import { describe, it, expect } from "vitest";
import BetterSQLite from "better-sqlite3";
import migration0000 from "@/lib/db/migrations/0000_pale_fixer.sql?raw";
import migration0001 from "@/lib/db/migrations/0001_cynical_the_watchers.sql?raw";
import migration0002 from "@/lib/db/migrations/0002_wide_tag.sql?raw";
import migration0003 from "@/lib/db/migrations/0003_greedy_human_robot.sql?raw";
import migration0004 from "@/lib/db/migrations/0004_transaction_extended_fields.sql?raw";
import migration0005 from "@/lib/db/migrations/0005_colossal_tarantula.sql?raw";
import migration0006 from "@/lib/db/migrations/0006_pot_allocation_rules.sql?raw";
import migration0007 from "@/lib/db/migrations/0007_csv_import_tables.sql?raw";
import migration0008 from "@/lib/db/migrations/0008_duplicate_candidate.sql?raw";
import migration0009 from "@/lib/db/migrations/0009_api_account_sync.sql?raw";

function applyMigrations(sqlite: BetterSQLite.Database, migrations: string[]) {
  for (const sql of migrations) {
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  }
}

const BASE_MIGRATIONS = [
  migration0000, migration0001, migration0002, migration0003,
  migration0004, migration0005, migration0006, migration0007, migration0008,
];

describe("migration 0009: api_account_sync", () => {
  it("runs cleanly on a fresh database", () => {
    const sqlite = new BetterSQLite(":memory:");
    expect(() => applyMigrations(sqlite, [...BASE_MIGRATIONS, migration0009])).not.toThrow();
  });

  it("adds is_api_synced column to account with default 0", () => {
    const sqlite = new BetterSQLite(":memory:");
    applyMigrations(sqlite, BASE_MIGRATIONS);

    sqlite.exec(`INSERT INTO institution (name) VALUES ('TestBank')`);
    sqlite.exec(`INSERT INTO account (name, institution_id, account_type_id, currency, opening_balance, opening_date)
      VALUES ('Checking', 1, 1, 'GBP', 0, '2024-01-01')`);

    applyMigrations(sqlite, [migration0009]);

    const row = sqlite.prepare("SELECT is_api_synced FROM account WHERE id = 1").get() as { is_api_synced: number };
    expect(row.is_api_synced).toBe(0);
  });

  it("adds external_id column to transaction as nullable", () => {
    const sqlite = new BetterSQLite(":memory:");
    applyMigrations(sqlite, BASE_MIGRATIONS);

    sqlite.exec(`INSERT INTO institution (name) VALUES ('TestBank')`);
    sqlite.exec(`INSERT INTO account (name, institution_id, account_type_id, currency, opening_balance, opening_date)
      VALUES ('Checking', 1, 1, 'GBP', 0, '2024-01-01')`);
    sqlite.exec(`INSERT INTO "transaction" (account_id, amount, date, type, running_balance)
      VALUES (1, -10.0, '2024-01-15', 'manual', -10.0)`);

    applyMigrations(sqlite, [migration0009]);

    const row = sqlite.prepare("SELECT external_id FROM \"transaction\" WHERE id = 1").get() as { external_id: string | null };
    expect(row.external_id).toBeNull();
  });

  it("creates institution_api_connection table", () => {
    const sqlite = new BetterSQLite(":memory:");
    applyMigrations(sqlite, [...BASE_MIGRATIONS, migration0009]);

    const tableInfo = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='institution_api_connection'"
    ).get();
    expect(tableInfo).toBeDefined();
  });

  it("seeds api_sync transaction_type row", () => {
    const sqlite = new BetterSQLite(":memory:");
    applyMigrations(sqlite, [...BASE_MIGRATIONS, migration0009]);

    const row = sqlite.prepare("SELECT name FROM transaction_type WHERE name = 'api_sync'").get();
    expect(row).toBeDefined();
  });

  it("is idempotent: applying migration twice does not error (OR IGNORE guards inserts)", () => {
    const sqlite = new BetterSQLite(":memory:");
    applyMigrations(sqlite, [...BASE_MIGRATIONS, migration0009]);
    // The INSERT OR IGNORE statements should not throw on re-run
    const insertStmt = migration0009
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("INSERT OR IGNORE"));
    for (const stmt of insertStmt) {
      expect(() => sqlite.exec(stmt)).not.toThrow();
    }
  });

  it("existing transactions keep external_id = null after migration", () => {
    const sqlite = new BetterSQLite(":memory:");
    applyMigrations(sqlite, BASE_MIGRATIONS);

    sqlite.exec(`INSERT INTO institution (name) VALUES ('TestBank')`);
    sqlite.exec(`INSERT INTO account (name, institution_id, account_type_id, currency, opening_balance, opening_date)
      VALUES ('Checking', 1, 1, 'GBP', 0, '2024-01-01')`);
    for (let i = 0; i < 5; i++) {
      sqlite.exec(`INSERT INTO "transaction" (account_id, amount, date, type, running_balance)
        VALUES (1, -${i + 1}.0, '2024-01-${String(i + 1).padStart(2, "0")}', 'manual', 0)`);
    }

    applyMigrations(sqlite, [migration0009]);

    const rows = sqlite.prepare("SELECT external_id FROM \"transaction\"").all() as { external_id: string | null }[];
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.external_id === null)).toBe(true);
  });
});
