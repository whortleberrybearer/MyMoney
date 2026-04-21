import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  recalculateRunningBalance,
  recalculatePotRunningBalance,
  reassignTransaction,
  updateTransaction,
} from "@/lib/transactions";
import { createTestDb } from "./db-helper";
import { account, category, institution, pot, transaction } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

// ---------------------------------------------------------------------------
// Seed helpers
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
    accountTypeId: 1,
    currency: "GBP",
    openingBalance,
    openingDate: "2024-01-01",
  });
  const [acc] = await db.select().from(account);
  return acc;
}

async function seedTransaction(
  db: ReturnType<typeof createTestDb>,
  accountId: number,
  overrides: Partial<{
    date: string;
    amount: number;
    type: string;
    payee: string | null;
    notes: string | null;
    reference: string | null;
    categoryId: number | null;
    runningBalance: number;
  }> = {},
) {
  await db.insert(transaction).values({
    accountId,
    date: overrides.date ?? "2024-01-15",
    amount: overrides.amount ?? -10,
    type: overrides.type ?? "manual",
    payee: overrides.payee ?? null,
    notes: overrides.notes ?? null,
    reference: overrides.reference ?? null,
    categoryId: overrides.categoryId ?? null,
    runningBalance: overrides.runningBalance ?? 0,
    isVoid: 0,
  });
  const rows = await db.select().from(transaction).where(eq(transaction.accountId, accountId));
  return rows[rows.length - 1];
}

async function seedPot(
  db: ReturnType<typeof createTestDb>,
  accountId: number,
  openingBalance = 0,
) {
  await db.insert(pot).values({
    accountId,
    name: "Test Pot",
    openingBalance,
    openingDate: "2024-01-01",
    isActive: 1,
  });
  const pots = await db.select().from(pot).where(eq(pot.accountId, accountId));
  return pots[pots.length - 1];
}

async function seedPotTransaction(
  db: ReturnType<typeof createTestDb>,
  potId: number,
  overrides: Partial<{
    date: string;
    amount: number;
    type: string;
    runningBalance: number;
  }> = {},
) {
  await db.insert(transaction).values({
    potId,
    date: overrides.date ?? "2024-01-15",
    amount: overrides.amount ?? -10,
    type: overrides.type ?? "imported",
    runningBalance: overrides.runningBalance ?? 0,
    isVoid: 0,
  });
  const rows = await db.select().from(transaction).where(eq(transaction.potId, potId));
  return rows[rows.length - 1];
}

