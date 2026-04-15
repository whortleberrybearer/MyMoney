import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { createPotTransfer } from "@/lib/transfers";
import { createTestDb } from "./db-helper";
import { account, institution, pot, transaction } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

async function seedInstitution(db: ReturnType<typeof createTestDb>) {
  await db.insert(institution).values({ name: "Barclays" });
  const [inst] = await db.select().from(institution);
  return inst;
}

async function seedAccount(db: ReturnType<typeof createTestDb>, instId: number) {
  await db.insert(account).values({
    name: "Current Account",
    institutionId: instId,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 1000,
    openingDate: "2024-01-01",
  });
  const [acc] = await db.select().from(account);
  return acc;
}

async function seedPot(db: ReturnType<typeof createTestDb>, accountId: number) {
  await db.insert(pot).values({
    accountId,
    name: "Holiday Fund",
    openingBalance: 0,
    openingDate: "2024-01-01",
  });
  const [p] = await db.select().from(pot).where(eq(pot.accountId, accountId));
  return p;
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

describe("createPotTransfer", () => {
  it("creates a transfer pair with matching transfer_id (into pot)", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await createPotTransfer({
      potId: p.id,
      accountId: acc.id,
      amount: 100,
      date: "2024-02-01",
      direction: "into_pot",
    });

    const rows = await db.select().from(transaction);
    expect(rows).toHaveLength(2);
    expect(rows[0].transferId).toBe(rows[1].transferId);
  });

  it("account side is debited and pot side is credited for into_pot", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await createPotTransfer({
      potId: p.id,
      accountId: acc.id,
      amount: 100,
      date: "2024-02-01",
      direction: "into_pot",
    });

    const rows = await db.select().from(transaction);
    const accountRow = rows.find((r) => r.accountId === acc.id)!;
    const potRow = rows.find((r) => r.potId === p.id)!;

    expect(accountRow.amount).toBe(-100);
    expect(potRow.amount).toBe(100);
  });

  it("pot side is debited and account side is credited for out_of_pot", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await createPotTransfer({
      potId: p.id,
      accountId: acc.id,
      amount: 50,
      date: "2024-02-01",
      direction: "out_of_pot",
    });

    const rows = await db.select().from(transaction);
    const accountRow = rows.find((r) => r.accountId === acc.id)!;
    const potRow = rows.find((r) => r.potId === p.id)!;

    expect(accountRow.amount).toBe(50);
    expect(potRow.amount).toBe(-50);
  });

  it("paired amounts sum to zero", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await createPotTransfer({
      potId: p.id,
      accountId: acc.id,
      amount: 75,
      date: "2024-02-01",
      direction: "into_pot",
    });

    const rows = await db.select().from(transaction);
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    expect(total).toBe(0);
  });

  it("stores notes on both rows", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await createPotTransfer({
      potId: p.id,
      accountId: acc.id,
      amount: 100,
      date: "2024-02-01",
      direction: "into_pot",
      notes: "Monthly saving",
    });

    const rows = await db.select().from(transaction);
    expect(rows[0].notes).toBe("Monthly saving");
    expect(rows[1].notes).toBe("Monthly saving");
  });

  it("increments transfer_id across multiple transfers", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await createPotTransfer({ potId: p.id, accountId: acc.id, amount: 10, date: "2024-02-01", direction: "into_pot" });
    await createPotTransfer({ potId: p.id, accountId: acc.id, amount: 20, date: "2024-02-02", direction: "out_of_pot" });

    const rows = await db.select().from(transaction);
    const ids = [...new Set(rows.map((r) => r.transferId))].sort();
    expect(ids).toEqual([1, 2]);
  });

  it("rejects zero amount", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await expect(
      createPotTransfer({ potId: p.id, accountId: acc.id, amount: 0, date: "2024-02-01", direction: "into_pot" }),
    ).rejects.toThrow("Transfer amount must be greater than zero");
  });

  it("rejects negative amount", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await expect(
      createPotTransfer({ potId: p.id, accountId: acc.id, amount: -50, date: "2024-02-01", direction: "into_pot" }),
    ).rejects.toThrow("Transfer amount must be greater than zero");
  });

  it("rejects empty date", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const inst = await seedInstitution(db);
    const acc = await seedAccount(db, inst.id);
    const p = await seedPot(db, acc.id);

    await expect(
      createPotTransfer({ potId: p.id, accountId: acc.id, amount: 100, date: "", direction: "into_pot" }),
    ).rejects.toThrow("Transfer date is required");
  });
});
