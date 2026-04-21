import { and, asc, eq, max, sql } from "drizzle-orm";
import { getDb } from "./db";
import { category, pot, transaction } from "./db/schema";
import { getPotAllocationRules, type PotAllocationRule } from "./pot-allocation-rules";

export type PotAllocationFailure = {
  ruleName: string;
  potNames: string[];
};

export type PotAllocationResult = {
  allocations: number;
  failures: PotAllocationFailure[];
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Evaluates active pot allocation rules for the given account against the
 * specified transaction IDs (newly imported). Returns the number of virtual
 * transfer pairs created and any rule failures due to insufficient balance.
 *
 * Must be called after the categorisation rules engine has already run.
 */
export async function applyPotAllocationRules(
  accountId: number,
  transactionIds: number[],
): Promise<PotAllocationResult> {
  if (transactionIds.length === 0) return { allocations: 0, failures: [] };

  const db = getDb();
  const rules = await getPotAllocationRules(accountId, { activeOnly: true });

  if (rules.length === 0) return { allocations: 0, failures: [] };

  // Load transactions in import order (ascending id)
  const txRows = await db
    .select({
      id: transaction.id,
      notes: transaction.notes,
      reference: transaction.reference,
      amount: transaction.amount,
      type: transaction.type,
      date: transaction.date,
    })
    .from(transaction)
    .where(and(eq(transaction.isVoid, 0), sql`${transaction.id} IN (${sql.join(transactionIds.map((id) => sql`${id}`), sql`, `)})`))
    .orderBy(asc(transaction.id));

  const savingsTransferCategoryId = await ensureSavingsTransferCategory();

  let allocations = 0;
  const failures: PotAllocationFailure[] = [];

  for (const tx of txRows) {
    let matched = false;

    for (const rule of rules) {
      if (!evaluateRule(rule, tx)) continue;

      // First match wins — check balance before creating transfers
      const total = rule.actions.reduce((sum, a) => sum + a.allocationValue, 0);
      const balance = await getAccountRunningBalance(accountId);

      if (total > balance) {
        const potIds = rule.actions.map((a) => a.potId);
        const potRows = await db
          .select({ id: pot.id, name: pot.name })
          .from(pot)
          .where(sql`${pot.id} IN (${sql.join(potIds.map((id) => sql`${id}`), sql`, `)})`);
        const potNameById = new Map(potRows.map((p) => [p.id, p.name]));

        failures.push({
          ruleName: rule.name,
          potNames: potIds.map((id) => potNameById.get(id) ?? `Pot ${id}`),
        });
        matched = true;
        break;
      }

      // Sufficient balance — create virtual transfer pairs
      const transferId = await nextTransferId();

      for (const action of rule.actions) {
        const potRow = await db
          .select({ name: pot.name })
          .from(pot)
          .where(eq(pot.id, action.potId))
          .limit(1);
        const potName = potRow[0]?.name ?? "unknown pot";
        const notes = `Auto-transfer to ${potName}`;

        await db.insert(transaction).values([
          {
            accountId,
            potId: null,
            transferId,
            amount: -action.allocationValue,
            date: tx.date,
            notes,
            type: "virtual_transfer",
            categoryId: savingsTransferCategoryId,
            isVoid: 0,
          },
          {
            accountId: null,
            potId: action.potId,
            transferId,
            amount: action.allocationValue,
            date: tx.date,
            notes,
            type: "virtual_transfer",
            categoryId: savingsTransferCategoryId,
            isVoid: 0,
          },
        ]);

        allocations++;
      }

      // Recalculate running balances after all transfers for this rule
      await recalculateAccountRunningBalance(accountId, tx.date);
      for (const action of rule.actions) {
        await recalculatePotRunningBalance(action.potId, tx.date);
      }

      matched = true;
      break;
    }

    void matched;
  }

  return { allocations, failures };
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
};

function evaluateRule(rule: PotAllocationRule, tx: TxSnapshot): boolean {
  if (rule.conditions.length === 0) return true;
  return rule.conditions.every((cond) => evaluateCondition(cond, tx));
}

function evaluateCondition(
  cond: { field: string; operator: string; value: string },
  tx: TxSnapshot,
): boolean {
  let fieldValue: string | number | null;

  switch (cond.field) {
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
    default:
      return false;
  }

  if (fieldValue === null || fieldValue === undefined) return false;

  switch (cond.operator) {
    case "contains":
      return String(fieldValue).toLowerCase().includes(cond.value.toLowerCase());
    case "starts_with":
      return String(fieldValue).toLowerCase().startsWith(cond.value.toLowerCase());
    case "equals":
      return String(fieldValue).toLowerCase() === cond.value.toLowerCase();
    case "greater_than": {
      const num = Number(cond.value);
      if (isNaN(num)) return false;
      return typeof fieldValue === "number" && fieldValue > num;
    }
    case "less_than": {
      const num = Number(cond.value);
      if (isNaN(num)) return false;
      return typeof fieldValue === "number" && fieldValue < num;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureSavingsTransferCategory(): Promise<number> {
  const db = getDb();
  const existing = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.name, "Savings transfer"))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [maxSortRow] = await db
    .select({ maxSort: sql<number>`coalesce(max(${category.sortOrder}), 0)` })
    .from(category);

  await db.insert(category).values({
    name: "Savings transfer",
    isSystem: 1,
    sortOrder: maxSortRow.maxSort + 1,
  });

  const [newCat] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.name, "Savings transfer"));
  return newCat.id;
}

async function nextTransferId(): Promise<number> {
  const db = getDb();
  const [maxRow] = await db
    .select({ maxId: max(transaction.transferId) })
    .from(transaction);
  return (maxRow?.maxId ?? 0) + 1;
}

async function getAccountRunningBalance(accountId: number): Promise<number> {
  const db = getDb();
  const [lastTx] = await db
    .select({ runningBalance: transaction.runningBalance })
    .from(transaction)
    .where(and(eq(transaction.accountId, accountId), eq(transaction.isVoid, 0)))
    .orderBy(sql`${transaction.date} desc, ${transaction.id} desc`)
    .limit(1);
  return lastTx?.runningBalance ?? 0;
}

async function recalculateAccountRunningBalance(accountId: number, fromDate: string): Promise<void> {
  const { recalculateRunningBalance } = await import("./transactions");
  await recalculateRunningBalance(accountId, fromDate);
}

async function recalculatePotRunningBalance(potId: number, fromDate: string): Promise<void> {
  const { recalculatePotRunningBalance: recalc } = await import("./transactions");
  await recalc(potId, fromDate);
}