async function seedCategory(db: ReturnType<typeof createTestDb>, name = "Food") {
  // category table is already seeded with some entries; use a unique name
  const existing = await db.select().from(category);
  const found = existing.find((c) => c.name === name);
  if (found) return found;
  await db.insert(category).values({ name, isSystem: 0, sortOrder: 99 });
  const all = await db.select().from(category);
  return all.find((c) => c.name === name)!;
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// listTransactions
// ---------------------------------------------------------------------------

describe("listTransactions — basic", () => {
  it("returns empty array for account with no transactions", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    expect(await listTransactions(acc.id)).toEqual([]);
  });

  it("returns own transactions sorted newest-first by default", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { date: "2024-01-01", amount: -10 });
    await seedTransaction(db, acc.id, { date: "2024-01-03", amount: -30 });
    await seedTransaction(db, acc.id, { date: "2024-01-02", amount: -20 });

    const rows = await listTransactions(acc.id);
    expect(rows).toHaveLength(3);
    expect(rows[0].date).toBe("2024-01-03");
    expect(rows[1].date).toBe("2024-01-02");
    expect(rows[2].date).toBe("2024-01-01");
  });

  it("does not return void transactions", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await db.insert(transaction).values({
      accountId: acc.id,
      date: "2024-01-01",
      amount: -10,
      type: "manual",
      runningBalance: 0,
      isVoid: 1,
    });
    expect(await listTransactions(acc.id)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// listTransactions — filters
// ---------------------------------------------------------------------------

describe("listTransactions — filters", () => {
  it("filters by fromDate", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { date: "2024-01-01" });
    await seedTransaction(db, acc.id, { date: "2024-01-10" });
    await seedTransaction(db, acc.id, { date: "2024-01-20" });

    const rows = await listTransactions(acc.id, { fromDate: "2024-01-10" });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.date >= "2024-01-10")).toBe(true);
  });

  it("filters by toDate", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { date: "2024-01-01" });
    await seedTransaction(db, acc.id, { date: "2024-01-10" });
    await seedTransaction(db, acc.id, { date: "2024-01-20" });

    const rows = await listTransactions(acc.id, { toDate: "2024-01-10" });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.date <= "2024-01-10")).toBe(true);
  });

  it("filters by date range (from and to)", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { date: "2024-01-01" });
    await seedTransaction(db, acc.id, { date: "2024-01-10" });
    await seedTransaction(db, acc.id, { date: "2024-01-20" });

    const rows = await listTransactions(acc.id, {
      fromDate: "2024-01-05",
      toDate: "2024-01-15",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2024-01-10");
  });

  it("filters by categoryId", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    const cat = await seedCategory(db, "Groceries-test");
    await seedTransaction(db, acc.id, { categoryId: cat.id });
    await seedTransaction(db, acc.id, { categoryId: null });

    const rows = await listTransactions(acc.id, { categoryId: cat.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].categoryId).toBe(cat.id);
  });

  it("filters by type", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { type: "manual" });
    await seedTransaction(db, acc.id, { type: "imported" });

    const rows = await listTransactions(acc.id, { type: "manual" });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("manual");
  });

  it("filters by reference substring (case-insensitive)", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { reference: "REF12345" });
    await seedTransaction(db, acc.id, { reference: "OTHER-REF" });
    await seedTransaction(db, acc.id, { reference: null });

    const rows = await listTransactions(acc.id, { reference: "ref123" });
    expect(rows).toHaveLength(1);
    expect(rows[0].reference).toBe("REF12345");
  });

  it("filters by payee substring (case-insensitive)", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, { payee: "Starbucks Coffee" });
    await seedTransaction(db, acc.id, { payee: "Tesco" });
    await seedTransaction(db, acc.id, { payee: null });

    const rows = await listTransactions(acc.id, { payee: "star" });
    expect(rows).toHaveLength(1);
    expect(rows[0].payee).toBe("Starbucks Coffee");
  });

  it("combines multiple filters with AND logic", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await seedTransaction(db, acc.id, {
      date: "2024-01-10",
      type: "manual",
      payee: "Shop",
    });
    await seedTransaction(db, acc.id, {
      date: "2024-01-10",
      type: "imported",
      payee: "Shop",
    });
    await seedTransaction(db, acc.id, {
      date: "2024-02-01",
      type: "manual",
      payee: "Shop",
    });

    const rows = await listTransactions(acc.id, {
      fromDate: "2024-01-01",
      toDate: "2024-01-31",
      type: "manual",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("manual");
    expect(rows[0].date).toBe("2024-01-10");
  });
});

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

describe("createTransaction", () => {
  it("inserts a transaction with type=manual and recalculates running balance for subsequent rows", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 100);

    // Seed an existing transaction
    await seedTransaction(db, acc.id, { date: "2024-01-20", amount: -20 });

    await createTransaction(acc.id, { date: "2024-01-10", amount: -10 });

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    expect(rows).toHaveLength(2);

    const created = rows.find((r) => r.date === "2024-01-10")!;
    expect(created.type).toBe("manual");
    expect(created.runningBalance).toBeCloseTo(90); // 100 - 10

    const later = rows.find((r) => r.date === "2024-01-20")!;
    expect(later.runningBalance).toBeCloseTo(70); // 100 - 10 - 20
  });

  it("throws when date is missing", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await expect(
      createTransaction(acc.id, { date: "", amount: -10 }),
    ).rejects.toThrow(/date/i);
  });

  it("throws when amount is NaN", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db);
    await expect(
      createTransaction(acc.id, { date: "2024-01-01", amount: NaN }),
    ).rejects.toThrow(/amount/i);
  });
});

// ---------------------------------------------------------------------------
// updateTransaction
// ---------------------------------------------------------------------------

