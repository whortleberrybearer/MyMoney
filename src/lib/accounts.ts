import { and, asc, desc, eq, sql, sum } from "drizzle-orm";
import { getDb } from "./db";
import {
  account,
  accountTag,
  accountType,
  institution,
  pot,
  potTag,
  tag,
  transaction,
} from "./db/schema";
import type { PotRow } from "./pots";

export type AccountRow = {
  id: number;
  name: string;
  institutionId: number;
  institutionName: string;
  accountTypeId: number;
  accountTypeName: string;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  openingDate: string;
  notes: string | null;
  isActive: number;
  tagId: number | null;
  tagName: string | null;
  pots?: PotRow[];
};

export type CreateAccountInput = {
  name: string;
  institutionId: number;
  accountTypeId: number;
  currency: string;
  openingBalance: number;
  openingDate: string;
  notes?: string;
  tagId?: number;
};

export type UpdateAccountInput = CreateAccountInput & { id: number };

/**
 * Lists accounts filtered by active state and optionally by tag.
 *
 * @param showInactive - When false, only accounts with is_active=1 are returned.
 * @param tagId - When provided, only accounts linked to this tag via account_tag are returned.
 *                When null/undefined, all accounts are returned regardless of tag.
 */
export async function listAccounts(
  showInactive: boolean,
  tagId?: number | null,
): Promise<AccountRow[]> {
  const db = getDb();
  // Explicit SQL aliases are required for every column whose raw SQL name would
  // collide with another column in the result set.  The Tauri SQL plugin returns
  // rows as IndexMap<String, Value>, which collapses duplicate column names (last
  // value wins).  Without aliases, "name" and "id" each appear multiple times
  // (from account, institution, account_type, and tag), causing wrong values to
  // be passed to Drizzle's index-based mapResultRow.
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      institutionId: account.institutionId,
      institutionName: sql<string>`${institution.name}`.as("institutionName"),
      accountTypeId: account.accountTypeId,
      accountTypeName: sql<string>`${accountType.name}`.as("accountTypeName"),
      currency: account.currency,
      openingBalance: account.openingBalance,
      openingDate: account.openingDate,
      notes: account.notes,
      isActive: account.isActive,
      tagId: sql<number | null>`${tag.id}`.as("tagId"),
      tagName: sql<string | null>`${tag.name}`.as("tagName"),
    })
    .from(account)
    .leftJoin(institution, eq(account.institutionId, institution.id))
    .leftJoin(accountType, eq(account.accountTypeId, accountType.id))
    .leftJoin(accountTag, eq(account.id, accountTag.accountId))
    .leftJoin(tag, eq(accountTag.tagId, tag.id))
    .where(
      and(
        eq(account.isDeleted, 0),
        showInactive ? undefined : eq(account.isActive, 1),
        tagId != null ? eq(accountTag.tagId, tagId) : undefined,
      ),
    )
    .orderBy(asc(institution.name), asc(account.name));

  return rows.map((r) => ({ ...r, currentBalance: r.openingBalance }));
}

export async function createAccount(input: CreateAccountInput): Promise<void> {
  const db = getDb();
  const trimmedName = input.name.trim();

  const existing = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        sql`lower(${account.name}) = lower(${trimmedName})`,
        eq(account.isDeleted, 0),
      ),
    );
  if (existing.length > 0) {
    throw new Error("An account with this name already exists");
  }

  await db.insert(account).values({
    name: trimmedName,
    institutionId: input.institutionId,
    accountTypeId: input.accountTypeId,
    currency: input.currency,
    openingBalance: input.openingBalance,
    openingDate: input.openingDate,
    notes: input.notes ?? null,
  });

  if (input.tagId !== undefined) {
    const inserted = await db
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          sql`lower(${account.name}) = lower(${trimmedName})`,
          eq(account.isDeleted, 0),
        ),
      )
      .orderBy(desc(account.id))
      .limit(1);
    if (inserted[0]) {
      await db
        .insert(accountTag)
        .values({ accountId: inserted[0].id, tagId: input.tagId });
    }
  }
}

