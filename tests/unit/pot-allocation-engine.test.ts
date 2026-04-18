import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { applyPotAllocationRules } from "@/lib/pot-allocation-engine";
import { createTestDb } from "./db-helper";
import {
  account,
  category,
  institution,
  pot,
  potAllocationRule,
  potAllocationRuleAction,
  potAllocationRuleCondition,
  transaction,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

type TestDb = ReturnType<typeof createTestDb>;

async function seedAccount(db: TestDb, name = "Current Account") {
  await db.insert(institution).values({ name: `Bank-${name}` });
  const insts = await db.select().from(institution);
  const inst = insts[insts.length - 1];
  await db.insert(account).values({
    name,
    institutionId: inst.id,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2024-01-01",
  });
  const accts = await db.select().from(account).where(eq(account.name, name));
  return accts[0];
}

async function seedPot(db: TestDb, accountId: number, name = "Holiday Pot") {
  await db.insert(pot).values({
    accountId,
    name,
    openingBalance: 0,
    openingDate: "2024-01-01",
    isActive: 1,
  });
  const pots = await db.select().from(pot).where(eq(pot.accountId, accountId));
  return pots[pots.length - 1];
}

async function seedTransaction(db: TestDb, accountId: number, overrides: {
  amount?: number;
  notes?: string | null;
  type?: string;
  date?: string;
  runningBalance?: number;
} = {}) {
  await db.insert(transaction).values({
    accountId,
    amount: overrides.amount ?? 1000,
    date: overrides.date ?? "2024-06-01",
    notes: overrides.notes ?? null,
    type: overrides.type ?? "imported",
    runningBalance: overrides.runningBalance ?? (overrides.amount ?? 1000),
    isVoid: 0,
  });
  const rows = await db.select().from(transaction).where(eq(transaction.accountId, accountId));
  return rows[rows.length - 1];
}

async function seedRule(
  db: TestDb,
  accountId: number,
  opts: {
    name?: string;
    priority?: number;
    isActive?: number;
    field?: string;
    operator?: string;
    value?: string;
    potId: number;
    allocationValue?: number;
  },
) {
  await db.insert(potAllocationRule).values({
    accountId,
    name: opts.name ?? "Test Rule",
    priority: opts.priority ?? 1,
    isActive: opts.isActive ?? 1,
  });
  const rules = await db.select().from(potAllocationRule).where(eq(potAllocationRule.accountId, accountId));
  const rule = rules[rules.length - 1];

  await db.insert(potAllocationRuleCondition).values({
    ruleId: rule.id,
    field: opts.field ?? "description",
    operator: opts.operator ?? "contains",
    value: opts.value ?? "SALARY",
  });

  await db.insert(potAllocationRuleAction).values({
    ruleId: rule.id,
    potId: opts.potId,
    allocationValue: opts.allocationValue ?? 200,
  });

  return rule;
}

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(db as any);
});

// ---------------------------------------------------------------------------
// Basic behaviour
// ---------------------------------------------------------------------------

