import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  setAccountActive,
  updateAccount,
} from "@/lib/accounts";
import { createTestDb } from "./db-helper";
import { account, accountTag, institution } from "@/lib/db/schema";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

// Seed helpers — use seeded account_type ids (1=Current) and create an institution
async function seedInstitution(db: ReturnType<typeof createTestDb>, name = "Barclays") {
  await db.insert(institution).values({ name });
  const [inst] = await db.select().from(institution);
  return inst;
}

const BASE_ACCOUNT = {
  name: "My Account",
  institutionId: 0, // filled in per test
  accountTypeId: 1, // "Current" from seed
  currency: "GBP",
  openingBalance: 100,
  openingDate: "2024-01-01",
} as const;

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// listAccounts
// ---------------------------------------------------------------------------

describe("listAccounts", () => {
  it("returns empty array when no accounts exist", async () => {
    expect(await listAccounts(false)).toEqual([]);
  });

  it("returns only active accounts when showInactive=false", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values([
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Active Acc", isActive: 1 },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Inactive Acc", isActive: 0 },
    ]);

    const rows = await listAccounts(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Active Acc");
  });

  it("returns active and inactive when showInactive=true", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values([
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Active", isActive: 1 },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Inactive", isActive: 0 },
    ]);

    const rows = await listAccounts(true);
    expect(rows).toHaveLength(2);
  });

  it("never returns soft-deleted accounts", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values([
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Visible", isDeleted: 0 },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Deleted", isDeleted: 1 },
    ]);

    const rows = await listAccounts(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Visible");
  });

  it("joins institution name and account type name", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db, "NatWest");
    await db.insert(account).values({ ...BASE_ACCOUNT, institutionId: inst.id });

    const [row] = await listAccounts(false);
    expect(row.institutionName).toBe("NatWest");
    expect(row.accountTypeName).toBe("Current");
  });
});

// ---------------------------------------------------------------------------
// createAccount
// ---------------------------------------------------------------------------

describe("createAccount", () => {
  it("creates an account without a tag", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });

    const rows = await listAccounts(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("My Account");
    expect(rows[0].tagId).toBeNull();
  });

  it("creates an account with a tag", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    // tag id=1 is "Personal" from seed
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, tagId: 1 });

    const rows = await listAccounts(false);
    expect(rows[0].tagId).toBe(1);
    expect(rows[0].tagName).toBe("Personal");
  });

  it("rejects a duplicate name (case-insensitive, excluding deleted)", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, name: "Savings" });
    await expect(
      createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, name: "savings" }),
    ).rejects.toThrow("An account with this name already exists");
  });

  it("allows a name reused by a deleted account", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values({
      ...BASE_ACCOUNT,
      institutionId: inst.id,
      name: "Recycled",
      isDeleted: 1,
    });
    await expect(
      createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, name: "Recycled" }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// updateAccount
// ---------------------------------------------------------------------------

describe("updateAccount", () => {
  it("updates all account fields", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, name: "Original" });
    const [created] = await listAccounts(false);

    await updateAccount({
      id: created.id,
      name: "Updated",
      institutionId: inst.id,
      accountTypeId: 2, // "Savings"
      currency: "USD",
      openingBalance: 500,
      openingDate: "2024-06-01",
      notes: "Some notes",
    });

    const [updated] = await listAccounts(false);
    expect(updated.name).toBe("Updated");
    expect(updated.currency).toBe("USD");
    expect(updated.openingBalance).toBe(500);
  });

  it("replaces the tag when updated", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, tagId: 1 });
    const [created] = await listAccounts(false);

    // Change tag from Personal(1) to Joint(2)
    await updateAccount({ ...BASE_ACCOUNT, id: created.id, institutionId: inst.id, tagId: 2 });
    const [updated] = await listAccounts(false);
    expect(updated.tagName).toBe("Joint");
  });

  it("removes the tag when updated to undefined", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, tagId: 1 });
    const [created] = await listAccounts(false);

    await updateAccount({ ...BASE_ACCOUNT, id: created.id, institutionId: inst.id });
    const [updated] = await listAccounts(false);
    expect(updated.tagId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setAccountActive
// ---------------------------------------------------------------------------

describe("setAccountActive", () => {
  it("deactivates an active account", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });
    const [created] = await listAccounts(false);

    await setAccountActive(created.id, false);
    expect(await listAccounts(false)).toHaveLength(0);
    expect(await listAccounts(true)).toHaveLength(1);
  });

  it("reactivates an inactive account", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });
    const [created] = await listAccounts(false);
    await setAccountActive(created.id, false);

    await setAccountActive(created.id, true);
    expect(await listAccounts(false)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

describe("deleteAccount", () => {
  it("soft-deletes the account (sets is_deleted=1)", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });
    const [created] = await listAccounts(false);

    await deleteAccount(created.id);
    expect(await listAccounts(true)).toHaveLength(0);

    // Row still exists in DB with is_deleted=1
    const raw = await db.select().from(account);
    expect(raw).toHaveLength(1);
    expect(raw[0].isDeleted).toBe(1);
  });

  it("removes account_tag rows when deleting", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id, tagId: 1 });
    const [created] = await listAccounts(false);

    await deleteAccount(created.id);

    const tags = await db.select().from(accountTag);
    expect(tags).toHaveLength(0);
  });
});
