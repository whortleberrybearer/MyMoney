## Why

Users can import transactions but have no way to view, search, or manage them per account. The transaction list is the core interaction surface of a personal finance app — without it, the app has no practical utility beyond data ingestion. This is Phase 1 foundation work (GitHub issue #14).

## What Changes

- Add a `TransactionListScreen` that opens when the user selects an account from the dashboard, showing all transactions for that account (including virtual transfers to/from pots of that account)
- Add `payee` and `runningBalance` fields to the `transaction` table via a Drizzle migration
- Add `reference` and `categoryId` fields to the `transaction` table (reference is currently missing; category links to the existing `category` table)
- Remove `description` from the transaction schema — bank import data maps to `notes` instead (already aligned in OFX import but schema needs the formal column removal)
- Expose Tauri commands for listing, creating, updating, and deleting transactions with running balance recalculation
- Transactions can be sorted by date (default: newest first) or amount
- Transactions can be filtered by date range, category, reference, and counterparty/payee
- Transactions can be manually created, edited, and hard-deleted (no soft delete / void)
- Virtual transfer transactions are visually distinct from imported and manual transactions
- Running balance is recalculated for all subsequent transactions after any create, update, or delete

## Capabilities

### New Capabilities

- `transaction-list`: Full transaction list screen per account — columns (date, payee, notes, amount, category, running balance, reference, type), sorting, filtering/search, manual create/edit/hard-delete, running balance recalculation, virtual transfer distinction

### Modified Capabilities

- `transaction-import`: The `transaction` table schema changes (add `payee`, `reference`, `categoryId`, `runningBalance`; remove `description`) affect how imported transactions are stored. The OFX/CSV import commands must be updated to populate the new columns.

## Impact

- **Schema**: `transaction` table gains `payee`, `reference`, `category_id`, `running_balance` columns; `description` column removed. Drizzle migration required.
- **Tauri commands**: New commands — `list_transactions`, `create_transaction`, `update_transaction`, `delete_transaction`. Existing import commands updated to populate new columns.
- **Frontend**: New screen `TransactionListScreen`; new lib module `src/lib/transactions.ts`; app-context navigation extended with a `transaction-list` screen state.
- **Dependencies**: Requires account-management (F-01) and reference-data (categories, F-03) to be complete — both already shipped.
- **Tests**: Unit tests for all new Tauri-side business logic (running balance, list/filter, CRUD) and E2E tests for the full transaction list screen flow.
