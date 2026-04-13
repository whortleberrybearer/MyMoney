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
import { readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Test database helpers
// ---------------------------------------------------------------------------

const TEST_DB_PATH = join(tmpdir(), "my-money-e2e.pfdata");

/** Create (or recreate) the test SQLite database with all migrations applied. */
function createTestDb() {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  const sqlite = new BetterSQLite(TEST_DB_PATH);
  const migDir = join(process.cwd(), "src/lib/db/migrations");
  for (const file of ["0000_pale_fixer.sql", "0001_cynical_the_watchers.sql"]) {
    const sql = readFileSync(join(migDir, file), "utf-8");
    for (const stmt of sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)) {
      sqlite.exec(stmt);
    }
  }
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
  await (await find("*=Manage Institutions")).waitForExist({ timeout: 5_000 });
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
      const title = await find("*=Manage Institutions");
      expect(await title.isDisplayed()).toBe(true);
    });

    it("shows an empty list on a fresh database", async () => {
      // The seed data does not include institutions — the list should be empty
      const addBtn = await find("button*=Add Institution");
      expect(await addBtn.isDisplayed()).toBe(true);
    });

    it("creates a new institution and shows it in the list", async () => {
      await (await find("button*=Add Institution")).click();
      const input = await find("input[placeholder='Institution name']");
      await input.waitForDisplayed({ timeout: 3_000 });
      await input.setValue("Test Bank");
      await (await find("button[aria-label='Save']")).click();

      const item = await find("span=Test Bank");
      await item.waitForExist({ timeout: 5_000 });
      expect(await item.isDisplayed()).toBe(true);
    });

    it("shows a validation error when saving an empty name", async () => {
      await (await find("button*=Add Institution")).click();
      await (await find("button[aria-label='Save']")).click();
      const err = await find("*=Name is required");
      await err.waitForExist({ timeout: 3_000 });
      expect(await err.isDisplayed()).toBe(true);
      // Cancel the empty row
      await (await find("button[aria-label='Cancel']")).click();
    });

    it("renames an institution", async () => {
      const editBtns = await findAll("button[aria-label='Edit']");
      await editBtns[0].click();

      const input = await find("input[value='Test Bank']");
      await input.waitForDisplayed({ timeout: 3_000 });
      await input.clearValue();
      await input.setValue("Renamed Bank");
      await (await find("button[aria-label='Save']")).click();

      const renamed = await find("span=Renamed Bank");
      await renamed.waitForExist({ timeout: 5_000 });
      expect(await renamed.isDisplayed()).toBe(true);
    });

    it("shows a delete confirmation and removes the institution", async () => {
      const deleteBtns = await findAll("button[aria-label='Delete']");
      await deleteBtns[0].click();

      const confirmation = await find("*=Delete institution?");
      await confirmation.waitForExist({ timeout: 3_000 });
      expect(await confirmation.isDisplayed()).toBe(true);

      await (await find("button=Delete")).click();

      await browser.waitUntil(
        async () => !(await (await find("span=Renamed Bank")).isExisting()),
        { timeout: 5_000, interval: 300, timeoutMsg: "Institution was not removed from the list" },
      );
    });

    after(async () => {
      // Close institution dialog and the account form sheet with Escape
      await browser.keys("Escape");
      await browser.pause(400);
      await browser.keys("Escape");
      await browser.pause(400);
    });
  });

  // -------------------------------------------------------------------------
  // Account list — empty state
  // -------------------------------------------------------------------------
  describe("Account list (empty database)", () => {
    it("shows the empty-state message when no active accounts exist", async () => {
      const msg = await find("*=No active accounts");
      expect(await msg.isDisplayed()).toBe(true);
    });

    it("shows the inactive-accounts toggle", async () => {
      const toggle = await find("[role='switch']");
      expect(await toggle.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Account creation
  // -------------------------------------------------------------------------
  describe("Create account", () => {
    before(async () => {
      // Create an institution via the UI so it is available in the form's dropdown
      await openInstitutionDialog();
      await (await find("button*=Add Institution")).click();
      await (await find("input[placeholder='Institution name']")).setValue("My Bank");
      await (await find("button[aria-label='Save']")).click();
      await (await find("span=My Bank")).waitForExist({ timeout: 5_000 });
      // Close the institution dialog (keep the account sheet open)
      await browser.keys("Escape");
      await browser.pause(500);
      // The AccountFormSheet should still be open with the institution now loaded
      await (await find("*=New Account")).waitForExist({ timeout: 5_000 });
    });

    it("shows validation errors when the form is submitted empty", async () => {
      await (await find("button=Save")).click();
      await (await find("*=Name is required")).waitForExist({ timeout: 3_000 });
      expect(await (await find("*=Name is required")).isDisplayed()).toBe(true);
      expect(await (await find("*=Institution is required")).isDisplayed()).toBe(true);
      expect(await (await find("*=Account type is required")).isDisplayed()).toBe(true);
    });

    it("creates an account with all required fields and shows it in the list", async () => {
      await (await find("#acc-name")).setValue("My Current Account");
      await selectOption("acc-institution", "My Bank");
      await selectOption("acc-type", "Current");
      // Currency defaults to GBP — leave it
      // Opening balance defaults to 0 — leave it
      await (await find("#acc-opening-date")).setValue("2024-01-15");

      await (await find("button=Save")).click();

      // The sheet closes and the account appears in the table
      const accountCell = await find("td*=My Current Account");
      await accountCell.waitForExist({ timeout: 10_000 });
      expect(await accountCell.isDisplayed()).toBe(true);
    });

    it("shows the institution name in the account row", async () => {
      const instCell = await find("td*=My Bank");
      expect(await instCell.isDisplayed()).toBe(true);
    });

    it("shows the account type badge", async () => {
      const badge = await find("*=Current");
      expect(await badge.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Account row actions (requires the account created above to exist)
  // -------------------------------------------------------------------------
  describe("Account row actions", () => {
    it("deactivates the account and shows empty active list", async () => {
      const trigger = await find("button[aria-label='Row actions']");
      await trigger.click();
      const deactivate = await find("*=Deactivate");
      await deactivate.waitForExist({ timeout: 3_000 });
      await deactivate.click();

      const emptyMsg = await find("*=No active accounts");
      await emptyMsg.waitForExist({ timeout: 5_000 });
      expect(await emptyMsg.isDisplayed()).toBe(true);
    });

    it("shows the deactivated account when the inactive toggle is on", async () => {
      await (await find("[role='switch']")).click();
      const accountCell = await find("td*=My Current Account");
      await accountCell.waitForExist({ timeout: 5_000 });
      expect(await accountCell.isDisplayed()).toBe(true);
    });

    it("opens the delete confirmation dialog", async () => {
      const trigger = await find("button[aria-label='Row actions']");
      await trigger.click();
      const deleteItem = await find("*=Delete");
      await deleteItem.waitForExist({ timeout: 3_000 });
      await deleteItem.click();

      const confirmation = await find("*=Delete account?");
      await confirmation.waitForExist({ timeout: 3_000 });
      expect(await confirmation.isDisplayed()).toBe(true);
    });

    it("deletes the account after confirmation", async () => {
      await (await find("button=Delete")).click();

      await browser.waitUntil(
        async () => !(await (await find("td*=My Current Account")).isExisting()),
        { timeout: 5_000, interval: 300, timeoutMsg: "Account was not removed from the list" },
      );
    });
  });
});
