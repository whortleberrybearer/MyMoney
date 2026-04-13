import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStartupBackup } from "@/lib/file-backup";

// Mock the Tauri core invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runStartupBackup", () => {
  it("calls run_startup_backup with filePath and today's date-stamped backupPath", async () => {
    mockInvoke.mockResolvedValue(undefined);

    const today = new Date().toISOString().slice(0, 10);
    await runStartupBackup("C:/data/my-money.pfdata");

    expect(mockInvoke).toHaveBeenCalledWith("run_startup_backup", {
      filePath: "C:/data/my-money.pfdata",
      backupPath: `C:/data/my-money.pfdata.${today}.bak`,
    });
  });

  it("does not throw when the Rust command fails", async () => {
    mockInvoke.mockRejectedValue(new Error("permission denied"));

    await expect(
      runStartupBackup("C:/data/my-money.pfdata")
    ).resolves.toBeUndefined();
  });
});
