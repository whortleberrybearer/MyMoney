/**
 * E2E tests for the transaction list screen.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database is created before each suite. The required
 * institution/account/transactions are created via the UI (like the other E2E
 * tests). localStorage is pointed at the DB path so the app opens directly to
 * the dashboard.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import type { ChainablePromiseElement } from "webdriverio";
import { initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Helpers: create required data via the UI (no direct DB interaction)
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
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
  const addBtn = await find("button*=Add Account");
  await addBtn.waitForClickable({ timeout: 10_000 });
  await addBtn.click();

  await (
    await find('[data-slot="sheet-title"]')
  ).waitForDisplayed({ timeout: 10_000 });

  // Create institution via the UI
  await (await find("button*=Manage")).waitForExist({ timeout: 10_000 });
  await (await find("button*=Manage")).click();
  await (
    await find('[data-slot="dialog-title"]')
  ).waitForExist({ timeout: 10_000 });

  await (await find("button*=Add Institution")).click();
  await (
    await find("input[placeholder='Institution name']")
  ).setValue("Test Bank");
  await (await find("button[aria-label='Save']")).click();
  await (await find("span=Test Bank")).waitForExist({ timeout: 10_000 });

  const dialog = await find('[data-slot="dialog-content"]');
  const dialogClose = await dialog.$("button=Close");
  await dialogClose.waitForClickable({ timeout: 10_000 });
  await dialogClose.click();
  await dialog.waitForExist({ reverse: true, timeout: 10_000 });

  // Fill the account form
  await (await find("#acc-name")).setValue("Test Account");
  await selectOption("acc-institution", "Test Bank");
  await selectOption("acc-type", "Current");
  await (await find("#acc-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  // Dashboard restyle: account rows are buttons/cards, not table cells.
  await (await find("button*=Test Account")).waitForExist({ timeout: 10_000 });
}

/**
 * Navigate to the transaction list by clicking on the "Test Account" name link.
 */
async function navigateToTransactionList() {
  const accountLink = await find("button*=Test Account");
  await accountLink.waitForClickable({ timeout: 10_000 });
  await accountLink.click();
  await (
    await find("[data-testid='add-transaction-btn']")
  ).waitForExist({ timeout: 10_000 });
}

async function setControlledInputValue(
  input: WebdriverIO.Element | ChainablePromiseElement,
  value: string,
) {
  const resolved = await input;
  await browser.execute(
    (el: HTMLInputElement, nextValue: string) => {
      // Use the native setter so React’s controlled input tracking sees the change.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(el, nextValue);

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    resolved as unknown as HTMLInputElement,
    value,
  );
}

async function addTransaction({
  date,
  amount,
  payee,
  notes,
}: {
  date: string;
  amount: string;
  payee: string;
  notes: string;
}) {
  const addBtn = await find("[data-testid='add-transaction-btn']");
  await addBtn.waitForClickable({ timeout: 10_000 });
  await addBtn.click();

  const sheetTitle = await find('[data-slot="sheet-title"]');
  await sheetTitle.waitForExist({ timeout: 10_000 });

  const dateField = await find("[data-testid='tx-date']");
  await setControlledInputValue(dateField, date);

  const amountField = await find("[data-testid='tx-amount']");
  await amountField.setValue(amount);

  const payeeField = await find("[data-testid='tx-payee']");
  await payeeField.setValue(payee);

  const notesField = await find("[data-testid='tx-notes']");
  await notesField.setValue(notes);

  const saveBtn = await find("[data-testid='tx-save']");
  await saveBtn.waitForClickable({ timeout: 10_000 });
  await saveBtn.click();

  await sheetTitle.waitForExist({ reverse: true, timeout: 10_000 });
}

async function seedBaseTransactions() {
  await addTransaction({
    date: "2024-01-10",
    amount: "-50",
    payee: "Tesco",
    notes: "Groceries",
  });
  await addTransaction({
    date: "2024-01-15",
    amount: "-25",
    payee: "Starbucks",
    notes: "Coffee",
  });
  await addTransaction({
    date: "2024-01-20",
    amount: "500",
    payee: "Employer",
    notes: "January salary",
  });

  await browser.waitUntil(
    async () => (await findAll("[data-testid^='tx-row-']").length) === 3,
    {
      timeout: 10_000,
      timeoutMsg: "Expected 3 seeded transactions to appear",
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Transaction list — navigation", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await navigateToTransactionList();
    await seedBaseTransactions();
    const backBtn = await find("button[aria-label='Back']");
    await backBtn.waitForClickable({ timeout: 10_000 });
    await backBtn.click();
    // The Back button now returns to the Accounts Overview screen.
    await (
      await find("span*=All your financial accounts")
    ).waitForExist({ timeout: 20_000 });
  });

  it("clicking an account row navigates to the transaction list screen", async () => {
    await navigateToTransactionList();

    const header = await find("span.font-semibold");
    expect(await header.getText()).toBe("Test Account");
  });

  it("transaction list shows the correct number of rows", async () => {
    const rowCount = await findAll("[data-testid^='tx-row-']").length;
    expect(rowCount).toBe(3);
  });

  it("back button returns to accounts overview", async () => {
    const backBtn = await find("button[aria-label='Back']");
    await backBtn.waitForClickable({ timeout: 5_000 });
    await backBtn.click();
    await (
      await find("span*=All your financial accounts")
    ).waitForExist({ timeout: 10_000 });
  });
});

