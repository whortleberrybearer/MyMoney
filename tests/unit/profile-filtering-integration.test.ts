/**
 * Integration tests for the profile filtering feature — data layer only.
 *
 * These tests exercise listAccounts + createTag against a real in-memory
 * SQLite database (via createTestDb). No UI rendering is done here.
 *
 * UI-level profile switching is not tested in unit tests because Radix Select
 * interaction is not supported in jsdom. The AccountsScreen.test.tsx and
 * DashboardShell.test.tsx files cover the React wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { listAccounts } from "@/lib/accounts";
import { createTag, listTags } from "@/lib/reference-data";
import { createTestDb } from "./db-helper";
import { account, accountTag, institution } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

const mockGetDb = vi.mocked(dbModule.getDb);

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// Integration: profile filter flow (data layer)
// ---------------------------------------------------------------------------

describe("Profile filter — data layer integration", () => {
  it("seed data has Personal and Joint tags, and accounts can be filtered by tag", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await db.insert(institution).values({ name: "Test Bank" });
    const [inst] = await db.select().from(institution);

    await db.insert(account).values([
      {
        name: "Personal Acc",
        institutionId: inst.id,
        accountTypeId: 1,
        currency: "GBP",
        openingBalance: 100,
        openingDate: "2024-01-01",
      },
      {
        name: "Joint Acc",
        institutionId: inst.id,
        accountTypeId: 1,
        currency: "GBP",
        openingBalance: 200,
        openingDate: "2024-01-01",
      },
    ]);

    const [personalAcc] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.name, "Personal Acc"));
    const [jointAcc] = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.name, "Joint Acc"));

    // Verify seed tags exist (Personal=1, Joint=2 from migration)
    const tags = await listTags();
    const personalTag = tags.find((t) => t.name === "Personal");
    const jointTag = tags.find((t) => t.name === "Joint");
    expect(personalTag).toBeDefined();
    expect(jointTag).toBeDefined();

    await db.insert(accountTag).values({ accountId: personalAcc.id, tagId: personalTag!.id });
    await db.insert(accountTag).values({ accountId: jointAcc.id, tagId: jointTag!.id });

    // Filter by Personal tag — only Personal Acc should appear
    const personalRows = await listAccounts(false, personalTag!.id);
    expect(personalRows).toHaveLength(1);
    expect(personalRows[0].name).toBe("Personal Acc");

    // Filter by Joint tag — only Joint Acc should appear
    const jointRows = await listAccounts(false, jointTag!.id);
    expect(jointRows).toHaveLength(1);
    expect(jointRows[0].name).toBe("Joint Acc");

    // No filter (All) — both accounts appear
    const allRows = await listAccounts(false, null);
    expect(allRows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: inline tag creation flow (data layer)
// ---------------------------------------------------------------------------

describe("Inline tag creation — data layer integration", () => {
  it("creates a new tag and it appears in listTags", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    const newTag = await createTag("Work");
    expect(newTag.name).toBe("Work");
    expect(newTag.id).toBeTypeOf("number");

    const allTags = await listTags();
    expect(allTags.map((t) => t.name)).toContain("Work");
  });

  it("new tag can be used to filter accounts immediately after creation", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await db.insert(institution).values({ name: "Bank" });
    const [inst] = await db.select().from(institution);

    const workTag = await createTag("Work");

    await db.insert(account).values({
      name: "Work Expenses",
      institutionId: inst.id,
      accountTypeId: 1,
      currency: "GBP",
      openingBalance: 0,
      openingDate: "2024-01-01",
    });
    const [acc] = await db.select({ id: account.id }).from(account);
    await db.insert(accountTag).values({ accountId: acc.id, tagId: workTag.id });

    const rows = await listAccounts(false, workTag.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Work Expenses");
  });
});
