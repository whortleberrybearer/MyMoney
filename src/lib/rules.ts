import { asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  account,
  categorisationRule,
  category,
  ruleAction,
  ruleCondition,
  transaction,
} from "./db/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RuleCondition = {
  id?: number;
  field: string;
  operator: string;
  value: string;
};

export type RuleAction = {
  id?: number;
  actionType: "assign_category" | "set_note";
  categoryId?: number | null;
  note?: string | null;
};

export type Rule = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
};

export type CreateRuleInput = {
  name: string;
  conditions: Omit<RuleCondition, "id">[];
  actions: Omit<RuleAction, "id">[];
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Apply active categorisation rules to the specified transactions (or all
 * non-void transactions when no IDs are provided). Returns the number of
 * transactions that were assigned a non-Uncategorised category.
 */
export async function applyRules(transactionIds?: number[]): Promise<number> {
  const db = getDb();

  // Load the Uncategorised system category id
  const [uncatRow] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.name, "Uncategorised"));

  if (!uncatRow) {
    throw new Error("Uncategorised category not found in database");
  }
  const uncategorisedId = uncatRow.id;

  // Load all active rules with their conditions and actions, ordered by priority
  const rules = await getRules({ activeOnly: true });

  // Load the transactions to process
  let txQuery = db
    .select({
      id: transaction.id,
      notes: transaction.notes,
      reference: transaction.reference,
      amount: transaction.amount,
      type: transaction.type,
      payee: transaction.payee,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
    })
    .from(transaction)
    .where(eq(transaction.isVoid, 0));

  const txRows = transactionIds?.length
    ? (await txQuery).filter((t) => transactionIds.includes(t.id))
    : await txQuery;

  if (txRows.length === 0) return 0;

  // Load accounts for name-based matching on the `account` field
  const allAccounts = await db.select({ id: account.id, name: account.name }).from(account);
  const accountNameById = new Map(allAccounts.map((a) => [a.id, a.name]));

  // Load categories for name-based matching on the `category` field
  const allCategories = await db.select({ id: category.id, name: category.name }).from(category);
  const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));

  let categorisedCount = 0;

  for (const tx of txRows) {
    let matchedRule: Rule | null = null;

    for (const rule of rules) {
      if (evaluateRule(rule, tx, accountNameById, categoryNameById)) {
        matchedRule = rule;
        break; // first-match-wins
      }
    }

    const updates: Partial<{ categoryId: number | null; notes: string | null }> = {};

    if (matchedRule) {
      for (const action of matchedRule.actions) {
        if (action.actionType === "assign_category" && action.categoryId != null) {
          updates.categoryId = action.categoryId;
        } else if (action.actionType === "set_note") {
          updates.notes = action.note ?? null;
        }
      }
      if (!("categoryId" in updates)) {
        updates.categoryId = uncategorisedId;
      }
    } else {
      updates.categoryId = uncategorisedId;
    }

    await db.update(transaction).set(updates).where(eq(transaction.id, tx.id));

    if (updates.categoryId !== uncategorisedId) {
      categorisedCount++;
    }
  }

  return categorisedCount;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

type TxSnapshot = {
  id: number;
  notes: string | null;
  reference: string | null;
  amount: number;
  type: string;
  payee: string | null;
  accountId: number | null;
  categoryId: number | null;
};

function evaluateRule(
  rule: Rule,
  tx: TxSnapshot,
  accountNameById: Map<number, string>,
  categoryNameById: Map<number, string>,
): boolean {
  // Vacuous truth: no conditions = matches everything
  if (rule.conditions.length === 0) return true;

  return rule.conditions.every((cond) =>
    evaluateCondition(cond, tx, accountNameById, categoryNameById),
  );
}

