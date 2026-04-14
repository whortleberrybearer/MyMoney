/**
 * E2E tests for tags and profile filtering.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Covers:
 *  - Selecting an existing tag in the account form's TagCombobox
 *  - Inline tag creation via the TagCombobox "Create <name>" item
 *  - Profile selector filtering the accounts list by tag
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import BetterSQLite from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ---------------------------------------------------------------------------
// Test database helpers
// ---------------------------------------------------------------------------

const TEST_DB_PATH = join(tmpdir(), "my-money-e2e-tags.pfdata");

function createTestDb() {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  const sqlite = new BetterSQLite(TEST_DB_PATH);
  sqlite.close();
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  createTestDb();
  const dbPath = TEST_DB_PATH.replace(/\\/g, "/");
  await browser.execute((path: string) => {
    localStorage.setItem("lastOpenedFilePath", path);
  }, dbPath);
  await browser.refresh();
  await (await find("button*=Add Account")).waitForExist({ timeout: 20_000 });
}

/**
 * Click a Radix Select trigger by its `id` attribute, wait for the listbox,
 * then click the option whose visible text includes `optionText`.
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

/**
 * Click the profile selector trigger and choose the given option text
 * (e.g. "All", "Personal", "Joint").
 */
async function selectProfileFilter(optionText: string) {
  const trigger = await find('[aria-label="Profile selector"]');
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();
  await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });
  const options = await findAll('[role="option"]');
  for (const opt of options) {
    if ((await opt.getText()).trim() === optionText) {
      await opt.click();
      return;
    }
  }
  throw new Error(`Profile filter option "${optionText}" not found`);
}

/**
 * Open the TagCombobox in the account form and select an existing tag by name.
 * The AccountFormSheet must already be open.
 */
async function selectTagInCombobox(tagName: string) {
  const trigger = await find("#acc-tag");
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();
  await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });
  const options = await findAll('[role="option"]');
  for (const opt of options) {
    if ((await opt.getText()).trim() === tagName) {
      await opt.click();
      return;
    }
  }
  throw new Error(`Tag "${tagName}" not found in combobox`);
}

/**
 * Open the TagCombobox, type `tagName`, and click the "Create <tagName>" item.
 * The AccountFormSheet must already be open.
 */
