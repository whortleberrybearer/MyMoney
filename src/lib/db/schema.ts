import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accountType = sqliteTable("account_type", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  assetLiability: text("asset_liability").notNull(),
});

export const transactionType = sqliteTable("transaction_type", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const tag = sqliteTable("tag", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const category = sqliteTable("category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  isSystem: integer("is_system").notNull().default(0),
  sortOrder: integer("sort_order").notNull(),
});

export const institution = sqliteTable("institution", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});
