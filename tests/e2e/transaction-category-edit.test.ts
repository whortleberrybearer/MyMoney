/**
 * E2E tests for the transaction category combobox.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Verifies that the category field in the transaction create/edit drawer is a
 * searchable combobox that correctly persists the selected category.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import type { ChainablePromiseElement } from "webdriverio";
import { initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

async function setControlledInputValue(
  input: WebdriverIO.Element | ChainablePromiseElement,
  value: string,
) {
  const resolved = await input;
  await browser.execute(
    (el: HTMLInputElement, nextValue: string) => {
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

async function createTestAccountAndNavigate() {
  const addAccountBtn = await find("button*=Add Account");
  await addAccountBtn.waitForClickable({ timeout: 10_000 });
  await addAccountBtn.click();

  await (await find("button*=Manage")).waitForExist({ timeout: 10_000 });
  await (await find("button*=Manage")).click();
  await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 5_000 });

  await (await find("button*=Add Institution")).click();
  await (await find("input[placeholder='Institution name']")).setValue("Tx Cat Bank");
  await (await find("button[aria-label='Save']")).click();
  await (await find("span=Tx Cat Bank")).waitForExist({ timeout: 10_000 });

  const dialog = await find('[data-slot="dialog-content"]');
  const dialogClose = await dialog.$("button=Close");
  await dialogClose.waitForClickable({ timeout: 10_000 });
  await dialogClose.click();
  await dialog.waitForExist({ reverse: true, timeout: 10_000 });

  await (await find("#acc-name")).setValue("Tx Cat Account");
  const instTrigger = await find("#acc-institution");
  await instTrigger.click();
  await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });
  const instOptions = await findAll('[role="option"]');
  for (const opt of instOptions) {
    if ((await opt.getText()).includes("Tx Cat Bank")) {
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
  await (await find("td*=Tx Cat Account")).waitForExist({ timeout: 10_000 });

  const accountLink = await find("button*=Tx Cat Account");
  await accountLink.waitForClickable({ timeout: 10_000 });
  await accountLink.click();
  await (await find('[data-testid="add-transaction-btn"]')).waitForExist({ timeout: 10_000 });
}

async function openAddTransactionDrawer() {
  const addBtn = await find('[data-testid="add-transaction-btn"]');
  await addBtn.waitForClickable({ timeout: 5_000 });
  await addBtn.click();
  await (await find('[data-slot="sheet-title"]')).waitForExist({ timeout: 10_000 });
}

async function openCategoryCombobox() {
  const trigger = await find('[data-testid="tx-category"]');
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();
  await (await find('[data-slot="command-input"]')).waitForExist({ timeout: 5_000 });
}

async function selectCategoryByName(name: string) {
  const searchInput = await find('[data-slot="command-input"]');
  await searchInput.waitForExist({ timeout: 5_000 });
  await searchInput.setValue(name);

  await browser.waitUntil(
    async () => {
      const options = await findAll('[role="option"]');
      for (const opt of options) {
        if ((await opt.getText()).trim().toLowerCase().startsWith(name.toLowerCase())) {
          await opt.click();
          return true;
        }
      }
      return false;
    },
    { timeout: 5_000, timeoutMsg: `Category "${name}" not found in combobox` },
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Transaction category combobox", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccountAndNavigate();
  });

  describe("Add transaction drawer", () => {
    before(async () => {
      await openAddTransactionDrawer();
    });

    after(async () => {
      // Close the drawer if still open
      const cancelBtn = await find("button*=Cancel");
      if (await cancelBtn.isExisting() && await cancelBtn.isClickable()) {
        await cancelBtn.click();
        await (await find('[data-slot="sheet-content"]')).waitForExist({
          reverse: true,
          timeout: 5_000,
        });
      }
    });

    it("category combobox is visible in the add transaction drawer", async () => {
      const trigger = await find('[data-testid="tx-category"]');
      expect(await trigger.isExisting()).toBe(true);
    });

    it("combobox shows Uncategorised by default", async () => {
      const trigger = await find('[data-testid="tx-category"]');
      expect(await trigger.getText()).toMatch(/uncategorised/i);
    });

    it("typing filters the category list", async () => {
      await openCategoryCombobox();

      const searchInput = await find('[data-slot="command-input"]');
      await searchInput.setValue("gro");

      await browser.waitUntil(
        async () => {
          const options = await findAll('[role="option"]');
          for (const opt of options) {
            if ((await opt.getText()).toLowerCase().includes("groceries")) return true;
          }
          return false;
        },
        { timeout: 3_000, timeoutMsg: "Groceries option not found after filtering" },
      );

      // Bills should not be visible
      const options = await findAll('[role="option"]');
      let billsVisible = false;
      for (const opt of options) {
        if ((await opt.getText()).toLowerCase().includes("bills")) {
          billsVisible = true;
          break;
        }
      }
      expect(billsVisible).toBe(false);

      // Close combobox by pressing Escape
      await browser.keys(["Escape"]);
    });

    it("can select a category and save — transaction list shows category", async () => {
      // Fill required fields
      const amountField = await find('[data-testid="tx-amount"]');
      await amountField.setValue("-25");

      await openCategoryCombobox();
      await selectCategoryByName("Groceries");

      // Combobox trigger should now show "Groceries"
      const trigger = await find('[data-testid="tx-category"]');
      expect(await trigger.getText()).toMatch(/groceries/i);

      await (await find('[data-testid="tx-save"]')).click();
      await (await find('[data-slot="sheet-content"]')).waitForExist({
        reverse: true,
        timeout: 5_000,
      });

      // Transaction list should show "Groceries" in the category column
      await browser.waitUntil(
        async () => {
          const cells = await findAll("td");
          for (const cell of cells) {
            if ((await cell.getText()).trim() === "Groceries") return true;
          }
          return false;
        },
        { timeout: 5_000, timeoutMsg: "Groceries not found in transaction list" },
      );
    });
  });

  describe("Edit transaction drawer", () => {
    it("opens edit drawer and category is pre-populated", async () => {
      // Click the row actions for the transaction we just created
      const moreButtons = await findAll('[data-testid^="row-actions-"]');
      if (moreButtons.length === 0) throw new Error("No row action buttons found");
      await moreButtons[0].waitForClickable({ timeout: 5_000 });
      await moreButtons[0].click();

      const editItem = await find('[data-testid^="row-action-edit-"]');
      await editItem.waitForClickable({ timeout: 5_000 });
      await editItem.click();

      await (await find('[data-slot="sheet-title"]')).waitForExist({ timeout: 5_000 });

      const trigger = await find('[data-testid="tx-category"]');
      expect(await trigger.getText()).toMatch(/groceries/i);
    });

    it("can change category to a different value and save", async () => {
      await openCategoryCombobox();
      await selectCategoryByName("Bills");

      await (await find('[data-testid="tx-save"]')).click();
      await (await find('[data-slot="sheet-content"]')).waitForExist({
        reverse: true,
        timeout: 5_000,
      });

      // Transaction list should now show "Bills"
      await browser.waitUntil(
        async () => {
          const cells = await findAll("td");
          for (const cell of cells) {
            if ((await cell.getText()).trim() === "Bills") return true;
          }
          return false;
        },
        { timeout: 5_000, timeoutMsg: "Bills not found in transaction list after edit" },
      );
    });

    it("can select Uncategorised to clear the category", async () => {
      // Open edit again
      const moreButtons = await findAll('[data-testid^="row-actions-"]');
      await moreButtons[0].waitForClickable({ timeout: 5_000 });
      await moreButtons[0].click();

      const editItem = await find('[data-testid^="row-action-edit-"]');
      await editItem.waitForClickable({ timeout: 5_000 });
      await editItem.click();

      await (await find('[data-slot="sheet-title"]')).waitForExist({ timeout: 5_000 });

      await openCategoryCombobox();
      await selectCategoryByName("Uncategorised");

      await (await find('[data-testid="tx-save"]')).click();
      await (await find('[data-slot="sheet-content"]')).waitForExist({
        reverse: true,
        timeout: 5_000,
      });

      // Category column should be blank (no category text in that row)
      await browser.waitUntil(
        async () => {
          const cells = await findAll("td");
          for (const cell of cells) {
            if ((await cell.getText()).trim() === "Bills") return false;
          }
          return true;
        },
        { timeout: 5_000, timeoutMsg: "Bills still showing after clearing category" },
      );
    });
  });
});
