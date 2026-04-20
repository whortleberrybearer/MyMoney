/**
 * E2E tests for the Pot Allocation Rules tab in the account/transaction view.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 */

import { $ as find, $$ as findAll, expect } from "@wdio/globals";
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

async function createTestAccount() {
  const addBtn = await find("button*=Add Account");
  await addBtn.waitForClickable({ timeout: 10_000 });
  await addBtn.click();

  await (
    await find('[data-slot="sheet-title"]')
  ).waitForDisplayed({ timeout: 10_000 });

  await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
  await (await find("button*=Manage")).click();
  await (
    await find('[data-slot="dialog-title"]')
  ).waitForExist({ timeout: 5_000 });

  await (await find("button*=Add Institution")).click();
  await (
    await find("input[placeholder='Institution name']")
  ).setValue("Test Bank");
  await (await find("button[aria-label='Save']")).click();
  await (await find("span=Test Bank")).waitForExist({ timeout: 5_000 });

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

async function createTestPot() {
  const addPotBtn = await find("button[aria-label='Add pot to Test Account']");
  await addPotBtn.waitForExist({ timeout: 10_000 });
  await addPotBtn.scrollIntoView();
  await addPotBtn.waitForClickable({ timeout: 10_000 });
  await addPotBtn.click();

  await (
    await find('[data-slot="sheet-title"]')
  ).waitForDisplayed({ timeout: 10_000 });
  await (await find("#pot-name")).setValue("Savings Pot");
  await (await find("#pot-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  await (await find("td*=Savings Pot")).waitForExist({ timeout: 10_000 });
}

async function navigateToRulesTab() {
  const accountLink = await find("button*=Test Account");
  await accountLink.waitForClickable({ timeout: 10_000 });
  await accountLink.click();

  await (
    await find('[data-testid="add-transaction-btn"]')
  ).waitForExist({ timeout: 10_000 });

  const rulesTab = await find('[data-testid="tab-rules"]');
  await rulesTab.waitForClickable({ timeout: 10_000 });
  await rulesTab.click();

  await (
    await find('[data-testid="par-new-rule-button"]')
  ).waitForExist({ timeout: 10_000 });
}

async function openRuleBuilder() {
  await (await find('[data-testid="par-new-rule-button"]')).click();
  await (
    await find('[data-testid="par-name-input"]')
  ).waitForExist({ timeout: 10_000 });
}

async function fillRuleForm(
  name: string,
  conditionValue: string,
  amount: string,
) {
  await (await find('[data-testid="par-name-input"]')).setValue(name);
  await (
    await find('[data-testid="par-cond-value-0"]')
  ).setValue(conditionValue);

  // Select the pot via Radix Select
  const potTrigger = await find('[data-testid="par-action-pot-0"]');
  await potTrigger.waitForClickable({ timeout: 10_000 });
  await potTrigger.click();
  const listbox = await find('[role="listbox"]');
  await listbox.waitForExist({ timeout: 5_000 });
  const options = await findAll('[role="option"]');
  await options[0].click();

  // Set allocation amount
  const amountInput = await find('[data-testid="par-action-amount-0"]');
  await amountInput.setValue(amount);
}

// ---------------------------------------------------------------------------
// Tests: Rules tab navigation
// ---------------------------------------------------------------------------

describe("Pot Allocation Rules Tab — navigation", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
  });

  it("shows Rules tab in account view", async () => {
    const accountLink = await find("button*=Test Account");
    await accountLink.waitForClickable({ timeout: 10_000 });
    await accountLink.click();
    await (
      await find('[data-testid="tab-rules"]')
    ).waitForExist({ timeout: 10_000 });
    await expect(await find('[data-testid="tab-rules"]')).toBeExisting();
  });

  it("shows empty state when no rules exist", async () => {
    const rulesTab = await find('[data-testid="tab-rules"]');
    await rulesTab.click();
    await (
      await find('[data-testid="par-empty-state"]')
    ).waitForExist({ timeout: 10_000 });
    await expect(await find('[data-testid="par-empty-state"]')).toBeExisting();
  });

  it("shows New Rule button on the rules tab", async () => {
    await expect(
      await find('[data-testid="par-new-rule-button"]'),
    ).toBeExisting();
  });
});

// ---------------------------------------------------------------------------
// Tests: Create rule
// ---------------------------------------------------------------------------

