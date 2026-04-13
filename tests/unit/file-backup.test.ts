import { describe, it, expect, vi, beforeEach } from "vitest";
import { pruneBackups } from "@/lib/file-backup";

// Mock tauri-plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  copyFile: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}));

import { readDir, remove } from "@tauri-apps/plugin-fs";

const mockReadDir = vi.mocked(readDir);
const mockRemove = vi.mocked(remove);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pruneBackups", () => {
  it("deletes backups beyond the 2 most recent", async () => {
    mockReadDir.mockResolvedValue([
      { name: "my-money.pfdata.2026-01-01.bak" },
      { name: "my-money.pfdata.2026-01-02.bak" },
      { name: "my-money.pfdata.2026-01-03.bak" },
      { name: "my-money.pfdata.2026-01-04.bak" },
      { name: "my-money.pfdata" }, // the data file itself — should be ignored
      { name: "other-file.txt" },  // unrelated file — should be ignored
    ] as never);

    await pruneBackups("C:/data/my-money.pfdata");

    // Most recent two are kept: 2026-01-04 and 2026-01-03
    // Oldest two should be deleted: 2026-01-01 and 2026-01-02
    expect(mockRemove).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledWith(
      "C:/data/my-money.pfdata.2026-01-01.bak"
    );
    expect(mockRemove).toHaveBeenCalledWith(
      "C:/data/my-money.pfdata.2026-01-02.bak"
    );
  });

  it("does not delete anything when 2 or fewer backups exist", async () => {
    mockReadDir.mockResolvedValue([
      { name: "my-money.pfdata.2026-01-03.bak" },
      { name: "my-money.pfdata.2026-01-04.bak" },
    ] as never);

    await pruneBackups("C:/data/my-money.pfdata");

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("does not delete anything when only 1 backup exists", async () => {
    mockReadDir.mockResolvedValue([
      { name: "my-money.pfdata.2026-01-04.bak" },
    ] as never);

    await pruneBackups("C:/data/my-money.pfdata");

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("does not delete anything when no backups exist", async () => {
    mockReadDir.mockResolvedValue([] as never);

    await pruneBackups("C:/data/my-money.pfdata");

    expect(mockRemove).not.toHaveBeenCalled();
  });
});