describe("Transaction list — sorting", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await navigateToTransactionList();
    await seedBaseTransactions();
  });

  it("sorts by amount when Amount header is clicked", async () => {
    const amountHeader = await find("[data-testid='col-amount']");
    await amountHeader.click();

    await browser.pause(400);

    const rows = await findAll("[data-testid^='tx-row-']");
    expect(await rows.length).toBeGreaterThan(0);

    // After clicking Amount (default desc): first row should be highest amount (500)
    const firstRowText = await rows[0].getText();
    expect(firstRowText).toContain("500");
  });
});

describe("Transaction list — filtering", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await navigateToTransactionList();
    await seedBaseTransactions();
  });

  it("filtering by date range shows only matching transactions", async () => {
    const fromField = await find("[data-testid='filter-from-date']");
    const toField = await find("[data-testid='filter-to-date']");

    await setControlledInputValue(fromField, "2024-01-12");
    await setControlledInputValue(toField, "2024-01-18");

    expect(await fromField.getValue()).toBe("2024-01-12");
    expect(await toField.getValue()).toBe("2024-01-18");

    await browser.waitUntil(
      async () => {
        const emptyState = await find("[data-testid='empty-state']");
        if (await emptyState.isExisting()) return true;

        const rows = await findAll("[data-testid^='tx-row-']");
        if ((await rows.length) === 0) return false;

        const firstRowText = await rows[0].getText();
        return (
          firstRowText.includes("Starbucks") ||
          firstRowText.includes("2024-01-15")
        );
      },
      { timeout: 10_000, timeoutMsg: "Expected date filter to apply" },
    );

    const emptyState = await find("[data-testid='empty-state']");
    if (await emptyState.isExisting()) {
      throw new Error(
        `Filter returned empty state: ${await emptyState.getText()}`,
      );
    }

    const rows = await findAll("[data-testid^='tx-row-']");
    const texts: string[] = [];
    for (const r of rows) {
      texts.push(await r.getText());
    }
    expect(texts.some((t) => t.includes("Starbucks"))).toBe(true);
    expect(texts.some((t) => t.includes("Tesco"))).toBe(false);
    expect(texts.some((t) => t.includes("Employer"))).toBe(false);
  });

  it("filtering by payee text shows only matching transactions", async () => {
    // Clear date filter first
    const fromField = await find("[data-testid='filter-from-date']");
    const toField = await find("[data-testid='filter-to-date']");
    await setControlledInputValue(fromField, "");
    await setControlledInputValue(toField, "");

    expect(await fromField.getValue()).toBe("");
    expect(await toField.getValue()).toBe("");

    const payeeFilter = await find("[data-testid='filter-payee']");
    await payeeFilter.setValue("tesco");

    expect(await payeeFilter.getValue()).toBe("tesco");

    await browser.waitUntil(
      async () => {
        const emptyState = await find("[data-testid='empty-state']");
        if (await emptyState.isExisting()) return true;

        const rows = await findAll("[data-testid^='tx-row-']");
        if ((await rows.length) === 0) return false;

        const firstRowText = await rows[0].getText();
        return firstRowText.includes("Tesco");
      },
      { timeout: 10_000, timeoutMsg: "Expected payee filter to apply" },
    );

    const emptyState = await find("[data-testid='empty-state']");
    if (await emptyState.isExisting()) {
      throw new Error(
        `Filter returned empty state: ${await emptyState.getText()}`,
      );
    }

    const rows = await findAll("[data-testid^='tx-row-']");
    const texts: string[] = [];
    for (const r of rows) {
      texts.push(await r.getText());
    }
    expect(texts.some((t) => t.includes("Tesco"))).toBe(true);
    expect(texts.some((t) => t.includes("Starbucks"))).toBe(false);
    expect(texts.some((t) => t.includes("Employer"))).toBe(false);
  });
});