describe("Pot Allocation Rules Tab — create rule", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
    await navigateToRulesTab();
  });

  it("New Rule button opens the rule builder sheet", async () => {
    await openRuleBuilder();
    await expect(await find('[data-testid="par-name-input"]')).toBeExisting();
  });

  it("Save button is disabled when form is empty", async () => {
    const saveBtn = await find('[data-testid="par-builder-save"]');
    await expect(saveBtn).toBeDisabled();
  });

  it("creates a rule and it appears in the list", async () => {
    await fillRuleForm("Salary Split", "SALARY", "200");

    const saveBtn = await find('[data-testid="par-builder-save"]');
    await saveBtn.waitForEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Rule should appear in the list
    await (
      await find('[data-testid^="par-rule-row-"]')
    ).waitForExist({ timeout: 10_000 });
    const rows = await findAll('[data-testid^="par-rule-row-"]');
    expect(rows.length).toBe(1);
    expect(await rows[0].getText()).toContain("Salary Split");
  });

  it("Cancel button closes builder without creating a rule", async () => {
    await openRuleBuilder();
    await (await find('[data-testid="par-builder-cancel"]')).click();
    // Builder should close; existing rule count unchanged
    const rows = await findAll('[data-testid^="par-rule-row-"]');
    expect(rows.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Toggle and delete
// ---------------------------------------------------------------------------

describe("Pot Allocation Rules Tab — toggle and delete", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
    await navigateToRulesTab();
    // Create a rule to act on
    await openRuleBuilder();
    await fillRuleForm("Test Rule", "TEST", "50");
    const saveBtn = await find('[data-testid="par-builder-save"]');
    await saveBtn.waitForEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await (
      await find('[data-testid^="par-rule-row-"]')
    ).waitForExist({ timeout: 10_000 });
  });

  it("new rule is active by default (shows Active label)", async () => {
    // The Switch reflects isActive=1; the label next to it says "Active"
    const row = await find('[data-testid^="par-rule-row-"]');
    expect(await row.getText()).toContain("Active");
  });

  it("toggling rule sets it to Off", async () => {
    const toggle = await find('[data-testid^="par-rule-toggle-"]');
    await toggle.waitForClickable({ timeout: 5_000 });
    await toggle.click();
    await (await find("span=Off")).waitForExist({ timeout: 5_000 });
  });

  it("toggling rule again restores Active", async () => {
    const toggle = await find('[data-testid^="par-rule-toggle-"]');
    await toggle.waitForClickable({ timeout: 5_000 });
    await toggle.click();
    await (await find("span=Active")).waitForExist({ timeout: 5_000 });
  });

  it("cancel in delete dialog does not remove rule", async () => {
    const deleteBtn = await find('[data-testid^="par-rule-delete-"]');
    await deleteBtn.waitForClickable({ timeout: 5_000 });
    await deleteBtn.click();

    const cancelBtn = await find('[data-testid="par-delete-cancel"]');
    await cancelBtn.waitForClickable({ timeout: 5_000 });
    await cancelBtn.click();

    // Rule still exists
    await (
      await find('[data-testid^="par-rule-row-"]')
    ).waitForExist({ timeout: 5_000 });
  });

  it("confirming delete removes the rule and shows empty state", async () => {
    const deleteBtn = await find('[data-testid^="par-rule-delete-"]');
    await deleteBtn.waitForClickable({ timeout: 5_000 });
    await deleteBtn.click();

    const confirmBtn = await find('[data-testid="par-delete-confirm"]');
    await confirmBtn.waitForClickable({ timeout: 5_000 });
    await confirmBtn.click();

    await (
      await find('[data-testid="par-empty-state"]')
    ).waitForExist({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Drag handle is present
// ---------------------------------------------------------------------------

describe("Pot Allocation Rules Tab — drag to reorder", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
    await navigateToRulesTab();
    // Create two rules to reorder
    await openRuleBuilder();
    await fillRuleForm("Rule A", "AAA", "50");
    await (
      await find('[data-testid="par-builder-save"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="par-builder-save"]')).click();
    await (
      await find('[data-testid^="par-rule-row-"]')
    ).waitForExist({ timeout: 10_000 });

    await openRuleBuilder();
    await fillRuleForm("Rule B", "BBB", "50");
    await (
      await find('[data-testid="par-builder-save"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="par-builder-save"]')).click();
    await browser.waitUntil(
      async () => (await findAll('[data-testid^="par-rule-row-"]').length) >= 2,
      {
        timeout: 10_000,
        timeoutMsg: "Expected 2 pot allocation rule rows to be visible",
      },
    );
  });

  it("each rule row has a drag handle", async () => {
    const handles = await findAll('[data-testid^="par-rule-drag-"]');
    expect(handles.length).toBe(2);
  });

  it("rules are listed with Rule A before Rule B (priority order)", async () => {
    const rows = await findAll('[data-testid^="par-rule-row-"]');
    expect(await rows[0].getText()).toContain("Rule A");
    expect(await rows[1].getText()).toContain("Rule B");
  });
});
