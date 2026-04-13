import BetterSQLite from "better-sqlite3";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/lib/db/schema";
import migration0000 from "@/lib/db/migrations/0000_pale_fixer.sql?raw";
import migration0001 from "@/lib/db/migrations/0001_cynical_the_watchers.sql?raw";

/**
 * Creates an isolated in-memory SQLite database with all migrations applied.
 * Use this to back a mocked `getDb()` in unit tests.
 *
 * The return type matches the sqlite-proxy drizzle instance used by the real
 * adapter so `vi.mocked(getDb).mockReturnValue(createTestDb())` works.
 */
export function createTestDb() {
  const sqlite = new BetterSQLite(":memory:");

  // Apply each migration the same way the runtime runner does
  for (const sql of [migration0000, migration0001]) {
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      sqlite.exec(stmt);
    }
  }

  return drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      if (method === "run") {
        stmt.run(...(params as unknown[]));
        return { rows: [] };
      }
      // Drizzle's mapResultRow accesses row values by numeric index.
      // Use .raw(true) so better-sqlite3 returns arrays of column values
      // in SQL-column order — this also avoids collisions when multiple
      // tables have identically-named columns (e.g. multiple "name" columns
      // from JOINs that Drizzle aliases in the result mapping).
      const rows = stmt.raw(true).all(...(params as unknown[])) as unknown[][];
      return { rows };
    },
    { schema },
  );
}

export type TestDb = ReturnType<typeof createTestDb>;
