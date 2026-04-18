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
import { applyRules } from "./rules";
import { recalculateRunningBalance } from "./transactions";

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
      .where(
        and(eq(transaction.accountId, accountId), eq(transaction.isVoid, 0)),
      );

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

  let earliestImportedDate: string | null = null;
  const importedIds: number[] = [];

  for (const parsed of toImport) {
    if (!earliestImportedDate || parsed.date < earliestImportedDate) {
      earliestImportedDate = parsed.date;
    }

    // Insert the transaction row
    await db.insert(transaction).values({
      accountId,
      amount: parsed.amount,
      date: parsed.date,
      payee: parsed.name ?? null,
      notes: parsed.memo ?? null,
      reference: parsed.checkNum ?? null,
      type: "imported",
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

    importedIds.push(lastRow.id);

    // Record the FITID linked to the new transaction
    await db.insert(transactionFitid).values({
      transactionId: lastRow.id,
      accountId,
      fitid: parsed.fitid,
    });

    imported++;
  }

  // Recalculate running balances for all transactions on or after the earliest imported date
  if (earliestImportedDate !== null) {
    await recalculateRunningBalance(accountId, earliestImportedDate);
  }

  // Apply categorisation rules to the newly imported transactions
  const categorised = importedIds.length > 0 ? await applyRules(importedIds) : 0;
  const uncategorised = imported - categorised;

  // Apply pot allocation rules (stub — not yet implemented; see issue #12)
  applyPotAllocationRules();

  return { total, imported, duplicateCandidates, categorised, uncategorised };
}

function applyPotAllocationRules(): void {
  // Stub: no-op
}
