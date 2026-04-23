import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const institutionColumnMapping = sqliteTable(
  "institution_column_mapping",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    institutionId: integer("institution_id")
      .notNull()
      .references(() => institution.id),
    mappingJson: text("mapping_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("institution_column_mapping_institution_id_idx").on(t.institutionId)],
);

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
  isApiSynced: integer("is_api_synced").notNull().default(0),
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

export const pot = sqliteTable("pot", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => account.id),
  name: text("name").notNull(),
  openingBalance: real("opening_balance").notNull().default(0),
  openingDate: text("opening_date").notNull(),
  isActive: integer("is_active").notNull().default(1),
  notes: text("notes"),
});

export const potTag = sqliteTable(
  "pot_tag",
  {
    potId: integer("pot_id")
      .notNull()
      .references(() => pot.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id),
  },
  (t) => [primaryKey({ columns: [t.potId, t.tagId] })],
);

export const transaction = sqliteTable("transaction", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").references(() => account.id),
  potId: integer("pot_id").references(() => pot.id),
  transferId: integer("transfer_id"),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  payee: text("payee"),
  notes: text("notes"),
  reference: text("reference"),
  categoryId: integer("category_id").references(() => category.id),
  runningBalance: real("running_balance").notNull().default(0),
  type: text("type").notNull(),
  isVoid: integer("is_void").notNull().default(0),
  isDuplicateCandidate: integer("is_duplicate_candidate").notNull().default(0),
  externalId: text("external_id"),
});

export const transactionFitid = sqliteTable(
  "transaction_fitid",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transaction.id),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    fitid: text("fitid").notNull(),
  },
  (t) => [uniqueIndex("transaction_fitid_account_fitid_idx").on(t.accountId, t.fitid)],
);

export const potAllocationRule = sqliteTable("pot_allocation_rule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => account.id),
  name: text("name").notNull(),
  priority: integer("priority").notNull(),
  isActive: integer("is_active").notNull().default(1),
});

export const potAllocationRuleCondition = sqliteTable("pot_allocation_rule_condition", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => potAllocationRule.id),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  value: text("value").notNull(),
});

export const potAllocationRuleAction = sqliteTable("pot_allocation_rule_action", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => potAllocationRule.id),
  potId: integer("pot_id")
    .notNull()
    .references(() => pot.id),
  allocationValue: real("allocation_value").notNull(),
});

export const categorisationRule = sqliteTable("categorisation_rule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: integer("is_active").notNull().default(1),
});

export const ruleCondition = sqliteTable("rule_condition", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => categorisationRule.id),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  value: text("value").notNull(),
});

export const ruleAction = sqliteTable("rule_action", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => categorisationRule.id),
  actionType: text("action_type").notNull(),
  categoryId: integer("category_id").references(() => category.id),
  note: text("note"),
});

export const institutionApiConnection = sqliteTable("institution_api_connection", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  institutionId: integer("institution_id")
    .notNull()
    .references(() => institution.id),
  apiType: text("api_type").notNull(),
  keychainKey: text("keychain_key").notNull(),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
