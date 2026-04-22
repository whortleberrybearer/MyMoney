import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { importCsvFile } from "@/lib/csv-import";
import { saveInstitutionColumnMapping } from "@/lib/csv-column-mapping";
import { createTestDb } from "./db-helper";
import { account, institution, transaction } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ColumnMapping } from "@/lib/csv-types";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

const mockGetDb = vi.mocked(dbModule.getDb);

const SINGLE_MAPPING: ColumnMapping = {
  columns: { date: 0, payee: 1, notes: null, amount: 2, debit: null, credit: null, balance: null, reference: null },
  amountConvention: "single",
  dateFormat: "dd/MM/yyyy",
  hasHeaderRow: true,
};

const SPLIT_MAPPING: ColumnMapping = {
  columns: { date: 0, payee: 1, notes: null, amount: null, debit: 2, credit: 3, balance: null, reference: null },
  amountConvention: "split",
  dateFormat: "dd/MM/yyyy",
  hasHeaderRow: true,
};

async function seedAccountAndMapping(db: ReturnType<typeof createTestDb>, mapping: ColumnMapping) {
  await db.insert(institution).values({ name: "Test Bank" });
  const [inst] = await db.select().from(institution);
  await db.insert(account).values({
    name: "Test Account",
    institutionId: inst.id,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2024-01-01",
  });
  const [acc] = await db.select().from(account);
  await saveInstitutionColumnMapping(inst.id, mapping);
  return acc;
}

function makeCsv(rows: string[][]): string {
  return rows.map(r => r.join(",")).join("\n");
}

beforeEach(() => {
  mockGetDb.mockReturnValue(createTestDb() as any);
});

describe("importCsvFile — single amount convention", () => {
  it("imports transactions with correct field mapping", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SINGLE_MAPPING);
    const csv = makeCsv([
      ["Date", "Payee", "Amount"],
      ["15/03/2024", "TESCO STORES", "-12.50"],
    ]);
    const result = await importCsvFile(acc.id, csv);
    expect(result.imported).toBe(1);
    expect(result.total).toBe(1);
    const txs = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(txs[0].date).toBe("2024-03-15");
    expect(txs[0].payee).toBe("TESCO STORES");
    expect(txs[0].amount).toBeCloseTo(-12.50);
  });

  it("skips header row when hasHeaderRow is true", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SINGLE_MAPPING);
    const csv = makeCsv([
      ["Date", "Payee", "Amount"],
      ["15/03/2024", "TESCO", "-12.50"],
      ["16/03/2024", "SAINSBURY", "-8.00"],
    ]);
    const result = await importCsvFile(acc.id, csv);
    expect(result.imported).toBe(2);
  });

  it("includes header row when hasHeaderRow is false", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const noHeaderMapping: ColumnMapping = { ...SINGLE_MAPPING, hasHeaderRow: false };
    const acc = await seedAccountAndMapping(db, noHeaderMapping);
    const csv = makeCsv([
      ["15/03/2024", "TESCO", "-12.50"],
    ]);
    const result = await importCsvFile(acc.id, csv);
    expect(result.imported).toBe(1);
  });
});

describe("importCsvFile — split amount convention", () => {
  it("computes amount as credit minus debit (debit-only row)", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SPLIT_MAPPING);
    const csv = makeCsv([
      ["Date", "Payee", "Debit", "Credit"],
      ["15/03/2024", "TESCO", "12.50", ""],
    ]);
    await importCsvFile(acc.id, csv);
    const [tx] = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(tx.amount).toBeCloseTo(-12.50);
  });

  it("computes amount as credit minus debit (credit-only row)", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SPLIT_MAPPING);
    const csv = makeCsv([
      ["Date", "Payee", "Debit", "Credit"],
      ["15/03/2024", "SALARY", "", "2500.00"],
    ]);
    await importCsvFile(acc.id, csv);
    const [tx] = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(tx.amount).toBeCloseTo(2500.00);
  });
});

describe("importCsvFile — parse errors", () => {
  it("counts rows with unparseable dates as parseErrors", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SINGLE_MAPPING);
    const csv = makeCsv([
      ["Date", "Payee", "Amount"],
      ["NOT-A-DATE", "TESCO", "-12.50"],
      ["16/03/2024", "SAINSBURY", "-8.00"],
    ]);
    const result = await importCsvFile(acc.id, csv);
    expect(result.parseErrors).toBe(1);
    expect(result.imported).toBe(1);
  });
});

