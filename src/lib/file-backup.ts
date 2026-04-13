import { copyFile, readDir, remove } from "@tauri-apps/plugin-fs";

/** Returns YYYY-MM-DD for the current local date. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the directory portion of an absolute file path.
 * Works on both Windows (backslash) and POSIX (forward slash) paths.
 */
function dirname(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return filePath.slice(0, lastSep);
}

/**
 * Returns the filename (basename) portion of an absolute file path.
 */
function basename(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return filePath.slice(lastSep + 1);
}

/**
 * Creates a backup of `filePath` in the same directory, named
 * `{filename}.{YYYY-MM-DD}.bak`. Overwrites any existing backup for today.
 */
export async function createBackup(filePath: string): Promise<void> {
  const backupPath = `${filePath}.${todayIso()}.bak`;
  await copyFile(filePath, backupPath);
}

/**
 * Deletes all but the 2 most recent `{basename}.*.bak` files in the
 * same directory as `filePath`, sorted lexicographically descending
 * (ISO date stamps sort correctly as strings).
 */
export async function pruneBackups(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const prefix = `${base}.`;
  const suffix = ".bak";

  const entries = await readDir(dir);

  const backupNames = entries
    .filter(
      (e) =>
        e.name &&
        e.name.startsWith(prefix) &&
        e.name.endsWith(suffix)
    )
    .map((e) => e.name as string)
    .sort()
    .reverse(); // most recent first

  const toDelete = backupNames.slice(2); // keep first 2, delete the rest

  await Promise.all(
    toDelete.map((name) => remove(`${dir}/${name}`))
  );
}

/**
 * Runs backup creation and pruning non-blocking. Errors are logged but
 * never thrown — backup failure must never block the user.
 */
export async function runStartupBackup(filePath: string): Promise<void> {
  try {
    await createBackup(filePath);
    await pruneBackups(filePath);
  } catch (err) {
    console.error("[backup] startup backup failed:", err);
  }
}
