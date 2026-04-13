## Why

The app needs a stable set of reference tables (account types, transaction types, tags, categories) before any financial data can be recorded or displayed. Without automatic Drizzle migration execution on file open, every data file will start in an undefined state, making the rest of Phase 1 development impossible. This is a foundational prerequisite for all account and transaction features (F-01 through F-13).

## What Changes

- Drizzle migrations are applied automatically when the app opens an existing data file (via the Tauri command layer)
- If a migration fails, an error is surfaced to the user — not silently swallowed
- `account_type` table seeded with 6 rows (Current, Savings, ISA, Stocks & Shares ISA, Pension, Mortgage)
- `transaction_type` table seeded with 3 rows (imported, manual, virtual_transfer)
- `tag` table seeded with 2 rows (Personal, Joint)
- `category` table seeded with 30 rows including one system row (Uncategorised, `is_system = 1`, `sort_order = 999`)
- `institution` table confirmed to exist and starts empty
- Seed operations are idempotent — re-running does not create duplicates

**Dependencies**: Requires [F-00 / file selection & open] to be complete so that the file-open path exists to hook into. The file-selection change is already done.

**Schema changes**: Drizzle migration file(s) required to create reference tables if they don't yet exist, plus seed data inserted via Drizzle within the migration or a dedicated seed step.

## Capabilities

### New Capabilities

- `database-migrations`: Automatic Drizzle migration execution on file open, with user-visible error on failure
- `reference-data-seed`: Idempotent seeding of all reference tables (account_type, transaction_type, tag, category) on first open

### Modified Capabilities

- `file-selection`: The file-open flow must now trigger migration execution after successfully opening a data file

## Impact

- **Tauri command layer**: New command (or extension of the open-file command) to run Drizzle migrations and report errors
- **Drizzle schema**: Migration file(s) covering all reference tables
- **Frontend**: Error surface when migration fails (likely reuses existing error/dialog patterns)
- **No new UI screens**: No new pages; migration failure error is the only new UI element
