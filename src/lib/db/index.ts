import Database from "@tauri-apps/plugin-sql";
import { AppDb, createDrizzleDb } from "./adapter";
import migration0000 from "./migrations/0000_pale_fixer.sql?raw";

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
  // Convert absolute OS path to a sqlite:/// URI so tauri-plugin-sql opens
  // the correct file regardless of platform.
  const normalised = filePath.replace(/\\/g, "/");
  // Unix:    "/home/user/file.pfdata"  → "sqlite:///home/user/file.pfdata"
  // Windows: "C:/Users/file.pfdata"   → "sqlite:///C:/Users/file.pfdata"
  return normalised.startsWith("/")
    ? `sqlite://${normalised}`
    : `sqlite:///${normalised}`;
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
