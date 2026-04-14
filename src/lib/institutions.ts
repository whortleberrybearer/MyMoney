import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "./db";
import { account, institution } from "./db/schema";

export type Institution = typeof institution.$inferSelect;

export async function listInstitutions(): Promise<Institution[]> {
  const db = getDb();
  return db.select().from(institution).orderBy(asc(institution.name));
}

export async function createInstitution(name: string): Promise<void> {
  const db = getDb();
  const trimmed = name.trim();
  const existing = await db
    .select({ id: institution.id })
    .from(institution)
    .where(sql`lower(${institution.name}) = lower(${trimmed})`);
  if (existing.length > 0) {
    throw new Error("An institution with this name already exists");
  }
  await db.insert(institution).values({ name: trimmed });
}

export async function updateInstitution(id: number, name: string): Promise<void> {
  const db = getDb();
  const trimmed = name.trim();
  const existing = await db
    .select({ id: institution.id })
    .from(institution)
    .where(
      and(
        sql`lower(${institution.name}) = lower(${trimmed})`,
        ne(institution.id, id),
      ),
    );
  if (existing.length > 0) {
    throw new Error("An institution with this name already exists");
  }
  await db
    .update(institution)
    .set({ name: trimmed })
    .where(eq(institution.id, id));
}

export async function deleteInstitution(id: number): Promise<void> {
  const db = getDb();
  const linked = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.institutionId, id), eq(account.isDeleted, 0)));
  if (linked.length > 0) {
    throw new Error(
      "Cannot delete an institution that has linked accounts",
    );
  }
  await db.delete(institution).where(eq(institution.id, id));
}
