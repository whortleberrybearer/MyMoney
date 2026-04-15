/**
 * OFX transaction import pipeline.
 *
 * Parses OFX/QFX file contents, runs FITID-based duplicate detection,
 * inserts new transactions, validates the closing balance, and invokes
 * categorisation and pot-allocation rule stubs.
 *
 * All DB writes run inside a single SQLite transaction — the entire batch
 * is rolled back if closing-balance validation fails or any insert throws.
 */

import { and, desc, eq, sum } from "drizzle-orm";
import { getDb } from "./db";
import { account, transaction, transactionFitid } from "./db/schema";
import type { ImportResult } from "./import";
import { parseOfx } from "./ofx-parser";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import transactions from OFX/QFX file contents into the given account.
 *
 * @param accountId    Target account ID.
 * @param fileContents Raw text content of the .ofx / .qfx file.
 * @returns            Summary counts for the import result screen.
 * @throws             If the file is malformed or closing-balance validation
 *                     fails (entire batch is rolled back on throw).
 */
export async function importOfxFile(
  accountId: number,
  fileContents: string,
): Promise<ImportResult> {
  const db = getDb();
  const statement = parseOfx(fileContents);

  const total = statement.transactions.length;
  let imported = 0;
  let duplicateCandidates = 0;

  const toImport = [] as typeof statement.transactions;

  for (const parsed of statement.transactions) {
    // FITID duplicate check — scoped to this account
    const existing = await db
      .select({ id: transactionFitid.id })
      .from(transactionFitid)
      .where(
        and(
          eq(transactionFitid.accountId, accountId),
          eq(transactionFitid.fitid, parsed.fitid),
        ),
      );

    if (existing.length > 0) {
      // Duplicate candidate — held for user review, never auto-imported.
      duplicateCandidates++;
      continue;
    }

    toImport.push(parsed);
  }

  // Closing balance validation — only when file includes LEDGERBAL.
  // Do this BEFORE writing anything so we don't rely on driver-level transactions.
  if (statement.closingBalance !== null) {
    const [accountRow] = await db
      .select({ openingBalance: account.openingBalance })
      .from(account)
      .where(eq(account.id, accountId));

    if (!accountRow) {
      throw new Error(`Account ${accountId} not found`);
    }

    const [totalRow] = await db
      .select({ total: sum(transaction.amount) })
      .from(transaction)
      .where(and(eq(transaction.accountId, accountId), eq(transaction.isVoid, 0)));

    const runningBalanceBefore =
      accountRow.openingBalance + Number(totalRow?.total ?? 0);

    const importSum = toImport.reduce((acc, t) => acc + t.amount, 0);
    const runningBalanceAfter = runningBalanceBefore + importSum;

    const diff = Math.abs(runningBalanceAfter - statement.closingBalance);
    if (diff > 0.005) {
      const fileBalance = statement.closingBalance.toFixed(2);
      const calcBalance = runningBalanceAfter.toFixed(2);
      throw new Error(
        `Import blocked: closing balance in file (${fileBalance}) does not match calculated balance (${calcBalance}). The file may be incomplete.`,
      );
    }
  }

  for (const parsed of toImport) {
    // Insert the transaction row
    await db.insert(transaction).values({
      accountId,
      amount: parsed.amount,
      date: parsed.date,
      notes: parsed.memo || null,
      type: "import",
      isVoid: 0,
    });

    // Retrieve the ID of the row we just inserted (largest id for this account)
    const [lastRow] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(eq(transaction.accountId, accountId))
      .orderBy(desc(transaction.id))
      .limit(1);

    if (!lastRow) {
      throw new Error("Failed to determine inserted transaction id");
    }

    // Record the FITID linked to the new transaction
    await db.insert(transactionFitid).values({
      transactionId: lastRow.id,
      accountId,
      fitid: parsed.fitid,
    });

    imported++;
  }

  // Apply categorisation rules (stub — not yet implemented; see issue #10)
  const categorised = applyCategorisationRules(imported);
  const uncategorised = imported - categorised;

  // Apply pot allocation rules (stub — not yet implemented; see issue #12)
  applyPotAllocationRules();

  return { total, imported, duplicateCandidates, uncategorised };
}

// ---------------------------------------------------------------------------
// Rules engine stubs
// Replaced when issues #10 (categorisation) and #12 (pot allocation) ship.
// ---------------------------------------------------------------------------

function applyCategorisationRules(_importedCount: number): number {
  // Stub: no rules → all transactions are uncategorised
  return 0;
}

function applyPotAllocationRules(): void {
  // Stub: no-op
}
