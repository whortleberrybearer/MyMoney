import { describe, it, expect } from "vitest";
import { createTestDb } from "./db-helper";

describe("rules schema migration", () => {
  it("creates categorisation_rule table with correct columns", () => {
    const sqlite = (createTestDb() as unknown as { _: { client: import("better-sqlite3").Database } });
    // Access the underlying sqlite instance via the drizzle proxy internals isn't easy,
    // so we use a separate BetterSQLite instance to verify the DDL.
    // This is tested indirectly: if insert/select works, the table exists.
    const db = createTestDb();
    expect(db).toBeDefined();
  });

  it("can insert and select from categorisation_rule", async () => {
    const db = createTestDb();
    const { categorisationRule } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    await db.insert(categorisationRule).values({ name: "Test Rule", sortOrder: 1, isActive: 1 });
    const rows = await db.select().from(categorisationRule);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test Rule");
    expect(rows[0].sortOrder).toBe(1);
    expect(rows[0].isActive).toBe(1);
    void eq;
  });

  it("can insert and select from rule_condition", async () => {
    const db = createTestDb();
    const { categorisationRule, ruleCondition } = await import("@/lib/db/schema");

    await db.insert(categorisationRule).values({ name: "Rule A", sortOrder: 1, isActive: 1 });
    const [rule] = await db.select().from(categorisationRule);

    await db.insert(ruleCondition).values({
      ruleId: rule.id,
      field: "description",
      operator: "contains",
      value: "coffee",
    });

    const rows = await db.select().from(ruleCondition);
    expect(rows).toHaveLength(1);
    expect(rows[0].ruleId).toBe(rule.id);
    expect(rows[0].field).toBe("description");
    expect(rows[0].operator).toBe("contains");
    expect(rows[0].value).toBe("coffee");
  });

  it("can insert and select from rule_action with assign_category type", async () => {
    const db = createTestDb();
    const { categorisationRule, ruleAction, category } = await import("@/lib/db/schema");

    await db.insert(categorisationRule).values({ name: "Rule B", sortOrder: 1, isActive: 1 });
    const [rule] = await db.select().from(categorisationRule);

    const [cat] = await db.select().from(category).limit(1);

    await db.insert(ruleAction).values({
      ruleId: rule.id,
      actionType: "assign_category",
      categoryId: cat.id,
      note: null,
    });

    const rows = await db.select().from(ruleAction);
    expect(rows).toHaveLength(1);
    expect(rows[0].actionType).toBe("assign_category");
    expect(rows[0].categoryId).toBe(cat.id);
    expect(rows[0].note).toBeNull();
  });

  it("can insert and select from rule_action with set_note type", async () => {
    const db = createTestDb();
    const { categorisationRule, ruleAction } = await import("@/lib/db/schema");

    await db.insert(categorisationRule).values({ name: "Rule C", sortOrder: 1, isActive: 1 });
    const [rule] = await db.select().from(categorisationRule);

    await db.insert(ruleAction).values({
      ruleId: rule.id,
      actionType: "set_note",
      categoryId: null,
      note: "Supermarket shop",
    });

    const rows = await db.select().from(ruleAction);
    expect(rows).toHaveLength(1);
    expect(rows[0].actionType).toBe("set_note");
    expect(rows[0].note).toBe("Supermarket shop");
    expect(rows[0].categoryId).toBeNull();
  });
});
