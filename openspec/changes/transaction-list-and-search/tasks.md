## 1. Database Schema & Migration

- [x] 1.1 Update `src/lib/db/schema.ts`: add `payee TEXT`, `reference TEXT`, `categoryId INTEGER` (FK to `category.id`), `runningBalance REAL NOT NULL DEFAULT 0` to the `transaction` table; remove `description TEXT`
- [x] 1.2 Run `npx drizzle-kit generate` to produce the Drizzle migration file and commit it alongside the schema change
- [x] 1.3 Verify the migration applies cleanly on a fresh database (`npm run test` or a manual check with a temp DB)

## 2. Transaction Data Layer (`src/lib/transactions.ts`)

- [x] 2.1 Create `src/lib/transactions.ts` with a `listTransactions(accountId, filters, sort)` function — returns account transactions (`account_id = accountId`, `is_void = 0`) plus account-side virtual transfer legs, applying sort (date desc default, amount option) and filters (date range, category, type, reference substring, payee substring)
- [x] 2.2 Add `createTransaction(accountId, data)` function — inserts a row with `type = 'manual'`, then triggers running balance recalculation for all rows on or after the new date
- [x] 2.3 Add `updateTransaction(id, data)` function — updates editable fields; recalculates running balance if date or amount changed
- [x] 2.4 Add `deleteTransaction(id)` function — hard-deletes the row, then recalculates running balance for all rows with date ≥ deleted row's date on the same account
- [x] 2.5 Add internal `recalculateRunningBalance(accountId, fromDate)` helper — walks transactions ordered by date ASC, id ASC from `fromDate`, computing cumulative balance starting from `openingBalance + SUM(amount WHERE date < fromDate)`

## 3. Unit Tests (`tests/unit/transactions.test.ts`)

- [x] 3.1 Test `listTransactions` — returns empty array for account with no transactions
- [x] 3.2 Test `listTransactions` — returns own transactions sorted newest-first by default
- [x] 3.3 Test `listTransactions` — filters by date range (from and/or to)
- [x] 3.4 Test `listTransactions` — filters by category
- [x] 3.5 Test `listTransactions` — filters by type (`manual`, `imported`, `virtual-transfer`)
- [x] 3.6 Test `listTransactions` — filters by reference substring (case-insensitive)
- [x] 3.7 Test `listTransactions` — filters by payee substring (case-insensitive)
- [x] 3.8 Test `listTransactions` — multiple filters combine with AND logic
- [x] 3.9 Test `createTransaction` — inserts transaction with correct type and recalculates running balance for subsequent rows
- [x] 3.10 Test `createTransaction` — validation rejects missing date or amount
- [x] 3.11 Test `updateTransaction` — updates notes/payee/category/reference without triggering recalculation
- [x] 3.12 Test `updateTransaction` — triggers recalculation when amount changes
- [x] 3.13 Test `updateTransaction` — triggers recalculation when date changes
- [x] 3.14 Test `deleteTransaction` — hard-deletes row and recalculates running balance for subsequent rows
- [x] 3.15 Test `recalculateRunningBalance` — correctly seeds balance from opening balance + prior transactions
- [x] 3.16 Test `recalculateRunningBalance` — correctly handles backdated inserts (running balance is correct at every row)
- [x] 3.17 Test `recalculateRunningBalance` — correctly handles deletion mid-history

## 4. OFX Import Update (`src/lib/ofx-import.ts`)

- [x] 4.1 Update OFX import to populate `payee` from the OFX `<NAME>` field (nullable)
- [x] 4.2 Update OFX import to populate `reference` from the OFX `<CHECKNUM>` field (nullable)
- [x] 4.3 Update OFX import to call `recalculateRunningBalance` after all transactions are inserted (from the earliest imported date)
- [x] 4.4 Remove any references to `description` column in the import code

## 5. Unit Tests — OFX Import Update (`tests/unit/ofx-import.test.ts`)

- [ ] 5.1 Test OFX import populates `payee` from `<NAME>` field
- [ ] 5.2 Test OFX import populates `reference` from `<CHECKNUM>` field
- [ ] 5.3 Test OFX import leaves `payee` null when `<NAME>` is absent
- [ ] 5.4 Test OFX import triggers running balance recalculation after insert

## 6. App Navigation — `transaction-list` Screen

