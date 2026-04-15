import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  listAccountsWithPots,
  setAccountActive,
  updateAccount,
} from "@/lib/accounts";
import { createTestDb } from "./db-helper";
import { account, accountTag, institution, pot, transaction } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  it("returns all accounts when tagId is null", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values([
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Tagged" },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Untagged" },
    ]);
    const [tagged] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.name, "Tagged"));
    await db.insert(accountTag).values({ accountId: tagged.id, tagId: 1 }); // Personal seed tag

    const rows = await listAccounts(false, null);
    expect(rows).toHaveLength(2);
  });

  it("returns only accounts matching tagId when tagId is set", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values([
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Personal Acc" },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Joint Acc" },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Untagged Acc" },
    ]);
    const [personalAcc] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.name, "Personal Acc"));
    const [jointAcc] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.name, "Joint Acc"));
    await db.insert(accountTag).values({ accountId: personalAcc.id, tagId: 1 }); // Personal
    await db.insert(accountTag).values({ accountId: jointAcc.id, tagId: 2 });    // Joint

    const rows = await listAccounts(false, 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Personal Acc");
    expect(rows[0].tagId).toBe(1);
  });

  it("applies tagId filter and showInactive=false together", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await db.insert(account).values([
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Active Tagged", isActive: 1 },
      { ...BASE_ACCOUNT, institutionId: inst.id, name: "Inactive Tagged", isActive: 0 },
    ]);
    const accs = await db.select({ id: account.id }).from(account);
    for (const acc of accs) {
      await db.insert(accountTag).values({ accountId: acc.id, tagId: 1 }); // Personal
    }

    const result = await listAccounts(false, 1);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Active Tagged");
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

// ---------------------------------------------------------------------------
// listAccountsWithPots
// ---------------------------------------------------------------------------

describe("listAccountsWithPots", () => {
  it("attaches active pots with calculated balances to each account", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });
    const [acc] = await listAccounts(false);

    await db.insert(pot).values({
      accountId: acc.id,
      name: "Holiday Fund",
      openingBalance: 200,
      openingDate: "2024-01-01",
      isActive: 1,
    });
    const [p] = await db.select().from(pot);
    await db.insert(transaction).values({
      potId: p.id,
      amount: 50,
      date: "2024-02-01",
      type: "virtual_transfer",
      isVoid: 0,
    });

    const rows = await listAccountsWithPots(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].pots).toHaveLength(1);
    expect(rows[0].pots![0].name).toBe("Holiday Fund");
    expect(rows[0].pots![0].currentBalance).toBe(250); // 200 + 50
  });

  it("excludes closed pots by default (showClosedPots=false)", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });
    const [acc] = await listAccounts(false);

    await db.insert(pot).values([
      { accountId: acc.id, name: "Active", openingBalance: 0, openingDate: "2024-01-01", isActive: 1 },
      { accountId: acc.id, name: "Closed", openingBalance: 0, openingDate: "2024-01-01", isActive: 0 },
    ]);

    const rows = await listAccountsWithPots(false);
    expect(rows[0].pots).toHaveLength(1);
    expect(rows[0].pots![0].name).toBe("Active");
  });

  it("includes closed pots when showClosedPots=true", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });
    const [acc] = await listAccounts(false);

    await db.insert(pot).values([
      { accountId: acc.id, name: "Active", openingBalance: 0, openingDate: "2024-01-01", isActive: 1 },
      { accountId: acc.id, name: "Closed", openingBalance: 0, openingDate: "2024-01-01", isActive: 0 },
    ]);

    const rows = await listAccountsWithPots(false, null, true);
    expect(rows[0].pots).toHaveLength(2);
  });

  it("accounts with no pots have an empty pots array", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    await createAccount({ ...BASE_ACCOUNT, institutionId: inst.id });

    const rows = await listAccountsWithPots(false);
    expect(rows[0].pots).toEqual([]);
  });
});
