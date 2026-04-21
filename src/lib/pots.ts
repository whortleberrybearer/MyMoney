import { and, asc, eq, sql, sum } from "drizzle-orm";
import { getDb } from "./db";
import { pot, potTag, tag, transaction } from "./db/schema";

export type PotRow = {
  id: number;
  accountId: number;
  name: string;
  openingBalance: number;
  openingDate: string;
  isActive: number;
  notes: string | null;
  tagId: number | null;
  tagName: string | null;
  currentBalance: number;
};

export type CreatePotInput = {
  accountId: number;
  name: string;
  openingBalance?: number;
  openingDate: string;
  notes?: string;
  tagId?: number;
};

export type UpdatePotInput = CreatePotInput & { id: number };

/**
 * Lists pots for a given account, with calculated current balance.
 *
 * @param accountId - The parent account.
 * @param showClosed - When true, includes pots with is_active=0.
 */
export async function listPots(
  accountId: number,
  showClosed: boolean,
): Promise<PotRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: pot.id,
      accountId: pot.accountId,
      name: pot.name,
      openingBalance: pot.openingBalance,
      openingDate: pot.openingDate,
      isActive: pot.isActive,
      notes: pot.notes,
      tagId: sql<number | null>`${tag.id}`.as("tagId"),
      tagName: sql<string | null>`${tag.name}`.as("tagName"),
    })
    .from(pot)
    .leftJoin(potTag, eq(pot.id, potTag.potId))
    .leftJoin(tag, eq(potTag.tagId, tag.id))
    .where(
      and(
        eq(pot.accountId, accountId),
        showClosed ? undefined : eq(pot.isActive, 1),
      ),
    )
    .orderBy(asc(pot.name));

  // Calculate current balance for each pot
  const results: PotRow[] = [];
  for (const row of rows) {
    const [balanceRow] = await db
      .select({ total: sum(transaction.amount) })
      .from(transaction)
      .where(and(eq(transaction.potId, row.id), eq(transaction.isVoid, 0)));

    const txSum = Number(balanceRow?.total ?? 0);
    results.push({
      ...(row as Omit<PotRow, "currentBalance">),
      currentBalance: row.openingBalance + txSum,
    });
  }

  return results;
}

export type PotSummary = {
  id: number;
  name: string;
};

/**
 * Returns the id and name of all active pots for an account.
 * Used to populate assignment dropdowns where balance is not needed.
 */
export async function getPotsForAccount(accountId: number): Promise<PotSummary[]> {
  const db = getDb();
  return db
    .select({ id: pot.id, name: pot.name })
    .from(pot)
    .where(and(eq(pot.accountId, accountId), eq(pot.isActive, 1)))
    .orderBy(asc(pot.name));
}

export async function createPot(input: CreatePotInput): Promise<void> {
  const db = getDb();
  const trimmedName = input.name.trim();

  const existing = await db
    .select({ id: pot.id })
    .from(pot)
    .where(
      and(
        eq(pot.accountId, input.accountId),
        sql`lower(${pot.name}) = lower(${trimmedName})`,
      ),
    );
  if (existing.length > 0) {
    throw new Error("A pot with this name already exists in this account");
  }

  await db.insert(pot).values({
    accountId: input.accountId,
    name: trimmedName,
    openingBalance: input.openingBalance ?? 0,
    openingDate: input.openingDate,
    notes: input.notes ?? null,
  });

  if (input.tagId !== undefined) {
    const [inserted] = await db
      .select({ id: pot.id })
      .from(pot)
      .where(
        and(
          eq(pot.accountId, input.accountId),
          sql`lower(${pot.name}) = lower(${trimmedName})`,
        ),
      )
      .orderBy(sql`${pot.id} DESC`)
      .limit(1);
    if (inserted) {
      await db.insert(potTag).values({ potId: inserted.id, tagId: input.tagId });
    }
  }
}

export async function updatePot(input: UpdatePotInput): Promise<void> {
  const db = getDb();
  const trimmedName = input.name.trim();

  const existing = await db
    .select({ id: pot.id })
    .from(pot)
    .where(
      and(
        eq(pot.accountId, input.accountId),
        sql`lower(${pot.name}) = lower(${trimmedName})`,
        sql`${pot.id} != ${input.id}`,
      ),
    );
  if (existing.length > 0) {
    throw new Error("A pot with this name already exists in this account");
  }

  await db
    .update(pot)
    .set({
      name: trimmedName,
      openingBalance: input.openingBalance ?? 0,
      openingDate: input.openingDate,
      notes: input.notes ?? null,
    })
    .where(eq(pot.id, input.id));

  await db.delete(potTag).where(eq(potTag.potId, input.id));
  if (input.tagId !== undefined) {
    await db.insert(potTag).values({ potId: input.id, tagId: input.tagId });
  }
}

/**
 * Returns the current calculated balance for a pot.
 */
export async function getPotBalance(potId: number): Promise<number> {
  const db = getDb();
  const [potRow] = await db
    .select({ openingBalance: pot.openingBalance })
    .from(pot)
    .where(eq(pot.id, potId));
  if (!potRow) throw new Error("Pot not found");

  const [balanceRow] = await db
    .select({ total: sum(transaction.amount) })
    .from(transaction)
    .where(and(eq(transaction.potId, potId), eq(transaction.isVoid, 0)));

  return potRow.openingBalance + Number(balanceRow?.total ?? 0);
}

/**
 * Closes a pot (sets is_active=0).
 * Returns the auto-transfer amount if one was needed (non-zero balance),
 * or 0 if the pot was already at zero. The caller is responsible for
 * creating the virtual transfer before calling this function when balance != 0.
 */
export async function closePot(potId: number): Promise<void> {
  const db = getDb();
  await db.update(pot).set({ isActive: 0 }).where(eq(pot.id, potId));
}

export async function reactivatePot(potId: number): Promise<void> {
  const db = getDb();
  await db.update(pot).set({ isActive: 1 }).where(eq(pot.id, potId));
}

/**
 * Hard deletes a pot: removes all its transaction rows, pot_tag rows, and the pot row.
 */
export async function deletePot(potId: number): Promise<void> {
  const db = getDb();
  await db.delete(transaction).where(eq(transaction.potId, potId));
  await db.delete(potTag).where(eq(potTag.potId, potId));
  await db.delete(pot).where(eq(pot.id, potId));
}
