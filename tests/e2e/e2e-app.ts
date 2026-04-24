import { browser, $ as find } from "@wdio/globals";
import BetterSQLite from "better-sqlite3";
import { randomUUID } from "crypto";
import { mkdirSync, readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(THIS_DIR, "../../src/lib/db/migrations");

const MIGRATIONS_TABLE = "__drizzle_migrations";

// Keep in sync with the `when` values in `src/lib/db/index.ts`.
// We only need the latest value so the app's migrator will skip already-applied migrations.
const DRIZZLE_LATEST_MIGRATION_WHEN = 1776805200000;

const MIGRATION_FILES = [
  "0000_pale_fixer.sql",
  "0001_cynical_the_watchers.sql",
  "0002_wide_tag.sql",
  "0003_greedy_human_robot.sql",
  "0004_transaction_extended_fields.sql",
  "0005_colossal_tarantula.sql",
  "0006_pot_allocation_rules.sql",
  "0007_csv_import_tables.sql",
  "0008_duplicate_candidate.sql",
  "0009_api_account_sync.sql",
];

const E2E_RUN_DIR = process.env.MY_MONEY_E2E_RUN_DIR;

const ACCOUNTS_OVERVIEW_SUBTITLE_SELECTOR = "span*=All your financial accounts";
const DASHBOARD_ADD_ACCOUNT_SELECTOR = "button*=Add Account";
const SIDEBAR_DASHBOARD_BUTTON_XPATH =
  "//button[.//span[normalize-space()='Dashboard']]";

function ensureRunDir() {
  const runDir = E2E_RUN_DIR ?? join(tmpdir(), "my-money-e2e");
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

export function createE2EDb() {
  const runDir = ensureRunDir();
  const dbPath = join(runDir, `${randomUUID()}.pfdata`);
  const sqlite = new BetterSQLite(dbPath);
  sqlite.close();
  return dbPath;
}

/** Apply all migrations to a BetterSQLite instance. */
function applyMigrations(sqlite: BetterSQLite.Database) {
  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  }

  // Mark migrations as already applied so the in-app migrator (which only checks
  // the latest `created_at`) does not attempt to re-run CREATE/ALTER statements.
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )`,
  );
  sqlite.exec(
    `INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at)
     VALUES ('e2e-seed', ${DRIZZLE_LATEST_MIGRATION_WHEN})`,
  );
}

/**
 * Creates a pre-seeded temp DB with an API-synced institution, connection,
 * account, and transactions. Returns the DB path.
 *
 * Seeded data:
 *  - Institution id=1: "Test Bank"
 *  - institution_api_connection id=1: connected to institution 1 via starling
 *  - Account id=1: "Starling Current", is_api_synced=1
 *  - Transaction id=1: amount=-25.00, type="api_sync", external_id="ext-001"
 */
export function createApiSyncedDb(): string {
  const runDir = ensureRunDir();
  const dbPath = join(runDir, `${randomUUID()}.pfdata`);
  const sqlite = new BetterSQLite(dbPath);

  applyMigrations(sqlite);

  sqlite.exec(`INSERT INTO institution (id, name) VALUES (1, 'Test Bank')`);
  sqlite.exec(`
    INSERT INTO institution_api_connection
      (id, institution_id, api_type, keychain_key, created_at, updated_at)
    VALUES
      (1, 1, 'starling', 'mymoney.starling.1', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
  `);
  sqlite.exec(`
    INSERT INTO account
      (id, name, institution_id, account_type_id, currency, opening_balance, opening_date,
       is_active, is_api_synced, is_deleted)
    VALUES
      (1, 'Starling Current', 1, 1, 'GBP', 0.0, '2024-01-01', 1, 1, 0)
  `);
  sqlite.exec(`
    INSERT INTO \`transaction\`
      (id, account_id, date, amount, type, is_void, external_id, running_balance)
    VALUES
      (1, 1, '2024-01-15', -25.0, 'api_sync', 0, 'ext-001', -25.0)
  `);

  sqlite.close();
  return dbPath;
}

/**
 * Creates a fresh temp DB, points the app at it via localStorage, refreshes,
 * and waits until the dashboard is ready.
 */
export async function initializeAppWithFreshDb() {
  const dbPath = createE2EDb();

  // Forward slashes so toSqliteUri() in db/index.ts works correctly on Windows
  const normalizedDbPath = dbPath.replace(/\\/g, "/");
  await browser.execute((path: string) => {
    localStorage.setItem("lastOpenedFilePath", path);
  }, normalizedDbPath);

  await browser.refresh();

  await ensureOnDashboard();

  return dbPath;
}

/**
 * Creates an API-synced pre-seeded DB, points the app at it, refreshes,
 * and waits until the dashboard is ready.
 */
export async function initializeAppWithApiSyncedDb() {
  const dbPath = createApiSyncedDb();

  const normalizedDbPath = dbPath.replace(/\\/g, "/");
  await browser.execute((path: string) => {
    localStorage.setItem("lastOpenedFilePath", path);
  }, normalizedDbPath);

  await browser.refresh();

  await ensureOnDashboard();

  return dbPath;
}

export async function waitForAccountsOverviewReady(timeout = 20_000) {
  await (
    await find(ACCOUNTS_OVERVIEW_SUBTITLE_SELECTOR)
  ).waitForExist({ timeout });
}

export async function ensureOnDashboard(timeout = 20_000) {
  await browser.waitUntil(
    async () =>
      (await (await find(DASHBOARD_ADD_ACCOUNT_SELECTOR)).isExisting()) ||
      (await (await find(ACCOUNTS_OVERVIEW_SUBTITLE_SELECTOR)).isExisting()),
    {
      timeout,
      timeoutMsg:
        "Expected app to show either the Dashboard (Add Account) or Accounts Overview (All your financial accounts)",
    },
  );

  if (await (await find(ACCOUNTS_OVERVIEW_SUBTITLE_SELECTOR)).isExisting()) {
    const dashboardNavBtn = await find(SIDEBAR_DASHBOARD_BUTTON_XPATH);
    await dashboardNavBtn.waitForClickable({ timeout: 10_000 });
    await dashboardNavBtn.click();
  }

  await (await find(DASHBOARD_ADD_ACCOUNT_SELECTOR)).waitForExist({ timeout });
}
