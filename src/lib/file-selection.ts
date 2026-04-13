import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { saveFilePath } from "./app-context";

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
  await writeFile(filePath, new Uint8Array());

  saveFilePath(filePath);
  return filePath;
}

/**
 * Opens a native open dialog filtered to `.pfdata` files, persists the
 * chosen path, and returns it. Returns null if the user cancels.
 */
export async function openExistingFile(): Promise<string | null> {
  const filePath = await open({
    multiple: false,
    filters: [PFDATA_FILTER],
  });

  if (!filePath) return null;

  saveFilePath(filePath);
  return filePath;
}
