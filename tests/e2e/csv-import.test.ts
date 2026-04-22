/**
 * E2E tests for CSV transaction import.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database is created, an account is seeded via the UI,
 * then the import flow is exercised using CSV fixture files from tests/e2e/fixtures/.
 */

import { browser, $ as find, expect } from "@wdio/globals";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Paths to CSV fixtures (absolute paths required for file input setValue)
// ---------------------------------------------------------------------------

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(THIS_DIR, "fixtures");
const CSV_VALID_3TX = join(FIXTURES_DIR, "valid-3tx.csv");
const CSV_VALID_SPLIT = join(FIXTURES_DIR, "valid-split.csv");
const CSV_INVALID_DATE = join(FIXTURES_DIR, "invalid-date-row.csv");

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function toXpathLiteral(value: string): string {
  // Minimal escaping for XPath string literals.
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

async function selectOption(triggerId: string, optionText: string) {
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

async function selectByTestId(testId: string, optionText: string) {
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

/**
 * Creates a test account via the UI (institution "Test Bank", account "Import Account").
 * Assumes the AccountFormSheet is accessible from the dashboard.
 */
async function createTestAccount() {
  // Open the account form sheet
  const addBtn = await find("button*=Add Account");
  await addBtn.waitForClickable({ timeout: 10_000 });
  await addBtn.click();

  // Create institution
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

  // Close institution dialog
  const dialog = await find('[data-slot="dialog-content"]');
  await (await dialog.$("button=Close")).click();
  await dialog.waitForExist({ reverse: true, timeout: 10_000 });

  // Fill account form
  await (await find("#acc-name")).setValue("Import Account");
  await selectOption("acc-institution", "Test Bank");
  await selectOption("acc-type", "Current");
  await (await find("#acc-opening-date")).setValue("2024-01-01");
  await (await find("button=Save")).click();

  await (await find("td*=Import Account")).waitForExist({ timeout: 10_000 });
}

/**
 * Click the Import button in the header to open the import screen.
 */
async function openImportScreen() {
  const importBtn = await find('[data-testid="import-button"]');
  await importBtn.waitForClickable({ timeout: 10_000 });
  await importBtn.click();
  await (
    await find("h1*=Import Transactions")
  ).waitForExist({ timeout: 10_000 });
}

/**
 * Select an account in the import screen's account Select dropdown.
 */
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

/**
 * Set a file on the hidden file input.
 * Uses setValue() which works for file inputs in Chromium-based apps.
 */
async function setImportFile(filePath: string) {
  const fileInput = await find('[data-testid="file-input"]');
  // Make the input temporarily visible so WebdriverIO can interact with it
  await browser.execute(
    (el: HTMLInputElement) => {
      el.style.display = "block";
      el.style.opacity = "1";
    },
    fileInput as unknown as HTMLInputElement,
  );
  await fileInput.setValue(filePath);
  // Restore hidden state
  await browser.execute(
    (el: HTMLInputElement) => {
      el.style.display = "";
      el.style.opacity = "";
    },
    fileInput as unknown as HTMLInputElement,
  );
}

/**
 * Completes the CSV column mapper for the single-amount-convention fixture files.
 * Selects Date column (Col 0 / "Date"), dd/MM/yyyy format, Amount column (Col 2 / "Amount"),
 * then clicks Save & Import.
 */
async function completeSingleColumnMapper() {
  // Wait for mapper screen
  await (await find("h1*=Map CSV Columns")).waitForExist({ timeout: 10_000 });

  // Select date column — "Date" (header label for Col 0)
  await selectByTestId("date-col-select", "Date");

  // Select date format
  await selectByTestId("date-format-select", "dd/MM/yyyy");

  // Select amount column — "Amount" (header label for Col 2)
  await selectByTestId("amount-col-select", "Amount");

  // Click Save & Import
  const saveBtn = await find('[data-testid="save-import-button"]');
  await saveBtn.waitForEnabled({ timeout: 5_000 });
  await saveBtn.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CSV Import — first import shows column mapper", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
  });

  it("navigates to import screen", async () => {
    await openImportScreen();
    await expect(await find("h1*=Import Transactions")).toBeExisting();
  });

  it("shows mapper screen when CSV is selected and Next is clicked", async () => {
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await (await find("h1*=Map CSV Columns")).waitForExist({ timeout: 15_000 });
  });

  it("completes mapper and shows correct import counts", async () => {
    await completeSingleColumnMapper();
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    expect(await (await find('[data-testid="result-total"]')).getText()).toBe("3");
    expect(await (await find('[data-testid="result-imported"]')).getText()).toBe("3");
    expect(await (await find('[data-testid="result-duplicates"]')).getText()).toBe("0");
  });
});

