import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { institutionColumnMapping } from "./db/schema";
import type { ColumnMapping } from "./csv-types";

export async function getInstitutionColumnMapping(institutionId: number): Promise<ColumnMapping | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(institutionColumnMapping)
    .where(eq(institutionColumnMapping.institutionId, institutionId));
  if (!row) return null;
  return JSON.parse(row.mappingJson) as ColumnMapping;
}

export async function saveInstitutionColumnMapping(
  institutionId: number,
  mapping: ColumnMapping,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const mappingJson = JSON.stringify(mapping);

  const [existing] = await db
    .select({ id: institutionColumnMapping.id })
    .from(institutionColumnMapping)
    .where(eq(institutionColumnMapping.institutionId, institutionId));

  if (existing) {
    await db
      .update(institutionColumnMapping)
      .set({ mappingJson, updatedAt: now })
      .where(eq(institutionColumnMapping.institutionId, institutionId));
  } else {
    await db.insert(institutionColumnMapping).values({
      institutionId,
      mappingJson,
      createdAt: now,
      updatedAt: now,
    });
  }
}