- [ ] 6.1 Extend `app-context.tsx` with a `transaction-list` screen state carrying `{ screen: "transaction-list", filePath: string, accountId: number, accountName: string }`
- [ ] 6.2 Add the `transaction-list` case to the `AppScreens` switch in `App.tsx`, rendering `<TransactionListScreen>` with back navigation to dashboard
- [ ] 6.3 Update `AccountsScreen.tsx` to call the `onNavigateToTransactions(accountId, accountName)` prop when a row is clicked, and wire this prop through `DashboardShell.tsx` to `App.tsx`

## 7. Frontend — `TransactionListScreen` Component

- [ ] 7.1 Create `src/components/TransactionListScreen.tsx` with a header showing account name and a back button
- [ ] 7.2 Add the DataTable with columns: Date, Payee, Notes, Amount (signed, coloured), Category, Running Balance, Reference, Type (badge)
- [ ] 7.3 Apply visual distinction to `virtual-transfer` type rows (italic row or distinct badge colour)
- [ ] 7.4 Add filter bar: date-range pickers, category select, type select, reference text input, payee text input; wire filters to `listTransactions` call
- [ ] 7.5 Add column sort on Date and Amount headers; wire sort to `listTransactions` call
- [ ] 7.6 Add "Add Transaction" button that opens the `TransactionFormSheet` in create mode
- [ ] 7.7 Add row actions menu (⋮) with Edit and Delete actions

## 8. Frontend — `TransactionFormSheet` Component

- [ ] 8.1 Create `src/components/TransactionFormSheet.tsx` as a Sheet supporting create and edit modes
- [ ] 8.2 In create mode: all fields editable (date, amount, payee, notes, reference, category); on save call `createTransaction`
- [ ] 8.3 In edit mode for imported transactions: date and amount are read-only; payee, notes, reference, category editable; on save call `updateTransaction`
- [ ] 8.4 In edit mode for manual transactions: all fields editable including date and amount; on save call `updateTransaction`
- [ ] 8.5 Add inline validation: date required, amount required (non-zero)
- [ ] 8.6 Add delete confirmation dialog (shadcn/ui `AlertDialog`) triggered from the Delete row action; on confirm call `deleteTransaction`

## 9. Unit Tests — Frontend Components

- [ ] 9.1 Create `tests/unit/TransactionListScreen.test.tsx` — renders empty state when no transactions
- [ ] 9.2 Test `TransactionListScreen` — renders transaction rows with correct columns
- [ ] 9.3 Test `TransactionListScreen` — virtual transfer rows have visual distinction
- [ ] 9.4 Create `tests/unit/TransactionFormSheet.test.tsx` — create mode shows all fields editable
- [ ] 9.5 Test `TransactionFormSheet` — edit mode for imported transaction shows date/amount read-only
- [ ] 9.6 Test `TransactionFormSheet` — edit mode for manual transaction shows all fields editable
- [ ] 9.7 Test `TransactionFormSheet` — submit blocked when date or amount missing

## 10. E2E Tests (`tests/e2e/transaction-list.test.ts`)

- [ ] 10.1 Set up E2E helper: seed an account with known transactions in the test DB before suite runs
- [ ] 10.2 E2E: clicking an account row on the dashboard navigates to the transaction list screen
- [ ] 10.3 E2E: transaction list shows the correct number of rows and the account name in the header
- [ ] 10.4 E2E: sorting by amount changes the row order
- [ ] 10.5 E2E: filtering by date range shows only matching transactions
- [ ] 10.6 E2E: filtering by payee text shows only matching transactions
- [ ] 10.7 E2E: clicking Add Transaction, filling the form, and saving adds a new row to the list
- [ ] 10.8 E2E: editing a transaction's notes field via the row actions menu updates the displayed value
- [ ] 10.9 E2E: deleting a transaction via the row actions menu and confirming removes the row
- [ ] 10.10 E2E: cancelling the delete confirmation leaves the row unchanged
- [ ] 10.11 E2E: back button returns to the dashboard

## 11. Final Checks

- [ ] 11.1 Run `npm run test` (unit tests) — all pass
- [ ] 11.2 Run `npm run test:e2e` (E2E tests) — all pass
- [ ] 11.3 Run `npm run build` — TypeScript compiles without errors
