import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { importOfxFile } from "@/lib/ofx-import";
import { createTestDb } from "./db-helper";
import { account, institution, transaction, transactionFitid } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOfxFile(
  transactions: Array<{
    fitid: string;
    dtposted: string;
    trnamt: string;
    name: string;
    trntype?: string;
  }>,
  ledgerbal?: string,
): string {
  const txBlocks = transactions
    .map(
      (t) => `<STMTTRN>
<TRNTYPE>${t.trntype ?? "DEBIT"}
<DTPOSTED>${t.dtposted}
<TRNAMT>${t.trnamt}
<FITID>${t.fitid}
<NAME>${t.name}
</STMTTRN>`,
    )
    .join("\n");

  const ledgerSection = ledgerbal
    ? `<LEDGERBAL><BALAMT>${ledgerbal}\n<DTASOF>20240131\n</LEDGERBAL>`
    : "";

  return `OFXHEADER:100
DATA:OFXSGML
VERSION:151

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
${txBlocks}
</BANKTRANLIST>
${ledgerSection}
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
}

// ---------------------------------------------------------------------------
// Test DB seed helpers
// ---------------------------------------------------------------------------

async function seedAccount(
  db: ReturnType<typeof createTestDb>,
  openingBalance = 0,
) {
  await db.insert(institution).values({ name: "Test Bank" });
  const [inst] = await db.select().from(institution);
  await db.insert(account).values({
    name: "Test Account",
    institutionId: inst.id,
    accountTypeId: 1, // Current (from seed)
    currency: "GBP",
    openingBalance,
    openingDate: "2024-01-01",
  });
  const [acc] = await db.select().from(account);
  return acc;
}

async function seedFitid(
  db: ReturnType<typeof createTestDb>,
  accountId: number,
  fitid: string,
) {
  // Insert a dummy transaction first (required FK)
  await db.insert(transaction).values({
    accountId,
    amount: -10,
    date: "2024-01-01",
    notes: "seed tx",
    type: "import",
    isVoid: 0,
  });
  const [tx] = await db.select().from(transaction).where(eq(transaction.accountId, accountId));
  await db.insert(transactionFitid).values({
    transactionId: tx.id,
    accountId,
    fitid,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

describe("importOfxFile — all new FITIDs", () => {
  it("imports all transactions and records FITIDs when none exist", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    const ofx = makeOfxFile([
      { fitid: "TX001", dtposted: "20240101", trnamt: "-10.00", name: "Shop" },
      { fitid: "TX002", dtposted: "20240102", trnamt: "-20.00", name: "Cafe" },
      { fitid: "TX003", dtposted: "20240103", trnamt: "500.00", name: "Salary" },
    ]);

    const result = await importOfxFile(acc.id, ofx);

    expect(result.total).toBe(3);
    expect(result.imported).toBe(3);
    expect(result.duplicateCandidates).toBe(0);
    expect(result.uncategorised).toBe(3); // stub returns 0 categorised

    const txRows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    expect(txRows).toHaveLength(3);

    const fitidRows = await db.select().from(transactionFitid);
    expect(fitidRows).toHaveLength(3);
    expect(fitidRows.map((r) => r.fitid).sort()).toEqual(["TX001", "TX002", "TX003"]);
  });
});

describe("importOfxFile — duplicate FITID detection", () => {
  it("counts existing FITIDs as duplicates and does not insert them", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    await seedFitid(db, acc.id, "TX001"); // pre-existing

    const ofx = makeOfxFile([
      { fitid: "TX001", dtposted: "20240101", trnamt: "-10.00", name: "Shop" }, // duplicate
      { fitid: "TX002", dtposted: "20240102", trnamt: "-20.00", name: "Cafe" }, // new
      { fitid: "TX003", dtposted: "20240103", trnamt: "-30.00", name: "Gym" },  // new
    ]);

    const result = await importOfxFile(acc.id, ofx);

    expect(result.total).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.duplicateCandidates).toBe(1);

    // Only 2 new transactions inserted (seeded tx + 2 new = 3 total)
    const txRows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    expect(txRows).toHaveLength(3); // 1 seeded + 2 new
  });

  it("duplicate is NOT inserted as a new transaction row", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    await seedFitid(db, acc.id, "ALREADY");

    const countBefore = (
      await db.select().from(transaction).where(eq(transaction.accountId, acc.id))
    ).length;

    const ofx = makeOfxFile([
      { fitid: "ALREADY", dtposted: "20240101", trnamt: "-50.00", name: "Dup" },
    ]);

    const result = await importOfxFile(acc.id, ofx);

    expect(result.duplicateCandidates).toBe(1);
    expect(result.imported).toBe(0);

    const countAfter = (
      await db.select().from(transaction).where(eq(transaction.accountId, acc.id))
    ).length;
    expect(countAfter).toBe(countBefore); // no new rows
  });
});

describe("importOfxFile — cross-account FITID isolation", () => {
  it("does not treat a FITID from a different account as a duplicate", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    // Create two accounts
    await db.insert(institution).values({ name: "Bank" });
    const [inst] = await db.select().from(institution);
    await db.insert(account).values([
      {
        name: "Account A",
        institutionId: inst.id,
        accountTypeId: 1,
        currency: "GBP",
        openingBalance: 0,
        openingDate: "2024-01-01",
      },
      {
        name: "Account B",
        institutionId: inst.id,
        accountTypeId: 1,
        currency: "GBP",
        openingBalance: 0,
        openingDate: "2024-01-01",
      },
    ]);
    const accounts = await db.select().from(account);
    const accA = accounts.find((a) => a.name === "Account A")!;
    const accB = accounts.find((a) => a.name === "Account B")!;

    // Seed FITID on account A
    await seedFitid(db, accA.id, "SHARED_FITID");

    // Import into account B with same FITID
    const ofx = makeOfxFile([
      { fitid: "SHARED_FITID", dtposted: "20240115", trnamt: "-25.00", name: "Shop" },
    ]);

    const result = await importOfxFile(accB.id, ofx);

    // Should be imported (not duplicate) because it's a different account
    expect(result.imported).toBe(1);
    expect(result.duplicateCandidates).toBe(0);
  });
});

describe("importOfxFile — closing balance validation", () => {
  it("commits import when closing balance matches running balance", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    // Opening balance 1000, import one debit of -50 → running balance = 950
    const acc = await seedAccount(db, 1000);
    const ofx = makeOfxFile(
      [{ fitid: "TX001", dtposted: "20240115", trnamt: "-50.00", name: "Shop" }],
      "950.00",
    );

    const result = await importOfxFile(acc.id, ofx);

    expect(result.imported).toBe(1);
  });

  it("rolls back and throws when closing balance does not match", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    // Opening balance 1000, import -50, but LEDGERBAL says 800 (wrong)
    const acc = await seedAccount(db, 1000);
    const ofx = makeOfxFile(
      [{ fitid: "TX001", dtposted: "20240115", trnamt: "-50.00", name: "Shop" }],
      "800.00",
    );

    await expect(importOfxFile(acc.id, ofx)).rejects.toThrow(
      /Import blocked.*closing balance.*950\.00.*800\.00|Import blocked.*800\.00.*950\.00/i,
    );

    // Verify rollback — no transactions inserted
    const txRows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    expect(txRows).toHaveLength(0);

    const fitidRows = await db.select().from(transactionFitid);
    expect(fitidRows).toHaveLength(0);
  });

  it("commits normally when no closing balance is in the file", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db, 500);
    const ofx = makeOfxFile([
      { fitid: "TX001", dtposted: "20240115", trnamt: "-25.00", name: "Coffee" },
    ]); // no ledgerbal argument

    const result = await importOfxFile(acc.id, ofx);

    expect(result.imported).toBe(1);
    const txRows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    expect(txRows).toHaveLength(1);
  });
});

describe("importOfxFile — result counts", () => {
  it("returns correct total, imported, duplicateCandidates, uncategorised", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    await seedFitid(db, acc.id, "DUP01");
    await seedFitid(db, acc.id, "DUP02");

    const ofx = makeOfxFile([
      { fitid: "DUP01", dtposted: "20240101", trnamt: "-10.00", name: "A" },
      { fitid: "DUP02", dtposted: "20240102", trnamt: "-20.00", name: "B" },
      { fitid: "NEW01", dtposted: "20240103", trnamt: "-30.00", name: "C" },
      { fitid: "NEW02", dtposted: "20240104", trnamt: "-40.00", name: "D" },
      { fitid: "NEW03", dtposted: "20240105", trnamt: "-50.00", name: "E" },
    ]);

    const result = await importOfxFile(acc.id, ofx);

    expect(result.total).toBe(5);
    expect(result.imported).toBe(3);
    expect(result.duplicateCandidates).toBe(2);
    expect(result.uncategorised).toBe(3); // stub returns 0 categorised → all 3 are uncategorised
  });
});

// ---------------------------------------------------------------------------
// Extended schema fields: payee, reference, running balance
// ---------------------------------------------------------------------------

function makeOfxFileWithChecknum(
  transactions: Array<{
    fitid: string;
    dtposted: string;
    trnamt: string;
    name?: string;
    memo?: string;
    checknum?: string;
  }>,
): string {
  const txBlocks = transactions
    .map((t) => {
      const nameLine = t.name ? `<NAME>${t.name}\n` : "";
      const memoLine = t.memo ? `<MEMO>${t.memo}\n` : "";
      const checknumLine = t.checknum ? `<CHECKNUM>${t.checknum}\n` : "";
      return `<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>${t.dtposted}
<TRNAMT>${t.trnamt}
<FITID>${t.fitid}
${nameLine}${memoLine}${checknumLine}</STMTTRN>`;
    })
    .join("\n");

  return `OFXHEADER:100
DATA:OFXSGML
VERSION:151

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
${txBlocks}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
}

