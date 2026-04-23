/**
 * CSV transaction import pipeline.
 *
 * Parses a CSV file using the institution's saved column mapping, runs
 * field-based duplicate detection, inserts new transactions, and invokes
 * categorisation and pot-allocation rule stubs.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import Papa from "papaparse";
import { getDb } from "./db";
import { account, institutionApiConnection, transaction } from "./db/schema";
import type { ImportResult } from "./import";
import { applyPotAllocationRules } from "./pot-allocation-engine";
import { applyRules } from "./rules";
import { recalculateRunningBalance } from "./transactions";
import { getInstitutionColumnMapping } from "./csv-column-mapping";

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

const MONTH_ABBR: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Converts a date string in one of the supported formats to ISO YYYY-MM-DD.
 * Returns null if parsing fails or the result is not a valid date.
 */
export function parseDateWithFormat(dateStr: string, format: string): string | null {
  const s = dateStr.trim();

  let year: string | undefined;
  let month: string | undefined;
  let day: string | undefined;

  if (format === "dd/MM/yyyy") {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    [, day, month, year] = m;
  } else if (format === "MM/dd/yyyy") {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    [, month, day, year] = m;
  } else if (format === "yyyy-MM-dd") {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    [, year, month, day] = m;
  } else if (format === "d/M/yyyy") {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    [, day, month, year] = m;
  } else if (format === "M/d/yyyy") {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    [, month, day, year] = m;
  } else if (format === "dd-MM-yyyy") {
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return null;
    [, day, month, year] = m;
  } else if (format === "dd MMM yyyy") {
    const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (!m) return null;
    day = m[1];
    const abbr = m[2].toLowerCase();
    month = MONTH_ABBR[abbr];
    if (!month) return null;
    year = m[3];
  } else if (format === "yyyy/MM/dd") {
    const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) return null;
    [, year, month, day] = m;
  } else {
    return null;
  }

  if (!year || !month || !day) return null;

  const y = parseInt(year, 10);
  const mo = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const iso = `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;

  // Validate via Date object (catches things like Feb 30)
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== mo ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }

  return iso;
}

// ---------------------------------------------------------------------------
// Duplicate detection helper
// ---------------------------------------------------------------------------

/**
 * Returns true if there is already a non-void, non-duplicate-candidate
 * transaction on this account with matching date, amount, and at least one
 * matching text field (notes, payee, or reference).
 */
async function isDuplicate(
  accountId: number,
  date: string,
  amount: number,
  notes: string | null,
  payee: string | null,
  reference: string | null,
): Promise<boolean> {
  const db = getDb();

  const baseConditions = [
    eq(transaction.accountId, accountId),
    eq(transaction.isVoid, 0),
    eq(transaction.isDuplicateCandidate, 0),
    eq(transaction.date, date),
    sql`${transaction.amount} = ${amount}`,
  ];

  // At least one text field must match (non-null on both sides)
  const textConditions = [];

  if (notes !== null) {
    textConditions.push(
      sql`${transaction.notes} IS NOT NULL AND lower(trim(${transaction.notes})) = lower(trim(${notes}))`,
    );
  }
  if (payee !== null) {
    textConditions.push(
      sql`${transaction.payee} IS NOT NULL AND lower(trim(${transaction.payee})) = lower(trim(${payee}))`,
    );
  }
  if (reference !== null) {
    textConditions.push(
      sql`${transaction.reference} IS NOT NULL AND lower(trim(${transaction.reference})) = lower(trim(${reference}))`,
    );
  }

  if (textConditions.length === 0) {
    // No text fields to compare — cannot confirm duplicate
    return false;
  }

  const orClause = sql.join(textConditions, sql` OR `);

  const rows = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(and(...baseConditions, sql`(${orClause})`))
    .limit(1);

  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import transactions from CSV file contents into the given account.
 *
 * @param accountId    Target account ID.
 * @param fileContents Raw text content of the .csv file.
 * @returns            Summary counts for the import result screen.
 * @throws             If no institution column mapping is found for the account's institution.
 */
export async function importCsvFile(
  accountId: number,
  fileContents: string,
): Promise<ImportResult> {
  const db = getDb();

  // Look up the account's institution ID and API sync status
  const [accountRow] = await db
    .select({ institutionId: account.institutionId, isApiSynced: account.isApiSynced })
    .from(account)
    .where(eq(account.id, accountId));

  if (!accountRow) {
    throw new Error(`Account ${accountId} not found`);
  }

  if (accountRow.isApiSynced === 1) {
    throw new Error(
      "CSV import is not available for API-connected accounts. Use the Settings page to re-sync.",
    );
  }

  // Also check the institution-level API connection
  const [apiConn] = await db
    .select({ id: institutionApiConnection.id })
    .from(institutionApiConnection)
    .where(eq(institutionApiConnection.institutionId, accountRow.institutionId));
  if (apiConn) {
    throw new Error(
      "CSV import is disabled for institutions connected via API. Use the Settings page to re-sync.",
    );
  }

  // Load the institution column mapping
  const mapping = await getInstitutionColumnMapping(accountRow.institutionId);
  if (!mapping) {
    throw new Error(
      `No column mapping found for institution ${accountRow.institutionId}. Please configure the CSV mapping before importing.`,
    );
  }

  // Parse the CSV
  const parsed = Papa.parse<string[]>(fileContents, { skipEmptyLines: true });
  const rows = parsed.data;

  // Skip header row if present
  const dataRows = mapping.hasHeaderRow ? rows.slice(1) : rows;

  const total = dataRows.length;
  let imported = 0;
  let duplicateCandidates = 0;
  let parseErrors = 0;

  let earliestImportedDate: string | null = null;
  const importedIds: number[] = [];

  for (const row of dataRows) {
    // Extract date
    const dateColIdx = mapping.columns.date;
    const rawDate = dateColIdx !== null ? (row[dateColIdx] ?? "").trim() : "";
    const isoDate = parseDateWithFormat(rawDate, mapping.dateFormat);
    if (!isoDate) {
      parseErrors++;
      continue;
    }

    // Extract and normalise amount
    let amount: number;
    if (mapping.amountConvention === "single") {
      const amountColIdx = mapping.columns.amount;
      const rawAmount = amountColIdx !== null ? (row[amountColIdx] ?? "").trim() : "";
      amount = parseFloat(rawAmount);
    } else {
      // split convention
      const creditColIdx = mapping.columns.credit;
      const debitColIdx = mapping.columns.debit;
      const rawCredit = creditColIdx !== null ? (row[creditColIdx] ?? "").trim() : "";
      const rawDebit = debitColIdx !== null ? (row[debitColIdx] ?? "").trim() : "";
      const credit = rawCredit === "" ? 0 : parseFloat(rawCredit);
      const debit = rawDebit === "" ? 0 : parseFloat(rawDebit);
      amount = credit - debit;
    }

    if (isNaN(amount)) {
      parseErrors++;
      continue;
    }

    // Extract optional text fields
    const payeeColIdx = mapping.columns.payee;
    const notesColIdx = mapping.columns.notes;
    const referenceColIdx = mapping.columns.reference;

    const payee =
      payeeColIdx !== null && row[payeeColIdx] !== undefined
        ? row[payeeColIdx].trim() || null
        : null;
    const notes =
      notesColIdx !== null && row[notesColIdx] !== undefined
        ? row[notesColIdx].trim() || null
        : null;
    const reference =
      referenceColIdx !== null && row[referenceColIdx] !== undefined
        ? row[referenceColIdx].trim() || null
        : null;

    // Duplicate detection
    const duplicate = await isDuplicate(accountId, isoDate, amount, notes, payee, reference);
    const isDupCandidate = duplicate ? 1 : 0;

    // Insert transaction
    await db.insert(transaction).values({
      accountId,
      amount,
      date: isoDate,
      payee,
      notes,
      reference,
      type: "imported",
      isVoid: 0,
      isDuplicateCandidate: isDupCandidate,
    });

    // Retrieve inserted ID
    const [lastRow] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(eq(transaction.accountId, accountId))
      .orderBy(desc(transaction.id))
      .limit(1);

    if (!lastRow) {
      throw new Error("Failed to determine inserted transaction id");
    }

    if (isDupCandidate) {
      duplicateCandidates++;
    } else {
      importedIds.push(lastRow.id);
      if (!earliestImportedDate || isoDate < earliestImportedDate) {
        earliestImportedDate = isoDate;
      }
      imported++;
    }
  }

  // Recalculate running balances (excludes duplicate candidates per updated logic)
  if (earliestImportedDate !== null) {
    await recalculateRunningBalance(accountId, earliestImportedDate);
  }

  // Apply categorisation rules to non-duplicate imported transactions
  const categorised = importedIds.length > 0 ? await applyRules(importedIds) : 0;
  const uncategorised = imported - categorised;

  // Apply pot allocation rules after categorisation
  const allocationResult =
    importedIds.length > 0
      ? await applyPotAllocationRules(accountId, importedIds)
      : { allocations: 0, failures: [] };

  return {
    total,
    imported,
    duplicateCandidates,
    categorised,
    uncategorised,
    potAllocations: allocationResult.allocations,
    allocationFailures: allocationResult.failures,
    parseErrors,
  };
}
