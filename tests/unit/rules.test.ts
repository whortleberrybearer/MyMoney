import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  applyRules,
  createRule,
  deleteRule,
  getRules,
  reorderRules,
  toggleRuleActive,
  updateRule,
} from "@/lib/rules";
import { createTestDb } from "./db-helper";
import {
  account,
  categorisationRule,
  category,
  institution,
  ruleAction,
  ruleCondition,
  transaction,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof createTestDb>;

async function seedAccount(db: TestDb) {
  await db.insert(institution).values({ name: "Bank" });
  const [inst] = await db.select().from(institution);
  await db.insert(account).values({
    name: "Checking",
    institutionId: inst.id,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2024-01-01",
  });
  const [acc] = await db.select().from(account);
  return acc;
}

async function seedTransaction(
  db: TestDb,
  accountId: number,
  overrides: Partial<{
    notes: string | null;
    payee: string | null;
    amount: number;
    type: string;
    categoryId: number | null;
    isVoid: number;
    reference: string | null;
  }> = {},
) {
  await db.insert(transaction).values({
    accountId,
    date: "2024-01-01",
    amount: overrides.amount ?? -10,
    type: overrides.type ?? "imported",
    runningBalance: overrides.amount ?? -10,
    notes: overrides.notes ?? null,
    payee: overrides.payee ?? null,
    reference: overrides.reference ?? null,
    categoryId: overrides.categoryId ?? null,
    isVoid: overrides.isVoid ?? 0,
  });
  const rows = await db.select().from(transaction).where(eq(transaction.accountId, accountId));
  return rows[rows.length - 1];
}

async function getUncategorisedId(db: TestDb) {
  const [row] = await db.select({ id: category.id }).from(category).where(eq(category.name, "Uncategorised"));
  return row.id;
}

async function getCategoryIdByName(db: TestDb, name: string) {
  const [row] = await db.select({ id: category.id }).from(category).where(eq(category.name, name));
  return row.id;
}

async function seedRule(
  db: TestDb,
  name: string,
  sortOrder: number,
  isActive: number,
  conditions: { field: string; operator: string; value: string }[],
  actions: { actionType: string; categoryId?: number | null; note?: string | null }[],
) {
  await db.insert(categorisationRule).values({ name, sortOrder, isActive });
  const rows = await db.select().from(categorisationRule);
  const rule = rows[rows.length - 1];

  for (const c of conditions) {
    await db.insert(ruleCondition).values({ ruleId: rule.id, ...c });
  }
  for (const a of actions) {
    await db.insert(ruleAction).values({ ruleId: rule.id, actionType: a.actionType, categoryId: a.categoryId ?? null, note: a.note ?? null });
  }

  return rule;
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// Engine: first-match-wins
// ---------------------------------------------------------------------------

describe("applyRules — engine behaviour", () => {
  it("assigns Uncategorised when no rules exist", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id);
    const uncatId = await getUncategorisedId(db as TestDb);

    await applyRules([tx.id]);

    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(uncatId);
  });

  it("applies first matching rule and skips subsequent rules (first-match-wins)", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { notes: "STARBUCKS" });

    const groceryId = await getCategoryIdByName(db as TestDb, "Groceries");
    const coffeeId = await getCategoryIdByName(db as TestDb, "Eating out");

    // Rule 1 (sort_order=1): matches, assigns Groceries
    await seedRule(db as TestDb, "Rule A", 1, 1,
      [{ field: "description", operator: "contains", value: "starbucks" }],
      [{ actionType: "assign_category", categoryId: groceryId }],
    );
    // Rule 2 (sort_order=2): also matches, assigns Coffee (should NOT be applied)
    await seedRule(db as TestDb, "Rule B", 2, 1,
      [{ field: "description", operator: "contains", value: "starbucks" }],
      [{ actionType: "assign_category", categoryId: coffeeId }],
    );

    await applyRules([tx.id]);

    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(groceryId);
  });

  it("skips inactive rules", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { notes: "AMAZON" });
    const uncatId = await getUncategorisedId(db as TestDb);
    const shoppingId = await getCategoryIdByName(db as TestDb, "Entertainment");

    await seedRule(db as TestDb, "Amazon Rule", 1, 0, // is_active = 0
      [{ field: "description", operator: "contains", value: "amazon" }],
      [{ actionType: "assign_category", categoryId: shoppingId }],
    );

    await applyRules([tx.id]);

    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(uncatId);
  });

  it("skips void transactions", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { isVoid: 1, notes: "AMAZON" });
    const shoppingId = await getCategoryIdByName(db as TestDb, "Entertainment");

    await seedRule(db as TestDb, "Amazon Rule", 1, 1,
      [{ field: "description", operator: "contains", value: "amazon" }],
      [{ actionType: "assign_category", categoryId: shoppingId }],
    );

    await applyRules();

    const [notUpdated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(notUpdated.categoryId).toBeNull();
  });

  it("returns count of categorised transactions (excluding Uncategorised assignments)", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx1 = await seedTransaction(db as TestDb, acc.id, { notes: "AMAZON" });
    const tx2 = await seedTransaction(db as TestDb, acc.id, { notes: "UNKNOWN" });

    const shoppingId = await getCategoryIdByName(db as TestDb, "Entertainment");

    await seedRule(db as TestDb, "Amazon Rule", 1, 1,
      [{ field: "description", operator: "contains", value: "amazon" }],
      [{ actionType: "assign_category", categoryId: shoppingId }],
    );

    const count = await applyRules([tx1.id, tx2.id]);
    expect(count).toBe(1); // only tx1 matched
  });

  it("rule with no conditions matches every transaction (vacuous truth)", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id);
    const groceryId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "Catch-all", 1, 1,
      [], // no conditions
      [{ actionType: "assign_category", categoryId: groceryId }],
    );

    await applyRules([tx.id]);

    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(groceryId);
  });
});

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

