import { invoke } from "@tauri-apps/api/core";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  account,
  accountType,
  institution,
  institutionApiConnection,
  transaction,
} from "./db/schema";
import { applyRules } from "./rules";
import { recalculateRunningBalance } from "./transactions";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ApiConnectionRow = {
  id: number;
  institutionId: number;
  institutionName: string;
  apiType: string;
  keychainKey: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiAccount = {
  external_id: string;
  name: string;
  currency: string;
  account_type_raw: string;
};

export type ApiTransaction = {
  external_id: string;
  date: string;
  amount: number;
  description: string;
};

export type SyncProgress = {
  connectionId: number;
  accountName: string;
  transactionsSynced: number;
  done: boolean;
  error?: string;
};

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/**
 * Store the PAT in the OS keychain and insert the institution_api_connection row.
 * Returns the new connection ID.
 */
export async function createApiConnection(
  institutionId: number,
  apiType: string,
  pat: string,
): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();

  const result = await invoke<{ keychain_key: string }>("create_api_connection", {
    input: { institution_id: institutionId, api_type: apiType, pat },
  });

  await db.insert(institutionApiConnection).values({
    institutionId,
    apiType,
    keychainKey: result.keychain_key,
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const [inserted] = await db
    .select({ id: institutionApiConnection.id })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.keychainKey, result.keychain_key));

  return inserted.id;
}

/**
 * Overwrite the PAT for an existing connection in the OS keychain.
 */
export async function updateApiConnectionPat(
  connectionId: number,
  newPat: string,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const [conn] = await db
    .select({ keychainKey: institutionApiConnection.keychainKey })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.id, connectionId));

  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  await invoke("update_api_connection_pat", {
    keychainKey: conn.keychainKey,
    newPat,
  });

  await db
    .update(institutionApiConnection)
    .set({ updatedAt: now })
    .where(eq(institutionApiConnection.id, connectionId));
}

/**
 * List all API connections with their institution name.
 */
export async function listApiConnections(): Promise<ApiConnectionRow[]> {
  const db = getDb();
  return db
    .select({
      id: institutionApiConnection.id,
      institutionId: institutionApiConnection.institutionId,
      institutionName: sql<string>`${institution.name}`.as("institutionName"),
      apiType: institutionApiConnection.apiType,
      keychainKey: institutionApiConnection.keychainKey,
      lastSyncedAt: institutionApiConnection.lastSyncedAt,
      createdAt: institutionApiConnection.createdAt,
      updatedAt: institutionApiConnection.updatedAt,
    })
    .from(institutionApiConnection)
    .leftJoin(institution, eq(institutionApiConnection.institutionId, institution.id))
    .orderBy(institutionApiConnection.id);
}

/**
 * Discover Starling accounts via the PAT stored for a given connection.
 */
export async function discoverStarlingAccounts(connectionId: number): Promise<ApiAccount[]> {
  const db = getDb();
  const [conn] = await db
    .select({ keychainKey: institutionApiConnection.keychainKey })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.id, connectionId));

  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  return invoke<ApiAccount[]>("discover_starling_accounts_by_key", {
    keychainKey: conn.keychainKey,
  });
}

/**
 * Create database account rows for the selected discovered accounts.
 * Each account is created with is_api_synced = 1.
 * Returns the new account IDs.
 */
export async function createSyncedAccounts(
  connectionId: number,
  selectedAccounts: ApiAccount[],
): Promise<number[]> {
  const db = getDb();
  const now = new Date().toISOString().split("T")[0]; // opening date = today

  const [conn] = await db
    .select({ institutionId: institutionApiConnection.institutionId })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.id, connectionId));

  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  // Look up account_type by name (Starling mapper returns the human-readable name)
  const accountTypeRows = await db.select().from(accountType);
  const typeMap = new Map(accountTypeRows.map((t) => [t.name, t.id]));

  const ids: number[] = [];

  for (const apiAcc of selectedAccounts) {
    const accountTypeId = typeMap.get(apiAcc.account_type_raw) ?? typeMap.get("Current")!;

    await db.insert(account).values({
      name: apiAcc.name,
      institutionId: conn.institutionId,
      accountTypeId,
      currency: apiAcc.currency,
      openingBalance: 0,
      openingDate: now,
      isApiSynced: 1,
    });

    const [inserted] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.name, apiAcc.name))
      .orderBy(sql`${account.id} desc`)
      .limit(1);

    if (inserted) ids.push(inserted.id);
  }

  return ids;
}

/**
 * Hard-delete a synced account and all its transactions.
 * This is the only hard-delete path in the app.
 */
export async function removeSyncedAccount(accountId: number): Promise<void> {
  const db = getDb();

  const [acc] = await db
    .select({ isApiSynced: account.isApiSynced })
    .from(account)
    .where(eq(account.id, accountId));

  if (!acc) throw new Error(`Account ${accountId} not found`);
  if (!acc.isApiSynced) throw new Error("Cannot hard-delete a non-API-synced account via this path");

  // Hard-delete all transactions for this account
  await db.delete(transaction).where(eq(transaction.accountId, accountId));

  // Hard-delete the account itself
  await db.delete(account).where(eq(account.id, accountId));
}

// ---------------------------------------------------------------------------
// Sync orchestration (tasks 4.1–4.8)
// ---------------------------------------------------------------------------