describe("importCsvFile — duplicate detection", () => {
  it("flags as duplicate when date+amount+notes all match", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const notesMapping: ColumnMapping = {
      columns: { date: 0, payee: null, notes: 1, amount: 2, debit: null, credit: null, balance: null, reference: null },
      amountConvention: "single",
      dateFormat: "dd/MM/yyyy",
      hasHeaderRow: true,
    };
    const acc = await seedAccountAndMapping(db, notesMapping);
    const csv = makeCsv([
      ["Date", "Notes", "Amount"],
      ["15/03/2024", "coffee", "-12.50"],
    ]);
    // Import once
    await importCsvFile(acc.id, csv);
    // Import again — same row should be duplicate
    const result2 = await importCsvFile(acc.id, csv);
    expect(result2.duplicateCandidates).toBe(1);
    expect(result2.imported).toBe(0);
  });

  it("flags as duplicate when date+amount+payee match (case-insensitive)", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SINGLE_MAPPING);
    const csv1 = makeCsv([["Date","Payee","Amount"],["15/03/2024","TESCO STORES","-12.50"]]);
    const csv2 = makeCsv([["Date","Payee","Amount"],["15/03/2024","tesco stores","-12.50"]]);
    await importCsvFile(acc.id, csv1);
    const result = await importCsvFile(acc.id, csv2);
    expect(result.duplicateCandidates).toBe(1);
  });

  it("does NOT flag as duplicate when date+amount match but no secondary field", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const nullMapping: ColumnMapping = {
      columns: { date: 0, payee: null, notes: null, amount: 1, debit: null, credit: null, balance: null, reference: null },
      amountConvention: "single",
      dateFormat: "dd/MM/yyyy",
      hasHeaderRow: true,
    };
    const acc = await seedAccountAndMapping(db, nullMapping);
    const csv = makeCsv([["Date","Amount"],["15/03/2024","-12.50"]]);
    await importCsvFile(acc.id, csv);
    const result = await importCsvFile(acc.id, csv);
    // Should NOT be duplicate since no secondary field matches (all null)
    expect(result.duplicateCandidates).toBe(0);
  });

  it("does NOT flag as duplicate when amount differs", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SINGLE_MAPPING);
    const csv1 = makeCsv([["Date","Payee","Amount"],["15/03/2024","TESCO","-12.50"]]);
    const csv2 = makeCsv([["Date","Payee","Amount"],["15/03/2024","TESCO","-13.00"]]);
    await importCsvFile(acc.id, csv1);
    const result = await importCsvFile(acc.id, csv2);
    expect(result.duplicateCandidates).toBe(0);
  });
});

describe("importCsvFile — no mapping", () => {
  it("throws error when no mapping exists for institution", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    await db.insert(institution).values({ name: "Test Bank" });
    const [inst] = await db.select().from(institution);
    await db.insert(account).values({
      name: "Test Account", institutionId: inst.id, accountTypeId: 1,
      currency: "GBP", openingBalance: 0, openingDate: "2024-01-01",
    });
    const [acc] = await db.select().from(account);
    await expect(importCsvFile(acc.id, "col1,col2\nval1,val2")).rejects.toThrow();
  });
});

describe("importCsvFile — running balance excludes duplicate candidates", () => {
  it("duplicate candidate transactions do not affect running balance chain", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccountAndMapping(db, SINGLE_MAPPING);
    const csv = makeCsv([
      ["Date","Payee","Amount"],
      ["15/03/2024","TESCO","-12.50"],
    ]);
    await importCsvFile(acc.id, csv);
    // Import same row again — it becomes a duplicate candidate
    await importCsvFile(acc.id, csv);
    const txs = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    const regular = txs.filter(t => t.isDuplicateCandidate === 0);
    const dupes = txs.filter(t => t.isDuplicateCandidate === 1);
    expect(regular).toHaveLength(1);
    expect(dupes).toHaveLength(1);
    // Running balance of duplicate candidate should be 0 (not included)
    expect(dupes[0].runningBalance).toBe(0);
  });
});