describe("applyRules — operators", () => {
  it("contains: matches case-insensitively", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { notes: "Starbucks Coffee" });
    const catId = await getCategoryIdByName(db as TestDb, "Eating out");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "description", operator: "contains", value: "coffee" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
  });

  it("starts_with: matches prefix case-insensitively", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { notes: "Amazon Prime" });
    const catId = await getCategoryIdByName(db as TestDb, "Entertainment");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "description", operator: "starts_with", value: "amazon" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
  });

  it("equals: case-insensitive text match", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { payee: "tesco" });
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "payee", operator: "equals", value: "TESCO" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
  });

  it("greater_than: matches when amount > value", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { amount: -5 });
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "amount", operator: "greater_than", value: "-10" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
  });

  it("less_than: matches when amount < value", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { amount: -3.5 });
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "amount", operator: "less_than", value: "0" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
  });

  it("invalid numeric cast for greater_than is treated as non-match", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { amount: -5 });
    const uncatId = await getUncategorisedId(db as TestDb);
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "amount", operator: "greater_than", value: "not-a-number" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(uncatId);
  });
});

// ---------------------------------------------------------------------------
// Multi-condition AND logic
// ---------------------------------------------------------------------------

describe("applyRules — multi-condition AND logic", () => {
  it("all conditions must match for rule to apply", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    // tx has matching payee but non-matching amount (credit, not debit)
    const tx = await seedTransaction(db as TestDb, acc.id, { payee: "Starbucks", amount: 5.0 });
    const uncatId = await getUncategorisedId(db as TestDb);
    const catId = await getCategoryIdByName(db as TestDb, "Eating out");

    await seedRule(db as TestDb, "R", 1, 1,
      [
        { field: "payee", operator: "contains", value: "starbucks" },
        { field: "amount", operator: "less_than", value: "0" }, // 5.0 is NOT less than 0
      ],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(uncatId);
  });

  it("matches when all conditions pass", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { payee: "Starbucks", amount: -3.5 });
    const catId = await getCategoryIdByName(db as TestDb, "Eating out");

    await seedRule(db as TestDb, "R", 1, 1,
      [
        { field: "payee", operator: "contains", value: "starbucks" },
        { field: "amount", operator: "less_than", value: "0" },
      ],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    await applyRules([tx.id]);
    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
  });
});

// ---------------------------------------------------------------------------
// Multiple actions
// ---------------------------------------------------------------------------

describe("applyRules — multiple actions", () => {
  it("applies both assign_category and set_note actions", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { notes: "TESCO" });
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "description", operator: "contains", value: "tesco" }],
      [
        { actionType: "assign_category", categoryId: catId },
        { actionType: "set_note", note: "Supermarket shop" },
      ],
    );

    await applyRules([tx.id]);

    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.categoryId).toBe(catId);
    expect(updated.notes).toBe("Supermarket shop");
  });

  it("set_note overwrites existing notes", async () => {
    const db = mockGetDb();
    const acc = await seedAccount(db as TestDb);
    const tx = await seedTransaction(db as TestDb, acc.id, { notes: "OLD MEMO" });
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "description", operator: "contains", value: "old" }],
      [
        { actionType: "assign_category", categoryId: catId },
        { actionType: "set_note", note: "New note" },
      ],
    );

    await applyRules([tx.id]);

    const [updated] = await (db as TestDb).select().from(transaction).where(eq(transaction.id, tx.id));
    expect(updated.notes).toBe("New note");
  });
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

