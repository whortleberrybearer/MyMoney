import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  closePot,
  createPot,
  deletePot,
  getPotBalance,
  listPots,
  reactivatePot,
  updatePot,
} from "@/lib/pots";
import { createTestDb } from "./db-helper";
import { account, institution, pot, potTag, transaction } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

async function seedInstitution(db: ReturnType<typeof createTestDb>, name = "Barclays") {
  await db.insert(institution).values({ name });
  const [inst] = await db.select().from(institution);
  return inst;
}

async function seedAccount(
  db: ReturnType<typeof createTestDb>,
  instId: number,
  name = "Current Account",
) {
  await db.insert(account).values({
    name,
    institutionId: instId,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 1000,
    openingDate: "2024-01-01",
  });
  const [acc] = await db
    .select()
    .from(account)
    .where(eq(account.name, name));
  return acc;
}

const BASE_POT = {
  name: "Holiday Fund",
  openingBalance: 0,
  openingDate: "2024-01-01",
} as const;

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// createPot
// ---------------------------------------------------------------------------

describe("createPot", () => {
  it("creates a pot without a tag", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id });

    const pots = await listPots(acc.id, false);
    expect(pots).toHaveLength(1);
    expect(pots[0].name).toBe("Holiday Fund");
    expect(pots[0].tagId).toBeNull();
    expect(pots[0].currentBalance).toBe(0);
  });

  it("creates a pot with a tag", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, tagId: 1 });

    const pots = await listPots(acc.id, false);
    expect(pots[0].tagId).toBe(1);
    expect(pots[0].tagName).toBe("Personal");
  });

  it("defaults opening balance to 0 when not provided", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ accountId: acc.id, name: "Test Pot", openingDate: "2024-01-01" });

    const pots = await listPots(acc.id, false);
    expect(pots[0].openingBalance).toBe(0);
    expect(pots[0].currentBalance).toBe(0);
  });

  it("stores opening balance when provided", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, openingBalance: 250 });

    const pots = await listPots(acc.id, false);
    expect(pots[0].openingBalance).toBe(250);
    expect(pots[0].currentBalance).toBe(250);
  });

  it("rejects duplicate name within same account (case-insensitive)", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, name: "Emergency" });

    await expect(
      createPot({ ...BASE_POT, accountId: acc.id, name: "emergency" }),
    ).rejects.toThrow("A pot with this name already exists in this account");
  });

  it("allows same name under different accounts", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc1 = await seedAccount(db, inst.id, "Account One");
    const acc2 = await seedAccount(db, inst.id, "Account Two");

    await createPot({ ...BASE_POT, accountId: acc1.id, name: "Savings" });
    await expect(
      createPot({ ...BASE_POT, accountId: acc2.id, name: "Savings" }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listPots
// ---------------------------------------------------------------------------

describe("listPots", () => {
  it("returns empty array when no pots exist", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    expect(await listPots(acc.id, false)).toEqual([]);
  });

  it("returns only active pots when showClosed=false", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values([
      { accountId: acc.id, name: "Active", openingBalance: 0, openingDate: "2024-01-01", isActive: 1 },
      { accountId: acc.id, name: "Closed", openingBalance: 0, openingDate: "2024-01-01", isActive: 0 },
    ]);

    const pots = await listPots(acc.id, false);
    expect(pots).toHaveLength(1);
    expect(pots[0].name).toBe("Active");
  });

  it("returns all pots when showClosed=true", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values([
      { accountId: acc.id, name: "Active", openingBalance: 0, openingDate: "2024-01-01", isActive: 1 },
      { accountId: acc.id, name: "Closed", openingBalance: 0, openingDate: "2024-01-01", isActive: 0 },
    ]);

    const pots = await listPots(acc.id, true);
    expect(pots).toHaveLength(2);
  });

  it("calculates current balance including transactions", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values({ accountId: acc.id, name: "Pot", openingBalance: 100, openingDate: "2024-01-01" });
    const [p] = await db.select().from(pot);
    // Add two transactions: credit 50, debit -30
    await db.insert(transaction).values([
      { potId: p.id, amount: 50, date: "2024-02-01", type: "virtual_transfer", isVoid: 0 },
      { potId: p.id, amount: -30, date: "2024-02-02", type: "virtual_transfer", isVoid: 0 },
    ]);

    const pots = await listPots(acc.id, false);
    expect(pots[0].currentBalance).toBe(120); // 100 + 50 - 30
  });

  it("excludes voided transactions from balance", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values({ accountId: acc.id, name: "Pot", openingBalance: 100, openingDate: "2024-01-01" });
    const [p] = await db.select().from(pot);
    await db.insert(transaction).values([
      { potId: p.id, amount: 50, date: "2024-02-01", type: "virtual_transfer", isVoid: 0 },
      { potId: p.id, amount: 200, date: "2024-02-02", type: "virtual_transfer", isVoid: 1 },
    ]);

    const pots = await listPots(acc.id, false);
    expect(pots[0].currentBalance).toBe(150); // 100 + 50 (void 200 excluded)
  });
});