/**
 * Sync all Starling transactions for a given connection.
 *
 * For each API-synced account under this connection:
 * - Fetches transactions from last_synced_at (or 1 year ago for initial sync)
 * - Upserts by external_id (insert new; overwrite changed, preserving notes/category; skip unchanged)
 * - Runs the categorisation rules engine on newly inserted transactions
 * - Recalculates running balances
 * - Updates last_synced_at on success
 *
 * @param connectionId  ID of the institution_api_connection row.
 * @param onProgress    Optional callback for progress updates.
 */
export async function syncStarlingConnection(
  connectionId: number,
  onProgress?: (progress: SyncProgress) => void,
): Promise<void> {
  const db = getDb();

  const [conn] = await db
    .select({
      keychainKey: institutionApiConnection.keychainKey,
      lastSyncedAt: institutionApiConnection.lastSyncedAt,
      institutionId: institutionApiConnection.institutionId,
    })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.id, connectionId));

  if (!conn) throw new Error(`Connection ${connectionId} not found`);

  // Determine the fetch window
  const fromDate = conn.lastSyncedAt
    ? conn.lastSyncedAt.split("T")[0]
    : (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split("T")[0];
      })();

  // Retrieve the PAT once
  const pat = await invoke<string>("get_keychain_secret", { key: conn.keychainKey });

  // Find all API-synced accounts belonging to this institution
  const syncedAccounts = await db
    .select({ id: account.id, name: account.name })
    .from(account)
    .where(and(eq(account.institutionId, conn.institutionId), eq(account.isApiSynced, 1)));

  for (const acc of syncedAccounts) {
    try {
      const apiTransactions = await invoke<ApiTransaction[]>(
        "fetch_starling_transactions",
        { pat, accountExternalId: acc.id.toString(), fromDate },
      );

      let synced = 0;
      let earliestDate: string | null = null;
      const newIds: number[] = [];

      for (const apiTx of apiTransactions) {
        const [existing] = await db
          .select({
            id: transaction.id,
            date: transaction.date,
            amount: transaction.amount,
            payee: transaction.payee,
            notes: transaction.notes,
            categoryId: transaction.categoryId,
          })
          .from(transaction)
          .where(
            and(
              eq(transaction.accountId, acc.id),
              eq(transaction.externalId, apiTx.external_id),
            ),
          );

        if (!existing) {
          // Insert new transaction
          await db.insert(transaction).values({
            accountId: acc.id,
            amount: apiTx.amount,
            date: apiTx.date,
            payee: apiTx.description || null,
            type: "api_sync",
            externalId: apiTx.external_id,
            isVoid: 0,
            isDuplicateCandidate: 0,
            runningBalance: 0,
          });

          const [inserted] = await db
            .select({ id: transaction.id })
            .from(transaction)
            .where(
              and(
                eq(transaction.accountId, acc.id),
                eq(transaction.externalId, apiTx.external_id),
              ),
            );

          if (inserted) {
            newIds.push(inserted.id);
            if (!earliestDate || apiTx.date < earliestDate) earliestDate = apiTx.date;
          }
          synced++;
        } else {
          // Check if API data differs (Starling wins for API-provided fields)
          const amountDiffers = existing.amount !== apiTx.amount;
          const payeeDiffers = (existing.payee ?? "") !== (apiTx.description ?? "");
          const dateDiffers = existing.date !== apiTx.date;

          if (amountDiffers || payeeDiffers || dateDiffers) {
            await db
              .update(transaction)
              .set({
                amount: apiTx.amount,
                payee: apiTx.description || null,
                date: apiTx.date,
                // notes, categoryId preserved — user-defined
              })
              .where(eq(transaction.id, existing.id));

            if (!earliestDate || apiTx.date < earliestDate) earliestDate = apiTx.date;
            synced++;
          }
          // else: unchanged — skip
        }

        onProgress?.({ connectionId, accountName: acc.name, transactionsSynced: synced, done: false });
      }

      // Recalculate running balances from the earliest affected date
      if (earliestDate) {
        await recalculateRunningBalance(acc.id, earliestDate);
      }

      // Run categorisation rules on newly inserted transactions only
      if (newIds.length > 0) {
        await applyRules(newIds);
      }

      onProgress?.({ connectionId, accountName: acc.name, transactionsSynced: synced, done: true });
    } catch (err) {
      onProgress?.({
        connectionId,
        accountName: acc.name,
        transactionsSynced: 0,
        done: true,
        error: String(err),
      });
    }
  }

  // Update last_synced_at on success
  await db
    .update(institutionApiConnection)
    .set({ lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(institutionApiConnection.id, connectionId));
}

/**
 * Sync all connected institutions in parallel (for startup sync).
 */
export async function syncAllConnections(
  onProgress?: (progress: SyncProgress) => void,
): Promise<void> {
  const connections = await listApiConnections();
  await Promise.all(
    connections.map((conn) => syncStarlingConnection(conn.id, onProgress).catch(() => {})),
  );
}

// ---------------------------------------------------------------------------
// Guard: is CSV import blocked for this account?
// ---------------------------------------------------------------------------

/**
 * Returns true if the account's institution has an active API connection,
 * meaning CSV import should be blocked.
 */
export async function isApiConnectedInstitution(accountId: number): Promise<boolean> {
  const db = getDb();

  const [acc] = await db
    .select({ institutionId: account.institutionId })
    .from(account)
    .where(eq(account.id, accountId));

  if (!acc) return false;

  const connections = await db
    .select({ id: institutionApiConnection.id })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.institutionId, acc.institutionId))
    .limit(1);

  return connections.length > 0;
}