export async function updateAccount(input: UpdateAccountInput): Promise<void> {
  const db = getDb();
  const trimmedName = input.name.trim();

  const existing = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        sql`lower(${account.name}) = lower(${trimmedName})`,
        eq(account.isDeleted, 0),
        sql`${account.id} != ${input.id}`,
      ),
    );
  if (existing.length > 0) {
    throw new Error("An account with this name already exists");
  }

  await db
    .update(account)
    .set({
      name: trimmedName,
      institutionId: input.institutionId,
      accountTypeId: input.accountTypeId,
      currency: input.currency,
      openingBalance: input.openingBalance,
      openingDate: input.openingDate,
      notes: input.notes ?? null,
    })
    .where(eq(account.id, input.id));

  await db.delete(accountTag).where(eq(accountTag.accountId, input.id));
  if (input.tagId !== undefined) {
    await db
      .insert(accountTag)
      .values({ accountId: input.id, tagId: input.tagId });
  }
}

export async function setAccountActive(
  accountId: number,
  isActive: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(account)
    .set({ isActive: isActive ? 1 : 0 })
    .where(eq(account.id, accountId));
}

export async function deleteAccount(accountId: number): Promise<void> {
  const db = getDb();
  await db.delete(accountTag).where(eq(accountTag.accountId, accountId));
  await db
    .update(account)
    .set({ isDeleted: 1 })
    .where(eq(account.id, accountId));
}

/**
 * Lists accounts with their associated pots (including calculated balances).
 * Used by the AccountsScreen to render pot child rows.
 *
 * @param showInactive - When false, only active accounts are returned.
 * @param tagId - When provided, filters accounts by tag.
 * @param showClosedPots - When true, includes closed pots under each account.
 */
export async function listAccountsWithPots(
  showInactive: boolean,
  tagId?: number | null,
  showClosedPots = false,
): Promise<AccountRow[]> {
  const db = getDb();

  const accounts = await listAccounts(showInactive, tagId);

  // For each account fetch its pots with balances
  const results: AccountRow[] = [];
  for (const acc of accounts) {
    const potRows = await db
      .select({
        id: pot.id,
        accountId: pot.accountId,
        name: pot.name,
        openingBalance: pot.openingBalance,
        openingDate: pot.openingDate,
        isActive: pot.isActive,
        notes: pot.notes,
        tagId: sql<number | null>`${tag.id}`.as("potTagId"),
        tagName: sql<string | null>`${tag.name}`.as("potTagName"),
      })
      .from(pot)
      .leftJoin(potTag, eq(pot.id, potTag.potId))
      .leftJoin(tag, eq(potTag.tagId, tag.id))
      .where(
        and(
          eq(pot.accountId, acc.id),
          showClosedPots ? undefined : eq(pot.isActive, 1),
        ),
      )
      .orderBy(asc(pot.name));

    const potsWithBalances: PotRow[] = [];
    for (const p of potRows) {
      const [balanceRow] = await db
        .select({ total: sum(transaction.amount) })
        .from(transaction)
        .where(and(eq(transaction.potId, p.id), eq(transaction.isVoid, 0)));
      potsWithBalances.push({
        ...(p as Omit<PotRow, "currentBalance">),
        currentBalance: p.openingBalance + Number(balanceRow?.total ?? 0),
      });
    }

    // Calculate the account's own current balance from account-side transactions
    const [accTxTotal] = await db
      .select({ total: sum(transaction.amount) })
      .from(transaction)
      .where(and(eq(transaction.accountId, acc.id), eq(transaction.isVoid, 0)));
    const currentBalance =
      acc.openingBalance + Number(accTxTotal?.total ?? 0);

    results.push({ ...acc, currentBalance, pots: potsWithBalances });
  }

  return results;
}