async function createTagViaCombobox(tagName: string) {
  const trigger = await find("#acc-tag");
  await trigger.waitForClickable({ timeout: 5_000 });
  await trigger.click();
  await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });

  const input = await find('input[placeholder="Search or create tag..."]');
  await input.waitForDisplayed({ timeout: 5_000 });
  await input.setValue(tagName);

  const createItem = await find(`*=Create "${tagName}"`);
  await createItem.waitForExist({ timeout: 5_000 });
  await createItem.waitForClickable({ timeout: 5_000 });
  await createItem.click();

  // Popover closes after creation; verify the trigger now shows the new tag name
  await trigger.waitForExist({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Tags and profile filtering", () => {
  // -------------------------------------------------------------------------
  // Tag combobox — selecting an existing tag
  // -------------------------------------------------------------------------
  describe("Tag combobox — select existing tag", () => {
    before(loadDashboard);

    let institutionCreated = false;

    before(async () => {
      // Create an institution so the account form can be submitted
      await (await find("button*=Add Account")).click();
      await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 5_000 });

      await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
      await (await find("button*=Manage")).click();
      await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 5_000 });

      await (await find("button*=Add Institution")).click();
      await (await find("input[placeholder='Institution name']")).setValue("Tag Bank");
      await (await find("button[aria-label='Save']")).click();
      await (await find("span=Tag Bank")).waitForExist({ timeout: 5_000 });

      const dialog = await find('[data-slot="dialog-content"]');
      const dialogClose = await dialog.$("button=Close");
      await dialogClose.waitForClickable({ timeout: 5_000 });
      await dialogClose.click();
      await dialog.waitForExist({ reverse: true, timeout: 10_000 });

      institutionCreated = true;
    });

    it("opens the tag combobox and shows seeded tags", async () => {
      // AccountFormSheet should still be open from the before hook
      const sheet = await find('[data-slot="sheet-content"]');
      await sheet.waitForExist({ timeout: 5_000 });

      const tagTrigger = await find("#acc-tag");
      await tagTrigger.waitForClickable({ timeout: 5_000 });
      await tagTrigger.click();

      await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });

      const options = await findAll('[role="option"]');
      const optionTexts = await Promise.all(options.map((o) => o.getText()));
      expect(optionTexts.some((t) => t.trim() === "Personal")).toBe(true);
      expect(optionTexts.some((t) => t.trim() === "Joint")).toBe(true);

      // Close the combobox by pressing Escape
      await browser.keys(["Escape"]);
    });

    it("selects the 'Personal' tag and shows it on the trigger button", async () => {
      await selectTagInCombobox("Personal");

      const tagTrigger = await find("#acc-tag");
      const triggerText = await tagTrigger.getText();
      expect(triggerText).toContain("Personal");
    });

    it("saves the account with the selected tag", async () => {
      expect(institutionCreated).toBe(true);
      await (await find("#acc-name")).setValue("Personal Savings");
      await selectOption("acc-institution", "Tag Bank");
      await selectOption("acc-type", "Current");
      await (await find("#acc-opening-date")).setValue("2024-01-01");

      await (await find("button=Save")).click();

      const accountCell = await find("td*=Personal Savings");
      await accountCell.waitForExist({ timeout: 10_000 });
      expect(await accountCell.isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Profile selector — filter accounts by tag
  // -------------------------------------------------------------------------
  describe("Profile selector — filter accounts by tag", () => {
    before(loadDashboard);

    before(async () => {
      // Set up institution
      await (await find("button*=Add Account")).click();
      await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 5_000 });
      await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
      await (await find("button*=Manage")).click();
      await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 5_000 });
      await (await find("button*=Add Institution")).click();
      await (await find("input[placeholder='Institution name']")).setValue("Filter Bank");
      await (await find("button[aria-label='Save']")).click();
      await (await find("span=Filter Bank")).waitForExist({ timeout: 5_000 });
      const dialog = await find('[data-slot="dialog-content"]');
      await (await dialog.$("button=Close")).click();
      await dialog.waitForExist({ reverse: true, timeout: 10_000 });

      // Create "Personal Account" with Personal tag
      await (await find("#acc-name")).setValue("Personal Account");
      await selectOption("acc-institution", "Filter Bank");
      await selectOption("acc-type", "Current");
      await (await find("#acc-opening-date")).setValue("2024-01-01");
      await selectTagInCombobox("Personal");
      await (await find("button=Save")).click();
      await (await find("td*=Personal Account")).waitForExist({ timeout: 10_000 });

      // Create "Joint Account" with Joint tag
      await (await find("button*=Add Account")).click();
      await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 5_000 });
      await (await find("#acc-name")).setValue("Joint Account");
      await selectOption("acc-institution", "Filter Bank");
      await selectOption("acc-type", "Current");
      await (await find("#acc-opening-date")).setValue("2024-01-01");
      await selectTagInCombobox("Joint");
      await (await find("button=Save")).click();
      await (await find("td*=Joint Account")).waitForExist({ timeout: 10_000 });
    });

    it("shows both accounts when 'All' is selected (default)", async () => {
      const personalCell = await find("td*=Personal Account");
      const jointCell = await find("td*=Joint Account");
      expect(await personalCell.isDisplayed()).toBe(true);
      expect(await jointCell.isDisplayed()).toBe(true);
    });

    it("shows only the Personal account when 'Personal' profile is selected", async () => {
      await selectProfileFilter("Personal");

      await (await find("td*=Personal Account")).waitForExist({ timeout: 5_000 });
      expect(await (await find("td*=Personal Account")).isDisplayed()).toBe(true);

      const jointCell = await find("td*=Joint Account");
      await jointCell.waitForExist({ reverse: true, timeout: 5_000 });
    });

    it("shows only the Joint account when 'Joint' profile is selected", async () => {
      await selectProfileFilter("Joint");

      await (await find("td*=Joint Account")).waitForExist({ timeout: 5_000 });
      expect(await (await find("td*=Joint Account")).isDisplayed()).toBe(true);

      const personalCell = await find("td*=Personal Account");
      await personalCell.waitForExist({ reverse: true, timeout: 5_000 });
    });

    it("restores both accounts when 'All' is selected", async () => {
      await selectProfileFilter("All");

      await (await find("td*=Personal Account")).waitForExist({ timeout: 5_000 });
      await (await find("td*=Joint Account")).waitForExist({ timeout: 5_000 });
      expect(await (await find("td*=Personal Account")).isDisplayed()).toBe(true);
      expect(await (await find("td*=Joint Account")).isDisplayed()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Inline tag creation
  // -------------------------------------------------------------------------
  describe("Inline tag creation", () => {
    before(loadDashboard);

    before(async () => {
      // Set up institution
      await (await find("button*=Add Account")).click();
      await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 5_000 });
      await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
      await (await find("button*=Manage")).click();
      await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 5_000 });
      await (await find("button*=Add Institution")).click();
      await (await find("input[placeholder='Institution name']")).setValue("Create Tag Bank");
      await (await find("button[aria-label='Save']")).click();
      await (await find("span=Create Tag Bank")).waitForExist({ timeout: 5_000 });
      const dialog = await find('[data-slot="dialog-content"]');
      await (await dialog.$("button=Close")).click();
      await dialog.waitForExist({ reverse: true, timeout: 10_000 });
    });

    it("shows the 'Create' option when a non-existent tag name is typed", async () => {
      const tagTrigger = await find("#acc-tag");
      await tagTrigger.waitForClickable({ timeout: 5_000 });
      await tagTrigger.click();
      await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });

      const input = await find('input[placeholder="Search or create tag..."]');
      await input.waitForDisplayed({ timeout: 5_000 });
      await input.setValue("Business");

      const createItem = await find('*=Create "Business"');
      await createItem.waitForExist({ timeout: 5_000 });
      expect(await createItem.isDisplayed()).toBe(true);

      await browser.keys(["Escape"]);
    });

    it("does not show 'Create' when an exact match already exists", async () => {
      const tagTrigger = await find("#acc-tag");
      await tagTrigger.waitForClickable({ timeout: 5_000 });
      await tagTrigger.click();
      await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });

      const input = await find('input[placeholder="Search or create tag..."]');
      await input.waitForDisplayed({ timeout: 5_000 });
      await input.setValue("Personal");

      const createItem = await find('*=Create "Personal"');
      await createItem.waitForExist({ reverse: true, timeout: 3_000 });

      await browser.keys(["Escape"]);
    });

    it("creates a new tag and shows it selected on the trigger button", async () => {
      await createTagViaCombobox("Business");

      const tagTrigger = await find("#acc-tag");
      await tagTrigger.waitForExist({ timeout: 5_000 });
      const triggerText = await tagTrigger.getText();
      expect(triggerText).toContain("Business");
    });

    it("saves the account with the newly created tag", async () => {
      await (await find("#acc-name")).setValue("Business Expenses");
      await selectOption("acc-institution", "Create Tag Bank");
      await selectOption("acc-type", "Current");
      await (await find("#acc-opening-date")).setValue("2024-01-01");

      await (await find("button=Save")).click();

      const accountCell = await find("td*=Business Expenses");
      await accountCell.waitForExist({ timeout: 10_000 });
      expect(await accountCell.isDisplayed()).toBe(true);
    });

    it("shows the new 'Business' tag in the profile selector", async () => {
      const trigger = await find('[aria-label="Profile selector"]');
      await trigger.waitForClickable({ timeout: 5_000 });
      await trigger.click();
      await (await find('[role="listbox"]')).waitForExist({ timeout: 5_000 });

      const options = await findAll('[role="option"]');
      const optionTexts = await Promise.all(options.map((o) => o.getText()));
      expect(optionTexts.some((t) => t.trim() === "Business")).toBe(true);

      // Close the selector by pressing Escape
      await browser.keys(["Escape"]);
    });

    it("filters to the new account when 'Business' profile is selected", async () => {
      await selectProfileFilter("Business");

      await (await find("td*=Business Expenses")).waitForExist({ timeout: 5_000 });
      expect(await (await find("td*=Business Expenses")).isDisplayed()).toBe(true);
    });
  });
});
