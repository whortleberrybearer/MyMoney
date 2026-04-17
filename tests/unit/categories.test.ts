import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import {
  CategoryInUseError,
  createCategory,
  deleteCategory,
  listCategories,
} from "@/lib/categories";
import { createTestDb } from "./db-helper";
import { account, category, institution, transaction } from "@/lib/db/schema";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

// The test DB is pre-seeded with 30 categories from migration 0000
const SEEDED_COUNT = 30;

function useDb() {
  const db = mockGetDb();
  mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);
  return db;
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAccount(db: ReturnType<typeof createTestDb>) {
  await db.insert(institution).values({ name: "Test Bank" });
  const [inst] = await db.select().from(institution);
  await db.insert(account).values({
    name: "Test Account",
    institutionId: inst.id,
    accountTypeId: 1,
    currency: "GBP",
    openingBalance: 0,
    openingDate: "2024-01-01",
  });
  const [acc] = await db.select().from(account);
  return acc;
}

async function seedTransaction(
  db: ReturnType<typeof createTestDb>,
  accountId: number,
  categoryId: number | null = null,
) {
  await db.insert(transaction).values({
    accountId,
    date: "2024-01-01",
    amount: -10,
    type: "manual",
    runningBalance: -10,
    categoryId,
    isVoid: 0,
  });
  const rows = await db.select().from(transaction);
  return rows[rows.length - 1];
}

// ---------------------------------------------------------------------------
// listCategories
// ---------------------------------------------------------------------------

describe("listCategories", () => {
  it("returns all seeded categories", async () => {
    const result = await listCategories();
    expect(result).toHaveLength(SEEDED_COUNT);
  });

  it("returns categories in alphabetical order", async () => {
    const result = await listCategories();
    const names = result.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("includes Uncategorised in the list", async () => {
    const result = await listCategories();
    expect(result.some((c) => c.name === "Uncategorised")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

describe("createCategory", () => {
  it("adds a new category that appears in subsequent listCategories calls", async () => {
    const db = useDb();
    void db;
    await createCategory("My New Category");
    const result = await listCategories();
    expect(result.map((c) => c.name)).toContain("My New Category");
  });

  it("trims whitespace from the name", async () => {
    const db = useDb();
    void db;
    await createCategory("  Trimmed  ");
    const result = await listCategories();
    expect(result.map((c) => c.name)).toContain("Trimmed");
  });

  it("rejects a blank name", async () => {
    await expect(createCategory("   ")).rejects.toThrow("Category name is required");
  });

  it("rejects an empty string", async () => {
    await expect(createCategory("")).rejects.toThrow("Category name is required");
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    const db = useDb();
    void db;
    await createCategory("Hobbies");
    await expect(createCategory("hobbies")).rejects.toThrow(
      "A category with this name already exists",
    );
  });

  it("rejects a name that duplicates an existing seeded category", async () => {
    await expect(createCategory("Bills")).rejects.toThrow(
      "A category with this name already exists",
    );
  });
});

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

describe("deleteCategory", () => {
  it("deletes a category that is not in use", async () => {
    const db = useDb();
    void db;
    // "Other" is a seeded non-system category
    const [other] = (await listCategories()).filter((c) => c.name === "Other");
    await deleteCategory(other.id);
    const after = await listCategories();
    expect(after.map((c) => c.name)).not.toContain("Other");
    expect(after).toHaveLength(SEEDED_COUNT - 1);
  });

  it("throws when the category does not exist", async () => {
    await expect(deleteCategory(99999)).rejects.toThrow("Category not found");
  });

  it("blocks deletion of system categories (Uncategorised)", async () => {
    const db = useDb();
    void db;
    const [uncategorised] = (await listCategories()).filter(
      (c) => c.name === "Uncategorised",
    );
    await expect(deleteCategory(uncategorised.id)).rejects.toThrow(
      "System categories cannot be deleted",
    );
  });

  it("throws CategoryInUseError when category is in use and no replacement given", async () => {
    const db = useDb();
    const acc = await seedAccount(db);
    const [bills] = (await listCategories()).filter((c) => c.name === "Bills");
    await seedTransaction(db, acc.id, bills.id);

    await expect(deleteCategory(bills.id)).rejects.toThrow(CategoryInUseError);
  });

  it("CategoryInUseError includes the transaction count", async () => {
    const db = useDb();
    const acc = await seedAccount(db);
    const [bills] = (await listCategories()).filter((c) => c.name === "Bills");
    await seedTransaction(db, acc.id, bills.id);
    await seedTransaction(db, acc.id, bills.id);

    try {
      await deleteCategory(bills.id);
      throw new Error("should not reach here");
    } catch (err) {
      expect(err).toBeInstanceOf(CategoryInUseError);
      expect((err as CategoryInUseError).transactionCount).toBe(2);
    }
  });

  it("reassigns transactions and deletes when replacement is provided", async () => {
    const db = useDb();
    const acc = await seedAccount(db);
    const cats = await listCategories();
    const bills = cats.find((c) => c.name === "Bills")!;
    const groceries = cats.find((c) => c.name === "Groceries")!;
    const tx = await seedTransaction(db, acc.id, bills.id);

    await deleteCategory(bills.id, groceries.id);

    // Bills should be gone
    const after = await listCategories();
    expect(after.map((c) => c.name)).not.toContain("Bills");

    // Transaction should now reference Groceries
    const [updatedTx] = await db
      .select()
      .from(transaction)
      .where(
        (await import("drizzle-orm")).eq(transaction.id, tx.id),
      );
    expect(updatedTx.categoryId).toBe(groceries.id);
  });

  it("does not reassign voided transactions", async () => {
    const db = useDb();
    const acc = await seedAccount(db);
    const cats = await listCategories();
    const bills = cats.find((c) => c.name === "Bills")!;
    const groceries = cats.find((c) => c.name === "Groceries")!;

    // Insert a voided transaction with Bills
    await db.insert(transaction).values({
      accountId: acc.id,
      date: "2024-01-01",
      amount: -10,
      type: "manual",
      runningBalance: -10,
      categoryId: bills.id,
      isVoid: 1,
    });

    // deleteCategory without replacement should succeed (voided tx not counted)
    await deleteCategory(bills.id);

    const after = await listCategories();
    expect(after.map((c) => c.name)).not.toContain("Bills");
  });

  it("throws when the replacement category does not exist", async () => {
    const db = useDb();
    const acc = await seedAccount(db);
    const [bills] = (await listCategories()).filter((c) => c.name === "Bills");
    await seedTransaction(db, acc.id, bills.id);

    await expect(deleteCategory(bills.id, 99999)).rejects.toThrow(
      "Replacement category not found",
    );
  });

  it("allows using Uncategorised as the replacement target", async () => {
    const db = useDb();
    const acc = await seedAccount(db);
    const cats = await listCategories();
    const bills = cats.find((c) => c.name === "Bills")!;
    const uncategorised = cats.find((c) => c.name === "Uncategorised")!;
    const tx = await seedTransaction(db, acc.id, bills.id);

    await deleteCategory(bills.id, uncategorised.id);

    const after = await listCategories();
    expect(after.map((c) => c.name)).not.toContain("Bills");

    const [updatedTx] = await db
      .select()
      .from(transaction)
      .where(
        (await import("drizzle-orm")).eq(transaction.id, tx.id),
      );
    expect(updatedTx.categoryId).toBe(uncategorised.id);
  });
});
