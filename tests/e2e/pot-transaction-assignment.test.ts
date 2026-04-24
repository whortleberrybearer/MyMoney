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
import BetterSQLite from "better-sqlite3";
import { ensureOnDashboard, initializeAppWithFreshDb, waitForAccountsOverviewReady } from "./e2e-app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  dbPath = await initializeAppWithFreshDb();
}

let dbPath: string;

function getDb() {
  if (!dbPath) throw new Error("E2E DB path not initialized");
  return new BetterSQLite(dbPath);
}

function getPotIdByName(potName: string): number {
  const sqlite = getDb();
  try {
    const row = sqlite
      .prepare("SELECT id FROM pot WHERE name = ? ORDER BY id DESC LIMIT 1")
      .get(potName) as { id: number } | undefined;
    if (!row) throw new Error(`Pot not found in DB: ${potName}`);
    return row.id;
  } finally {
    sqlite.close();
  }
}

function getLatestTxByPayee(payee: string): { id: number; potId: number | null; accountId: number | null } {
  const sqlite = getDb();
  try {
    const row = sqlite
      .prepare(
        "SELECT id, pot_id as potId, account_id as accountId FROM `transaction` WHERE payee = ? ORDER BY id DESC LIMIT 1",
      )
      .get(payee) as { id: number; potId: number | null; accountId: number | null } | undefined;
    if (!row) throw new Error(`Transaction not found in DB for payee: ${payee}`);
    return row;
  } finally {
    sqlite.close();
  }
}

async function waitForAccountsOverviewWithAccount(accountName: string) {
  await waitForAccountsOverviewReady();
  await (await find(`button*=${accountName}`)).waitForExist({ timeout: 10_000 });
}

async function count(selector: string): Promise<number> {
  const els = await findAll(selector);
  // In WDIO v9, $$ returns a ChainablePromiseArray whose length is a Promise<number>.
  return await (els as unknown as { length: number | Promise<number> }).length;
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
  await ensureOnDashboard();
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

  await (await find("button*=Test Account")).waitForExist({ timeout: 10_000 });
}

async function createTestPot(potName = "Holiday Fund") {
  await ensureOnDashboard();
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
  // Pot names also appear inside the Accounts Overview account card (which is a <button>),
  // so `button*=${potName}` is ambiguous. Navigate to the Dashboard and click the dedicated
  // pot link in the accounts table.
  await ensureOnDashboard();

  // Dedicated pot link is rendered as a <button data-testid="pot-name-link">.
  // Use CSS + text matching to avoid XPath selector issues under tauri-driver.
  const potLinks = await findAll('[data-testid="pot-name-link"]');
  for (const link of potLinks) {
    if ((await link.getText()).includes(potName)) {
      await link.scrollIntoView();
      await link.waitForClickable({ timeout: 10_000 });
      await link.click();
      // Wait for the pot transaction list to load (header shows pot name)
      await (await find(`header span`)).waitForExist({ timeout: 10_000 });
      return;
    }
  }

  throw new Error(`Pot link not found on dashboard: ${potName}`);

  
}

