import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  createApiConnection,
  createSyncedAccounts,
  removeSyncedAccount,
  isApiConnectedInstitution,
  syncStarlingConnection,
} from "@/lib/api-sync";
import { createTestDb } from "./db-helper";
import {
  account,
  accountType,
  institution,
  institutionApiConnection,
  transaction,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/rules", () => ({ applyRules: vi.fn().mockResolvedValue(0) }));
vi.mock("@/lib/transactions", () => ({
  recalculateRunningBalance: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

const mockGetDb = vi.mocked(dbModule.getDb);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedInstitution(db: ReturnType<typeof createTestDb>, name = "Starling Bank") {
  await db.insert(institution).values({ name });
  const [inst] = await db.select().from(institution);
  return inst;
}

async function seedConnection(
  db: ReturnType<typeof createTestDb>,
  institutionId: number,
) {
  const now = new Date().toISOString();
  await db.insert(institutionApiConnection).values({
    institutionId,
    apiType: "starling",
    keychainKey: "mymoney.starling.1",
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  const [conn] = await db.select().from(institutionApiConnection);
  return conn;
}

async function seedAccount(
  db: ReturnType<typeof createTestDb>,
  institutionId: number,
  opts: { isApiSynced?: number; name?: string } = {},
) {
  const [aType] = await db.select().from(accountType).where(eq(accountType.name, "Current"));
  await db.insert(account).values({
    name: opts.name ?? "Test Account",
    institutionId,
    accountTypeId: aType.id,
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2024-01-01",
    isApiSynced: opts.isApiSynced ?? 0,
  });
  const accounts = await db.select().from(account);
  return accounts[accounts.length - 1];
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetDb.mockReturnValue(createTestDb() as never);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createApiConnection tests (task 5.7)
// ---------------------------------------------------------------------------

describe("createApiConnection", () => {
  it("calls create_api_connection invoke and inserts DB row", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);

    mockInvoke.mockResolvedValueOnce({ keychain_key: "mymoney.starling.1" });

    const connectionId = await createApiConnection(inst.id, "starling", "my-pat");

    expect(mockInvoke).toHaveBeenCalledWith("create_api_connection", {
      input: { institution_id: inst.id, api_type: "starling", pat: "my-pat" },
    });

    const rows = await db.select().from(institutionApiConnection);
    expect(rows).toHaveLength(1);
    expect(rows[0].keychainKey).toBe("mymoney.starling.1");
    expect(rows[0].apiType).toBe("starling");
    expect(connectionId).toBeGreaterThan(0);
  });

  it("does not store PAT in the database", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    mockInvoke.mockResolvedValueOnce({ keychain_key: "mymoney.starling.1" });

    await createApiConnection(inst.id, "starling", "super-secret-pat");

    const rows = await db.select().from(institutionApiConnection);
    // PAT must not appear in any column
    const rowStr = JSON.stringify(rows[0]);
    expect(rowStr).not.toContain("super-secret-pat");
  });
});

// ---------------------------------------------------------------------------
// removeSyncedAccount tests (task 5.8)
// ---------------------------------------------------------------------------

describe("removeSyncedAccount", () => {
  it("hard-deletes account and all its transactions", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 1 });

    await db.insert(transaction).values([
      { accountId: acc.id, amount: -10, date: "2024-01-10", type: "api_sync", runningBalance: 0, isVoid: 0, isDuplicateCandidate: 0 },
      { accountId: acc.id, amount: -20, date: "2024-01-11", type: "api_sync", runningBalance: 0, isVoid: 0, isDuplicateCandidate: 0 },
    ]);

    await removeSyncedAccount(acc.id);

    const accounts = await db.select().from(account).where(eq(account.id, acc.id));
    expect(accounts).toHaveLength(0);

    const transactions = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(transactions).toHaveLength(0);
  });

  it("throws if account is not api-synced", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 0 });

    await expect(removeSyncedAccount(acc.id)).rejects.toThrow("non-API-synced");
  });
});

// ---------------------------------------------------------------------------
// isApiConnectedInstitution tests (task 5.9 guard)
// ---------------------------------------------------------------------------

