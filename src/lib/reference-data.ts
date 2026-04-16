import { asc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { accountType, category, tag } from "./db/schema";

export type AccountType = typeof accountType.$inferSelect;
export type Tag = typeof tag.$inferSelect;
export type Category = typeof category.$inferSelect;

export async function listCategories(): Promise<Category[]> {
  const db = getDb();
  return db.select().from(category).orderBy(asc(category.sortOrder), asc(category.name));
}

export async function listAccountTypes(): Promise<AccountType[]> {
  const db = getDb();
  return db.select().from(accountType).orderBy(asc(accountType.name));
}

export async function listTags(): Promise<Tag[]> {
  const db = getDb();
  return db.select().from(tag).orderBy(asc(tag.name));
}

export async function createTag(name: string): Promise<Tag> {
  const db = getDb();
  const trimmed = name.trim();

  const existing = await db
    .select()
    .from(tag)
    .where(sql`lower(${tag.name}) = lower(${trimmed})`);
  if (existing.length > 0) {
    throw new Error("A tag with this name already exists");
  }

  await db.insert(tag).values({ name: trimmed });

  const [created] = await db
    .select()
    .from(tag)
    .where(sql`lower(${tag.name}) = lower(${trimmed})`);
  return created;
}

export const CURRENCIES = ["GBP", "USD", "EUR", "JPY", "CAD", "AUD", "CHF"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "GBP";
