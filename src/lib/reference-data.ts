import { asc } from "drizzle-orm";
import { getDb } from "./db";
import { accountType, tag } from "./db/schema";

export type AccountType = typeof accountType.$inferSelect;
export type Tag = typeof tag.$inferSelect;

export async function listAccountTypes(): Promise<AccountType[]> {
  const db = getDb();
  return db.select().from(accountType).orderBy(asc(accountType.name));
}

export async function listTags(): Promise<Tag[]> {
  const db = getDb();
  return db.select().from(tag).orderBy(asc(tag.name));
}

export const CURRENCIES = ["GBP", "USD", "EUR", "JPY", "CAD", "AUD", "CHF"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "GBP";
