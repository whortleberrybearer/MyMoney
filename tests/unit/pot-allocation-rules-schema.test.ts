import { describe, it, expect } from "vitest";
import { createTestDb } from "./db-helper";
import {
  account,
  institution,
  pot,
  potAllocationRule,
  potAllocationRuleAction,
  potAllocationRuleCondition,
} from "@/lib/db/schema";

async function seedAccount(db: ReturnType<typeof createTestDb>) {
  await db.insert(institution).values({ name: "Test Bank" });
  const [inst] = await db.select().from(institution);
  await db.insert(account).values({
    name: "Test Account",
    institutionId: inst.id,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2024-01-01",
    isActive: 1,
    isDeleted: 0,
  });
  const [acct] = await db.select().from(account);
  return acct;
}

describe("pot allocation rules schema migration", () => {
  it("can insert and select from pot_allocation_rule", async () => {
    const db = createTestDb();
    const acct = await seedAccount(db);

    await db.insert(potAllocationRule).values({
      accountId: acct.id,
      name: "Salary split",
      priority: 1,
      isActive: 1,
    });

    const rows = await db.select().from(potAllocationRule);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Salary split");
    expect(rows[0].priority).toBe(1);
    expect(rows[0].isActive).toBe(1);
    expect(rows[0].accountId).toBe(acct.id);
  });

  it("can insert and select from pot_allocation_rule_condition", async () => {
    const db = createTestDb();
    const acct = await seedAccount(db);

    await db.insert(potAllocationRule).values({ accountId: acct.id, name: "Rule A", priority: 1, isActive: 1 });
    const [rule] = await db.select().from(potAllocationRule);

    await db.insert(potAllocationRuleCondition).values({
      ruleId: rule.id,
      field: "description",
      operator: "contains",
      value: "SALARY",
    });

    const rows = await db.select().from(potAllocationRuleCondition);
    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe("description");
    expect(rows[0].operator).toBe("contains");
    expect(rows[0].value).toBe("SALARY");
  });

  it("can insert and select from pot_allocation_rule_action", async () => {
    const db = createTestDb();
    const acct = await seedAccount(db);

    await db.insert(pot).values({ accountId: acct.id, name: "Holiday Pot", openingBalance: 0, openingDate: "2024-01-01", isActive: 1 });
    const [p] = await db.select().from(pot);

    await db.insert(potAllocationRule).values({ accountId: acct.id, name: "Rule B", priority: 1, isActive: 1 });
    const [rule] = await db.select().from(potAllocationRule);

    await db.insert(potAllocationRuleAction).values({
      ruleId: rule.id,
      potId: p.id,
      allocationValue: 200.0,
    });

    const rows = await db.select().from(potAllocationRuleAction);
    expect(rows).toHaveLength(1);
    expect(rows[0].potId).toBe(p.id);
    expect(rows[0].allocationValue).toBe(200.0);
  });

  it("migration is idempotent — multiple createTestDb calls succeed", () => {
    const db1 = createTestDb();
    const db2 = createTestDb();
    expect(db1).toBeDefined();
    expect(db2).toBeDefined();
  });
});
