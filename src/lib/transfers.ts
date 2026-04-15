import { eq, max } from "drizzle-orm";
import { getDb } from "./db";
import { transaction } from "./db/schema";

export type TransferDirection = "into_pot" | "out_of_pot";

export type CreatePotTransferInput = {
  potId: number;
  accountId: number;
  amount: number;
  date: string;
  direction: TransferDirection;
  notes?: string;
};

/**
 * Creates a virtual transfer pair between a pot and its parent account.
 *
 * A transfer pair is two transaction rows sharing a transfer_id:
 *   - "into pot":  debit on account (-amount), credit on pot (+amount)
 *   - "out of pot": debit on pot (-amount), credit on account (+amount)
 */
export async function createPotTransfer(
  input: CreatePotTransferInput,
): Promise<void> {
  if (input.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero");
  }
  if (!input.date) {
    throw new Error("Transfer date is required");
  }

  const db = getDb();

  // Derive next transfer_id (max existing + 1, or 1 if none)
  const [maxRow] = await db
    .select({ maxId: max(transaction.transferId) })
    .from(transaction);
  const transferId = (maxRow?.maxId ?? 0) + 1;

  const accountAmount =
    input.direction === "into_pot" ? -input.amount : input.amount;
  const potAmount =
    input.direction === "into_pot" ? input.amount : -input.amount;

  await db.insert(transaction).values([
    {
      accountId: input.accountId,
      potId: null,
      transferId,
      amount: accountAmount,
      date: input.date,
      notes: input.notes ?? null,
      type: "virtual_transfer",
      isVoid: 0,
    },
    {
      accountId: null,
      potId: input.potId,
      transferId,
      amount: potAmount,
      date: input.date,
      notes: input.notes ?? null,
      type: "virtual_transfer",
      isVoid: 0,
    },
  ]);
}

/**
 * Returns the account-side balance for a given account, calculated as
 * opening_balance + SUM(transaction.amount WHERE account_id = accountId AND is_void = 0).
 * Used to display the account's own balance excluding pot balances.
 */
export async function getAccountTransactionSum(
  accountId: number,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ amount: transaction.amount })
    .from(transaction)
    .where(eq(transaction.accountId, accountId));

  return rows
    .filter((r) => r.amount !== null)
    .reduce((acc, r) => acc + r.amount, 0);
}
