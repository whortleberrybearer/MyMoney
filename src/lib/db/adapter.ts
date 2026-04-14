import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

export type AppDb = ReturnType<typeof createDrizzleDb>;

export function createDrizzleDb(tauriDb: Database) {
  return drizzle(
    async (sql, params, method) => {
      if (method === "run") {
        await tauriDb.execute(sql, params);
        return { rows: [] };
      }
      // Drizzle's mapResultRow accesses row values by numeric index (row[columnIndex]).
      // The Tauri SQL plugin returns rows as IndexMap-backed objects that preserve
      // SQL column order, so Object.values() gives values in the correct column order.
      // This works for all methods ("all", "get", "values").
      const rows = await tauriDb.select<Record<string, unknown>[]>(sql, params);
      return { rows: rows.map((row) => Object.values(row)) };
    },
    { schema },
  );
}
