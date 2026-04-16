/**
 * Transaction data layer.
 *
 * All business logic for listing, creating, updating, and hard-deleting
 * transactions lives here. Running balance is recalculated synchronously
 * after any mutation.
 *
 * Conventions:
 * - Amounts: signed real (positive = credit, negative = debit)
 * - Dates: ISO text strings (YYYY-MM-DD)
 * - Deletion: hard-delete (no soft-delete / is_void for manual transactions)
 * - Running balance: stored per row, recalculated after every mutation
 */

import { and, asc, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import { getDb } from "./db";
import { account, category, transaction } from "./db/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TransactionRow = {
  id: number;
  accountId: number | null;
  potId: number | null;
  transferId: number | null;
  date: string;
  payee: string | null;
  notes: string | null;
  reference: string | null;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  runningBalance: number;
  type: string;
  isVoid: number;
};

export type TransactionSort = "date-desc" | "date-asc" | "amount-asc" | "amount-desc";

export type TransactionFilters = {
  fromDate?: string;
  toDate?: string;
  categoryId?: number;
  type?: string;
  reference?: string;
  payee?: string;
};

export type CreateTransactionInput = {
  date: string;
  amount: number;
  payee?: string;
  notes?: string;
  reference?: string;
  categoryId?: number;
};

export type UpdateTransactionInput = {
  id: number;
  date?: string;
  amount?: number;
  payee?: string | null;
  notes?: string | null;
  reference?: string | null;
  categoryId?: number | null;
};

// ---------------------------------------------------------------------------
// listTransactions
// ---------------------------------------------------------------------------

/**
 * Returns all non-void account-side transactions for an account, with
 * optional filtering and sorting.
 *
 * Only account-side rows are returned (account_id = accountId).
 * Pot-side legs (pot_id IS NOT NULL) are excluded.
 */
export async function listTransactions(
  accountId: number,
  filters: TransactionFilters = {},
  sort: TransactionSort = "date-desc",
): Promise<TransactionRow[]> {
  const db = getDb();

  const conditions = [
    eq(transaction.accountId, accountId),
    eq(transaction.isVoid, 0),
  ];

  if (filters.fromDate) {
    conditions.push(gte(transaction.date, filters.fromDate));
  }
  if (filters.toDate) {
    conditions.push(lte(transaction.date, filters.toDate));
  }
  if (filters.categoryId !== undefined) {
    conditions.push(eq(transaction.categoryId, filters.categoryId));
  }
  if (filters.type) {
    conditions.push(eq(transaction.type, filters.type));
  }
  if (filters.reference) {
    conditions.push(
      sql`lower(${transaction.reference}) LIKE lower(${"%" + filters.reference + "%"})`,
    );
  }
  if (filters.payee) {
    conditions.push(
      sql`lower(${transaction.payee}) LIKE lower(${"%" + filters.payee + "%"})`,
    );
  }

  let orderBy;
  switch (sort) {
    case "date-asc":
      orderBy = [asc(transaction.date), asc(transaction.id)];
      break;
    case "amount-asc":
      orderBy = [asc(transaction.amount), asc(transaction.id)];
      break;
    case "amount-desc":
      orderBy = [desc(transaction.amount), asc(transaction.id)];
      break;
    case "date-desc":
    default:
      orderBy = [desc(transaction.date), asc(transaction.id)];
      break;
  }

  const rows = await db
    .select({
      id: transaction.id,
      accountId: transaction.accountId,
      potId: transaction.potId,
      transferId: transaction.transferId,
      date: transaction.date,
      payee: transaction.payee,
      notes: transaction.notes,
      reference: transaction.reference,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      categoryName: sql<string | null>`${category.name}`.as("categoryName"),
      runningBalance: transaction.runningBalance,
      type: transaction.type,
      isVoid: transaction.isVoid,
    })
    .from(transaction)
    .leftJoin(category, eq(transaction.categoryId, category.id))
    .where(and(...conditions))
    .orderBy(...orderBy);

  return rows;
}

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

/**
 * Creates a manual transaction for the given account and recalculates
 * running balances for all transactions on or after the new date.
 *
 * @throws If date or amount are missing/invalid.
 */
