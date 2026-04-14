/**
 * E2E tests for account management.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database (with migrations applied) is created in the
 * OS temp directory before the suite runs. localStorage is pointed at that
 * path and the WebView is refreshed so the app opens it as an existing file,
 * bypassing the welcome screen and landing directly on the dashboard.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import BetterSQLite from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Test database helpers
// ---------------------------------------------------------------------------

const TEST_DB_PATH = join(tmpdir(), "my-money-e2e.pfdata");

/**
 * Create (or recreate) the test SQLite database file.
 *
 * Note: the app applies migrations on startup (from an inlined migration list
 * in `src/lib/db/index.ts`). If we also apply the raw SQL migrations here, the
 * app will attempt to run `CREATE TABLE ...` a second time and fail.
 */
function createTestDb() {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  const sqlite = new BetterSQLite(TEST_DB_PATH);
  sqlite.close();
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * Point the app at our test database and wait for the dashboard to load.
 * Recreates the database first so each call starts from a clean state.
 */
async function loadDashboard() {
  createTestDb();
  // Forward slashes so toSqliteUri() in db/index.ts works correctly on Windows
  const dbPath = TEST_DB_PATH.replace(/\\/g, "/");
  await browser.execute((path: string) => {
    localStorage.setItem("lastOpenedFilePath", path);
  }, dbPath);
  await browser.refresh();
  // The AccountsScreen "Add Account" button signals the dashboard is ready
  await (await find("button*=Add Account")).waitForExist({ timeout: 20_000 });
}

/** Open the AccountFormSheet and navigate to the institution management dialog. */
async function openInstitutionDialog() {
  await (await find("button*=Add Account")).click();
  await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
  await (await find("button*=Manage")).click();
  await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 5_000 });
}

/**
 * Click a Select trigger by its `id` attribute, wait for the listbox, then
 * click the option whose visible text includes `optionText`.
 */
async function selectOption(triggerId: string, optionText: string) {
  await (await find(`#${triggerId}`)).click();
  await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });
  const options = await findAll('[role="option"]');
  for (const opt of options) {
    if ((await opt.getText()).includes(optionText)) {
      await opt.click();
      return;
    }
  }
  throw new Error(`Select option "${optionText}" not found in listbox`);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Account Management", () => {
  before(loadDashboard);

  // -------------------------------------------------------------------------
  // Institution management (accessed via the form sheet's "Manage" link)
  // -------------------------------------------------------------------------
  describe("Institution management", () => {
    before(openInstitutionDialog);

    it("shows the Manage Institutions dialog", async () => {
      const title = await find('[data-slot="dialog-title"]');
      await title.waitForDisplayed({ timeout: 5_000 });
      expect(await title.getText()).toBe("Manage Institutions");
    });



    after(async () => {
      // Close institution dialog and the account form sheet with Escape
      await browser.keys("Escape");
      await browser.pause(400);
      await browser.keys("Escape");
      await browser.pause(400);
    });
  });

});
