import Database from "@tauri-apps/plugin-sql";
import { AppDb, createDrizzleDb } from "./adapter";
import migration0000 from "./migrations/0000_pale_fixer.sql?raw";
import migration0001 from "./migrations/0001_cynical_the_watchers.sql?raw";
import migration0002 from "./migrations/0002_wide_tag.sql?raw";
import migration0003 from "./migrations/0003_greedy_human_robot.sql?raw";
import migration0004 from "./migrations/0004_transaction_extended_fields.sql?raw";
import migration0005 from "./migrations/0005_colossal_tarantula.sql?raw";
import migration0006 from "./migrations/0006_pot_allocation_rules.sql?raw";
import migration0007 from "./migrations/0007_csv_import_tables.sql?raw";
import migration0008 from "./migrations/0008_duplicate_candidate.sql?raw";

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
  {
    when: 1776243319315,
    hash: "c4a16ad440079b512e525eb7120560d782bd51499c116b1a37a6d1f65a00a9a8",
    sql: migration0002,
  },
  {
    when: 1776282795136,
    hash: "5c965e32c51f716492e4727c4a5de9c5c9e9975366144293aa6c0941d7c07a18",
    sql: migration0003,
  },
  {
    when: 1776369189477,
    hash: "e225767832b29ef103782d1189f8a12d3a2b32faf22a680615d23778b1b74f6f",
    sql: migration0004,
  },
  {
    when: 1776459596136,
    hash: "840631d33b12c5d2bc9a3fe722064313c745207768b8273aec3e68449452ab3d",
    sql: migration0005,
  },
  {
    when: 1776546000000,
    hash: "bfba01143ae0a056ebf240fd3b8b935a2d3af80d5b8722ab829bb842575b5838",
    sql: migration0006,
  },
  {
    when: 1776632400000,
    hash: "983572ce24928e7cd741745f56d9ac937a632befaab0caf1d523f02734a13219",
    sql: migration0007,
  },
  {
    when: 1776718800000,
    hash: "c0f3cfd7478c7670a359f1c5e747675cca8b10bf2a23d0f32b6654dac3a12db8",
    sql: migration0008,
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