describe("isApiConnectedInstitution", () => {
  it("returns true when institution has an API connection", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    await seedConnection(db, inst.id);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 1 });

    expect(await isApiConnectedInstitution(acc.id)).toBe(true);
  });

  it("returns false when institution has no API connection", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 0 });

    expect(await isApiConnectedInstitution(acc.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// syncStarlingConnection tests (tasks 4.10–4.12)
// ---------------------------------------------------------------------------

describe("syncStarlingConnection", () => {
  it("inserts new transactions from API", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const conn = await seedConnection(db, inst.id);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 1 });

    // get_keychain_secret returns PAT
    mockInvoke
      .mockResolvedValueOnce("test-pat") // get_keychain_secret
      .mockResolvedValueOnce([           // fetch_starling_transactions
        { external_id: "tx-001", date: "2024-01-15", amount: -12.50, description: "TESCO" },
        { external_id: "tx-002", date: "2024-01-16", amount: 500.00, description: "Salary" },
      ]);

    await syncStarlingConnection(conn.id);

    const txs = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(txs).toHaveLength(2);
    expect(txs.find((t) => t.externalId === "tx-001")?.amount).toBe(-12.50);
    expect(txs.find((t) => t.externalId === "tx-002")?.amount).toBe(500.00);
  });

  it("overwrites changed transactions (Starling wins)", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const conn = await seedConnection(db, inst.id);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 1 });

    // Seed an existing transaction with different amount
    await db.insert(transaction).values({
      accountId: acc.id,
      amount: -10.00,
      date: "2024-01-15",
      type: "api_sync",
      externalId: "tx-001",
      payee: "OLD PAYEE",
      notes: "user note",
      categoryId: null,
      runningBalance: 0,
      isVoid: 0,
      isDuplicateCandidate: 0,
    });

    mockInvoke
      .mockResolvedValueOnce("test-pat")
      .mockResolvedValueOnce([
        { external_id: "tx-001", date: "2024-01-15", amount: -12.50, description: "TESCO" },
      ]);

    await syncStarlingConnection(conn.id);

    const [updated] = await db.select().from(transaction).where(eq(transaction.externalId, "tx-001"));
    expect(updated.amount).toBe(-12.50);
    expect(updated.payee).toBe("TESCO");
  });

  it("preserves user-defined fields (notes, category) on overwrite", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const conn = await seedConnection(db, inst.id);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 1 });

    await db.insert(transaction).values({
      accountId: acc.id,
      amount: -10.00,
      date: "2024-01-15",
      type: "api_sync",
      externalId: "tx-001",
      payee: "OLD",
      notes: "user note preserved",
      categoryId: 1,
      runningBalance: 0,
      isVoid: 0,
      isDuplicateCandidate: 0,
    });

    mockInvoke
      .mockResolvedValueOnce("test-pat")
      .mockResolvedValueOnce([
        { external_id: "tx-001", date: "2024-01-15", amount: -15.00, description: "NEW" },
      ]);

    await syncStarlingConnection(conn.id);

    const [updated] = await db.select().from(transaction).where(eq(transaction.externalId, "tx-001"));
    // API field updated
    expect(updated.amount).toBe(-15.00);
    // User-defined fields preserved
    expect(updated.notes).toBe("user note preserved");
    expect(updated.categoryId).toBe(1);
  });

  it("skips unchanged transactions", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const conn = await seedConnection(db, inst.id);
    const acc = await seedAccount(db, inst.id, { isApiSynced: 1 });

    await db.insert(transaction).values({
      accountId: acc.id,
      amount: -12.50,
      date: "2024-01-15",
      type: "api_sync",
      externalId: "tx-001",
      payee: "TESCO",
      runningBalance: 0,
      isVoid: 0,
      isDuplicateCandidate: 0,
    });

    const updateSpy = vi.spyOn(db, "update");

    mockInvoke
      .mockResolvedValueOnce("test-pat")
      .mockResolvedValueOnce([
        { external_id: "tx-001", date: "2024-01-15", amount: -12.50, description: "TESCO" },
      ]);

    await syncStarlingConnection(conn.id);

    // No update calls for the transaction table (only for last_synced_at)
    const txUpdateCalls = updateSpy.mock.calls.filter(
      ([tbl]: [unknown]) => tbl === transaction,
    );
    expect(txUpdateCalls).toHaveLength(0);
  });

  it("updates last_synced_at after successful sync", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const conn = await seedConnection(db, inst.id);
    await seedAccount(db, inst.id, { isApiSynced: 1 });

    mockInvoke
      .mockResolvedValueOnce("test-pat")
      .mockResolvedValueOnce([]);

    await syncStarlingConnection(conn.id);

    const [updated] = await db
      .select({ lastSyncedAt: institutionApiConnection.lastSyncedAt })
      .from(institutionApiConnection)
      .where(eq(institutionApiConnection.id, conn.id));

    expect(updated.lastSyncedAt).not.toBeNull();
  });

  it("uses last_synced_at as from_date on subsequent syncs", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const now = new Date().toISOString();
    await db.insert(institutionApiConnection).values({
      institutionId: inst.id,
      apiType: "starling",
      keychainKey: "mymoney.starling.1",
      lastSyncedAt: "2024-06-01T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
    });
    const [conn] = await db.select().from(institutionApiConnection);
    await seedAccount(db, inst.id, { isApiSynced: 1 });

    mockInvoke
      .mockResolvedValueOnce("test-pat")
      .mockResolvedValueOnce([]);

    await syncStarlingConnection(conn.id);

    const fetchCall = mockInvoke.mock.calls.find(
      ([cmd]) => cmd === "fetch_starling_transactions",
    );
    expect(fetchCall?.[1]).toMatchObject({ fromDate: "2024-06-01" });
  });

  it("fetches 1 year back on initial sync (last_synced_at = null)", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as never);

    const inst = await seedInstitution(db);
    const conn = await seedConnection(db, inst.id); // lastSyncedAt = null
    await seedAccount(db, inst.id, { isApiSynced: 1 });

    mockInvoke
      .mockResolvedValueOnce("test-pat")
      .mockResolvedValueOnce([]);

    const beforeDate = new Date();
    beforeDate.setFullYear(beforeDate.getFullYear() - 1);
    const expectedFromDatePrefix = beforeDate.toISOString().split("T")[0].slice(0, 7); // YYYY-MM

    await syncStarlingConnection(conn.id);

    const fetchCall = mockInvoke.mock.calls.find(
      ([cmd]) => cmd === "fetch_starling_transactions",
    );
    expect(fetchCall?.[1].fromDate).toMatch(new RegExp(`^${expectedFromDatePrefix}`));
  });
});