describe("CSV Import — second import skips mapper", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
    // First import to save mapping
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await completeSingleColumnMapper();
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    await (await find('[data-testid="done-button"]')).click();
    await (await find("button*=Add Account")).waitForExist({ timeout: 10_000 });
  });

  it("skips mapper screen on second import and goes directly to result", async () => {
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    // Should go directly to result screen (not mapper)
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    // Mapper heading should NOT appear
    await expect(await find("h1*=Map CSV Columns")).not.toBeExisting();
  });
});

describe("CSV Import — split amount convention", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_SPLIT);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await (await find("h1*=Map CSV Columns")).waitForExist({ timeout: 15_000 });
  });

  it("imports correctly with split convention selected", async () => {
    // Select date column
    await selectByTestId("date-col-select", "Date");
    // Select date format
    await selectByTestId("date-format-select", "dd/MM/yyyy");
    // Switch to split convention
    await (await find('[data-testid="amount-convention-split"]')).click();
    // Select debit and credit columns
    await selectByTestId("debit-col-select", "Debit");
    await selectByTestId("credit-col-select", "Credit");
    // Save & Import
    const saveBtn = await find('[data-testid="save-import-button"]');
    await saveBtn.waitForEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    expect(await (await find('[data-testid="result-imported"]')).getText()).toBe("2");
  });
});

describe("CSV Import — duplicate detection", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
    // First import
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await completeSingleColumnMapper();
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    await (await find('[data-testid="done-button"]')).click();
    await (await find("button*=Add Account")).waitForExist({ timeout: 10_000 });
  });

  it("shows duplicate candidates on reimport of same file", async () => {
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    // All 3 rows should be duplicates
    expect(await (await find('[data-testid="result-duplicates"]')).getText()).toBe("3");
    expect(await (await find('[data-testid="result-imported"]')).getText()).toBe("0");
  });
});

describe("CSV Import — parse errors", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_INVALID_DATE);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await (await find("h1*=Map CSV Columns")).waitForExist({ timeout: 15_000 });
    await completeSingleColumnMapper();
  });

  it("shows parse errors count on result screen", async () => {
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
    // 1 valid row imported, 1 parse error
    expect(await (await find('[data-testid="result-imported"]')).getText()).toBe("1");
    expect(await (await find('[data-testid="result-parse-errors"]')).getText()).toBe("1");
  });
});

describe("CSV Import — cancel mapper returns to wizard", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await (await find("h1*=Map CSV Columns")).waitForExist({ timeout: 15_000 });
  });

  it("returns to import wizard when Cancel is clicked", async () => {
    await (await find('[data-testid="cancel-button"]')).click();
    await (await find("h1*=Import Transactions")).waitForExist({ timeout: 10_000 });
  });

  it("does not save a mapping when cancel is clicked", async () => {
    // After cancel, re-uploading CSV should show mapper screen again
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await (await find("h1*=Map CSV Columns")).waitForExist({ timeout: 15_000 });
  });
});

describe("CSV Import — result screen parse errors row", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await createTestAccount();
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(CSV_VALID_3TX);
    await (await find('[data-testid="next-button"]')).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();
    await completeSingleColumnMapper();
    await (await find('[data-testid="done-button"]')).waitForExist({ timeout: 60_000 });
  });

  it("does not show parse errors row when count is zero", async () => {
    await expect(await find('[data-testid="result-parse-errors"]')).not.toBeExisting();
  });
});
