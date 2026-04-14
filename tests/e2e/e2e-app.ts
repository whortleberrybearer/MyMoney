import { browser, $ as find } from "@wdio/globals";
import BetterSQLite from "better-sqlite3";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const E2E_RUN_DIR = process.env.MY_MONEY_E2E_RUN_DIR;

function ensureRunDir() {
  const runDir = E2E_RUN_DIR ?? join(tmpdir(), "my-money-e2e");
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

export function createE2EDb() {
  const runDir = ensureRunDir();
  const dbPath = join(runDir, `${randomUUID()}.pfdata`);
  const sqlite = new BetterSQLite(dbPath);
  sqlite.close();
  return dbPath;
}

/**
 * Creates a fresh temp DB, points the app at it via localStorage, refreshes,
 * and waits until the dashboard is ready.
 */
export async function initializeAppWithFreshDb() {
  const dbPath = createE2EDb();

  // Forward slashes so toSqliteUri() in db/index.ts works correctly on Windows
  const normalizedDbPath = dbPath.replace(/\\/g, "/");
  await browser.execute((path: string) => {
    localStorage.setItem("lastOpenedFilePath", path);
  }, normalizedDbPath);

  await browser.refresh();

  await (await find("button*=Add Account")).waitForExist({ timeout: 20_000 });

  return dbPath;
}