describe("applyPotAllocationRules", () => {
  it("returns zero allocations when no transaction IDs provided", async () => {
    const acct = await seedAccount(db);
    const result = await applyPotAllocationRules(acct.id, []);
    expect(result).toEqual({ allocations: 0, failures: [] });
  });

  it("returns zero allocations when no active rules exist", async () => {
    const acct = await seedAccount(db);
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", runningBalance: 1000 });
    const result = await applyPotAllocationRules(acct.id, [tx.id]);
    expect(result).toEqual({ allocations: 0, failures: [] });
  });

  it("creates virtual transfer pair when rule matches", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 2000, runningBalance: 2000 });
    await seedRule(db, acct.id, { potId: p.id, allocationValue: 200, value: "SALARY" });

    const result = await applyPotAllocationRules(acct.id, [tx.id]);

    expect(result.allocations).toBe(1);
    expect(result.failures).toHaveLength(0);

    const txRows = await db.select().from(transaction);
    const virtualTxs = txRows.filter((t) => t.type === "virtual_transfer");
    expect(virtualTxs).toHaveLength(2);

    const debit = virtualTxs.find((t) => t.accountId === acct.id);
    const credit = virtualTxs.find((t) => t.potId === p.id);
    expect(debit).toBeDefined();
    expect(credit).toBeDefined();
    expect(debit!.amount).toBe(-200);
    expect(credit!.amount).toBe(200);
    expect(debit!.transferId).toBe(credit!.transferId);
    expect(debit!.notes).toBe(`Auto-transfer to ${p.name}`);
  });

  it("assigns savings transfer category to virtual transfers", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 2000, runningBalance: 2000 });
    await seedRule(db, acct.id, { potId: p.id, allocationValue: 200 });

    await applyPotAllocationRules(acct.id, [tx.id]);

    const [cat] = await db.select().from(category).where(eq(category.name, "Savings transfer"));
    expect(cat).toBeDefined();

    const virtualTxs = (await db.select().from(transaction)).filter((t) => t.type === "virtual_transfer");
    for (const vtx of virtualTxs) {
      expect(vtx.categoryId).toBe(cat.id);
    }
  });

  it("first-match-wins: only the first matching rule fires", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY PAYMENT", amount: 2000, runningBalance: 2000 });

    // Rule A matches (priority 1, contains "SALARY")
    await seedRule(db, acct.id, { name: "Rule A", priority: 1, potId: p.id, allocationValue: 100, value: "SALARY" });
    // Rule B would also match (priority 2, contains "PAYMENT")
    await seedRule(db, acct.id, { name: "Rule B", priority: 2, potId: p.id, allocationValue: 50, value: "PAYMENT" });

    const result = await applyPotAllocationRules(acct.id, [tx.id]);

    // Only Rule A should have fired → 1 allocation pair
    expect(result.allocations).toBe(1);
    const virtualTxs = (await db.select().from(transaction)).filter((t) => t.type === "virtual_transfer");
    const debits = virtualTxs.filter((t) => t.accountId === acct.id);
    expect(debits).toHaveLength(1);
    expect(debits[0].amount).toBe(-100);
  });

  it("inactive rules are skipped", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 2000, runningBalance: 2000 });
    await seedRule(db, acct.id, { potId: p.id, isActive: 0 });

    const result = await applyPotAllocationRules(acct.id, [tx.id]);
    expect(result.allocations).toBe(0);
  });

  it("rules from other accounts do not fire", async () => {
    const acct1 = await seedAccount(db, "Account 1");
    const acct2 = await seedAccount(db, "Account 2");
    const p = await seedPot(db, acct1.id);
    const tx = await seedTransaction(db, acct2.id, { notes: "SALARY", amount: 2000, runningBalance: 2000 });
    await seedRule(db, acct1.id, { potId: p.id, value: "SALARY" });

    const result = await applyPotAllocationRules(acct2.id, [tx.id]);
    expect(result.allocations).toBe(0);
  });

  it("no match when no conditions match", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const tx = await seedTransaction(db, acct.id, { notes: "MORTGAGE", amount: 2000, runningBalance: 2000 });
    await seedRule(db, acct.id, { potId: p.id, value: "SALARY" });

    const result = await applyPotAllocationRules(acct.id, [tx.id]);
    expect(result.allocations).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Insufficient balance
// ---------------------------------------------------------------------------

describe("insufficient balance handling", () => {
  it("blocks rule when total allocation exceeds running balance", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    // Running balance is 100, rule wants to allocate 500
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 100, runningBalance: 100 });
    await seedRule(db, acct.id, { potId: p.id, allocationValue: 500 });

    const result = await applyPotAllocationRules(acct.id, [tx.id]);

    expect(result.allocations).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].ruleName).toBe("Test Rule");
    expect(result.failures[0].potNames).toContain(p.name);

    const virtualTxs = (await db.select().from(transaction)).filter((t) => t.type === "virtual_transfer");
    expect(virtualTxs).toHaveLength(0);
  });

  it("fires rule when balance exactly matches total allocation", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 200, runningBalance: 200 });
    await seedRule(db, acct.id, { potId: p.id, allocationValue: 200 });

    const result = await applyPotAllocationRules(acct.id, [tx.id]);
    expect(result.allocations).toBe(1);
    expect(result.failures).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-action rules
// ---------------------------------------------------------------------------

describe("multi-action rules", () => {
  it("creates transfer pairs for each action", async () => {
    const acct = await seedAccount(db);
    const pot1 = await seedPot(db, acct.id, "Holiday");
    const pot2 = await seedPot(db, acct.id, "Rainy Day");
    const tx = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 2000, runningBalance: 2000 });

    await db.insert(potAllocationRule).values({ accountId: acct.id, name: "Split", priority: 1, isActive: 1 });
    const [rule] = await db.select().from(potAllocationRule);
    await db.insert(potAllocationRuleCondition).values({ ruleId: rule.id, field: "description", operator: "contains", value: "SALARY" });
    await db.insert(potAllocationRuleAction).values([
      { ruleId: rule.id, potId: pot1.id, allocationValue: 200 },
      { ruleId: rule.id, potId: pot2.id, allocationValue: 100 },
    ]);

    const result = await applyPotAllocationRules(acct.id, [tx.id]);

    expect(result.allocations).toBe(2);
    const virtualTxs = (await db.select().from(transaction)).filter((t) => t.type === "virtual_transfer");
    expect(virtualTxs).toHaveLength(4); // 2 debits + 2 credits
  });
});

// ---------------------------------------------------------------------------
// Running balance updates in same import batch
// ---------------------------------------------------------------------------

describe("running balance updates across import batch", () => {
  it("later rules see updated balance after earlier transfers", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);

    // Two transactions in the same import batch
    const tx1 = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 300, runningBalance: 300, date: "2024-06-01" });
    const tx2 = await seedTransaction(db, acct.id, { notes: "SALARY", amount: 10, runningBalance: 310, date: "2024-06-02" });

    // Rule allocates 300; tx1 has 300 (just enough), tx2 only has ~10 left after tx1's transfer
    await seedRule(db, acct.id, { potId: p.id, allocationValue: 300, value: "SALARY" });

    const result = await applyPotAllocationRules(acct.id, [tx1.id, tx2.id]);

    // tx1 should fire (balance 300 >= 300), tx2 should fail (balance < 300 after tx1's debit)
    expect(result.allocations).toBe(1);
    expect(result.failures).toHaveLength(1);
  });
});