describe("updateTransaction", () => {
  it("updates notes/payee/reference/category without triggering recalculation", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 100);
    const tx = await seedTransaction(db, acc.id, {
      date: "2024-01-10",
      amount: -10,
      runningBalance: 90,
    });

    await updateTransaction({
      id: tx.id,
      notes: "Updated notes",
      payee: "New Payee",
    });

    const [updated] = await db
      .select()
      .from(transaction)
      .where(eq(transaction.id, tx.id));
    expect(updated.notes).toBe("Updated notes");
    expect(updated.payee).toBe("New Payee");
    // Running balance should be unchanged (no date/amount change)
    expect(updated.runningBalance).toBeCloseTo(90);
  });

  it("recalculates running balance when amount changes", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 100);
    const tx1 = await seedTransaction(db, acc.id, {
      date: "2024-01-10",
      amount: -10,
      runningBalance: 90,
    });
    await seedTransaction(db, acc.id, {
      date: "2024-01-20",
      amount: -20,
      runningBalance: 70,
    });

    await updateTransaction({ id: tx1.id, amount: -5 });

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    const row1 = rows.find((r) => r.id === tx1.id)!;
    const row2 = rows.find((r) => r.date === "2024-01-20")!;

    expect(row1.runningBalance).toBeCloseTo(95); // 100 - 5
    expect(row2.runningBalance).toBeCloseTo(75); // 100 - 5 - 20
  });

  it("recalculates running balance when date changes", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 100);
    const tx1 = await seedTransaction(db, acc.id, {
      date: "2024-01-10",
      amount: -10,
    });
    await seedTransaction(db, acc.id, {
      date: "2024-01-20",
      amount: -20,
    });

    // Move tx1 to after tx2's date
    await updateTransaction({ id: tx1.id, date: "2024-01-25" });

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    const row2 = rows.find((r) => r.date === "2024-01-20")!;
    const row1 = rows.find((r) => r.id === tx1.id)!;

    expect(row2.runningBalance).toBeCloseTo(80); // 100 - 20
    expect(row1.runningBalance).toBeCloseTo(70); // 100 - 20 - 10
  });
});

// ---------------------------------------------------------------------------
// deleteTransaction
// ---------------------------------------------------------------------------

