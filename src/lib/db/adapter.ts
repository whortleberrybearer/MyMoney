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
      const rows = await tauriDb.select<Record<string, unknown>[]>(sql, params);
      if (method === "values") {
        return { rows: rows.map((row) => Object.values(row)) };
      }
      return { rows };
    },
    { schema },
  );
}