describe("getRules", () => {
  it("returns rules ordered by sort_order", async () => {
    const db = mockGetDb();
    await seedRule(db as TestDb, "Rule B", 2, 1, [], []);
    await seedRule(db as TestDb, "Rule A", 1, 1, [], []);

    const rules = await getRules();
    expect(rules[0].name).toBe("Rule A");
    expect(rules[1].name).toBe("Rule B");
  });

  it("returns conditions and actions for each rule", async () => {
    const db = mockGetDb();
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");
    await seedRule(db as TestDb, "R", 1, 1,
      [{ field: "payee", operator: "contains", value: "tesco" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );

    const rules = await getRules();
    expect(rules[0].conditions).toHaveLength(1);
    expect(rules[0].conditions[0].field).toBe("payee");
    expect(rules[0].actions).toHaveLength(1);
    expect(rules[0].actions[0].actionType).toBe("assign_category");
  });

  it("activeOnly filters inactive rules", async () => {
    const db = mockGetDb();
    await seedRule(db as TestDb, "Active", 1, 1, [], []);
    await seedRule(db as TestDb, "Inactive", 2, 0, [], []);

    const rules = await getRules({ activeOnly: true });
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe("Active");
  });
});

describe("createRule", () => {
  it("creates rule with conditions and actions appended to end", async () => {
    const db = mockGetDb();
    await seedRule(db as TestDb, "Existing", 1, 1, [], []);
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");

    await createRule({
      name: "New Rule",
      conditions: [{ field: "payee", operator: "contains", value: "tesco" }],
      actions: [{ actionType: "assign_category", categoryId: catId }],
    });

    const rules = await getRules();
    expect(rules).toHaveLength(2);
    expect(rules[1].name).toBe("New Rule");
    expect(rules[1].sortOrder).toBe(2);
  });
});

describe("updateRule", () => {
  it("updates rule name and replaces conditions and actions", async () => {
    const db = mockGetDb();
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");
    await seedRule(db as TestDb, "Old Name", 1, 1,
      [{ field: "payee", operator: "equals", value: "old" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );
    const [rule] = await getRules();

    const newCatId = await getCategoryIdByName(db as TestDb, "Entertainment");
    await updateRule(rule.id, {
      name: "New Name",
      conditions: [{ field: "description", operator: "contains", value: "new" }],
      actions: [{ actionType: "assign_category", categoryId: newCatId }],
    });

    const [updated] = await getRules();
    expect(updated.name).toBe("New Name");
    expect(updated.conditions[0].field).toBe("description");
    expect(updated.actions[0].categoryId).toBe(newCatId);
  });
});

describe("deleteRule", () => {
  it("deletes rule and all its conditions and actions", async () => {
    const db = mockGetDb();
    const catId = await getCategoryIdByName(db as TestDb, "Groceries");
    await seedRule(db as TestDb, "Rule", 1, 1,
      [{ field: "payee", operator: "contains", value: "x" }],
      [{ actionType: "assign_category", categoryId: catId }],
    );
    const [rule] = await getRules();

    await deleteRule(rule.id);

    const rules = await getRules();
    expect(rules).toHaveLength(0);

    const conditions = await (db as TestDb).select().from(ruleCondition);
    expect(conditions).toHaveLength(0);

    const actions = await (db as TestDb).select().from(ruleAction);
    expect(actions).toHaveLength(0);
  });
});

describe("toggleRuleActive", () => {
  it("flips is_active from 1 to 0", async () => {
    const db = mockGetDb();
    await seedRule(db as TestDb, "Rule", 1, 1, [], []);
    const [rule] = await getRules();

    await toggleRuleActive(rule.id);

    const [updated] = await (db as TestDb).select().from(categorisationRule).where(eq(categorisationRule.id, rule.id));
    expect(updated.isActive).toBe(0);
  });

  it("flips is_active from 0 to 1", async () => {
    const db = mockGetDb();
    await seedRule(db as TestDb, "Rule", 1, 0, [], []);
    const [rule] = await getRules();

    await toggleRuleActive(rule.id);

    const [updated] = await (db as TestDb).select().from(categorisationRule).where(eq(categorisationRule.id, rule.id));
    expect(updated.isActive).toBe(1);
  });
});

describe("reorderRules", () => {
  it("updates sort_order for all rules in the provided order", async () => {
    const db = mockGetDb();
    await seedRule(db as TestDb, "A", 1, 1, [], []);
    await seedRule(db as TestDb, "B", 2, 1, [], []);
    await seedRule(db as TestDb, "C", 3, 1, [], []);

    const rules = await getRules();
    const [a, b, c] = rules;

    // Reverse order: C, B, A
    await reorderRules([c.id, b.id, a.id]);

    const reordered = await getRules();
    expect(reordered[0].name).toBe("C");
    expect(reordered[1].name).toBe("B");
    expect(reordered[2].name).toBe("A");
  });
});
