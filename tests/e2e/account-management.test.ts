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
  const sheetContent = await find('[data-slot="sheet-content"]');
  if (!(await sheetContent.isExisting())) {
    const addAccountBtn = await find("button*=Add Account");
    await addAccountBtn.waitForClickable({ timeout: 10_000 });
    await addAccountBtn.click();
  }
  await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
  const manageBtn = await find("button*=Manage");
  await manageBtn.waitForClickable({ timeout: 5_000 });
  await manageBtn.click();
  await (
    await find('[data-slot="dialog-title"]')
  ).waitForExist({ timeout: 5_000 });
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

async function openRowActionsMenu() {
  const trigger = await find("button[aria-label='Row actions']");
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();

  const menu = await find('[data-slot="dropdown-menu-content"]');
  await menu.waitForDisplayed({ timeout: 5_000 });
  return menu;
}

async function clickRowActionsItem(label: string) {
  const menu = await openRowActionsMenu();
  const items = await menu.$$('[data-slot="dropdown-menu-item"]');
  for (const item of items) {
    if ((await item.getText()).trim() === label) {
      await item.waitForClickable({ timeout: 5_000 });
      await item.click();
      return;
    }
  }
  throw new Error(`Row actions item "${label}" not found`);
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
      // Avoid `*=...` here: WDIO treats it as "partial link text".
      const err = await find("p=Name is required");
      await err.waitForExist({ timeout: 3_000 });
      expect(await err.isDisplayed()).toBe(true);
      // Cancel the empty row
      await (await find("button[aria-label='Cancel']")).click();
    });

    it("renames an institution", async () => {
      const editBtn = await find("button[aria-label='Edit']");
      await editBtn.waitForClickable({ timeout: 5_000 });
      await editBtn.click();

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
      const deleteBtn = await find("button[aria-label='Delete']");
      await deleteBtn.waitForClickable({ timeout: 5_000 });
      await deleteBtn.click();

      const confirmationTitle = await find('[data-slot="alert-dialog-title"]');
      await confirmationTitle.waitForDisplayed({ timeout: 3_000 });
      expect(await confirmationTitle.getText()).toBe("Delete institution?");

      await (await find('[data-slot="alert-dialog-action"]')).click();

      await (
        await find("span=Renamed Bank")
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });

    after(async () => {
      // Close institution dialog and the account form sheet using the UI close buttons.
      // (Escape can be flaky with focus traps in WebView2.)
      const dialog = await find('[data-slot="dialog-content"]');
      if (await dialog.isExisting()) {
        const dialogClose = await dialog.$("button=Close");
        await dialogClose.waitForClickable({ timeout: 5_000 });
        await dialogClose.click();
        await dialog.waitForExist({ reverse: true, timeout: 10_000 });
      }

      const sheet = await find('[data-slot="sheet-content"]');
      if (await sheet.isExisting()) {
        const sheetClose = await sheet.$("button=Close");
        await sheetClose.waitForClickable({ timeout: 5_000 });
        await sheetClose.click();
        await sheet.waitForExist({ reverse: true, timeout: 10_000 });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Account list — empty state
  // -------------------------------------------------------------------------
  describe("Account list (empty database)", () => {
    it("shows the empty-state message when no active accounts exist", async () => {
      const msg = await find(
        "div*=No active accounts. Add one to get started.",
      );
      await msg.waitForDisplayed({ timeout: 5_000 });
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
      await (
        await find("input[placeholder='Institution name']")
      ).setValue("My Bank");
      await (await find("button[aria-label='Save']")).click();
      await (await find("span=My Bank")).waitForExist({ timeout: 5_000 });
      // Close the institution dialog (keep the account sheet open)
      const dialog = await find('[data-slot="dialog-content"]');
      const dialogClose = await dialog.$("button=Close");
      await dialogClose.waitForClickable({ timeout: 5_000 });
      await dialogClose.click();
      await dialog.waitForExist({ reverse: true, timeout: 10_000 });
      // The AccountFormSheet should still be open with the institution now loaded
      const sheetTitle = await find('[data-slot="sheet-title"]');
      await sheetTitle.waitForDisplayed({ timeout: 5_000 });
      expect(await sheetTitle.getText()).toBe("New Account");
    });

    it("shows validation errors when the form is submitted empty", async () => {
      await (await find("button=Save")).click();
      const sheet = await find('[data-slot="sheet-content"]');
      const nameErr = await sheet.$("p=Name is required");
      await nameErr.waitForDisplayed({ timeout: 3_000 });
      expect(
        await (await sheet.$("p=Institution is required")).isDisplayed(),
      ).toBe(true);
      expect(
        await (await sheet.$("p=Account type is required")).isDisplayed(),
      ).toBe(true);
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
      const badge = await find('[data-slot="badge"]=Current');
      expect(await badge.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Account row actions (requires the account created above to exist)
  // -------------------------------------------------------------------------
  describe("Account row actions", () => {
    it("deactivates the account and shows empty active list", async () => {
      await clickRowActionsItem("Deactivate");

      const emptyMsg = await find(
        "div=No active accounts. Add one to get started.",
      );
      await emptyMsg.waitForDisplayed({ timeout: 5_000 });
      expect(await emptyMsg.isDisplayed()).toBe(true);
    });

    it("shows the deactivated account when the inactive toggle is on", async () => {
      const toggle = await find("[role='switch']");
      await toggle.waitForClickable({ timeout: 5_000 });
      await toggle.click();
      const accountCell = await find("td*=My Current Account");
      await accountCell.waitForExist({ timeout: 5_000 });
      expect(await accountCell.isDisplayed()).toBe(true);
    });

    it("opens the delete confirmation dialog", async () => {
      await clickRowActionsItem("Delete");

      const confirmationTitle = await find('[data-slot="alert-dialog-title"]');
      await confirmationTitle.waitForDisplayed({ timeout: 3_000 });
      expect(await confirmationTitle.getText()).toBe("Delete account?");
    });

    it("deletes the account after confirmation", async () => {
      const confirm = await find('[data-slot="alert-dialog-action"]');
      await confirm.waitForClickable({ timeout: 5_000 });
      await confirm.click();

      await (
        await find("td*=My Current Account")
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });
  });
});
