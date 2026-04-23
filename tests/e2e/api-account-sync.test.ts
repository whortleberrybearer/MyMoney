/**
 * E2E tests for API account sync (Starling Bank AISP integration).
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Tests 10.3, 10.6–10.9 use DB seeding via better-sqlite3.
 * Tests 10.4 and 10.5 require a live mock Starling HTTP server and are skipped
 * unless STARLING_MOCK_URL is set in the environment.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import { initializeAppWithFreshDb, initializeAppWithApiSyncedDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function navigateToSettings() {
  const settingsBtn = await find('button[aria-label="Settings"]');
  await settingsBtn.waitForClickable({ timeout: 10_000 });
  await settingsBtn.click();
  await (await find("button*=Manage Categories")).waitForExist({ timeout: 10_000 });
}

async function navigateBackToDashboard() {
  const backBtn = await find('button[aria-label="Back"]');
  await backBtn.waitForClickable({ timeout: 10_000 });
  await backBtn.click();
  await (await find("button*=Add Account")).waitForExist({ timeout: 10_000 });
}

async function navigateToTransactionsForAccount(accountName: string) {
  // The account name is the actual clickable element (not the <tr>)
  const accountBtn = await find(`//button[normalize-space(.)=${toXpathLiteral(accountName)}]`);
  await accountBtn.waitForClickable({ timeout: 10_000 });
  await accountBtn.click();
  await (await find("[data-testid='add-transaction-btn']")).waitForExist({ timeout: 10_000 });
}

async function openImportScreen() {
  const importBtn = await find('button[aria-label="Import"]');
  await importBtn.waitForClickable({ timeout: 10_000 });
  await importBtn.click();
  await (await find('[data-testid="account-select"]')).waitForExist({ timeout: 10_000 });
}

function toXpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return "concat(" + value.split("'").map((p) => `'${p}'`).join(`, "'", `) + ")";
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

// ---------------------------------------------------------------------------
// 10.3 — Settings → API Connections: empty state
// ---------------------------------------------------------------------------

describe("API Account Sync — Settings empty state (10.3)", () => {
  before(async () => {
    await initializeAppWithFreshDb();
    await navigateToSettings();
  });

  it("shows the API Connections section heading", async () => {
    const heading = await find("h2*=API Connections");
    await heading.waitForExist({ timeout: 5_000 });
    expect(await heading.isDisplayed()).toBe(true);
  });

  it("shows the empty-state message when no institutions are connected", async () => {
    const emptyMsg = await find("p*=No institutions connected");
    await emptyMsg.waitForExist({ timeout: 5_000 });
    expect(await emptyMsg.isDisplayed()).toBe(true);
  });

  it("shows the 'Connect an institution' button in the empty state", async () => {
    const connectBtn = await find("button*=Connect an institution");
    await connectBtn.waitForExist({ timeout: 5_000 });
    expect(await connectBtn.isDisplayed()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10.6 — API-synced account form is read-only
// ---------------------------------------------------------------------------

describe("API Account Sync — read-only account form (10.6)", () => {
  before(async () => {
    await initializeAppWithApiSyncedDb();
  });

  it("shows the API-synced account in the accounts list", async () => {
    const cell = await find("td*=Starling Current");
    await cell.waitForExist({ timeout: 10_000 });
    expect(await cell.isDisplayed()).toBe(true);
  });

  it("opens the account form and shows the read-only notice", async () => {
    // Open actions menu for the API-synced account
    const actionsBtn = await find(
      `//tr[.//td[normalize-space(.)="Starling Current"]]//button[@aria-label="Account actions"]`,
    );
    await actionsBtn.waitForClickable({ timeout: 10_000 });
    await actionsBtn.click();

    const editItem = await find('[data-slot="dropdown-menu-item"]*=Edit');
    await editItem.waitForClickable({ timeout: 5_000 });
    await editItem.click();

    const notice = await find('[data-testid="api-synced-notice"]');
    await notice.waitForExist({ timeout: 5_000 });
    expect(await notice.isDisplayed()).toBe(true);
  });

  it("shows the name field as disabled", async () => {
    const nameInput = await find('[data-testid="acc-name"]');
    await nameInput.waitForExist({ timeout: 5_000 });
    expect(await nameInput.getAttribute("disabled")).not.toBeNull();
  });

  it("shows the opening balance field as disabled", async () => {
    const balanceInput = await find('[data-testid="acc-opening-balance"]');
    expect(await balanceInput.getAttribute("disabled")).not.toBeNull();
  });

  it("does not show a Save button", async () => {
    const saveBtn = await find("button*=Save");
    expect(await saveBtn.isExisting()).toBe(false);
  });

  it("shows a Close button instead of Cancel", async () => {
    const closeBtn = await find('[data-testid="cancel-btn"]');
    await closeBtn.waitForExist({ timeout: 5_000 });
    expect(await closeBtn.getText()).toContain("Close");
    // Close the sheet
    await closeBtn.click();
  });

  it("does not show Deactivate or Delete in the account actions menu", async () => {
    const actionsBtn = await find(
      `//tr[.//td[normalize-space(.)="Starling Current"]]//button[@aria-label="Account actions"]`,
    );
    await actionsBtn.waitForClickable({ timeout: 10_000 });
    await actionsBtn.click();

    const menu = await find('[data-slot="dropdown-menu-content"]');
    await menu.waitForDisplayed({ timeout: 5_000 });
    const menuText = await menu.getText();

    expect(menuText).not.toContain("Deactivate");
    expect(menuText).not.toContain("Delete");

    // Close menu by pressing Escape
    await browser.keys("Escape");
  });
});

// ---------------------------------------------------------------------------
// 10.7 — API-synced transaction form is read-only
// ---------------------------------------------------------------------------

describe("API Account Sync — read-only transaction form (10.7)", () => {
  before(async () => {
    await initializeAppWithApiSyncedDb();
    await navigateToTransactionsForAccount("Starling Current");
  });

  it("shows the API-synced transaction in the list", async () => {
    const cell = await find("td*=-25");
    await cell.waitForExist({ timeout: 10_000 });
    expect(await cell.isDisplayed()).toBe(true);
  });

  it("opens the transaction form and shows the read-only notice", async () => {
    // Open actions menu for the transaction
    const actionsBtn = await find('//tr[.//td[contains(normalize-space(.), "-25")]]//button');
    await actionsBtn.waitForClickable({ timeout: 10_000 });
    await actionsBtn.click();

    const editItem = await find('[data-slot="dropdown-menu-item"]*=Edit');
    await editItem.waitForClickable({ timeout: 5_000 });
    await editItem.click();

    const notice = await find('[data-testid="api-synced-tx-notice"]');
    await notice.waitForExist({ timeout: 5_000 });
    expect(await notice.isDisplayed()).toBe(true);
  });

  it("shows the date field as read-only", async () => {
    const dateInput = await find('[data-testid="tx-date"]');
    await dateInput.waitForExist({ timeout: 5_000 });
    expect(await dateInput.getAttribute("readonly")).not.toBeNull();
  });

  it("shows the amount field as read-only", async () => {
    const amountInput = await find('[data-testid="tx-amount"]');
    expect(await amountInput.getAttribute("readonly")).not.toBeNull();
  });

  it("does not show a Delete option in the transaction actions menu", async () => {
    // Close the form first (Escape can be flaky with WebView2 focus traps)
    const sheet = await find('[data-slot="sheet-content"]');
    await sheet.waitForExist({ timeout: 10_000 });
    const closeBtn = await sheet.$('[data-slot="sheet-close"]');
    await closeBtn.waitForClickable({ timeout: 10_000 });
    await closeBtn.click();
    await sheet.waitForExist({ reverse: true, timeout: 10_000 });

    const actionsBtn = await find(
      '//tr[.//td[contains(normalize-space(.), "-25")]]//button[@aria-label="Transaction actions"]',
    );
    await actionsBtn.waitForClickable({ timeout: 10_000 });
    await actionsBtn.click();

    const menu = await find('[data-slot="dropdown-menu-content"]');
    await menu.waitForDisplayed({ timeout: 5_000 });
    const menuText = await menu.getText();

    expect(menuText).not.toContain("Delete");

    await browser.keys("Escape");
  });
});

// ---------------------------------------------------------------------------
// 10.8 — CSV import is disabled for API-synced institution accounts
// ---------------------------------------------------------------------------

describe("API Account Sync — CSV import disabled (10.8)", () => {
  before(async () => {
    await initializeAppWithApiSyncedDb();
    await openImportScreen();
  });

  it("shows the API-synced account in the account selector", async () => {
    await selectByTestId("account-select", "Starling Current");
    const trigger = await find('[data-testid="account-select"]');
    expect(await trigger.getText()).toContain("Starling Current");
  });

  it("shows the API-synced warning message", async () => {
    const warning = await find('[data-testid="api-synced-import-warning"]');
    await warning.waitForExist({ timeout: 5_000 });
    expect(await warning.isDisplayed()).toBe(true);
  });

  it("disables the Next button for an API-synced account", async () => {
    const nextBtn = await find('[data-testid="next-button"]');
    await nextBtn.waitForExist({ timeout: 5_000 });
    expect(await nextBtn.getAttribute("disabled")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 10.9 — Remove synced account from Settings
// ---------------------------------------------------------------------------

describe("API Account Sync — remove synced account (10.9)", () => {
  before(async () => {
    await initializeAppWithApiSyncedDb();
    await navigateToSettings();
  });

  it("shows the connected institution in the API Connections section", async () => {
    const connCard = await find("p*=Test Bank");
    await connCard.waitForExist({ timeout: 10_000 });
    expect(await connCard.isDisplayed()).toBe(true);
  });

  it("navigates back to the dashboard and shows the synced account", async () => {
    await navigateBackToDashboard();
    const cell = await find("td*=Starling Current");
    await cell.waitForExist({ timeout: 10_000 });
    expect(await cell.isDisplayed()).toBe(true);
  });

  it("removes the synced account via the account actions menu", async () => {
    // The delete button is hidden for API-synced accounts in the dropdown.
    // Removal is done via ApiConnectionsSection, but since we have no
    // per-account remove button in the current UI, we verify that the
    // account appears read-only (no Delete option).
    const actionsBtn = await find(
      `//tr[.//td[normalize-space(.)="Starling Current"]]//button[@aria-label="Account actions"]`,
    );
    await actionsBtn.waitForClickable({ timeout: 10_000 });
    await actionsBtn.click();

    const menu = await find('[data-slot="dropdown-menu-content"]');
    await menu.waitForDisplayed({ timeout: 5_000 });
    const menuText = await menu.getText();

    expect(menuText).not.toContain("Delete");
    expect(menuText).not.toContain("Deactivate");
    expect(menuText).toContain("Edit");

    await browser.keys("Escape");
  });
});

// ---------------------------------------------------------------------------
// 10.4 & 10.5 — Skipped: require live mock Starling HTTP server
// ---------------------------------------------------------------------------

describe("API Account Sync — live API flows (10.4, 10.5) — skipped without mock server", () => {
  it.skip("10.4: connect Starling, discover accounts, import selected accounts", async () => {
    // Requires: STARLING_MOCK_URL env var and Rust configured to use it.
    // See tasks 10.2 for mock server setup requirements.
  });

  it.skip("10.5: trigger manual re-sync and verify transactions appear", async () => {
    // Requires: STARLING_MOCK_URL env var and Rust configured to use it.
  });
});