export async function createTransaction(
  accountId: number,
  input: CreateTransactionInput,
): Promise<void> {
  if (!input.date) throw new Error("Date is required");
  if (input.amount === undefined || input.amount === null || isNaN(input.amount)) {
    throw new Error("Amount is required");
  }

  const db = getDb();

  await db.insert(transaction).values({
    accountId,
    date: input.date,
    amount: input.amount,
    payee: input.payee ?? null,
    notes: input.notes ?? null,
    reference: input.reference ?? null,
    categoryId: input.categoryId ?? null,
    runningBalance: 0, // will be recalculated below
    type: "manual",
    isVoid: 0,
  });

  await recalculateRunningBalance(accountId, input.date);
}

// ---------------------------------------------------------------------------
// updateTransaction
// ---------------------------------------------------------------------------

/**
 * Updates editable fields on a transaction. Recalculates running balance
 * if date or amount changed (from the earlier of the old/new dates).
 */
export async function updateTransaction(input: UpdateTransactionInput): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({
      id: transaction.id,
      accountId: transaction.accountId,
      date: transaction.date,
      amount: transaction.amount,
    })
    .from(transaction)
    .where(eq(transaction.id, input.id));

  if (!existing || existing.accountId === null) {
    throw new Error(`Transaction ${input.id} not found`);
  }

  const dateChanged = input.date !== undefined && input.date !== existing.date;
  const amountChanged = input.amount !== undefined && input.amount !== existing.amount;

  const updateValues: Partial<typeof transaction.$inferInsert> = {};
  if (input.date !== undefined) updateValues.date = input.date;
  if (input.amount !== undefined) updateValues.amount = input.amount;
  if ("payee" in input) updateValues.payee = input.payee;
  if ("notes" in input) updateValues.notes = input.notes;
  if ("reference" in input) updateValues.reference = input.reference;
  if ("categoryId" in input) updateValues.categoryId = input.categoryId;

  await db.update(transaction).set(updateValues).where(eq(transaction.id, input.id));

  if (dateChanged || amountChanged) {
    // Recalculate from the earlier of old/new date
    const fromDate =
      dateChanged && input.date! < existing.date ? input.date! : existing.date;
    await recalculateRunningBalance(existing.accountId, fromDate);
  }
}

// ---------------------------------------------------------------------------
// deleteTransaction
// ---------------------------------------------------------------------------

/**
 * Hard-deletes a transaction and recalculates running balance for all
 * subsequent transactions on the same account.
 */
export async function deleteTransaction(transactionId: number): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: transaction.id, accountId: transaction.accountId, date: transaction.date })
    .from(transaction)
    .where(eq(transaction.id, transactionId));

  if (!existing || existing.accountId === null) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  const { accountId, date } = existing;

  await db.delete(transaction).where(eq(transaction.id, transactionId));

  await recalculateRunningBalance(accountId, date);
}

// ---------------------------------------------------------------------------
// recalculateRunningBalance (internal)
// ---------------------------------------------------------------------------

/**
 * Recalculates `running_balance` for all non-void transactions on the
 * account with date >= fromDate, ordered by date ASC then id ASC.
 *
 * The starting balance is: account.opening_balance + SUM(amount) for all
 * non-void rows with date < fromDate.
 */
export async function recalculateRunningBalance(
  accountId: number,
  fromDate: string,
): Promise<void> {
  const db = getDb();

  // Fetch account opening balance
  const [accountRow] = await db
    .select({ openingBalance: account.openingBalance })
    .from(account)
    .where(eq(account.id, accountId));

  if (!accountRow) throw new Error(`Account ${accountId} not found`);

  // Sum of all non-void transactions strictly before fromDate
  const [priorTotal] = await db
    .select({ total: sum(transaction.amount) })
    .from(transaction)
    .where(
      and(
        eq(transaction.accountId, accountId),
        eq(transaction.isVoid, 0),
        sql`${transaction.date} < ${fromDate}`,
      ),
    );

  let running = accountRow.openingBalance + Number(priorTotal?.total ?? 0);

  // Fetch all rows from fromDate onwards ordered by date ASC, id ASC
  const toUpdate = await db
    .select({ id: transaction.id, amount: transaction.amount })
    .from(transaction)
    .where(
      and(
        eq(transaction.accountId, accountId),
        eq(transaction.isVoid, 0),
        gte(transaction.date, fromDate),
      ),
    )
    .orderBy(asc(transaction.date), asc(transaction.id));

  for (const row of toUpdate) {
    running += row.amount;
    await db
      .update(transaction)
      .set({ runningBalance: running })
      .where(eq(transaction.id, row.id));
  }
}
