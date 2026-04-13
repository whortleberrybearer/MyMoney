import Database from "@tauri-apps/plugin-sql";
import { AppDb, createDrizzleDb } from "./adapter";
import migration0000 from "./migrations/0000_pale_fixer.sql?raw";
import migration0001 from "./migrations/0001_cynical_the_watchers.sql?raw";

// ---------------------------------------------------------------------------
// Inline migration list
// Update this array (and precompute the hash) when drizzle-kit generates
// new migrations. Hash = sha256 of the raw .sql file contents.
// ---------------------------------------------------------------------------
const MIGRATIONS: Array<{ when: number; hash: string; sql: string }> = [
  {
    when: 1776074975325,
    hash: "c5fdc7022fb3dec0e2643dbc3c557a758409c77b8f4e0531c0a78922dd2d5547",
    sql: migration0000,
  },
  {
    when: 1776087770466,
    hash: "97e00de2da80748e035e69300efa2d9cf731fbe777f10735fabfbd2969b36235",
    sql: migration0001,
  },
];

const MIGRATIONS_TABLE = "__drizzle_migrations";

// ---------------------------------------------------------------------------
// Migration runner
// Replicates drizzle-orm/sqlite-proxy migrator logic but reads migrations
// from the inlined MIGRATIONS array instead of the filesystem (which is not
// available inside the Tauri WebView).
// ---------------------------------------------------------------------------
async function runMigrations(tauriDb: Database): Promise<void> {
  await tauriDb.execute(
    `CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )`,
    [],
  );

  const rows = await tauriDb.select<{ created_at: number }[]>(
    `SELECT created_at FROM \`${MIGRATIONS_TABLE}\` ORDER BY created_at DESC LIMIT 1`,
    [],
  );
  const lastAppliedAt: number = rows[0]?.created_at ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.when <= lastAppliedAt) continue;

    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await tauriDb.execute(statement, []);
    }

    await tauriDb.execute(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES ('${migration.hash}', '${migration.when}')`,
      [],
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
let instance: AppDb | null = null;

function toSqliteUri(filePath: string): string {
  // tauri-plugin-sql expects connection strings like:
  // - sqlite:test.db
  // - sqlite:/absolute/unix/path.db
  // - sqlite:C:/absolute/windows/path.db
  //
  // Using file-style URLs (sqlite:///...) can end up producing a path with a
  // leading slash on Windows ("/C:/...") which SQLite cannot open.

  const trimmed = filePath.trim();

  // Tauri dialogs typically return plain absolute paths, but be defensive.
  // Windows extended-length prefix: \\?\C:\path\to\file
  const withoutExtendedPrefix = trimmed.startsWith("\\\\?\\")
    ? trimmed.slice(4)
    : trimmed;

  const normalised = withoutExtendedPrefix.replace(/\\/g, "/");
  return `sqlite:${normalised}`;
}

export async function openDb(filePath: string): Promise<void> {
  const tauriDb = await Database.load(toSqliteUri(filePath));
  await runMigrations(tauriDb);
  instance = createDrizzleDb(tauriDb);
}

export function getDb(): AppDb {
  if (!instance) throw new Error("DB not initialised — call openDb first");
  return instance;
}
