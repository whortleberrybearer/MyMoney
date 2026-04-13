import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const account = sqliteTable("account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  institutionId: integer("institution_id")
    .notNull()
    .references(() => institution.id),
  accountTypeId: integer("account_type_id")
    .notNull()
    .references(() => accountType.id),
  currency: text("currency").notNull(),
  openingBalance: real("opening_balance").notNull().default(0),
  openingDate: text("opening_date").notNull(),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  isDeleted: integer("is_deleted").notNull().default(0),
});

export const accountTag = sqliteTable(
  "account_tag",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.tagId] })],
);