describe("importOfxFile — payee, reference, and running balance", () => {
  it("populates payee from NAME field", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    const ofx = makeOfxFileWithChecknum([
      { fitid: "TX001", dtposted: "20240115", trnamt: "-10.00", name: "Starbucks" },
    ]);

    await importOfxFile(acc.id, ofx);

    const [tx] = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(tx.payee).toBe("Starbucks");
  });

  it("populates reference from CHECKNUM field", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    const ofx = makeOfxFileWithChecknum([
      { fitid: "TX001", dtposted: "20240115", trnamt: "-10.00", name: "Shop", checknum: "REF12345" },
    ]);

    await importOfxFile(acc.id, ofx);

    const [tx] = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(tx.reference).toBe("REF12345");
  });

  it("leaves payee null when NAME is absent", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db);
    const ofx = makeOfxFileWithChecknum([
      { fitid: "TX001", dtposted: "20240115", trnamt: "-10.00", memo: "Some memo" },
    ]);

    await importOfxFile(acc.id, ofx);

    const [tx] = await db.select().from(transaction).where(eq(transaction.accountId, acc.id));
    expect(tx.payee).toBeNull();
    expect(tx.notes).toBe("Some memo");
  });

  it("recalculates running balance after import", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);

    const acc = await seedAccount(db, 100);
    const ofx = makeOfxFileWithChecknum([
      { fitid: "TX001", dtposted: "20240101", trnamt: "-10.00", name: "Shop A" },
      { fitid: "TX002", dtposted: "20240102", trnamt: "-20.00", name: "Shop B" },
    ]);

    await importOfxFile(acc.id, ofx);

    const txRows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));

    txRows.sort((a, b) => a.date.localeCompare(b.date));
    expect(txRows[0].runningBalance).toBeCloseTo(90);  // 100 - 10
    expect(txRows[1].runningBalance).toBeCloseTo(70);  // 100 - 10 - 20
  });
});