describe("deleteTransaction", () => {
  it("hard-deletes the row and recalculates running balance for subsequent rows", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 100);
    const tx1 = await seedTransaction(db, acc.id, { date: "2024-01-10", amount: -10 });
    await seedTransaction(db, acc.id, { date: "2024-01-20", amount: -20 });

    await deleteTransaction(tx1.id);

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2024-01-20");
    // Running balance should now be 100 - 20 = 80
    expect(rows[0].runningBalance).toBeCloseTo(80);
  });

  it("throws when transaction not found", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    await expect(deleteTransaction(999)).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// recalculateRunningBalance
// ---------------------------------------------------------------------------

describe("recalculateRunningBalance", () => {
  it("correctly seeds balance from opening balance + prior transactions", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 500);
    await seedTransaction(db, acc.id, { date: "2024-01-05", amount: -50 });
    await seedTransaction(db, acc.id, { date: "2024-01-20", amount: -100 });

    // Recalculate from 2024-01-20 (prior tx is 2024-01-05)
    await recalculateRunningBalance(acc.id, "2024-01-20");

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    const row1 = rows.find((r) => r.date === "2024-01-05")!;
    const row2 = rows.find((r) => r.date === "2024-01-20")!;

    // row1 was not in the recalc window — its balance is whatever it was seeded as (0)
    expect(row1.runningBalance).toBe(0);
    // row2: prior = 500 + (-50) = 450, then -100 = 350
    expect(row2.runningBalance).toBeCloseTo(350);
  });

  it("correctly handles backdated inserts", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    // Opening balance 100
    // T1: 2024-01-01 +0 (just a marker for opening balance), actually use account opening balance
    const acc = await seedAccount(db, 100);
    // T1 on 2024-01-01
    await db.insert(transaction).values({
      accountId: acc.id,
      date: "2024-01-01",
      amount: 0,
      type: "manual",
      runningBalance: 0,
      isVoid: 0,
    });
    // T3 on 2024-01-03 (+50)
    await db.insert(transaction).values({
      accountId: acc.id,
      date: "2024-01-03",
      amount: 50,
      type: "manual",
      runningBalance: 0,
      isVoid: 0,
    });

    // Now "insert" a backdated T2 on 2024-01-02 (-20)
    await db.insert(transaction).values({
      accountId: acc.id,
      date: "2024-01-02",
      amount: -20,
      type: "manual",
      runningBalance: 0,
      isVoid: 0,
    });

    await recalculateRunningBalance(acc.id, "2024-01-01");

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id))
      .orderBy(transaction.date);
    expect(rows[0].runningBalance).toBeCloseTo(100); // 100 + 0
    expect(rows[1].runningBalance).toBeCloseTo(80);  // 100 - 20
    expect(rows[2].runningBalance).toBeCloseTo(130); // 80 + 50
  });

  it("correctly handles deletion mid-history", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 0);
    // T1 +100 on 01, T2 +50 on 02, T3 +25 on 03
    const t1 = await seedTransaction(db, acc.id, { date: "2024-01-01", amount: 100 });
    const t2 = await seedTransaction(db, acc.id, { date: "2024-01-02", amount: 50 });
    await seedTransaction(db, acc.id, { date: "2024-01-03", amount: 25 });

    // Run full recalc to set correct initial balances
    await recalculateRunningBalance(acc.id, "2024-01-01");

    // Delete T2 and recalc from T2's date
    const t2Date = "2024-01-02";
    await db.delete(transaction).where(eq(transaction.id, t2.id));
    await recalculateRunningBalance(acc.id, t2Date);

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, acc.id));
    const rowT1 = rows.find((r) => r.id === t1.id)!;
    const rowT3 = rows.find((r) => r.date === "2024-01-03")!;

    expect(rowT1.runningBalance).toBeCloseTo(100); // unchanged
    expect(rowT3.runningBalance).toBeCloseTo(125); // 100 + 25
  });
});

// ---------------------------------------------------------------------------
// recalculatePotRunningBalance
// ---------------------------------------------------------------------------

describe("recalculatePotRunningBalance", () => {
  it("correctly seeds pot balance from opening balance + prior pot transactions", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 0);
    const p = await seedPot(db, acc.id, 100);
    await seedPotTransaction(db, p.id, { date: "2024-01-05", amount: -50 });
    await seedPotTransaction(db, p.id, { date: "2024-01-20", amount: -30 });

    await recalculatePotRunningBalance(p.id, "2024-01-20");

    const rows = await db.select().from(transaction).where(eq(transaction.potId, p.id));
    const row1 = rows.find((r) => r.date === "2024-01-05")!;
    const row2 = rows.find((r) => r.date === "2024-01-20")!;

    // row1 not in recalc window — balance unchanged from seed (0)
    expect(row1.runningBalance).toBe(0);
    // row2: prior = 100 + (-50) = 50, then -30 = 20
    expect(row2.runningBalance).toBeCloseTo(20);
  });

  it("correctly handles backdated pot inserts", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    const acc = await seedAccount(db, 0);
    const p = await seedPot(db, acc.id, 100);
    await seedPotTransaction(db, p.id, { date: "2024-01-01", amount: 0 });
    await seedPotTransaction(db, p.id, { date: "2024-01-03", amount: 50 });
    await seedPotTransaction(db, p.id, { date: "2024-01-02", amount: -20 });

    await recalculatePotRunningBalance(p.id, "2024-01-01");

    const rows = await db
      .select()
      .from(transaction)
      .where(eq(transaction.potId, p.id))
      .orderBy(transaction.date);
    expect(rows[0].runningBalance).toBeCloseTo(100);  // 100 + 0
    expect(rows[1].runningBalance).toBeCloseTo(80);   // 100 - 20
    expect(rows[2].runningBalance).toBeCloseTo(130);  // 80 + 50
  });

  it("does nothing when pot does not exist", async () => {
    const db = createTestDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockGetDb.mockReturnValue(db as any);
    await expect(recalculatePotRunningBalance(999, "2024-01-01")).resolves.toBeUndefined();
  });
});