function evaluateCondition(
  cond: RuleCondition,
  tx: TxSnapshot,
  accountNameById: Map<number, string>,
  categoryNameById: Map<number, string>,
): boolean {
  const { field, operator, value } = cond;

  let fieldValue: string | number | null;

  switch (field) {
    case "description":
      fieldValue = tx.notes;
      break;
    case "reference":
      fieldValue = tx.reference;
      break;
    case "amount":
      fieldValue = tx.amount;
      break;
    case "transaction_type":
      fieldValue = tx.type;
      break;
    case "payee":
      fieldValue = tx.payee;
      break;
    case "account":
      fieldValue = tx.accountId != null ? (accountNameById.get(tx.accountId) ?? null) : null;
      break;
    case "category":
      fieldValue = tx.categoryId != null ? (categoryNameById.get(tx.categoryId) ?? null) : null;
      break;
    default:
      return false;
  }

  if (fieldValue === null || fieldValue === undefined) return false;

  switch (operator) {
    case "contains":
      return String(fieldValue).toLowerCase().includes(value.toLowerCase());
    case "starts_with":
      return String(fieldValue).toLowerCase().startsWith(value.toLowerCase());
    case "equals":
      return String(fieldValue).toLowerCase() === value.toLowerCase();
    case "greater_than": {
      const num = Number(value);
      if (isNaN(num)) return false;
      return typeof fieldValue === "number" && fieldValue > num;
    }
    case "less_than": {
      const num = Number(value);
      if (isNaN(num)) return false;
      return typeof fieldValue === "number" && fieldValue < num;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getRules(opts?: { activeOnly?: boolean }): Promise<Rule[]> {
  const db = getDb();

  const ruleRows = await db
    .select()
    .from(categorisationRule)
    .where(opts?.activeOnly ? eq(categorisationRule.isActive, 1) : undefined)
    .orderBy(asc(categorisationRule.sortOrder));

  if (ruleRows.length === 0) return [];

  const ruleIds = ruleRows.map((r) => r.id);

  const conditionRows = await db
    .select()
    .from(ruleCondition)
    .where(inArray(ruleCondition.ruleId, ruleIds));

  const actionRows = await db
    .select()
    .from(ruleAction)
    .where(inArray(ruleAction.ruleId, ruleIds));

  return ruleRows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    conditions: conditionRows
      .filter((c) => c.ruleId === r.id)
      .map((c) => ({ id: c.id, field: c.field, operator: c.operator, value: c.value })),
    actions: actionRows
      .filter((a) => a.ruleId === r.id)
      .map((a) => ({
        id: a.id,
        actionType: a.actionType as "assign_category" | "set_note",
        categoryId: a.categoryId,
        note: a.note,
      })),
  }));
}

export async function createRule(input: CreateRuleInput): Promise<number> {
  const db = getDb();

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${categorisationRule.sortOrder}), 0)` })
    .from(categorisationRule);

  await db.insert(categorisationRule).values({
    name: input.name,
    sortOrder: maxOrder + 1,
    isActive: 1,
  });

  const [newRule] = await db
    .select()
    .from(categorisationRule)
    .orderBy(sql`id desc`)
    .limit(1);

  if (input.conditions.length > 0) {
    await db
      .insert(ruleCondition)
      .values(input.conditions.map((c) => ({ ...c, ruleId: newRule.id })));
  }

  if (input.actions.length > 0) {
    await db
      .insert(ruleAction)
      .values(input.actions.map((a) => ({ ...a, ruleId: newRule.id })));
  }

  return newRule.id;
}

export async function updateRule(
  id: number,
  input: CreateRuleInput,
): Promise<void> {
  const db = getDb();

  await db.update(categorisationRule).set({ name: input.name }).where(eq(categorisationRule.id, id));

  // Delete-and-reinsert child rows
  await db.delete(ruleCondition).where(eq(ruleCondition.ruleId, id));
  await db.delete(ruleAction).where(eq(ruleAction.ruleId, id));

  if (input.conditions.length > 0) {
    await db.insert(ruleCondition).values(input.conditions.map((c) => ({ ...c, ruleId: id })));
  }

  if (input.actions.length > 0) {
    await db.insert(ruleAction).values(input.actions.map((a) => ({ ...a, ruleId: id })));
  }
}

export async function deleteRule(id: number): Promise<void> {
  const db = getDb();
  await db.delete(ruleAction).where(eq(ruleAction.ruleId, id));
  await db.delete(ruleCondition).where(eq(ruleCondition.ruleId, id));
  await db.delete(categorisationRule).where(eq(categorisationRule.id, id));
}

export async function toggleRuleActive(id: number): Promise<void> {
  const db = getDb();
  await db
    .update(categorisationRule)
    .set({ isActive: sql`CASE WHEN ${categorisationRule.isActive} = 1 THEN 0 ELSE 1 END` })
    .where(eq(categorisationRule.id, id));
}

export async function reorderRules(orderedIds: number[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(categorisationRule)
      .set({ sortOrder: i + 1 })
      .where(eq(categorisationRule.id, orderedIds[i]));
  }
}
