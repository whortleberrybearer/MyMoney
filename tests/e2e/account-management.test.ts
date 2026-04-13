/**
 * E2E tests for account management.
 *
 * These tests require the full Tauri application to be running.
 * Run with: npm run test:e2e
 *
 * Setup assumption: the app is started fresh for each suite.
 * A temporary data file is created via the welcome screen before each test.
 */

import { browser, expect } from "@wdio/globals";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for an element and return it. */
async function waitForEl(selector: string, timeout = 10_000) {
  const el = await $(selector);
  await el.waitForExist({ timeout });
  return el;
}

/** Click a button whose visible text matches the given string. */
async function clickButton(text: string) {
  const btn = await $(`button=${text}`);
  await btn.waitForClickable();
  await btn.click();
}

/**
 * Advance past the welcome screen by creating a temp data file.
 * Uses the "Create new file" button visible on the welcome screen.
 */
async function skipToAppViaCreate() {
  // The WelcomeScreen shows "Create new file" — click it.
  // The native file-save dialog is dismissed automatically by the Tauri
  // test service's pre-configured default path (or can be dismissed via
  // browser.execute to pre-set localStorage and reload).
  //
  // For CI/automated runs, inject a pre-created file path via localStorage
  // so the app bypasses the welcome screen entirely.
  await browser.execute(() => {
    // Use an in-memory path that will be created by the app
    const testPath = "/tmp/test-my-money.pfdata";
    localStorage.setItem("lastOpenedFilePath", testPath);
  });
  await browser.refresh();
  // After refresh the startup hook sees the path and tries to open it.
  // Since the file does not exist yet it routes to file-not-found.
  // In a real test environment, a pre-seeded file is placed at testPath first.
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Account Management", () => {
  before(async () => {
    // Ensure the app has fully loaded
    await waitForEl("body");
  });

  describe("Institutions", () => {
    it("should open the institution management dialog", async () => {
      // Navigate to the accounts screen (already the default view after the
      // welcome screen has been bypassed)
      const addAccountBtn = await waitForEl("button*=Add Account");
      await addAccountBtn.click();

      // Click the "Manage" link next to the Institution field
      const manageLink = await waitForEl("button*=Manage, a*=Manage");
      await manageLink.click();

      const dialogTitle = await waitForEl("h2*=Manage Institutions");
      expect(await dialogTitle.getText()).toContain("Manage Institutions");
    });

    it("should create a new institution", async () => {
      // Assumes the Manage Institutions dialog is open from the previous test,
      // or reopened here
      const addBtn = await waitForEl("button*=Add Institution");
      await addBtn.click();

      const nameInput = await waitForEl("input[placeholder='Institution name']");
      await nameInput.setValue("Test Bank");

      await clickButton("Save");

      const item = await waitForEl("span*=Test Bank");
      expect(await item.getText()).toBe("Test Bank");
    });
  });

  describe("Accounts list", () => {
    it("should display 'No active accounts' when no accounts exist", async () => {
      const emptyMsg = await waitForEl("*=No active accounts");
      expect(await emptyMsg.isDisplayed()).toBe(true);
    });

    it("should show the inactive toggle", async () => {
      const toggle = await waitForEl("[role='switch']");
      expect(await toggle.isDisplayed()).toBe(true);
    });
  });

  describe("Create account", () => {
    it("should open the account form when Add Account is clicked", async () => {
      await clickButton("Add Account");
      const sheetTitle = await waitForEl("*=New Account");
      expect(await sheetTitle.isDisplayed()).toBe(true);
    });

    it("should show validation errors when saving an empty form", async () => {
      // Assumes sheet is open from previous test
      await clickButton("Save");
      const nameError = await waitForEl("*=Name is required");
      expect(await nameError.isDisplayed()).toBe(true);
    });
  });
});