describe("importOfxFile — rules engine integration", () => {
  it("returns categorised=0 and uncategorised=imported when no rules exist", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);

    const ofx = makeOfxFile([
      { fitid: "TX1", dtposted: "20240101", trnamt: "-10.00", name: "Shop" },
      { fitid: "TX2", dtposted: "20240102", trnamt: "-20.00", name: "Cafe" },
    ]);

    const result = await importOfxFile(acc.id, ofx);
    expect(result.categorised).toBe(0);
    expect(result.uncategorised).toBe(2);
  });

  it("returns correct categorised count when a matching rule exists", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);

    // Seed a rule that matches "Shop" in payee
    const { categorisationRule, ruleCondition, ruleAction, category } = await import("@/lib/db/schema");
    const { eq: eqLocal } = await import("drizzle-orm");
    await db.insert(categorisationRule).values({ name: "Shop Rule", sortOrder: 1, isActive: 1 });
    const [rule] = await db.select().from(categorisationRule);
    await db.insert(ruleCondition).values({ ruleId: rule.id, field: "payee", operator: "equals", value: "Shop" });
    const [cat] = await db.select().from(category).where(eqLocal(category.name, "Groceries"));
    await db.insert(ruleAction).values({ ruleId: rule.id, actionType: "assign_category", categoryId: cat.id });

    const ofx = makeOfxFile([
      { fitid: "TX1", dtposted: "20240101", trnamt: "-10.00", name: "Shop" },   // matches
      { fitid: "TX2", dtposted: "20240102", trnamt: "-20.00", name: "Cafe" },   // no match
    ]);

    const result = await importOfxFile(acc.id, ofx);
    expect(result.categorised).toBe(1);
    expect(result.uncategorised).toBe(1);
  });
});