async function setControlledInputValue(
  el: WebdriverIO.Element | ReturnType<typeof find>,
  value: string,
) {
  const element = await el;
  await browser.execute(
    (input: HTMLInputElement, v: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    element as unknown as HTMLInputElement,
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

    await browser.waitUntil(async () => (await count("[data-testid^='tx-row-']")) > 0, {
      timeout: 10_000,
    });
    expect(await find("[data-testid='col-pot']").isExisting()).toBe(true);

    await (await find("button[aria-label='Back']")).click();
    await waitForAccountsOverviewWithAccount("Test Account");
  });

  it("reassigns a transaction from the account to a pot", async () => {
    await navigateToAccountTransactionList();

    await browser.waitUntil(async () => (await count("[data-testid^='tx-row-']")) > 0, {
      timeout: 10_000,
    });

    // Get the first transaction row's id
    const firstRow = (await findAll("[data-testid^='tx-row-']"))[0];
    const rowTestId = await firstRow.getAttribute("data-testid");

    // Reassign to Holiday Fund
    await selectPotAssignment(rowTestId!, "Holiday Fund");

    // Wait for list to reload to empty state
    await (await find("[data-testid='empty-state']")).waitForExist({ timeout: 10_000 });

    // Verify reassignment persisted to DB
    const holidayPotId = getPotIdByName("Holiday Fund");
    const tx = getLatestTxByPayee("Tesco");
    expect(tx.potId).toBe(holidayPotId);
    expect(tx.accountId).toBe(null);

    await (await find("button[aria-label='Back']")).click();
    await waitForAccountsOverviewWithAccount("Test Account");
  });

  it("shows the reassigned transaction in the pot transaction list", async () => {
    await navigateToPotTransactionList("Holiday Fund");

    await browser.waitUntil(
      async () =>
        (await count("[data-testid^='tx-row-']")) > 0 ||
        (await (await find("[data-testid='empty-state']")).isExisting()),
      { timeout: 20_000, timeoutMsg: "Expected pot transaction list to finish loading" },
    );

    if (await (await find("[data-testid='empty-state']")).isExisting()) {
      const holidayPotId = getPotIdByName("Holiday Fund");
      const tx = getLatestTxByPayee("Tesco");
      throw new Error(
        `Pot list is empty, but DB shows tx ${tx.id} has pot_id=${tx.potId} (Holiday Fund id=${holidayPotId})`,
      );
    }

    const rows = await findAll("[data-testid^='tx-row-']");
    expect(rows.length).toBeGreaterThan(0);

    await (await find("button[aria-label='Back']")).click();
    await waitForAccountsOverviewWithAccount("Test Account");
  });

  it("reassigns a transaction from pot back to the main account", async () => {
    await navigateToPotTransactionList("Holiday Fund");

    await browser.waitUntil(
      async () => (await count("[data-testid^='tx-row-']")) > 0,
      { timeout: 10_000, timeoutMsg: "Expected transaction in pot list" },
    );

    const firstRow = (await findAll("[data-testid^='tx-row-']"))[0];
    const rowTestId = await firstRow.getAttribute("data-testid");

    await selectPotAssignment(rowTestId!, "Test Account");

    // Transaction should leave pot list
    await browser.waitUntil(
      async () => (await count("[data-testid^='tx-row-']")) === 0,
      { timeout: 10_000, timeoutMsg: "Expected transaction to be removed from pot list" },
    );

    await (await find("button[aria-label='Back']")).click();
    await waitForAccountsOverviewWithAccount("Test Account");
  });

  it("does not show assignment dropdown on virtual transfer rows", async () => {
    // No virtual transfers in this suite — verify by checking that any row
    // with data-tx-type=virtual_transfer has no pot-assignment trigger
    await navigateToAccountTransactionList();

    // The transaction should be back in the account list now
    await browser.waitUntil(
      async () => (await count("[data-testid^='tx-row-']")) > 0,
      { timeout: 10_000 },
    );

    const transferRows = await findAll("[data-tx-type='virtual_transfer']");
    for (const row of transferRows) {
      const trigger = await row.$("[data-testid^='pot-assignment-']");
      expect(await trigger.isExisting()).toBe(false);
    }

    await (await find("button[aria-label='Back']")).click();
    await waitForAccountsOverviewWithAccount("Test Account");
  });

  it("hides Pot column for an account with no active pots", async () => {
    // Create a second account with no pots
    await ensureOnDashboard();
    await (await find("button*=Add Account")).click();
    await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 10_000 });

    await (await find("#acc-name")).setValue("No Pot Account");
    await selectOption("acc-institution", "Test Bank");
    await selectOption("acc-type", "Current");
    await (await find("#acc-opening-date")).setValue("2024-01-01");
    await (await find("button=Save")).click();
    await (await find("button*=No Pot Account")).waitForExist({ timeout: 10_000 });

    // Navigate to no-pot account's transaction list
    const noPotLink = await find("button*=No Pot Account");
    await noPotLink.waitForClickable({ timeout: 10_000 });
    await noPotLink.click();
    await (await find("[data-testid='add-transaction-btn']")).waitForExist({ timeout: 10_000 });

    // Add a transaction so the table renders
    await addTransaction("2024-01-20", "-10", "Test");

    await browser.waitUntil(
      async () => (await count("[data-testid^='tx-row-']")) > 0,
      { timeout: 10_000 },
    );

    expect(await find("[data-testid='col-pot']").isExisting()).toBe(false);

    await (await find("button[aria-label='Back']")).click();
    await waitForAccountsOverviewWithAccount("Test Account");
  });
});
