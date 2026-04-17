/**
 * E2E tests for the categorisation rules management screen and rule builder.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 */

import { browser, $ as find, expect } from "@wdio/globals";
import { initializeAppWithFreshDb } from "./e2e-app";

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

async function navigateToRules() {
  await loadDashboard();
  const rulesBtn = await find('[data-testid="rules-nav-button"]');
  await rulesBtn.waitForClickable({ timeout: 10_000 });
  await rulesBtn.click();
  await (await find('[data-testid="new-rule-button"]')).waitForExist({ timeout: 10_000 });
}

describe("Rules Management Screen", () => {
  it("navigates to rules screen via nav button", async () => {
    await navigateToRules();
    const heading = await find("h1=Categorisation Rules");
    await expect(heading).toBeExisting();
  });

  it("shows empty state when no rules exist", async () => {
    await navigateToRules();
    const emptyState = await find('[data-testid="rules-empty-state"]');
    await expect(emptyState).toBeExisting();
  });

  it("back button returns to dashboard", async () => {
    await navigateToRules();
    const backBtn = await find('[data-testid="rules-back-button"]');
    await backBtn.click();
    await (await find('[data-testid="import-button"]')).waitForExist({ timeout: 10_000 });
  });

  it("new rule button opens rule builder sheet", async () => {
    await navigateToRules();
    const newBtn = await find('[data-testid="new-rule-button"]');
    await newBtn.click();
    await (await find('[data-testid="rule-name"]')).waitForExist({ timeout: 10_000 });
  });
});

describe("Rule Builder — create rule", () => {
  it("creates a new rule with a condition and assign_category action", async () => {
    await navigateToRules();
    const newBtn = await find('[data-testid="new-rule-button"]');
    await newBtn.click();
    await (await find('[data-testid="rule-name"]')).waitForExist({ timeout: 10_000 });

    // Fill name
    await (await find('[data-testid="rule-name"]')).setValue("Starbucks Rule");

    // Fill condition value
    await (await find('[data-testid="condition-value-0"]')).setValue("STARBUCKS");

    // Select category via combobox (opens then picks Groceries)
    const catCombobox = await find("#action-category-0");
    await catCombobox.waitForClickable({ timeout: 10_000 });
    await catCombobox.click();
    const groceriesOption = await find('[data-testid="category-option-4"]');
    await groceriesOption.waitForExist({ timeout: 5_000 });
    await groceriesOption.click();

    // Save should now be enabled
    const saveBtn = await find('[data-testid="rule-save-button"]');
    await saveBtn.waitForClickable({ timeout: 5_000 });
    await saveBtn.click();

    // Rule appears in list
    await (await find("span=Starbucks Rule")).waitForExist({ timeout: 10_000 });
  });

  it("cancel button closes builder without creating rule", async () => {
    await navigateToRules();
    await (await find('[data-testid="new-rule-button"]')).click();
    await (await find('[data-testid="rule-name"]')).waitForExist({ timeout: 10_000 });
    await (await find("button=Cancel")).click();
    await (await find('[data-testid="rules-empty-state"]')).waitForExist({ timeout: 5_000 });
  });
});

describe("Rules Management Screen — toggle and delete", () => {
  beforeEach(async () => {
    // Create a rule for each test
    await navigateToRules();
    await (await find('[data-testid="new-rule-button"]')).click();
    await (await find('[data-testid="rule-name"]')).setValue("Test Rule");
    await (await find('[data-testid="condition-value-0"]')).setValue("test");

    const catCombobox = await find("#action-category-0");
    await catCombobox.click();
    const option = await find('[data-testid="category-option-4"]');
    await option.waitForExist({ timeout: 5_000 });
    await option.click();

    const saveBtn = await find('[data-testid="rule-save-button"]');
    await saveBtn.waitForClickable({ timeout: 5_000 });
    await saveBtn.click();
    await (await find("span=Test Rule")).waitForExist({ timeout: 10_000 });
  });

  it("toggle updates rule active state", async () => {
    const toggle = await find('[data-testid^="rule-toggle-"]');
    await toggle.waitForClickable({ timeout: 5_000 });
    await toggle.click();
    // Label changes to "Off"
    await (await find("span=Off")).waitForExist({ timeout: 5_000 });
  });

  it("delete with confirmation removes rule", async () => {
    const deleteBtn = await find('[data-testid^="rule-delete-"]');
    await deleteBtn.waitForClickable({ timeout: 5_000 });
    await deleteBtn.click();
    const confirmBtn = await find('[data-testid="delete-confirm-button"]');
    await confirmBtn.waitForClickable({ timeout: 5_000 });
    await confirmBtn.click();
    await (await find('[data-testid="rules-empty-state"]')).waitForExist({ timeout: 10_000 });
  });

  it("re-run button shows toast after confirmation", async () => {
    const rerunBtn = await find('[data-testid="rerun-button"]');
    await rerunBtn.waitForClickable({ timeout: 5_000 });
    await rerunBtn.click();
    const confirmBtn = await find('[data-testid="rerun-confirm-button"]');
    await confirmBtn.waitForClickable({ timeout: 5_000 });
    await confirmBtn.click();
    await (await find('[data-testid="rerun-toast"]')).waitForExist({ timeout: 10_000 });
  });
});

describe("Rule Builder — operator filtering", () => {
  it("shows numeric operators when amount field is selected", async () => {
    await navigateToRules();
    await (await find('[data-testid="new-rule-button"]')).click();
    await (await find('[data-testid="rule-name"]')).waitForExist({ timeout: 10_000 });

    // Open the condition field selector
    const fieldSelect = await find('[data-testid="condition-field-0"]');
    await fieldSelect.click();
    // Select Amount
    await (await find("div*=Amount")).waitForExist({ timeout: 5_000 });
    await (await find("div*=Amount")).click();

    // Open operator selector
    const opSelect = await find('[data-testid="condition-operator-0"]');
    await opSelect.click();

    // Expect numeric operators
    await expect(await find("div*=Greater than")).toBeExisting();
    await expect(await find("div*=Less than")).toBeExisting();
  });
});
