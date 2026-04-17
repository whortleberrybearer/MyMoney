/**
 * E2E tests for OFX transaction import.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database is created, an account is seeded via the UI,
 * then the import flow is exercised using OFX fixture files from tests/e2e/fixtures/.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { initializeAppWithFreshDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Paths to OFX fixtures (absolute paths required for file input setValue)
// ---------------------------------------------------------------------------

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(THIS_DIR, "fixtures");
const OFX_VALID_3TX = join(FIXTURES_DIR, "valid-3tx.ofx");
const OFX_BALANCE_MISMATCH = join(FIXTURES_DIR, "balance-mismatch.ofx");
const OFX_NO_LEDGERBAL = join(FIXTURES_DIR, "no-ledgerbal.ofx");

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

async function loadDashboard() {
  await initializeAppWithFreshDb();
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OFX Import — happy path (valid 3-transaction file)", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
  });

  it("Import button is visible on the dashboard", async () => {
    await expect(await find('[data-testid="import-button"]')).toBeExisting();
  });

  it("navigates to the import screen on click", async () => {
    await openImportScreen();
    await expect(await find("h1*=Import Transactions")).toBeExisting();
  });

  it("Next button is disabled before account and file selection", async () => {
    const nextBtn = await find('[data-testid="next-button"]');
    await expect(nextBtn).toBeDisabled();
  });

  it("shows import result screen with correct counts after successful import", async () => {
    await selectImportAccount("Import Account");
    await setImportFile(OFX_VALID_3TX);

    await (
      await find('[data-testid="next-button"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();

    await (
      await find('[data-testid="done-button"]')
    ).waitForExist({
      timeout: 60_000,
    });

    expect(await (await find('[data-testid="result-total"]')).getText()).toBe(
      "3",
    );
    expect(
      await (await find('[data-testid="result-imported"]')).getText(),
    ).toBe("3");
    expect(
      await (await find('[data-testid="result-duplicates"]')).getText(),
    ).toBe("0");
  });

  it("Done button returns to the dashboard", async () => {
    const doneBtn = await find('[data-testid="done-button"]');
    await doneBtn.waitForClickable({ timeout: 10_000 });
    await doneBtn.click();
    await (await find("button*=Add Account")).waitForExist({ timeout: 10_000 });
  });
});

describe("OFX Import — all FITIDs already exist (all duplicates)", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();

    // First import to seed the FITIDs
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(OFX_VALID_3TX);
    await (
      await find('[data-testid="next-button"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();

    const doneBtn = await find('[data-testid="done-button"]');
    await doneBtn.waitForExist({ timeout: 60_000 });
    await doneBtn.waitForClickable({ timeout: 10_000 });
    await doneBtn.click();

    await (await find("button*=Add Account")).waitForExist({ timeout: 10_000 });
  });

  it("shows 0 imported and 3 duplicate candidates on re-import of same file", async () => {
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(OFX_VALID_3TX);
    await (
      await find('[data-testid="next-button"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();

    await (
      await find('[data-testid="done-button"]')
    ).waitForExist({
      timeout: 60_000,
    });

    expect(
      await (await find('[data-testid="result-imported"]')).getText(),
    ).toBe("0");
    expect(
      await (await find('[data-testid="result-duplicates"]')).getText(),
    ).toBe("3");
  });
});

describe("OFX Import — balance mismatch blocks import", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
  });

  it("shows balance mismatch error and does not navigate to result screen", async () => {
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(OFX_BALANCE_MISMATCH);
    await (
      await find('[data-testid="next-button"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();

    await (
      await find('[data-testid="import-error"]')
    ).waitForExist({ timeout: 15_000 });
    const errorText = await (
      await find('[data-testid="import-error"]')
    ).getText();
    expect(errorText).toContain("Import blocked");

    // Import result screen should NOT have appeared
    const resultHeading = await find("h1*=Import Complete");
    await expect(resultHeading).not.toBeExisting();
  });
});

describe("OFX Import — no LEDGERBAL (no balance validation)", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
  });

  it("imports successfully when OFX file has no closing balance", async () => {
    await openImportScreen();
    await selectImportAccount("Import Account");
    await setImportFile(OFX_NO_LEDGERBAL);
    await (
      await find('[data-testid="next-button"]')
    ).waitForEnabled({ timeout: 5_000 });
    await (await find('[data-testid="next-button"]')).click();

    await (
      await find('[data-testid="done-button"]')
    ).waitForExist({
      timeout: 60_000,
    });
    expect(
      await (await find('[data-testid="result-imported"]')).getText(),
    ).toBe("1");
  });
});

describe("OFX Import — unsupported file type", () => {
  before(async () => {
    await loadDashboard();
    await createTestAccount();
    await openImportScreen();
  });

  it("shows file type error for .txt files", async () => {
    // Create a temp .txt file to test with
    const txtPath = join(FIXTURES_DIR, "not-an-ofx.txt");
    await setImportFile(txtPath);

    await (
      await find('[data-testid="file-type-error"]')
    ).waitForExist({ timeout: 5_000 });
    const errorText = await (
      await find('[data-testid="file-type-error"]')
    ).getText();
    expect(errorText).toContain("Unsupported");
  });

  it("Next button remains disabled after unsupported file selection", async () => {
    await expect(await find('[data-testid="next-button"]')).toBeDisabled();
  });
});
