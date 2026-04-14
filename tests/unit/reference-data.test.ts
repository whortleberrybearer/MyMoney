import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dbModule from "@/lib/db";
import { createTag, listTags } from "@/lib/reference-data";
import { createTestDb } from "./db-helper";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
const mockGetDb = vi.mocked(dbModule.getDb);

vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockGetDb.mockReturnValue(createTestDb() as any);
});

// ---------------------------------------------------------------------------
// createTag
// ---------------------------------------------------------------------------

describe("createTag", () => {
  it("creates a new tag and returns it", async () => {
    const tag = await createTag("Family");
    expect(tag.name).toBe("Family");
    expect(tag.id).toBeTypeOf("number");
  });

  it("trims whitespace from the name before inserting", async () => {
    const tag = await createTag("  Family  ");
    expect(tag.name).toBe("Family");
  });

  it("throws when a tag with the same name already exists (case-insensitive)", async () => {
    // "Personal" is seeded by migration
    await expect(createTag("Personal")).rejects.toThrow("A tag with this name already exists");
    await expect(createTag("personal")).rejects.toThrow("A tag with this name already exists");
    await expect(createTag("PERSONAL")).rejects.toThrow("A tag with this name already exists");
  });

  it("throws when the trimmed name matches an existing tag", async () => {
    await expect(createTag("  Joint  ")).rejects.toThrow("A tag with this name already exists");
  });

  it("new tag appears in listTags after creation", async () => {
    const db = mockGetDb();
    mockGetDb.mockReturnValue(db as ReturnType<typeof dbModule.getDb>);

    await createTag("Work");
    const tags = await listTags();
    expect(tags.map((t) => t.name)).toContain("Work");
  });
});
