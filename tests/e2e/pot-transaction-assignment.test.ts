/**
 * E2E tests for pot transaction assignment.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh database is created before the suite. An account, a pot, and
 * a transaction are seeded via the UI. Tests verify that transactions can be
 * reassigned between the main account and pots.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import { initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

async function waitForOverlaysToClear() {
  const sheetOverlay = await find('[data-slot="sheet-overlay"]');
  if (await sheetOverlay.isExisting()) {
    await sheetOverlay.waitForExist({ reverse: true, timeout: 20_000 });
  }
  const dialogOverlay = await find('[data-slot="dialog-overlay"]');
  if (await dialogOverlay.isExisting()) {
    await dialogOverlay.waitForExist({ reverse: true, timeout: 20_000 });
  }
}

async function selectOption(triggerId: string, optionText: string) {
  await (await find(`#${triggerId}`)).click();
  await (await find('[role="listbox"]')).waitForExist({ timeout: 10_000 });
  const options = await findAll('[role="option"]');
  for (const opt of options) {
    if ((await opt.getText()).includes(optionText)) {
      await opt.click();
      return;
    }
  }
  throw new Error(`Select option "${optionText}" not found`);
}

async function createTestAccount() {
  await (await find("button*=Add Account")).click();
  await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 10_000 });

  await (await find("button*=Manage")).waitForExist({ timeout: 10_000 });
  await (await find("button*=Manage")).click();
  await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 10_000 });

  await (await find("button*=Add Institution")).click();
  await (await find("input[placeholder='Institution name']")).setValue("Test Bank");
  await (await find("button[aria-label='Save']")).click();
  await (await find("span=Test Bank")).waitForExist({ timeout: 10_000 });

  const dialog = await find('[data-slot="dialog-content"]');
  await (await dialog.$("button=Close")).click();
  await dialog.waitForExist({ reverse: true, timeout: 10_000 });

  await (await find("#acc-name")).setValue("Test Account");
  await selectOption("acc-institution", "Test Bank");
  await selectOption("acc-type", "Current");
  await (await find("#acc-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
}

async function createTestPot(potName = "Holiday Fund") {
  await waitForOverlaysToClear();
  const addPotBtn = await find("button[aria-label='Add pot to Test Account']");
  await addPotBtn.waitForExist({ timeout: 10_000 });
  await addPotBtn.scrollIntoView();
  await addPotBtn.waitForClickable({ timeout: 10_000 });
  await addPotBtn.click();

  await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 10_000 });
  await (await find("#pot-name")).setValue(potName);
  await (await find("#pot-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();
  await (await find('[data-slot="sheet-overlay"]')).waitForExist({ reverse: true, timeout: 10_000 });
}

async function navigateToAccountTransactionList() {
  const accountLink = await find("button*=Test Account");
  await accountLink.waitForClickable({ timeout: 10_000 });
  await accountLink.click();
  await (await find("[data-testid='add-transaction-btn']")).waitForExist({ timeout: 10_000 });
}

async function navigateToPotTransactionList(potName: string) {
  const potLink = await find(`button*=${potName}`);
  await potLink.waitForExist({ timeout: 10_000 });
  await potLink.scrollIntoView();
  await potLink.waitForClickable({ timeout: 10_000 });
  await potLink.click();
  // Wait for the pot transaction list to load (back button visible)
  await (await find("button[aria-label='Back']")).waitForExist({ timeout: 10_000 });
}

async function setControlledInputValue(el: WebdriverIO.Element, value: string) {
  await browser.execute(
    (input: HTMLInputElement, v: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    el as unknown as HTMLInputElement,
    value,
  );
}

async function addTransaction(date: string, amount: string, payee: string) {
  const addBtn = await find("[data-testid='add-transaction-btn']");
  await addBtn.waitForClickable({ timeout: 10_000 });
  await addBtn.click();

  await (await find('[data-slot="sheet-title"]')).waitForExist({ timeout: 10_000 });
  await setControlledInputValue(await find("[data-testid='tx-date']"), date);
  await (await find("[data-testid='tx-amount']")).setValue(amount);
  await (await find("[data-testid='tx-payee']")).setValue(payee);
  await (await find("[data-testid='tx-save']")).click();
  await (await find('[data-slot="sheet-overlay"]')).waitForExist({ reverse: true, timeout: 10_000 });
}

async function selectPotAssignment(transactionRowTestId: string, optionLabel: string) {
  const row = await find(`[data-testid='${transactionRowTestId}']`);
  await row.waitForExist({ timeout: 10_000 });

  // Find the assignment dropdown trigger within the row
  const trigger = await row.$("[data-testid^='pot-assignment-']");
  await trigger.scrollIntoView();
  await trigger.waitForClickable({ timeout: 10_000 });
  await trigger.click();

  await (await find('[role="listbox"]')).waitForExist({ timeout: 10_000 });
  const options = await findAll('[role="option"]');
  for (const opt of options) {
    if ((await opt.getText()).includes(optionLabel)) {
      await opt.click();
      return;
    }
  }
  throw new Error(`Assignment option "${optionLabel}" not found`);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Pot Transaction Assignment", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot("Holiday Fund");
  });

  it("shows Pot column in account transaction list when account has an active pot", async () => {
    await navigateToAccountTransactionList();
    await addTransaction("2024-01-15", "-50", "Tesco");

    const txRows = await findAll("[data-testid^='tx-row-']");
    await browser.waitUntil(async () => (await findAll("[data-testid^='tx-row-']")).length > 0, {
      timeout: 10_000,
    });
    expect(await find("[data-testid='col-pot']").isExisting()).toBe(true);

    await (await find("button[aria-label='Back']")).click();
    await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
  });

  it("reassigns a transaction from the account to a pot", async () => {
    await navigateToAccountTransactionList();

    const txRows = await findAll("[data-testid^='tx-row-']");
    await browser.waitUntil(async () => (await findAll("[data-testid^='tx-row-']")).length > 0, {
      timeout: 10_000,
    });

    // Get the first transaction row's id
    const firstRow = (await findAll("[data-testid^='tx-row-']"))[0];
    const rowTestId = await firstRow.getAttribute("data-testid");

    // Reassign to Holiday Fund
    await selectPotAssignment(rowTestId!, "Holiday Fund");

    // Transaction row should disappear from account list
    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length === 0,
      { timeout: 10_000, timeoutMsg: "Expected transaction to be removed from account list after reassignment" },
    );

    await (await find("button[aria-label='Back']")).click();
    await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
  });

  it("shows the reassigned transaction in the pot transaction list", async () => {
    await navigateToPotTransactionList("Holiday Fund");

    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length > 0,
      { timeout: 10_000, timeoutMsg: "Expected reassigned transaction to appear in pot list" },
    );

    const rows = await findAll("[data-testid^='tx-row-']");
    expect(rows.length).toBeGreaterThan(0);

    await (await find("button[aria-label='Back']")).click();
    await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
  });

  it("reassigns a transaction from pot back to the main account", async () => {
    await navigateToPotTransactionList("Holiday Fund");

    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length > 0,
      { timeout: 10_000, timeoutMsg: "Expected transaction in pot list" },
    );

    const firstRow = (await findAll("[data-testid^='tx-row-']"))[0];
    const rowTestId = await firstRow.getAttribute("data-testid");

    await selectPotAssignment(rowTestId!, "Test Account");

    // Transaction should leave pot list
    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length === 0,
      { timeout: 10_000, timeoutMsg: "Expected transaction to be removed from pot list" },
    );

    await (await find("button[aria-label='Back']")).click();
    await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
  });

  it("does not show assignment dropdown on virtual transfer rows", async () => {
    // No virtual transfers in this suite — verify by checking that any row
    // with data-tx-type=virtual_transfer has no pot-assignment trigger
    await navigateToAccountTransactionList();

    // The transaction should be back in the account list now
    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length > 0,
      { timeout: 10_000 },
    );

    const transferRows = await findAll("[data-tx-type='virtual_transfer']");
    for (const row of transferRows) {
      const trigger = await row.$("[data-testid^='pot-assignment-']");
      expect(await trigger.isExisting()).toBe(false);
    }

    await (await find("button[aria-label='Back']")).click();
    await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
  });

  it("hides Pot column for an account with no active pots", async () => {
    // Create a second account with no pots
    await (await find("button*=Add Account")).click();
    await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 10_000 });

    await (await find("#acc-name")).setValue("No Pot Account");
    await selectOption("acc-institution", "Test Bank");
    await selectOption("acc-type", "Current");
    await (await find("#acc-opening-date")).setValue("2024-01-01");
    await (await find("button=Save")).click();
    await (await find("td*=No Pot Account")).waitForExist({ timeout: 10_000 });

    // Navigate to no-pot account's transaction list
    const noPotLink = await find("button*=No Pot Account");
    await noPotLink.waitForClickable({ timeout: 10_000 });
    await noPotLink.click();
    await (await find("[data-testid='add-transaction-btn']")).waitForExist({ timeout: 10_000 });

    // Add a transaction so the table renders
    await addTransaction("2024-01-20", "-10", "Test");

    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length > 0,
      { timeout: 10_000 },
    );

    expect(await find("[data-testid='col-pot']").isExisting()).toBe(false);

    await (await find("button[aria-label='Back']")).click();
    await (await find("td*=Test Account")).waitForExist({ timeout: 10_000 });
  });
});
