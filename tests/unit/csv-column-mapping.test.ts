import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { getInstitutionColumnMapping, saveInstitutionColumnMapping } from "@/lib/csv-column-mapping";
import { createTestDb } from "./db-helper";
import { institution } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ColumnMapping } from "@/lib/csv-types";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

const mockGetDb = vi.mocked(dbModule.getDb);

const MAPPING: ColumnMapping = {
  columns: { date: 0, payee: 1, notes: null, amount: 2, debit: null, credit: null, balance: null, reference: null },
  amountConvention: "single",
  dateFormat: "dd/MM/yyyy",
  hasHeaderRow: true,
};

async function seedInstitution(db: ReturnType<typeof createTestDb>, name = "Test Bank") {
  await db.insert(institution).values({ name });
  const [inst] = await db.select().from(institution).where(eq(institution.name, name));
  return inst;
}

beforeEach(() => {
  mockGetDb.mockReturnValue(createTestDb() as any);
});

describe("getInstitutionColumnMapping", () => {
  it("returns null when no mapping exists for the institution", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const inst = await seedInstitution(db);
    const result = await getInstitutionColumnMapping(inst.id);
    expect(result).toBeNull();
  });

  it("returns the saved mapping when one exists", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const inst = await seedInstitution(db);
    await saveInstitutionColumnMapping(inst.id, MAPPING);
    const result = await getInstitutionColumnMapping(inst.id);
    expect(result).toEqual(MAPPING);
  });
});

describe("saveInstitutionColumnMapping", () => {
  it("inserts a new mapping on first call", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const inst = await seedInstitution(db);
    await saveInstitutionColumnMapping(inst.id, MAPPING);
    const result = await getInstitutionColumnMapping(inst.id);
    expect(result).toEqual(MAPPING);
  });

  it("upserts (updates) on second call for same institution", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const inst = await seedInstitution(db);
    await saveInstitutionColumnMapping(inst.id, MAPPING);
    const updated: ColumnMapping = { ...MAPPING, dateFormat: "yyyy-MM-dd" };
    await saveInstitutionColumnMapping(inst.id, updated);
    const result = await getInstitutionColumnMapping(inst.id);
    expect(result?.dateFormat).toBe("yyyy-MM-dd");
  });

  it("allows different institutions to have separate mappings", async () => {
    const db = createTestDb();
    mockGetDb.mockReturnValue(db as any);
    const inst1 = await seedInstitution(db, "Bank A");
    const inst2 = await seedInstitution(db, "Bank B");
    const mapping1: ColumnMapping = { ...MAPPING, dateFormat: "dd/MM/yyyy" };
    const mapping2: ColumnMapping = { ...MAPPING, dateFormat: "yyyy-MM-dd" };
    await saveInstitutionColumnMapping(inst1.id, mapping1);
    await saveInstitutionColumnMapping(inst2.id, mapping2);
    expect((await getInstitutionColumnMapping(inst1.id))?.dateFormat).toBe("dd/MM/yyyy");
    expect((await getInstitutionColumnMapping(inst2.id))?.dateFormat).toBe("yyyy-MM-dd");
  });
});
