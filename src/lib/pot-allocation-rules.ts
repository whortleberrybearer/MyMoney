import { asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  potAllocationRule,
  potAllocationRuleAction,
  potAllocationRuleCondition,
} from "./db/schema";

export type PotAllocationCondition = {
  id?: number;
  field: string;
  operator: string;
  value: string;
};

export type PotAllocationAction = {
  id?: number;
  potId: number;
  allocationValue: number;
};

export type PotAllocationRule = {
  id: number;
  accountId: number;
  name: string;
  priority: number;
  isActive: number;
  conditions: PotAllocationCondition[];
  actions: PotAllocationAction[];
};

export type CreatePotAllocationRuleInput = {
  name: string;
  conditions: Omit<PotAllocationCondition, "id">[];
  actions: Omit<PotAllocationAction, "id">[];
};

export async function getPotAllocationRules(
  accountId: number,
  opts?: { activeOnly?: boolean },
): Promise<PotAllocationRule[]> {
  const db = getDb();

  const ruleRows = await db
    .select()
    .from(potAllocationRule)
    .where(
      opts?.activeOnly
        ? sql`${potAllocationRule.accountId} = ${accountId} AND ${potAllocationRule.isActive} = 1`
        : eq(potAllocationRule.accountId, accountId),
    )
    .orderBy(asc(potAllocationRule.priority));

  if (ruleRows.length === 0) return [];

  const ruleIds = ruleRows.map((r) => r.id);

  const conditionRows = await db
    .select()
    .from(potAllocationRuleCondition)
    .where(inArray(potAllocationRuleCondition.ruleId, ruleIds));

  const actionRows = await db
    .select()
    .from(potAllocationRuleAction)
    .where(inArray(potAllocationRuleAction.ruleId, ruleIds));

  return ruleRows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    priority: r.priority,
    isActive: r.isActive,
    conditions: conditionRows
      .filter((c) => c.ruleId === r.id)
      .map((c) => ({ id: c.id, field: c.field, operator: c.operator, value: c.value })),
    actions: actionRows
      .filter((a) => a.ruleId === r.id)
      .map((a) => ({ id: a.id, potId: a.potId, allocationValue: a.allocationValue })),
  }));
}

export async function createPotAllocationRule(
  accountId: number,
  input: CreatePotAllocationRuleInput,
): Promise<number> {
  const db = getDb();

  const [{ maxPriority }] = await db
    .select({
      maxPriority: sql<number>`coalesce(max(${potAllocationRule.priority}), 0)`,
    })
    .from(potAllocationRule)
    .where(eq(potAllocationRule.accountId, accountId));

  await db.insert(potAllocationRule).values({
    accountId,
    name: input.name,
    priority: maxPriority + 1,
    isActive: 1,
  });

  const [newRule] = await db
    .select()
    .from(potAllocationRule)
    .where(eq(potAllocationRule.accountId, accountId))
    .orderBy(sql`id desc`)
    .limit(1);

  if (input.conditions.length > 0) {
    await db
      .insert(potAllocationRuleCondition)
      .values(input.conditions.map((c) => ({ ...c, ruleId: newRule.id })));
  }

  if (input.actions.length > 0) {
    await db
      .insert(potAllocationRuleAction)
      .values(input.actions.map((a) => ({ ...a, ruleId: newRule.id })));
  }

  return newRule.id;
}

export async function updatePotAllocationRule(
  id: number,
  input: CreatePotAllocationRuleInput,
): Promise<void> {
  const db = getDb();

  await db
    .update(potAllocationRule)
    .set({ name: input.name })
    .where(eq(potAllocationRule.id, id));

  await db.delete(potAllocationRuleCondition).where(eq(potAllocationRuleCondition.ruleId, id));
  await db.delete(potAllocationRuleAction).where(eq(potAllocationRuleAction.ruleId, id));

  if (input.conditions.length > 0) {
    await db
      .insert(potAllocationRuleCondition)
      .values(input.conditions.map((c) => ({ ...c, ruleId: id })));
  }

  if (input.actions.length > 0) {
    await db
      .insert(potAllocationRuleAction)
      .values(input.actions.map((a) => ({ ...a, ruleId: id })));
  }
}

export async function deletePotAllocationRule(id: number): Promise<void> {
  const db = getDb();
  await db.delete(potAllocationRuleAction).where(eq(potAllocationRuleAction.ruleId, id));
  await db.delete(potAllocationRuleCondition).where(eq(potAllocationRuleCondition.ruleId, id));
  await db.delete(potAllocationRule).where(eq(potAllocationRule.id, id));
}

export async function togglePotAllocationRuleActive(id: number): Promise<void> {
  const db = getDb();
  await db
    .update(potAllocationRule)
    .set({
      isActive: sql`CASE WHEN ${potAllocationRule.isActive} = 1 THEN 0 ELSE 1 END`,
    })
    .where(eq(potAllocationRule.id, id));
}

export async function reorderPotAllocationRules(orderedIds: number[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(potAllocationRule)
      .set({ priority: i + 1 })
      .where(eq(potAllocationRule.id, orderedIds[i]));
  }
}
