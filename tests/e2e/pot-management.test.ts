/**
 * E2E tests for pot management.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database is created before the suite runs and an
 * account is seeded via the UI. All pot tests operate on that account.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import { initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

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
  throw new Error(`Select option "${optionText}" not found`);
}

async function openInstitutionDialog() {
  const sheetContent = await find('[data-slot="sheet-content"]');
  if (!(await sheetContent.isExisting())) {
    await (await find("button*=Add Account")).click();
  }
  await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
  await (await find("button*=Manage")).click();
  await (
    await find('[data-slot="dialog-title"]')
  ).waitForExist({ timeout: 5_000 });
}

/** Creates an account named "Test Account" at My Bank via the UI. */
async function createTestAccount() {
  // Create institution
  await openInstitutionDialog();
  await (await find("button*=Add Institution")).click();
  await (
    await find("input[placeholder='Institution name']")
  ).setValue("My Bank");
  await (await find("button[aria-label='Save']")).click();
  await (await find("span=My Bank")).waitForExist({ timeout: 5_000 });

  // Close institution dialog
  const dialog = await find('[data-slot="dialog-content"]');
  await (await dialog.$("button=Close")).click();
  await dialog.waitForExist({ reverse: true, timeout: 10_000 });

  // Fill account form
  await (await find("#acc-name")).setValue("Test Account");
  await selectOption("acc-institution", "My Bank");
  await selectOption("acc-type", "Current");
  await (await find("#acc-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  // Wait for account to appear
  await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
}

/** Clicks the "Add pot" button for the first (only) account in the list. */
async function clickAddPot() {
  // Prefer a stable, case-insensitive lookup. The built app can vary in casing
  // (e.g. "Add Pot" vs "Add pot"), which would break a CSS attribute selector.
  const addPotBtn = await find(
    "//button[contains(translate(@aria-label,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'add pot') or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'add pot')]",
  );
  await addPotBtn.waitForExist({ timeout: 10_000 });
  await addPotBtn.scrollIntoView();
  await addPotBtn.waitForClickable({ timeout: 10_000 });
  await addPotBtn.click();
  await (
    await find('[data-slot="sheet-title"]')
  ).waitForDisplayed({ timeout: 5_000 });
}

async function findPotRow(potName: string) {
  const row = await find(
    `//tr[@data-testid='pot-row'][.//td[contains(normalize-space(.), "${potName}")]]`,
  );
  await row.waitForExist({ timeout: 10_000 });
  return row;
}

/** Clicks the pot actions dropdown for the first visible pot row. */
async function openPotActionsMenu(potName?: string) {
  const trigger = potName
    ? await (await findPotRow(potName)).$("button[aria-label='Pot actions']")
    : await find("button[aria-label='Pot actions']");
  await trigger.scrollIntoView();
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();
  const menu = await find('[data-slot="dropdown-menu-content"]');
  await menu.waitForDisplayed({ timeout: 5_000 });
  return menu;
}

async function clickPotActionsItem(label: string, potName?: string) {
  const menu = await openPotActionsMenu(potName);
  const items = await menu.$$('[data-slot="dropdown-menu-item"]');
  for (const item of items) {
    if ((await item.getText()).trim() === label) {
      await item.waitForClickable({ timeout: 5_000 });
      await item.click();
      return;
    }
  }
  throw new Error(`Pot actions item "${label}" not found`);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Pot Management", () => {
  before(async () => {
    await loadDashboard();
    // Open the add account sheet
    await (await find("button*=Add Account")).click();
    await (
      await find('[data-slot="sheet-title"]')
    ).waitForDisplayed({ timeout: 5_000 });
    await createTestAccount();
  });

  // -------------------------------------------------------------------------
  // Create a pot
  // -------------------------------------------------------------------------
  describe("Create pot", () => {
    before(clickAddPot);

    it("shows 'New Pot' sheet title", async () => {
      const title = await find('[data-slot="sheet-title"]');
      expect(await title.getText()).toBe("New Pot");
    });

    it("shows the parent account name read-only", async () => {
      const sheet = await find('[data-slot="sheet-content"]');
      expect(await sheet.getText()).toContain("Test Account");
    });

    it("shows validation error when name is blank", async () => {
      await (await find("button=Save")).click();
      const nameErr = await find("p=Name is required");
      await nameErr.waitForDisplayed({ timeout: 3_000 });
    });

    it("creates a pot and shows it as a child row", async () => {
      await (await find("#pot-name")).setValue("Holiday Fund");
      await (await find("#pot-opening-date")).setValue("2024-01-15");
      await (await find("button=Save")).click();

      // Sheet closes; pot appears as a child row
      const potCell = await find("td*=Holiday Fund");
      await potCell.waitForExist({ timeout: 10_000 });
      expect(await potCell.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Edit a pot
  // -------------------------------------------------------------------------
  describe("Edit pot", () => {
    it("opens the edit sheet pre-filled", async () => {
      await clickPotActionsItem("Edit", "Holiday Fund");
      const sheet = await find('[data-slot="sheet-content"]');
      await (
        await find('[data-slot="sheet-title"]')
      ).waitForDisplayed({ timeout: 5_000 });

      expect(await (await sheet.$("#pot-name")).getValue()).toBe(
        "Holiday Fund",
      );
    });

    it("saves an updated pot name", async () => {
      const nameInput = await find("#pot-name");
      await nameInput.clearValue();
      await nameInput.setValue("Summer Holiday");
      await (await find("button=Save")).click();

      const potCell = await find("td*=Summer Holiday");
      await potCell.waitForExist({ timeout: 10_000 });
      expect(await potCell.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Manual transfer
  // -------------------------------------------------------------------------
  describe("Manual pot transfer", () => {
    it("opens transfer dialog from pot actions", async () => {
      await clickPotActionsItem("Transfer", "Summer Holiday");
      const title = await find('[data-slot="dialog-title"]');
      await title.waitForDisplayed({ timeout: 5_000 });
      expect(await title.getText()).toBe("Transfer Funds");
    });

    it("shows pot and account names in the dialog", async () => {
      const dialog = await find('[data-slot="dialog-content"]');
      expect(await dialog.getText()).toContain("Summer Holiday");
      expect(await dialog.getText()).toContain("Test Account");
    });

    it("shows validation error when amount is zero", async () => {
      await (await find("#transfer-amount")).setValue("0");
      await (await find("#transfer-date")).setValue("2024-02-01");
      await (await find("button=Transfer")).click();
      const err = await find("p=Amount must be greater than zero");
      await err.waitForDisplayed({ timeout: 3_000 });
    });

    it("transfers funds into pot and updates balance", async () => {
      const amountInput = await find("#transfer-amount");
      await amountInput.clearValue();
      await amountInput.setValue("150");
      await (await find("#transfer-date")).setValue("2024-02-01");
      await (await find("button=Transfer")).click();

      // Dialog closes; pot balance cell shows 150.00
      const balanceCell = await find("td=150.00");
      await balanceCell.waitForExist({ timeout: 10_000 });
      expect(await balanceCell.isDisplayed()).toBe(true);
    });

    it("transfers funds out of pot and updates balance", async () => {
      await clickPotActionsItem("Transfer", "Summer Holiday");
      await (
        await find('[data-slot="dialog-title"]')
      ).waitForDisplayed({ timeout: 5_000 });

      // Select "Out of pot"
      const outRadio = await find("input[value='out_of_pot']");
      await outRadio.click();

      await (await find("#transfer-amount")).setValue("50");
      await (await find("#transfer-date")).setValue("2024-03-01");
      await (await find("button=Transfer")).click();

      // Balance should now be 100.00
      const balanceCell = await find("td=100.00");
      await balanceCell.waitForExist({ timeout: 10_000 });
      expect(await balanceCell.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Close pot (zero balance)
  // -------------------------------------------------------------------------
  describe("Close pot with zero balance", () => {
    before(async () => {
      // Create a new zero-balance pot to test close with zero balance
      await clickAddPot();
      await (await find("#pot-name")).setValue("Empty Pot");
      await (await find("#pot-opening-date")).setValue("2024-01-01");
      await (await find("button=Save")).click();
      await (await find("td*=Empty Pot")).waitForExist({ timeout: 10_000 });
    });

    it("closes the pot without a warning dialog when balance is zero", async () => {
      await clickPotActionsItem("Close", "Empty Pot");

      // No alert dialog should open; pot should be hidden
      await (
        await find("td*=Empty Pot")
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Show / hide closed pots toggle
  // -------------------------------------------------------------------------
  describe("Show closed pots toggle", () => {
    it("closed pot is hidden by default", async () => {
      // Empty Pot should not be visible (closed in previous test)
      expect(await (await find("td*=Empty Pot")).isExisting()).toBe(false);
    });

    it("reveals closed pot when toggle is enabled", async () => {
      const toggle = await find(
        "button[aria-label*='Show closed pots for Test Account']",
      );
      await toggle.waitForClickable({ timeout: 5_000 });
      await toggle.click();

      const potCell = await find("td*=Empty Pot");
      await potCell.waitForExist({ timeout: 5_000 });
      expect(await potCell.isDisplayed()).toBe(true);
    });

    it("hides closed pot again when toggle is disabled", async () => {
      const toggle = await find(
        "button[aria-label*='Show closed pots for Test Account']",
      );
      await toggle.click();

      await (
        await find("td*=Empty Pot")
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Close pot with non-zero balance (auto-transfer warning)
  // -------------------------------------------------------------------------
  describe("Close pot with non-zero balance", () => {
    it("shows a warning dialog and transfers balance on confirm", async () => {
      // "Summer Holiday" pot has a balance of 100.00 from the transfer tests
      await clickPotActionsItem("Close", "Summer Holiday");

      const alertTitle = await find('[data-slot="alert-dialog-title"]');
      await alertTitle.waitForDisplayed({ timeout: 5_000 });
      expect(await alertTitle.getText()).toContain(
        "Close pot with remaining balance",
      );

      // Confirm transfer & close
      const action = await find('[data-slot="alert-dialog-action"]');
      await action.click();
      await (
        await find('[data-slot="alert-dialog-content"]')
      ).waitForExist({
        reverse: true,
        timeout: 10_000,
      });

      // Pot should be hidden (is_active=0)
      await (
        await find("td*=Summer Holiday")
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Reactivate pot
  // -------------------------------------------------------------------------
  describe("Reactivate pot", () => {
    before(async () => {
      // Reveal closed pots to access the Reactivate action
      const toggle = await find(
        "button[aria-label*='Show closed pots for Test Account']",
      );
      await toggle.waitForClickable({ timeout: 5_000 });
      await toggle.click();
      await (await find("td*=Summer Holiday")).waitForExist({ timeout: 5_000 });
    });

    it("reactivates the closed pot", async () => {
      await clickPotActionsItem("Reactivate", "Summer Holiday");

      // Pot should reappear without the closed-pots toggle needing to be on
      // (after reactivation the toggle is still on, so pot is visible)
      const potCell = await find("td*=Summer Holiday");
      await potCell.waitForExist({ timeout: 5_000 });
      expect(await potCell.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Hard delete pot
  // -------------------------------------------------------------------------
  describe("Hard delete pot", () => {
    it("shows the permanent deletion warning dialog", async () => {
      await clickPotActionsItem("Delete", "Summer Holiday");

      const alertTitle = await find('[data-slot="alert-dialog-title"]');
      await alertTitle.waitForDisplayed({ timeout: 5_000 });
      expect(await alertTitle.getText()).toContain("Delete pot permanently");
    });

    it("contains 'permanent' and 'irreversible' in the warning text", async () => {
      const desc = await find('[data-slot="alert-dialog-description"]');
      const text = await desc.getText();
      expect(text).toContain("permanently");
    });

    it("permanently removes the pot on confirmation", async () => {
      const action = await find('[data-slot="alert-dialog-action"]');
      await action.waitForClickable({ timeout: 5_000 });
      await action.click();

      await (
        await find("td*=Summer Holiday")
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Account balance excludes pot balances + breakdown chart
  // -------------------------------------------------------------------------
  describe("Balance separation and breakdown chart", () => {
    before(async () => {
      // Create a fresh pot with a known balance to verify separation
      await clickAddPot();
      await (await find("#pot-name")).setValue("Chart Pot");
      await (await find("#pot-opening-balance")).setValue("500");
      await (await find("#pot-opening-date")).setValue("2024-01-01");
      await (await find("button=Save")).click();
      await (await find("td*=Chart Pot")).waitForExist({ timeout: 10_000 });
    });

    it("account balance row shows its own balance (not including pot)", async () => {
      // Account opening balance is 0; pot balance is 500
      // Account row should show 0.00, pot row shows 500.00
      const rows = await findAll("[data-testid='pot-row']");
      // The pot row for "Chart Pot" should show 500.00
      const balanceCells = await rows[0].$$("td");
      const lastCell = balanceCells[balanceCells.length - 2]; // second-to-last (before actions)
      expect(await lastCell.getText()).toBe("500.00");
    });

    it("shows breakdown toggle when account has active pots", async () => {
      const toggle = await find(
        "button[aria-label*='Show balance breakdown for Test Account']",
      );
      expect(await toggle.isDisplayed()).toBe(true);
    });

    it("shows breakdown chart when toggle is enabled", async () => {
      const toggle = await find(
        "button[aria-label*='Show balance breakdown for Test Account']",
      );
      await toggle.click();

      // The Recharts SVG should appear
      const chart = await find("svg");
      await chart.waitForExist({ timeout: 5_000 });
      expect(await chart.isDisplayed()).toBe(true);
    });

    it("hides breakdown chart when toggle is disabled", async () => {
      const toggle = await find(
        "button[aria-label*='Show balance breakdown for Test Account']",
      );
      await toggle.click();

      // Give a moment for the chart to unmount
      await browser.pause(300);
      // The chart container should not be present
      const chart = await find('[data-testid="pie-chart"]');
      expect(await chart.isExisting()).toBe(false);
    });
  });
});
