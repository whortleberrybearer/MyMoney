/**
 * E2E tests for category management.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database (with migrations applied) is created in the
 * OS temp directory before each suite. The app opens directly to the dashboard
 * and tests navigate to Settings to access category management.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import { ensureOnDashboard, initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

async function navigateToSettings() {
  const settingsBtn = await find(
    "//button[.//span[normalize-space()='Settings']]",
  );
  await settingsBtn.waitForClickable({ timeout: 10_000 });
  await settingsBtn.click();
  await (
    await find("button*=Manage Categories")
  ).waitForExist({ timeout: 10_000 });
}

async function openCategoryDialog() {
  const btn = await find("button*=Manage Categories");
  await btn.waitForClickable({ timeout: 5_000 });
  await btn.click();
  await (
    await find('[data-slot="dialog-title"]')
  ).waitForExist({ timeout: 5_000 });
}

async function getCategoryRowByName(name: string) {
  let found: WebdriverIO.Element | null = null;
  await browser.waitUntil(
    async () => {
      const rows = await findAll('[data-testid^="category-row-"]');
      for (const row of rows) {
        if ((await row.getText()).includes(name)) {
          found = row;
          return true;
        }
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: `Category "${name}" not found in list` },
  );
  if (!found) throw new Error(`Category "${name}" not found in list`);
  return found;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Category management", () => {
  before(async () => {
    await loadDashboard();
    await navigateToSettings();
    await openCategoryDialog();
  });

  it("shows seeded categories in the dialog", async () => {
    // A few seeded categories should be visible
    await getCategoryRowByName("Bills");
    await getCategoryRowByName("Groceries");
    await getCategoryRowByName("Uncategorised");
  });

  it("shows Uncategorised with the system indicator", async () => {
    const row = await getCategoryRowByName("Uncategorised");
    const nameSpan = await row.$("span.flex-1");
    await nameSpan.waitForExist({ timeout: 3_000 });
    const systemBadge = await nameSpan.$("span");
    expect((await systemBadge.getText()).toLowerCase()).toContain("system");
  });

  it("delete button is disabled for Uncategorised", async () => {
    // Find the Uncategorised row and check its delete button is disabled
    await browser.waitUntil(
      async () => {
        const rows = await findAll('[data-testid^="category-row-"]');
        for (const row of rows) {
          const text = await row.getText();
          if (text.includes("Uncategorised")) {
            const deleteBtn = await row.$('[data-testid^="delete-btn-"]');
            return (await deleteBtn.getAttribute("disabled")) !== null;
          }
        }
        return false;
      },
      {
        timeout: 5_000,
        timeoutMsg: "Uncategorised delete button is not disabled",
      },
    );
  });

  it("can add a new category and it appears in the list", async () => {
    const addBtn = await find('[data-testid="add-category-btn"]');
    await addBtn.waitForClickable({ timeout: 5_000 });
    await addBtn.click();

    const input = await find('[data-testid="new-category-input"]');
    await input.waitForExist({ timeout: 3_000 });
    await input.setValue("E2E Test Category");

    await (await find('[data-testid="save-new-category"]')).click();

    await getCategoryRowByName("E2E Test Category");
  });

  it("shows an error when adding a duplicate category name", async () => {
    const addBtn = await find('[data-testid="add-category-btn"]');
    await addBtn.waitForClickable({ timeout: 5_000 });
    await addBtn.click();

    const input = await find('[data-testid="new-category-input"]');
    await input.waitForExist({ timeout: 3_000 });
    await input.setValue("Bills");

    await (await find('[data-testid="save-new-category"]')).click();

    const errorEl = await find('[data-testid="add-error"]');
    await errorEl.waitForExist({ timeout: 3_000 });
    expect(await errorEl.getText()).toMatch(/already exists/i);
  });

  it("cancels adding a category without error", async () => {
    const cancelBtn = await find('[data-testid="cancel-new-category"]');
    await cancelBtn.waitForClickable({ timeout: 3_000 });
    await cancelBtn.click();

    await (
      await find('[data-testid="new-category-input"]')
    ).waitForExist({ reverse: true, timeout: 3_000 });
  });

  it("deletes an unused category after confirmation", async () => {
    // Find the "E2E Test Category" we added above and delete it
    const rows = await findAll('[data-testid^="category-row-"]');
    let deleteBtn: WebdriverIO.Element | undefined;
    for (const row of rows) {
      if ((await row.getText()).includes("E2E Test Category")) {
        deleteBtn = await row.$('[data-testid^="delete-btn-"]');
        break;
      }
    }
    if (!deleteBtn) throw new Error("E2E Test Category not found");

    await deleteBtn.waitForClickable({ timeout: 3_000 });
    await deleteBtn.click();

    // Confirm dialog appears
    const confirmBtn = await find('[data-testid="delete-confirm"]');
    await confirmBtn.waitForClickable({ timeout: 5_000 });
    await confirmBtn.click();

    // Category is removed from list
    await browser.waitUntil(
      async () => {
        const spans = await findAll('[data-slot="dialog-content"] span');
        for (const el of spans) {
          if ((await el.getText()).trim() === "E2E Test Category") return false;
        }
        return true;
      },
      { timeout: 5_000, timeoutMsg: "E2E Test Category was not removed" },
    );
  });

  it("cancels deletion and category remains in list", async () => {
    // Find any non-system category to test cancellation with
    const rows = await findAll('[data-testid^="category-row-"]');
    let deleteBtn: WebdriverIO.Element | undefined;
    for (const row of rows) {
      const text = await row.getText();
      if (!text.includes("(system)")) {
        deleteBtn = await row.$('[data-testid^="delete-btn-"]');
        break;
      }
    }
    if (!deleteBtn)
      throw new Error("No non-system category found for cancel test");

    // Record the category name before clicking
    const rowText = await (await deleteBtn.$("..")).$("span.flex-1").getText();

    await deleteBtn.waitForClickable({ timeout: 3_000 });
    await deleteBtn.click();

    const cancelBtn = await find('[data-testid="delete-cancel"]');
    await cancelBtn.waitForClickable({ timeout: 5_000 });
    await cancelBtn.click();

    // The category should still be in the list
    await getCategoryRowByName(rowText.trim());
  });
});

// ---------------------------------------------------------------------------
// In-use deletion flow
// ---------------------------------------------------------------------------

describe("Category management — in-use deletion flow", () => {
  let accountRowText = "";

  before(async () => {
    // Start fresh: navigate to dashboard, create an account, add a transaction
    // with a category, then delete that category with Uncategorised as replacement
    await loadDashboard();

    // Create an account via UI
    const addAccountBtn = await find("button*=Add Account");
    await addAccountBtn.waitForClickable({ timeout: 10_000 });
    await addAccountBtn.click();

    // Create institution
    await (await find("button*=Manage")).waitForExist({ timeout: 10_000 });
    await (await find("button*=Manage")).click();
    await (
      await find('[data-slot="dialog-title"]')
    ).waitForExist({ timeout: 5_000 });
    await (await find("button*=Add Institution")).click();
    await (
      await find("input[placeholder='Institution name']")
    ).setValue("Cat Test Bank");
    await (await find("button[aria-label='Save']")).click();
    await (await find("span=Cat Test Bank")).waitForExist({ timeout: 10_000 });

    const dialog = await find('[data-slot="dialog-content"]');
    const dialogClose = await dialog.$("button=Close");
    await dialogClose.waitForClickable({ timeout: 10_000 });
    await dialogClose.click();
    await dialog.waitForExist({ reverse: true, timeout: 10_000 });

    // Fill account form
    await (await find("#acc-name")).setValue("Cat Test Account");
    const instTrigger = await find("#acc-institution");
    await instTrigger.click();
    await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });
    const options = await findAll('[role="option"]');
    for (const opt of options) {
      if ((await opt.getText()).includes("Cat Test Bank")) {
        await opt.click();
        break;
      }
    }
    const typeTrigger = await find("#acc-type");
    await typeTrigger.click();
    await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });
    const typeOptions = await findAll('[role="option"]');
    for (const opt of typeOptions) {
      if ((await opt.getText()).includes("Current")) {
        await opt.click();
        break;
      }
    }
    await (await find("#acc-opening-date")).setValue("2024-01-01");
    await (await find("button=Save")).click();
    await (
      await find("td*=Cat Test Account")
    ).waitForExist({ timeout: 10_000 });

    // Navigate to transaction list
    const accountLink = await find("button*=Cat Test Account");
    await accountLink.waitForClickable({ timeout: 10_000 });
    await accountLink.click();

    // Add a transaction with "Bills" category
    const addTxBtn = await find('[data-testid="add-transaction-btn"]');
    await addTxBtn.waitForClickable({ timeout: 10_000 });
    await addTxBtn.click();

    await (await find('[data-testid="tx-amount"]')).setValue("-50");
    await (await find('[data-testid="tx-payee"]')).setValue("Test Payee");

    // Select "Bills" from the category combobox
    const categoryCombotrigger = await find('[data-testid="tx-category"]');
    await categoryCombotrigger.waitForClickable({ timeout: 5_000 });
    await categoryCombotrigger.click();

    const searchInput = await find('[data-slot="command-input"]');
    await searchInput.waitForExist({ timeout: 5_000 });
    await searchInput.setValue("Bills");

    const billsOption = await find('[data-testid^="category-option-"]');
    await billsOption.waitForClickable({ timeout: 5_000 });
    await billsOption.click();

    await (await find('[data-testid="tx-save"]')).click();
    await (
      await find('[data-slot="sheet-content"]')
    ).waitForExist({
      reverse: true,
      timeout: 5_000,
    });

    accountRowText = "Cat Test Account";
  });

  it("navigates to Settings and opens category management", async () => {
    // Navigate back to dashboard then to settings
    const backBtn = await find('button[aria-label="Back"]');
    await backBtn.waitForClickable({ timeout: 5_000 });
    await backBtn.click();

    // Back now lands on Accounts Overview; ensure we are on Dashboard before continuing.
    await ensureOnDashboard();

    await navigateToSettings();
    await openCategoryDialog();

    await getCategoryRowByName("Bills");
  });

  it("shows replacement picker when deleting an in-use category", async () => {
    const rows = await findAll('[data-testid^="category-row-"]');
    let deleteBtn: WebdriverIO.Element | undefined;
    for (const row of rows) {
      if ((await row.getText()).includes("Bills")) {
        deleteBtn = await row.$('[data-testid^="delete-btn-"]');
        break;
      }
    }
    if (!deleteBtn) throw new Error("Bills category not found");

    await deleteBtn.waitForClickable({ timeout: 3_000 });
    await deleteBtn.click();

    const confirmBtn = await find('[data-testid="delete-confirm"]');
    await confirmBtn.waitForClickable({ timeout: 5_000 });
    await confirmBtn.click();

    // Replacement picker should appear
    const replacementSelect = await find('[data-testid="replacement-select"]');
    await replacementSelect.waitForExist({ timeout: 5_000 });
    expect(await replacementSelect.isExisting()).toBe(true);
  });

  it("confirm button is disabled until replacement is selected", async () => {
    const confirmBtn = await find('[data-testid="replacement-confirm"]');
    await confirmBtn.waitForExist({ timeout: 3_000 });
    expect(await confirmBtn.getAttribute("disabled")).not.toBeNull();
  });

  it("deletes category and reassigns transactions after selecting Uncategorised", async () => {
    // Select Uncategorised as replacement
    const replacementSelect = await find('[data-testid="replacement-select"]');
    await replacementSelect.click();
    await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });

    const options = await findAll('[role="option"]');
    for (const opt of options) {
      if ((await opt.getText()).includes("Uncategorised")) {
        await opt.click();
        break;
      }
    }

    const confirmBtn = await find('[data-testid="replacement-confirm"]');
    await confirmBtn.waitForClickable({ timeout: 3_000 });
    await confirmBtn.click();

    // Bills should be gone from the category list
    await browser.waitUntil(
      async () => {
        const spans = await findAll('[data-slot="dialog-content"] span');
        for (const el of spans) {
          if ((await el.getText()).trim() === "Bills") return false;
        }
        return true;
      },
      { timeout: 5_000, timeoutMsg: "Bills was not removed from list" },
    );
  });
});
