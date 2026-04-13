import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { AppScreen, saveFilePath } from "./app-context";
import { openDb } from "./db";

const PFDATA_FILTER = { name: "My Money Data File", extensions: ["pfdata"] };

/**
 * Opens a native save dialog defaulting to `my-money.pfdata`, creates an
 * empty file at the chosen location, persists the path, and returns it.
 * Returns null if the user cancels.
 */
export async function createNewFile(): Promise<string | null> {
  const filePath = await save({
    defaultPath: "my-money.pfdata",
    filters: [PFDATA_FILTER],
  });

  if (!filePath) return null;

  // Create an empty file at the chosen path.
  await invoke("create_empty_file", { path: filePath });

  saveFilePath(filePath);
  return filePath;
}

/**
 * Opens a native open dialog filtered to `.pfdata` files, runs Drizzle
 * migrations against the selected file, persists the path, and returns it.
 * Returns null if the user cancels or if migration fails (in which case
 * `navigate` is called with the migration-error screen).
 */
export async function openExistingFile(
  navigate: (screen: AppScreen) => void,
): Promise<string | null> {
  const filePath = await open({
    multiple: false,
    filters: [PFDATA_FILTER],
  });

  if (!filePath) return null;

  saveFilePath(filePath);

  try {
    await openDb(filePath);
  } catch (err) {
    navigate({
      screen: "migration-error",
      filePath,
      error: String(err),
    });
    return null;
  }

  return filePath;
}
