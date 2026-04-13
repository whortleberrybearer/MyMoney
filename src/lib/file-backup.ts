import { invoke } from "@tauri-apps/api/core";

/** Returns YYYY-MM-DD for the current local date. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Runs backup creation and pruning via a Rust command (bypasses fs plugin
 * scope restrictions). Errors are logged but never thrown — backup failure
 * must never block the user.
 */
export async function runStartupBackup(filePath: string): Promise<void> {
  try {
    const backupPath = `${filePath}.${todayIso()}.bak`;
    await invoke("run_startup_backup", { filePath, backupPath });
  } catch (err) {
    console.error("[backup] startup backup failed:", err);
  }
}