describe("Transaction list — CRUD", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await navigateToTransactionList();
    await seedBaseTransactions();
  });

  it("adding a transaction saves and appears in the list", async () => {
    const countBefore = await findAll("[data-testid^='tx-row-']").length;

    const addBtn = await find("[data-testid='add-transaction-btn']");
    await addBtn.click();

    const sheetTitle = await find("[data-slot='sheet-title']");
    await sheetTitle.waitForExist({ timeout: 5_000 });

    // Fill date
    const dateField = await find("[data-testid='tx-date']");
    await setControlledInputValue(dateField, "2024-02-01");

    // Fill amount
    const amountField = await find("[data-testid='tx-amount']");
    await amountField.setValue("-15.00");

    // Fill payee
    const payeeField = await find("[data-testid='tx-payee']");
    await payeeField.setValue("New Payee");

    // Save
    const saveBtn = await find("[data-testid='tx-save']");
    await saveBtn.waitForClickable({ timeout: 5_000 });
    await saveBtn.click();

    // Sheet should close
    await sheetTitle.waitForExist({ reverse: true, timeout: 10_000 });

    // Row count should increase
    await browser.waitUntil(
      async () =>
        (await findAll("[data-testid^='tx-row-']").length) === countBefore + 1,
      {
        timeout: 10_000,
        timeoutMsg: "Expected a new transaction row to appear after save",
      },
    );
    const countAfter = await findAll("[data-testid^='tx-row-']").length;
    expect(countAfter).toBe(countBefore + 1);
  });

  it("editing a transaction notes field updates the displayed value", async () => {
    // Open the actions menu for the first row
    const actionBtns = await findAll("[data-testid^='tx-actions-']");
    await actionBtns[0].scrollIntoView();
    await actionBtns[0].waitForClickable({ timeout: 10_000 });
    await actionBtns[0].click();

    const editItem = await find(
      "//*[@role='menuitem' and contains(normalize-space(.), 'Edit')]",
    );
    await editItem.waitForExist({ timeout: 10_000 });
    await editItem.waitForClickable({ timeout: 10_000 });
    await editItem.click();

    const sheetTitle = await find("[data-slot='sheet-title']");
    await sheetTitle.waitForExist({ timeout: 5_000 });

    const notesField = await find("[data-testid='tx-notes']");
    await notesField.clearValue();
    await notesField.setValue("Updated notes E2E");

    const saveBtn = await find("[data-testid='tx-save']");
    await saveBtn.waitForClickable({ timeout: 5_000 });
    await saveBtn.click();

    await sheetTitle.waitForExist({ reverse: true, timeout: 10_000 });
    await browser.pause(400);

    const rows = await findAll("[data-testid^='tx-row-']");
    let found = false;
    for (const row of rows) {
      const text = await row.getText();
      if (text.includes("Updated notes E2E")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("deleting a transaction removes it from the list", async () => {
    const countBefore = await findAll("[data-testid^='tx-row-']").length;

    // Open actions menu for last row
    const lastAction = await find(
      "(//button[starts-with(@data-testid,'tx-actions-')])[last()]",
    );
    await lastAction.scrollIntoView();
    await lastAction.waitForClickable({ timeout: 10_000 });
    await lastAction.click();

    const deleteItem = await find(
      "//*[@role='menuitem' and contains(normalize-space(.), 'Delete')]",
    );
    await deleteItem.waitForExist({ timeout: 10_000 });
    await deleteItem.waitForClickable({ timeout: 10_000 });
    await deleteItem.click();

    // Confirm dialog
    const confirmBtn = await find("[data-testid='delete-confirm']");
    await confirmBtn.waitForClickable({ timeout: 10_000 });
    await confirmBtn.click();

    await browser.waitUntil(
      async () =>
        (await findAll("[data-testid^='tx-row-']").length) === countBefore - 1,
      {
        timeout: 10_000,
        timeoutMsg: "Expected row count to decrease after deleting",
      },
    );

    const countAfter = await findAll("[data-testid^='tx-row-']").length;
    expect(countAfter).toBe(countBefore - 1);
  });

  it("cancelling delete confirmation leaves the list unchanged", async () => {
    const countBefore = await findAll("[data-testid^='tx-row-']").length;

    const actionBtns = await findAll("[data-testid^='tx-actions-']");
    await actionBtns[0].scrollIntoView();
    await actionBtns[0].waitForClickable({ timeout: 10_000 });
    await actionBtns[0].click();

    const deleteItem = await find(
      "//*[@role='menuitem' and contains(normalize-space(.), 'Delete')]",
    );
    await deleteItem.waitForExist({ timeout: 10_000 });
    await deleteItem.waitForClickable({ timeout: 10_000 });
    await deleteItem.click();

    const cancelBtn = await find("[data-testid='delete-cancel']");
    await cancelBtn.waitForClickable({ timeout: 10_000 });
    await cancelBtn.click();

    await cancelBtn.waitForExist({ reverse: true, timeout: 10_000 });

    const countAfter = await findAll("[data-testid^='tx-row-']").length;
    expect(countAfter).toBe(countBefore);
  });
});