// ---------------------------------------------------------------------------
// updatePot
// ---------------------------------------------------------------------------

describe("updatePot", () => {
  it("updates all pot fields", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id });
    const [created] = await listPots(acc.id, false);

    await updatePot({
      id: created.id,
      accountId: acc.id,
      name: "Emergency Fund",
      openingBalance: 500,
      openingDate: "2024-06-01",
      notes: "Updated notes",
    });

    const [updated] = await listPots(acc.id, false);
    expect(updated.name).toBe("Emergency Fund");
    expect(updated.openingBalance).toBe(500);
    expect(updated.notes).toBe("Updated notes");
  });

  it("rejects duplicate name within same account on edit", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, name: "Pot A" });
    await createPot({ ...BASE_POT, accountId: acc.id, name: "Pot B" });
    const pots = await listPots(acc.id, false);
    const potA = pots.find((p) => p.name === "Pot A")!;

    await expect(
      updatePot({ id: potA.id, accountId: acc.id, name: "Pot B", openingDate: "2024-01-01" }),
    ).rejects.toThrow("A pot with this name already exists in this account");
  });

  it("replaces the tag on edit", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, tagId: 1 });
    const [created] = await listPots(acc.id, false);

    await updatePot({ id: created.id, accountId: acc.id, name: created.name, openingDate: created.openingDate, tagId: 2 });
    const [updated] = await listPots(acc.id, false);
    expect(updated.tagId).toBe(2);
    expect(updated.tagName).toBe("Joint");
  });

  it("removes the tag when updated to undefined", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, tagId: 1 });
    const [created] = await listPots(acc.id, false);

    await updatePot({ id: created.id, accountId: acc.id, name: created.name, openingDate: created.openingDate });
    const [updated] = await listPots(acc.id, false);
    expect(updated.tagId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// closePot / reactivatePot
// ---------------------------------------------------------------------------

describe("closePot / reactivatePot", () => {
  it("closePot sets is_active=0", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id });
    const [created] = await listPots(acc.id, false);

    await closePot(created.id);
    expect(await listPots(acc.id, false)).toHaveLength(0);
    const allPots = await listPots(acc.id, true);
    expect(allPots[0].isActive).toBe(0);
  });

  it("reactivatePot sets is_active=1", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id });
    const [created] = await listPots(acc.id, false);

    await closePot(created.id);
    await reactivatePot(created.id);
    expect(await listPots(acc.id, false)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getPotBalance
// ---------------------------------------------------------------------------

describe("getPotBalance", () => {
  it("returns opening balance when no transactions", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values({ accountId: acc.id, name: "Pot", openingBalance: 300, openingDate: "2024-01-01" });
    const [p] = await db.select().from(pot);

    expect(await getPotBalance(p.id)).toBe(300);
  });

  it("includes signed transaction amounts", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values({ accountId: acc.id, name: "Pot", openingBalance: 100, openingDate: "2024-01-01" });
    const [p] = await db.select().from(pot);
    await db.insert(transaction).values([
      { potId: p.id, amount: 200, date: "2024-02-01", type: "virtual_transfer", isVoid: 0 },
      { potId: p.id, amount: -50, date: "2024-02-02", type: "virtual_transfer", isVoid: 0 },
    ]);

    expect(await getPotBalance(p.id)).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// deletePot
// ---------------------------------------------------------------------------

describe("deletePot", () => {
  it("hard deletes the pot row", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id });
    const [created] = await listPots(acc.id, false);

    await deletePot(created.id);

    const raw = await db.select().from(pot);
    expect(raw).toHaveLength(0);
  });

  it("removes all transaction rows for the pot", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await db.insert(pot).values({ accountId: acc.id, name: "Pot", openingBalance: 0, openingDate: "2024-01-01" });
    const [p] = await db.select().from(pot);
    await db.insert(transaction).values([
      { potId: p.id, amount: 100, date: "2024-02-01", type: "virtual_transfer", isVoid: 0 },
      { potId: p.id, amount: -50, date: "2024-02-02", type: "virtual_transfer", isVoid: 0 },
    ]);

    await deletePot(p.id);

    const txRows = await db.select().from(transaction);
    expect(txRows).toHaveLength(0);
    const potRows = await db.select().from(pot);
    expect(potRows).toHaveLength(0);
  });

  it("removes pot_tag rows when deleting", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    await createPot({ ...BASE_POT, accountId: acc.id, tagId: 1 });
    const [created] = await listPots(acc.id, false);

    await deletePot(created.id);

    const tagRows = await db.select().from(potTag);
    expect(tagRows).toHaveLength(0);
  });
});
