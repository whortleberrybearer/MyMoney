/**
 * E2E tests for the transaction list screen.
 *
 * Requires the full Tauri application. Run with: npm run test:e2e
 *
 * Setup: a fresh SQLite database with migrations applied is seeded with an
 * account and known transactions before each suite. localStorage is pointed
 * at that path so the app opens directly to the dashboard.
 */

import { browser, $ as find, $$ as findAll, expect } from "@wdio/globals";
import BetterSQLite from "better-sqlite3";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { createE2EDb } from "./e2e-app";

// ---------------------------------------------------------------------------
// Helpers: seed a DB with migrations and known data
// ---------------------------------------------------------------------------

const MIGRATIONS = [
  "0000_pale_fixer.sql",
  "0001_cynical_the_watchers.sql",
  "0002_wide_tag.sql",
  "0003_greedy_human_robot.sql",
  "0004_transaction_extended_fields.sql",
];

function applyMigrations(sqlite: BetterSQLite.Database) {
  const migrationsDir = join(process.cwd(), "src/lib/db/migrations");

  // Mirror the runtime migrator’s bookkeeping so the app doesn’t try to
  // re-apply already-applied migrations when opening this seeded DB.
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at NUMERIC
  )`);

  const journal = JSON.parse(
    readFileSync(join(migrationsDir, "meta/_journal.json"), "utf-8"),
  ) as { entries: Array<{ tag: string; when: number }> };

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }

    const tag = file.replace(/\.sql$/, "");
    const when = journal.entries.find((e) => e.tag === tag)?.when;
    if (!when) throw new Error(`No migration journal entry for ${tag}`);

    const hash = createHash("sha256").update(sql, "utf8").digest("hex");
    sqlite.prepare(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
    ).run(hash, when);
  }
}

interface SeedResult {
  dbPath: string;
  accountId: number;
  txIds: number[];
}

/**
 * Creates a fresh DB, applies all migrations, seeds an institution, account,
 * and three transactions. Returns the DB path and seeded IDs.
 */
function seedDb(): SeedResult {
  const dbPath = createE2EDb();
  const sqlite = new BetterSQLite(dbPath);

  applyMigrations(sqlite);

  // Institution
  sqlite.exec("INSERT INTO institution (name) VALUES ('Test Bank')");
  const institutionId = (sqlite.prepare("SELECT id FROM institution").get() as { id: number }).id;

  // Account (opening balance 1000)
  sqlite.prepare(`
    INSERT INTO account (name, institution_id, account_type_id, currency, opening_balance, opening_date, is_active, is_deleted)
    VALUES ('Test Account', ?, 1, 'GBP', 1000, '2024-01-01', 1, 0)
  `).run(institutionId);
  const accountId = (sqlite.prepare("SELECT id FROM account").get() as { id: number }).id;

  // Three transactions with known amounts and dates
  // Note: "transaction" is a reserved keyword in SQLite, so it must be quoted.
  const insertTx = sqlite.prepare(`
    INSERT INTO "transaction" (account_id, date, amount, payee, notes, type, running_balance, is_void)
    VALUES (?, ?, ?, ?, ?, 'manual', 0, 0)
  `);
  insertTx.run(accountId, "2024-01-10", -50, "Tesco", "Groceries");
  insertTx.run(accountId, "2024-01-15", -25, "Starbucks", "Coffee");
  insertTx.run(accountId, "2024-01-20", 500, "Employer", "January salary");

  // Recalculate running balances manually
  const txRows = sqlite.prepare(
    "SELECT id, amount FROM \"transaction\" WHERE account_id = ? ORDER BY date ASC, id ASC"
  ).all(accountId) as Array<{ id: number; amount: number }>;

  let balance = 1000;
  const updateBal = sqlite.prepare("UPDATE \"transaction\" SET running_balance = ? WHERE id = ?");
  for (const tx of txRows) {
    balance += tx.amount;
    updateBal.run(balance, tx.id);
  }

  const txIds = txRows.map((r) => r.id);
  sqlite.close();

  return { dbPath, accountId, txIds };
}

async function openAppWithDb(dbPath: string) {
  const normalizedPath = dbPath.replace(/\\/g, "/");
  await browser.execute((path: string) => {
    localStorage.setItem("lastOpenedFilePath", path);
  }, normalizedPath);
  await browser.refresh();
  await (await find("button*=Add Account")).waitForExist({ timeout: 20_000 });
}

/**
 * Navigate to the transaction list by clicking on the "Test Account" name link.
 */
async function navigateToTransactionList() {
  const accountLink = await find("button*=Test Account");
  await accountLink.waitForClickable({ timeout: 10_000 });
  await accountLink.click();
  await (await find("[data-testid='add-transaction-btn']")).waitForExist({ timeout: 10_000 });
}

async function setControlledInputValue(input: WebdriverIO.Element, value: string) {
  await browser.execute(
    (el: HTMLInputElement, nextValue: string) => {
      // Use the native setter so React’s controlled input tracking sees the change.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(el, nextValue);

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    input as unknown as HTMLInputElement,
    value,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Transaction list — navigation", () => {
  before(async () => {
    const { dbPath } = seedDb();
    await openAppWithDb(dbPath);
  });

  it("clicking an account row navigates to the transaction list screen", async () => {
    await navigateToTransactionList();

    const header = await find("span.font-semibold");
    expect(await header.getText()).toBe("Test Account");
  });

  it("transaction list shows the correct number of rows", async () => {
    const rows = await findAll("[data-testid^='tx-row-']");
    expect(rows.length).toBe(3);
  });

  it("back button returns to the dashboard", async () => {
    const backBtn = await find("button[aria-label='Back']");
    await backBtn.waitForClickable({ timeout: 5_000 });
    await backBtn.click();
    await (await find("button*=Add Account")).waitForExist({ timeout: 10_000 });
  });
});

describe("Transaction list — sorting", () => {
  before(async () => {
    const { dbPath } = seedDb();
    await openAppWithDb(dbPath);
    await navigateToTransactionList();
  });

  it("sorts by amount when Amount header is clicked", async () => {
    const amountHeader = await find("[data-testid='col-amount']");
    await amountHeader.click();

    await browser.pause(400);

    const rows = await findAll("[data-testid^='tx-row-']");
    expect(rows.length).toBeGreaterThan(0);

    // After clicking Amount (default desc): first row should be highest amount (500)
    const firstRowText = await rows[0].getText();
    expect(firstRowText).toContain("500");
  });
});

describe("Transaction list — filtering", () => {
  before(async () => {
    const { dbPath } = seedDb();
    await openAppWithDb(dbPath);
    await navigateToTransactionList();
  });

  it("filtering by date range shows only matching transactions", async () => {
    const fromField = await find("[data-testid='filter-from-date']");
    const toField = await find("[data-testid='filter-to-date']");

    await setControlledInputValue(fromField, "2024-01-12");
    await setControlledInputValue(toField, "2024-01-18");

    expect(await fromField.getValue()).toBe("2024-01-12");
    expect(await toField.getValue()).toBe("2024-01-18");

    await browser.waitUntil(
      async () => {
        const emptyState = await find("[data-testid='empty-state']");
        if (await emptyState.isExisting()) return true;

        const rows = await findAll("[data-testid^='tx-row-']");
        if (rows.length === 0) return false;

        const firstRowText = await rows[0].getText();
        return firstRowText.includes("Starbucks") || firstRowText.includes("2024-01-15");
      },
      { timeout: 10_000, timeoutMsg: "Expected date filter to apply" },
    );

    const emptyState = await find("[data-testid='empty-state']");
    if (await emptyState.isExisting()) {
      throw new Error(`Filter returned empty state: ${await emptyState.getText()}`);
    }

    const rows = await findAll("[data-testid^='tx-row-']");
    const texts: string[] = [];
    for (const r of rows) {
      texts.push(await r.getText());
    }
    expect(texts.some((t) => t.includes("Starbucks"))).toBe(true);
    expect(texts.some((t) => t.includes("Tesco"))).toBe(false);
    expect(texts.some((t) => t.includes("Employer"))).toBe(false);
  });

  it("filtering by payee text shows only matching transactions", async () => {
    // Clear date filter first
    const fromField = await find("[data-testid='filter-from-date']");
    const toField = await find("[data-testid='filter-to-date']");
    await setControlledInputValue(fromField, "");
    await setControlledInputValue(toField, "");

    expect(await fromField.getValue()).toBe("");
    expect(await toField.getValue()).toBe("");

    const payeeFilter = await find("[data-testid='filter-payee']");
    await payeeFilter.setValue("tesco");

    expect(await payeeFilter.getValue()).toBe("tesco");

    await browser.waitUntil(
      async () => {
        const emptyState = await find("[data-testid='empty-state']");
        if (await emptyState.isExisting()) return true;

        const rows = await findAll("[data-testid^='tx-row-']");
        if (rows.length === 0) return false;

        const firstRowText = await rows[0].getText();
        return firstRowText.includes("Tesco");
      },
      { timeout: 10_000, timeoutMsg: "Expected payee filter to apply" },
    );

    const emptyState = await find("[data-testid='empty-state']");
    if (await emptyState.isExisting()) {
      throw new Error(`Filter returned empty state: ${await emptyState.getText()}`);
    }

    const rows = await findAll("[data-testid^='tx-row-']");
    const texts: string[] = [];
    for (const r of rows) {
      texts.push(await r.getText());
    }
    expect(texts.some((t) => t.includes("Tesco"))).toBe(true);
    expect(texts.some((t) => t.includes("Starbucks"))).toBe(false);
    expect(texts.some((t) => t.includes("Employer"))).toBe(false);
  });
});

describe("Transaction list — CRUD", () => {
  before(async () => {
    const { dbPath } = seedDb();
    await openAppWithDb(dbPath);
    await navigateToTransactionList();
  });

  it("adding a transaction saves and appears in the list", async () => {
    const countBefore = (await findAll("[data-testid^='tx-row-']")).length;

    const addBtn = await find("[data-testid='add-transaction-btn']");
    await addBtn.click();

    const sheetTitle = await find("[data-slot='sheet-title']");
    await sheetTitle.waitForExist({ timeout: 5_000 });

    // Fill date
    const dateField = await find("[data-testid='tx-date']");
    await dateField.clearValue();
    await dateField.setValue("2024-02-01");

    // Fill amount
    const amountField = await find("[data-testid='tx-amount']");
    await amountField.setValue("-15.00");

    // Fill payee
    const payeeField = await find("[data-testid='tx-payee']");
    await payeeField.setValue("New Payee");

    // Save
    const saveBtn = await find("[data-testid='tx-save']");
    await saveBtn.waitForClickable({ timeout: 5_000 });
    await saveBtn.click();

    // Sheet should close
    await sheetTitle.waitForExist({ reverse: true, timeout: 10_000 });

    // Row count should increase
    await browser.pause(500);
    const countAfter = (await findAll("[data-testid^='tx-row-']")).length;
    expect(countAfter).toBe(countBefore + 1);
  });

  it("editing a transaction notes field updates the displayed value", async () => {
    // Open the actions menu for the first row
    const actionBtns = await findAll("[data-testid^='tx-actions-']");
    await actionBtns[0].scrollIntoView();
    await actionBtns[0].waitForClickable({ timeout: 10_000 });
    await actionBtns[0].click();

    const editItem = await find(
      "//*[@role='menuitem' and contains(normalize-space(.), 'Edit')]",
    );
    await editItem.waitForExist({ timeout: 10_000 });
    await editItem.waitForClickable({ timeout: 10_000 });
    await editItem.click();

    const sheetTitle = await find("[data-slot='sheet-title']");
    await sheetTitle.waitForExist({ timeout: 5_000 });

    const notesField = await find("[data-testid='tx-notes']");
    await notesField.clearValue();
    await notesField.setValue("Updated notes E2E");

    const saveBtn = await find("[data-testid='tx-save']");
    await saveBtn.waitForClickable({ timeout: 5_000 });
    await saveBtn.click();

    await sheetTitle.waitForExist({ reverse: true, timeout: 10_000 });
    await browser.pause(400);

    const rows = await findAll("[data-testid^='tx-row-']");
    let found = false;
    for (const row of rows) {
      const text = await row.getText();
      if (text.includes("Updated notes E2E")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("deleting a transaction removes it from the list", async () => {
    const countBefore = (await findAll("[data-testid^='tx-row-']")).length;

    // Open actions menu for last row
    const actionBtns = await findAll("[data-testid^='tx-actions-']");
    const lastAction = actionBtns[actionBtns.length - 1];
    await lastAction.scrollIntoView();
    await lastAction.waitForClickable({ timeout: 10_000 });
    await lastAction.click();

    const deleteItem = await find(
      "//*[@role='menuitem' and contains(normalize-space(.), 'Delete')]",
    );
    await deleteItem.waitForExist({ timeout: 10_000 });
    await deleteItem.waitForClickable({ timeout: 10_000 });
    await deleteItem.click();

    // Confirm dialog
    const confirmBtn = await find("[data-testid='delete-confirm']");
    await confirmBtn.waitForClickable({ timeout: 10_000 });
    await confirmBtn.click();

    await browser.waitUntil(
      async () => (await findAll("[data-testid^='tx-row-']")).length === countBefore - 1,
      { timeout: 10_000, timeoutMsg: "Expected row count to decrease after deleting" },
    );

    const countAfter = (await findAll("[data-testid^='tx-row-']")).length;
    expect(countAfter).toBe(countBefore - 1);
  });

  it("cancelling delete confirmation leaves the list unchanged", async () => {
    const countBefore = (await findAll("[data-testid^='tx-row-']")).length;

    const actionBtns = await findAll("[data-testid^='tx-actions-']");
    await actionBtns[0].scrollIntoView();
    await actionBtns[0].waitForClickable({ timeout: 10_000 });
    await actionBtns[0].click();

    const deleteItem = await find(
      "//*[@role='menuitem' and contains(normalize-space(.), 'Delete')]",
    );
    await deleteItem.waitForExist({ timeout: 10_000 });
    await deleteItem.waitForClickable({ timeout: 10_000 });
    await deleteItem.click();

    const cancelBtn = await find("[data-testid='delete-cancel']");
    await cancelBtn.waitForClickable({ timeout: 10_000 });
    await cancelBtn.click();

    await cancelBtn.waitForExist({ reverse: true, timeout: 10_000 });

    const countAfter = (await findAll("[data-testid^='tx-row-']")).length;
    expect(countAfter).toBe(countBefore);
  });
});
