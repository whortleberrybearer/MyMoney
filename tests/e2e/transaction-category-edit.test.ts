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
  await (
    await find('[data-slot="dialog-title"]')
  ).waitForExist({ timeout: 5_000 });

  await (await find("button*=Add Institution")).click();
  await (
    await find("input[placeholder='Institution name']")
  ).setValue("Tx Cat Bank");
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
  await (
    await find('[data-testid="add-transaction-btn"]')
  ).waitForExist({ timeout: 10_000 });
}

async function openAddTransactionDrawer() {
  const addBtn = await find('[data-testid="add-transaction-btn"]');
  await addBtn.waitForClickable({ timeout: 5_000 });
  await addBtn.click();

  const title = await find('[data-slot="sheet-title"]');
  await title.waitForExist({ timeout: 10_000 });
  await browser.waitUntil(
    async () =>
      (await title.getText()).toLowerCase().includes("add transaction"),
    { timeout: 10_000, timeoutMsg: "Add Transaction sheet did not open" },
  );

  // Wait for key controls to be present to reduce flakiness.
  await (
    await find('[data-testid="tx-amount"]')
  ).waitForExist({ timeout: 10_000 });
  await (await find("#tx-category")).waitForExist({ timeout: 10_000 });
}

async function openCategoryCombobox() {
  const trigger = await find("#tx-category");
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();
  await (
    await find('[data-slot="command-input"]')
  ).waitForExist({ timeout: 5_000 });
}

async function selectCategoryByName(name: string) {
  const searchInput = await find('[data-slot="command-input"]');
  await searchInput.waitForExist({ timeout: 5_000 });
  await searchInput.setValue(name);

  await browser.waitUntil(
    async () => {
      const options = await findAll('[data-slot="command-item"]');
      for (const opt of options) {
        const text = (await opt.getText()).trim().toLowerCase();
        if (
          text === name.toLowerCase() ||
          text.startsWith(name.toLowerCase())
        ) {
          await opt.click();
          // Popover should close after selection.
          await (
            await find('[data-slot="command-input"]')
          ).waitForExist({
            reverse: true,
            timeout: 5_000,
          });
          return true;
        }
      }
      return false;
    },
    { timeout: 5_000, timeoutMsg: `Category "${name}" not found in combobox` },
  );
}

async function findTransactionRowByAmount(amountText: string) {
  // Amount is rendered as a plain number string, e.g. "-25.00".
  const xpath = `//tr[.//td[normalize-space(.)='${amountText}']]`;
  return find(xpath);
}

async function openEditDrawerForTransactionAmount(amountText: string) {
  const row = await findTransactionRowByAmount(amountText);
  await row.waitForExist({ timeout: 10_000 });

  const actionsButton = await row.$('button[data-testid^="tx-actions-"]');
  await actionsButton.waitForClickable({ timeout: 10_000 });
  await actionsButton.click();

  const editItem = await find(
    '//div[@data-slot="dropdown-menu-item" and normalize-space(.)="Edit"]',
  );
  await editItem.waitForClickable({ timeout: 10_000 });
  await editItem.click();

  const title = await find('[data-slot="sheet-title"]');
  await title.waitForExist({ timeout: 10_000 });
  await (await find("#tx-category")).waitForExist({ timeout: 10_000 });
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
      if ((await cancelBtn.isExisting()) && (await cancelBtn.isClickable())) {
        await cancelBtn.click();
        await (
          await find('[data-slot="sheet-content"]')
        ).waitForExist({
          reverse: true,
          timeout: 5_000,
        });
      }
    });

    it("category combobox is visible in the add transaction drawer", async () => {
      const trigger = await find("#tx-category");
      expect(await trigger.isExisting()).toBe(true);
    });

    it("combobox shows Uncategorised by default", async () => {
      const trigger = await find("#tx-category");
      expect(await trigger.getText()).toMatch(/uncategorised/i);
    });

    it("typing filters the category list", async () => {
      await openCategoryCombobox();

      const searchInput = await find('[data-slot="command-input"]');
      await searchInput.setValue("gro");

      await browser.waitUntil(
        async () => {
          const options = await findAll('[data-slot="command-item"]');
          for (const opt of options) {
            if ((await opt.getText()).toLowerCase().includes("groceries"))
              return true;
          }
          return false;
        },
        {
          timeout: 3_000,
          timeoutMsg: "Groceries option not found after filtering",
        },
      );

      // Bills should not be visible
      const options = await findAll('[data-slot="command-item"]');
      let billsVisible = false;
      for (const opt of options) {
        if ((await opt.getText()).toLowerCase().includes("bills")) {
          billsVisible = true;
          break;
        }
      }
      expect(billsVisible).toBe(false);

      // Close the combobox by toggling the trigger (Escape can be flaky in WebView2).
      const trigger = await find("#tx-category");
      await trigger.click();
      await (
        await find('[data-slot="command-input"]')
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });
    });

    it("can select a category and save — transaction list shows category", async () => {
      // Fill required fields
      const amountField = await find('[data-testid="tx-amount"]');
      await amountField.setValue("-25");

      await openCategoryCombobox();
      await selectCategoryByName("Groceries");

      // Combobox trigger should now show "Groceries"
      const trigger = await find("#tx-category");
      expect(await trigger.getText()).toMatch(/groceries/i);

      await (await find('[data-testid="tx-save"]')).click();
      await (
        await find('[data-slot="sheet-content"]')
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });

      // Transaction row should show "Groceries".
      await browser.waitUntil(
        async () => {
          const row = await findTransactionRowByAmount("-25.00");
          return /groceries/i.test(await row.getText());
        },
        {
          timeout: 10_000,
          timeoutMsg: "Groceries not found in saved transaction row",
        },
      );
    });
  });

  describe("Edit transaction drawer", () => {
    it("opens edit drawer and category is pre-populated", async () => {
      await openEditDrawerForTransactionAmount("-25.00");

      const trigger = await find("#tx-category");
      expect(await trigger.getText()).toMatch(/groceries/i);
    });

    it("can change category to a different value and save", async () => {
      await openCategoryCombobox();
      await selectCategoryByName("Bills");

      await (await find('[data-testid="tx-save"]')).click();
      await (
        await find('[data-slot="sheet-content"]')
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });

      // Transaction row should now show "Bills".
      await browser.waitUntil(
        async () => {
          const row = await findTransactionRowByAmount("-25.00");
          return /bills/i.test(await row.getText());
        },
        {
          timeout: 10_000,
          timeoutMsg: "Bills not found in transaction row after edit",
        },
      );
    });

    it("can select Uncategorised to clear the category", async () => {
      await openEditDrawerForTransactionAmount("-25.00");

      await openCategoryCombobox();
      await selectCategoryByName("Uncategorised");

      await (await find('[data-testid="tx-save"]')).click();
      await (
        await find('[data-slot="sheet-content"]')
      ).waitForExist({
        reverse: true,
        timeout: 5_000,
      });

      // Transaction row should have an empty category cell after clearing.
      await browser.waitUntil(
        async () => {
          const row = await findTransactionRowByAmount("-25.00");
          const cells = await row.$$("td");
          // Columns: date, payee, notes, amount, category, running balance, reference, type, actions
          const categoryCellText = (await cells[4].getText()).trim();
          return categoryCellText === "";
        },
        { timeout: 10_000, timeoutMsg: "Category cell did not clear" },
      );
    });
  });
});
