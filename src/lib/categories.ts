import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import { category, transaction } from "./db/schema";

export type Category = typeof category.$inferSelect;

export class CategoryInUseError extends Error {
  readonly code = "CATEGORY_IN_USE";
  readonly transactionCount: number;

  constructor(transactionCount: number) {
    super(`Category is assigned to ${transactionCount} transaction(s)`);
    this.transactionCount = transactionCount;
  }
}

export async function listCategories(): Promise<Category[]> {
  const db = getDb();
  return db.select().from(category).orderBy(asc(category.name));
}

export async function createCategory(name: string): Promise<void> {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name is required");
  }
  const existing = await db
    .select({ id: category.id })
    .from(category)
    .where(sql`lower(${category.name}) = lower(${trimmed})`);
  if (existing.length > 0) {
    throw new Error("A category with this name already exists");
  }
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${category.sortOrder}), 0)` })
    .from(category);
  await db.insert(category).values({ name: trimmed, sortOrder: maxOrder + 1 });
}

/**
 * Delete a category.
 *
 * - System categories (is_system = 1) cannot be deleted.
 * - If the category is assigned to non-voided transactions and no
 *   `replacementId` is provided, throws `CategoryInUseError`.
 * - If `replacementId` is provided, reassigns all affected transactions before
 *   deleting the category.
 *
 * NOTE(#10): When categorisation rules ship, this function must also reassign
 * any rules referencing the deleted category to the replacement.
 */
export async function deleteCategory(
  id: number,
  replacementId?: number,
): Promise<void> {
  const db = getDb();

  const [target] = await db
    .select()
    .from(category)
    .where(eq(category.id, id));
  if (!target) {
    throw new Error("Category not found");
  }
  if (target.isSystem) {
    throw new Error("System categories cannot be deleted");
  }

  const [{ txCount }] = await db
    .select({ txCount: count() })
    .from(transaction)
    .where(and(eq(transaction.categoryId, id), eq(transaction.isVoid, 0)));

  if (txCount > 0 && replacementId === undefined) {
    throw new CategoryInUseError(txCount);
  }

  if (txCount > 0 && replacementId !== undefined) {
    const [replacement] = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.id, replacementId), ne(category.id, id)));
    if (!replacement) {
      throw new Error("Replacement category not found");
    }
    await db
      .update(transaction)
      .set({ categoryId: replacementId })
      .where(and(eq(transaction.categoryId, id), eq(transaction.isVoid, 0)));
    // TODO(#10): reassign categorisation rules referencing this category
  }

  // Null out any remaining references (voided transactions) so the FK allows deletion
  await db
    .update(transaction)
    .set({ categoryId: null })
    .where(eq(transaction.categoryId, id));

  await db.delete(category).where(eq(category.id, id));
}
