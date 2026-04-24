/**
 * E2E tests for OFX import with pot allocation rules.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { ensureOnDashboard, initializeAppWithFreshDb } from "./e2e-app";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(THIS_DIR, "fixtures");
const OFX_VALID_3TX = join(FIXTURES_DIR, "valid-3tx.ofx");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

async function navigateToDashboardFromAccountsOverview() {
  await ensureOnDashboard();
}

function toXpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return (
    "concat(" +
    value
      .split("'")
      .map((part) => `'${part}'`)
      .join(', "\'", ') +
    ")"
  );
}

async function selectRadixOption(triggerId: string, optionText: string) {
  const trigger = await find(`#${triggerId}`);
  await trigger.waitForClickable({ timeout: 10_000 });
  await trigger.click();

  const listbox = await find('[role="listbox"]');
  await listbox.waitForExist({ timeout: 10_000 });

  const option = await find(
    `//*[@role="option" and contains(normalize-space(.), ${toXpathLiteral(optionText)})]`,
  );
  await option.waitForExist({ timeout: 10_000 });
  await option.scrollIntoView();
  await option.waitForClickable({ timeout: 10_000 });
  await option.click();
}

async function selectRadixByTestId(testId: string, optionText: string) {
  const trigger = await find(`[data-testid="${testId}"]`);
  await trigger.waitForClickable({ timeout: 10_000 });
  await trigger.click();

  const listbox = await find('[role="listbox"]');
  await listbox.waitForExist({ timeout: 10_000 });

  const option = await find(
    `//*[@role="option" and contains(normalize-space(.), ${toXpathLiteral(optionText)})]`,
  );
  await option.waitForExist({ timeout: 10_000 });
  await option.scrollIntoView();
  await option.waitForClickable({ timeout: 10_000 });
  await option.click();
}

async function createTestAccount() {
  await ensureOnDashboard();
  const addBtn = await find("button*=Add Account");
  await addBtn.waitForClickable({ timeout: 10_000 });
  await addBtn.click();

  await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 10_000 });

  await (await find("button*=Manage")).waitForExist({ timeout: 5_000 });
  await (await find("button*=Manage")).click();
  await (await find('[data-slot="dialog-title"]')).waitForExist({ timeout: 5_000 });

  await (await find("button*=Add Institution")).click();
  await (await find("input[placeholder='Institution name']")).setValue("Test Bank");
  await (await find("button[aria-label='Save']")).click();
  await (await find("span=Test Bank")).waitForExist({ timeout: 5_000 });

  const dialog = await find('[data-slot="dialog-content"]');
  await (await dialog.$("button=Close")).click();
  await dialog.waitForExist({ reverse: true, timeout: 10_000 });

  await (await find("#acc-name")).setValue("Import Account");
  await selectRadixOption("acc-institution", "Test Bank");
  await selectRadixOption("acc-type", "Current");
  await (await find("#acc-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  await (await find("button*=Import Account")).waitForExist({ timeout: 10_000 });
}

async function createTestPot() {
  await ensureOnDashboard();
  const addPotBtn = await find("button[aria-label='Add pot to Import Account']");
  await addPotBtn.waitForExist({ timeout: 10_000 });
  await addPotBtn.scrollIntoView();
  await addPotBtn.waitForClickable({ timeout: 10_000 });
  await addPotBtn.click();

  await (await find('[data-slot="sheet-title"]')).waitForDisplayed({ timeout: 10_000 });
  await (await find("#pot-name")).setValue("Savings Pot");
  await (await find("#pot-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  await (await find("button*=Savings Pot")).waitForExist({ timeout: 10_000 });
}

async function navigateToRulesTab() {
  const accountLink = await find("button*=Import Account");
  await accountLink.waitForClickable({ timeout: 10_000 });
  await accountLink.click();

  await (await find('[data-testid="add-transaction-btn"]')).waitForExist({ timeout: 10_000 });

  const rulesTab = await find('[data-testid="tab-rules"]');
  await rulesTab.waitForClickable({ timeout: 10_000 });
  await rulesTab.click();

  await (await find('[data-testid="par-new-rule-button"]')).waitForExist({ timeout: 10_000 });
}

async function createPotAllocationRule(allocationAmount: string) {
  await (await find('[data-testid="par-new-rule-button"]')).click();
  await (await find('[data-testid="par-name-input"]')).waitForExist({ timeout: 10_000 });

  await (await find('[data-testid="par-name-input"]')).setValue("Salary Allocation");

  // Change condition field to "Amount"
  await selectRadixByTestId("par-cond-field-0", "Amount");

  // Change operator to "Greater than"
  await selectRadixByTestId("par-cond-operator-0", "Greater than");

  // Set condition value (amount > 1000 matches the 1500 Salary transaction)
  await (await find('[data-testid="par-cond-value-0"]')).setValue("1000");

  // Select the pot
  const potTrigger = await find('[data-testid="par-action-pot-0"]');
  await potTrigger.waitForClickable({ timeout: 10_000 });
  await potTrigger.click();
  const listbox = await find('[role="listbox"]');
  await listbox.waitForExist({ timeout: 5_000 });
  const options = await findAll('[role="option"]');
  await options[0].click();

  // Set allocation amount
  await (await find('[data-testid="par-action-amount-0"]')).setValue(allocationAmount);

  const saveBtn = await find('[data-testid="par-builder-save"]');
  await saveBtn.waitForEnabled({ timeout: 5_000 });
  await saveBtn.click();

  await (await find('[data-testid^="par-rule-row-"]')).waitForExist({ timeout: 10_000 });
}

async function navigateBackToDashboard() {
  const backBtn = await find("button[aria-label='Back']");
  await backBtn.waitForClickable({ timeout: 10_000 });
  await backBtn.click();
  await navigateToDashboardFromAccountsOverview();
}

async function openImportScreen() {
  const importBtn = await find('[data-testid="import-button"]');
  await importBtn.waitForClickable({ timeout: 10_000 });
  await importBtn.click();
  await (await find("h1*=Import Transactions")).waitForExist({ timeout: 10_000 });
}

async function selectImportAccount(accountName: string) {
  const trigger = await find('[data-testid="account-select"]');
  await trigger.waitForClickable({ timeout: 10_000 });
  await trigger.click();

  const listbox = await find('[role="listbox"]');
  await listbox.waitForExist({ timeout: 10_000 });

  const option = await find(
    `//*[@role="option" and contains(normalize-space(.), ${toXpathLiteral(accountName)})]`,
  );
  await option.waitForExist({ timeout: 10_000 });
  await option.scrollIntoView();
  await option.waitForClickable({ timeout: 10_000 });
  await option.click();
}

async function setImportFile(filePath: string) {
  const fileInput = await find('[data-testid="file-input"]');
  await browser.execute(
    (el: HTMLInputElement) => {
      el.style.display = "block";
      el.style.opacity = "1";
    },
    fileInput as unknown as HTMLInputElement,
  );
  await fileInput.setValue(filePath);
  await browser.execute(
    (el: HTMLInputElement) => {
      el.style.display = "";
      el.style.opacity = "";
    },
    fileInput as unknown as HTMLInputElement,
  );
}

async function runImport(accountName: string, filePath: string) {
  await openImportScreen();
  await selectImportAccount(accountName);
  await setImportFile(filePath);
  await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
  await (await find('[data-testid="next-button"]')).click();
  await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
}

// ---------------------------------------------------------------------------
// Tests: import with matching active rule creates allocations
// ---------------------------------------------------------------------------

describe("Pot Allocation Import — rule matches and allocation is shown", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
    await navigateToRulesTab();
    // Allocate 200 to Savings Pot when amount > 1000 (Salary = 1500 matches)
    await createPotAllocationRule("200");
    await navigateBackToDashboard();
  });

  it("import result shows 1 pot allocation", async () => {
    await runImport("Import Account", OFX_VALID_3TX);

    const allocationsEl = await find('[data-testid="result-pot-allocations"]');
    await allocationsEl.waitForExist({ timeout: 10_000 });
    expect(await allocationsEl.getText()).toBe("1");
  });

  it("no allocation failures shown when balance is sufficient", async () => {
    const failuresEl = await find('[data-testid="allocation-failures"]');
    // Should not exist (only rendered when allocationFailures.length > 0)
    await expect(failuresEl).not.toBeExisting();
  });

  it("Done button returns to dashboard after allocation import", async () => {
    const doneBtn = await find('[data-testid="done-button"]');
    await doneBtn.waitForClickable({ timeout: 10_000 });
    await doneBtn.click();
    await navigateToDashboardFromAccountsOverview();
  });
});

// ---------------------------------------------------------------------------
// Tests: virtual transfer transactions appear in account transaction list
// ---------------------------------------------------------------------------

describe("Pot Allocation Import — virtual transfers created in transaction list", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
    await navigateToRulesTab();
    await createPotAllocationRule("200");
    await navigateBackToDashboard();
    await runImport("Import Account", OFX_VALID_3TX);
    // Click Done then navigate to transaction list
    await (await find('[data-testid="done-button"]')).click();
    await navigateToDashboardFromAccountsOverview();
    // Navigate to Import Account transaction list
    const accountLink = await find("button*=Import Account");
    await accountLink.waitForClickable({ timeout: 10_000 });
    await accountLink.click();
    await (await find('[data-testid="add-transaction-btn"]')).waitForExist({ timeout: 10_000 });
  });

  it("shows virtual_transfer type transactions in the account", async () => {
    const virtualRows = await findAll('[data-tx-type="virtual_transfer"]');
    expect(virtualRows.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: insufficient balance shows failure in result screen
// ---------------------------------------------------------------------------

describe("Pot Allocation Import — insufficient balance shows allocation failure", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await createTestPot();
    await navigateToRulesTab();
    // Allocate 5000 — far more than the running balance after import (1462.50)
    await createPotAllocationRule("5000");
    await navigateBackToDashboard();
  });

  it("import result shows 0 pot allocations when balance insufficient", async () => {
    await runImport("Import Account", OFX_VALID_3TX);

    const allocationsEl = await find('[data-testid="result-pot-allocations"]');
    await allocationsEl.waitForExist({ timeout: 10_000 });
    expect(await allocationsEl.getText()).toBe("0");
  });

  it("allocation failures section appears with rule name", async () => {
    const failuresEl = await find('[data-testid="allocation-failures"]');
    await failuresEl.waitForExist({ timeout: 5_000 });
    const text = await failuresEl.getText();
    expect(text).toContain("Salary Allocation");
  });
});

// ---------------------------------------------------------------------------
// Tests: import with no active rules shows 0 allocations
// ---------------------------------------------------------------------------

describe("Pot Allocation Import — no rules means 0 allocations", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    // No pot, no rules
  });

  it("import result shows 0 pot allocations when no rules exist", async () => {
    await runImport("Import Account", OFX_VALID_3TX);

    const allocationsEl = await find('[data-testid="result-pot-allocations"]');
    await allocationsEl.waitForExist({ timeout: 10_000 });
    expect(await allocationsEl.getText()).toBe("0");
  });
});
