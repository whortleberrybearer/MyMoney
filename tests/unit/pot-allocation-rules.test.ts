import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  createPotAllocationRule,
  deletePotAllocationRule,
  getPotAllocationRules,
  reorderPotAllocationRules,
  togglePotAllocationRuleActive,
  updatePotAllocationRule,
} from "@/lib/pot-allocation-rules";
import { createTestDb } from "./db-helper";
import {
  account,
  institution,
  pot,
  potAllocationRule,
  potAllocationRuleAction,
  potAllocationRuleCondition,
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

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(db as any);
});

// ---------------------------------------------------------------------------
// getPotAllocationRules
// ---------------------------------------------------------------------------

describe("getPotAllocationRules", () => {
  it("returns empty array when no rules exist for account", async () => {
    const acct = await seedAccount(db);
    const result = await getPotAllocationRules(acct.id);
    expect(result).toEqual([]);
  });

  it("returns rules in priority order", async () => {
    const acct = await seedAccount(db);
    await db.insert(potAllocationRule).values([
      { accountId: acct.id, name: "B", priority: 2, isActive: 1 },
      { accountId: acct.id, name: "A", priority: 1, isActive: 1 },
    ]);
    const result = await getPotAllocationRules(acct.id);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("B");
  });

  it("does not return rules from other accounts", async () => {
    const acct1 = await seedAccount(db, "Account 1");
    const acct2 = await seedAccount(db, "Account 2");
    await db.insert(potAllocationRule).values({ accountId: acct1.id, name: "Rule A", priority: 1, isActive: 1 });
    const result = await getPotAllocationRules(acct2.id);
    expect(result).toEqual([]);
  });

  it("includes conditions and actions for each rule", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    await db.insert(potAllocationRule).values({ accountId: acct.id, name: "Rule", priority: 1, isActive: 1 });
    const [rule] = await db.select().from(potAllocationRule);
    await db.insert(potAllocationRuleCondition).values({ ruleId: rule.id, field: "description", operator: "contains", value: "SALARY" });
    await db.insert(potAllocationRuleAction).values({ ruleId: rule.id, potId: p.id, allocationValue: 100 });

    const result = await getPotAllocationRules(acct.id);
    expect(result[0].conditions).toHaveLength(1);
    expect(result[0].conditions[0].field).toBe("description");
    expect(result[0].actions).toHaveLength(1);
    expect(result[0].actions[0].allocationValue).toBe(100);
  });

  it("with activeOnly:true returns only active rules", async () => {
    const acct = await seedAccount(db);
    await db.insert(potAllocationRule).values([
      { accountId: acct.id, name: "Active", priority: 1, isActive: 1 },
      { accountId: acct.id, name: "Inactive", priority: 2, isActive: 0 },
    ]);
    const result = await getPotAllocationRules(acct.id, { activeOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Active");
  });
});

// ---------------------------------------------------------------------------
// createPotAllocationRule
// ---------------------------------------------------------------------------

describe("createPotAllocationRule", () => {
  it("creates a rule with priority = max + 1", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    await db.insert(potAllocationRule).values({ accountId: acct.id, name: "Existing", priority: 2, isActive: 1 });

    await createPotAllocationRule(acct.id, {
      name: "New Rule",
      conditions: [{ field: "description", operator: "contains", value: "SALARY" }],
      actions: [{ potId: p.id, allocationValue: 200 }],
    });

    const rules = await getPotAllocationRules(acct.id);
    const newRule = rules.find((r) => r.name === "New Rule");
    expect(newRule).toBeDefined();
    expect(newRule!.priority).toBe(3);
    expect(newRule!.conditions).toHaveLength(1);
    expect(newRule!.actions).toHaveLength(1);
  });

  it("creates rule with priority 1 when no existing rules", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    await createPotAllocationRule(acct.id, {
      name: "First Rule",
      conditions: [{ field: "amount", operator: "greater_than", value: "1000" }],
      actions: [{ potId: p.id, allocationValue: 50 }],
    });

    const rules = await getPotAllocationRules(acct.id);
    expect(rules[0].priority).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updatePotAllocationRule
// ---------------------------------------------------------------------------

describe("updatePotAllocationRule", () => {
  it("updates the rule name and replaces conditions and actions", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const id = await createPotAllocationRule(acct.id, {
      name: "Old Name",
      conditions: [{ field: "description", operator: "contains", value: "OLD" }],
      actions: [{ potId: p.id, allocationValue: 100 }],
    });

    await updatePotAllocationRule(id, {
      name: "New Name",
      conditions: [{ field: "amount", operator: "greater_than", value: "500" }],
      actions: [{ potId: p.id, allocationValue: 250 }],
    });

    const rules = await getPotAllocationRules(acct.id);
    expect(rules[0].name).toBe("New Name");
    expect(rules[0].conditions).toHaveLength(1);
    expect(rules[0].conditions[0].field).toBe("amount");
    expect(rules[0].actions[0].allocationValue).toBe(250);
  });

  it("does not change priority or is_active on update", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const id = await createPotAllocationRule(acct.id, {
      name: "Rule",
      conditions: [{ field: "description", operator: "contains", value: "X" }],
      actions: [{ potId: p.id, allocationValue: 50 }],
    });
    await db.update(potAllocationRule).set({ isActive: 0 }).where(eq(potAllocationRule.id, id));

    await updatePotAllocationRule(id, {
      name: "Updated",
      conditions: [{ field: "description", operator: "contains", value: "Y" }],
      actions: [{ potId: p.id, allocationValue: 75 }],
    });

    const rules = await getPotAllocationRules(acct.id);
    expect(rules[0].isActive).toBe(0);
    expect(rules[0].priority).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// deletePotAllocationRule
// ---------------------------------------------------------------------------

describe("deletePotAllocationRule", () => {
  it("removes the rule, its conditions, and its actions", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const id = await createPotAllocationRule(acct.id, {
      name: "To Delete",
      conditions: [{ field: "description", operator: "contains", value: "X" }],
      actions: [{ potId: p.id, allocationValue: 100 }],
    });

    await deletePotAllocationRule(id);

    const rules = await db.select().from(potAllocationRule);
    const conditions = await db.select().from(potAllocationRuleCondition);
    const actions = await db.select().from(potAllocationRuleAction);
    expect(rules).toHaveLength(0);
    expect(conditions).toHaveLength(0);
    expect(actions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// togglePotAllocationRuleActive
// ---------------------------------------------------------------------------

describe("togglePotAllocationRuleActive", () => {
  it("toggles is_active from 1 to 0", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const id = await createPotAllocationRule(acct.id, {
      name: "Rule",
      conditions: [{ field: "description", operator: "contains", value: "X" }],
      actions: [{ potId: p.id, allocationValue: 100 }],
    });

    await togglePotAllocationRuleActive(id);
    const [row] = await db.select().from(potAllocationRule).where(eq(potAllocationRule.id, id));
    expect(row.isActive).toBe(0);
  });

  it("toggles is_active from 0 to 1", async () => {
    const acct = await seedAccount(db);
    const p = await seedPot(db, acct.id);
    const id = await createPotAllocationRule(acct.id, {
      name: "Rule",
      conditions: [{ field: "description", operator: "contains", value: "X" }],
      actions: [{ potId: p.id, allocationValue: 100 }],
    });
    await db.update(potAllocationRule).set({ isActive: 0 }).where(eq(potAllocationRule.id, id));

    await togglePotAllocationRuleActive(id);
    const [row] = await db.select().from(potAllocationRule).where(eq(potAllocationRule.id, id));
    expect(row.isActive).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// reorderPotAllocationRules
// ---------------------------------------------------------------------------

describe("reorderPotAllocationRules", () => {
  it("updates priority for all rules in the provided order", async () => {
    const acct = await seedAccount(db);
    await db.insert(potAllocationRule).values([
      { accountId: acct.id, name: "A", priority: 1, isActive: 1 },
      { accountId: acct.id, name: "B", priority: 2, isActive: 1 },
      { accountId: acct.id, name: "C", priority: 3, isActive: 1 },
    ]);
    const rules = await db.select().from(potAllocationRule).where(eq(potAllocationRule.accountId, acct.id));
    const [ruleA, ruleB, ruleC] = rules;

    // Reorder: C, A, B
    await reorderPotAllocationRules([ruleC.id, ruleA.id, ruleB.id]);

    const updated = await getPotAllocationRules(acct.id);
    expect(updated[0].name).toBe("C");
    expect(updated[1].name).toBe("A");
    expect(updated[2].name).toBe("B");
    expect(updated[0].priority).toBe(1);
    expect(updated[1].priority).toBe(2);
    expect(updated[2].priority).toBe(3);
  });
});
