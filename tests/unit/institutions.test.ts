import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  createInstitution,
  deleteInstitution,
  listInstitutions,
  updateInstitution,
} from "@/lib/institutions";
import { createTestDb } from "./db-helper";
import { account, institution } from "@/lib/db/schema";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

// Also mock the Tauri SQL plugin so importing the db module tree doesn't fail
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

beforeEach(() => {
  // Each test gets a fresh isolated database
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// listInstitutions
// ---------------------------------------------------------------------------

describe("listInstitutions", () => {
  it("returns an empty array when no institutions exist", async () => {
    const result = await listInstitutions();
    expect(result).toEqual([]);
  });

  it("returns institutions ordered by name", async () => {
    const db = mockGetDb();
    await db.insert(institution).values([
      { name: "Zebra Bank" },
      { name: "Alpha Credit" },
      { name: "Midland Finance" },
    ]);
    // Refresh mock so next call to getDb() returns same db instance
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const result = await listInstitutions();
    expect(result.map((i) => i.name)).toEqual([
      "Alpha Credit",
      "Midland Finance",
      "Zebra Bank",
    ]);
  });
});

// ---------------------------------------------------------------------------
// createInstitution
// ---------------------------------------------------------------------------

describe("createInstitution", () => {
  it("creates a new institution", async () => {
    await createInstitution("Barclays");
    const result = await listInstitutions();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Barclays");
  });

  it("trims whitespace from the name", async () => {
    await createInstitution("  HSBC  ");
    const result = await listInstitutions();
    expect(result[0].name).toBe("HSBC");
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    await createInstitution("Monzo");
    await expect(createInstitution("monzo")).rejects.toThrow(
      "An institution with this name already exists",
    );
  });

  it("persists so that subsequent calls see the new row", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createInstitution("First Direct");
    await createInstitution("Starling");
    const result = await listInstitutions();
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// updateInstitution
// ---------------------------------------------------------------------------

describe("updateInstitution", () => {
  it("renames an institution", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createInstitution("Old Name");
    const [inst] = await listInstitutions();
    await updateInstitution(inst.id, "New Name");

    const result = await listInstitutions();
    expect(result[0].name).toBe("New Name");
  });

  it("allows renaming to the same name (no-op)", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createInstitution("Barclays");
    const [inst] = await listInstitutions();
    await expect(updateInstitution(inst.id, "Barclays")).resolves.toBeUndefined();
  });

  it("rejects renaming to a name already used by another institution", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createInstitution("HSBC");
    await createInstitution("Lloyds");
    const insts = await listInstitutions();
    const lloyds = insts.find((i) => i.name === "Lloyds")!;

    await expect(updateInstitution(lloyds.id, "hsbc")).rejects.toThrow(
      "An institution with this name already exists",
    );
  });
});

// ---------------------------------------------------------------------------
// deleteInstitution
// ---------------------------------------------------------------------------

describe("deleteInstitution", () => {
  it("removes an institution that has no linked accounts", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createInstitution("NatWest");
    const [inst] = await listInstitutions();
    await deleteInstitution(inst.id);

    const result = await listInstitutions();
    expect(result).toHaveLength(0);
  });

  it("throws when the institution has linked accounts", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createInstitution("Barclays");
    const [inst] = await listInstitutions();

    // account_type id=1 is "Current" — seeded by migration 0000
    await db.insert(account).values({
      name: "Current Account",
      institutionId: inst.id,
      accountTypeId: 1,
      currency: "GBP",
      openingBalance: 0,
      openingDate: "2024-01-01",
    });

    await expect(deleteInstitution(inst.id)).rejects.toThrow(
      "Cannot delete an institution that has linked accounts",
    );
  });
});
