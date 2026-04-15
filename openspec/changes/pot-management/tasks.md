## 1. Database Schema & Migration

- [x] 1.1 Add `pot`, `pot_tag`, and `transaction` table definitions to `src/lib/db/schema.ts`; remove `show_combined_balance` from the `account` table definition
- [x] 1.2 Run `drizzle-kit generate` to produce the next migration SQL file and add it to the inlined migrations array in `src/lib/db/index.ts`
- [x] 1.3 Verify migration runs cleanly against a fresh and an existing database in unit tests (`db-helper.ts` / `createTestDb`)

## 2. Pot Data Layer (`src/lib/pots.ts`)

- [ ] 2.1 Implement `listPots(accountId, showClosed)` — returns pot rows with calculated current balance (`opening_balance + SUM(transaction.amount)`) for active (and optionally closed) pots
- [ ] 2.2 Implement `createPot(input)` — validates unique name within account (case-insensitive), inserts `pot` row and optional `pot_tag` row
- [ ] 2.3 Implement `updatePot(input)` — validates unique name excluding current pot, updates `pot` row, replaces `pot_tag` row
- [ ] 2.4 Implement `closePot(potId)` — calculates current balance; if non-zero, creates a virtual transfer pair returning balance to parent account; then sets `is_active = 0`
- [ ] 2.5 Implement `reactivatePot(potId)` — sets `is_active = 1`
- [ ] 2.6 Implement `deletePot(potId)` — hard deletes: removes all `transaction` rows for the pot, all `pot_tag` rows, and the `pot` row
- [ ] 2.7 Write unit tests for all pots data functions in `tests/unit/pots.test.ts`

## 3. Transfer Data Layer (`src/lib/transfers.ts`)

- [ ] 3.1 Implement `createPotTransfer(input)` — validates amount > 0 and required fields; inserts two `transaction` rows (account side + pot side) sharing a `transfer_id`; direction controls sign of amounts
- [ ] 3.2 Write unit tests for transfer creation (into pot, out of pot, validation errors) in `tests/unit/transfers.test.ts`

## 4. Accounts Data Layer Updates (`src/lib/accounts.ts`)

- [ ] 4.1 Update `listAccounts` to also fetch and attach pot rows (with calculated balances) under each account result — or provide a separate `listAccountsWithPots` function used by the accounts screen
- [ ] 4.2 Write/update unit tests to cover accounts listing with pot child data

## 5. Pot Management UI (`PotFormSheet`)

- [ ] 5.1 Create `src/components/PotFormSheet.tsx` — Sheet with fields: Name, Opening Balance (default 0), Opening Date, Tag (combobox), Notes; parent account shown read-only; currency label inherited from account
- [ ] 5.2 Wire create and edit modes; call `createPot` / `updatePot` on submit; show per-field validation errors
- [ ] 5.3 Write component tests for `PotFormSheet` in `tests/unit/PotFormSheet.test.tsx`

## 6. Pot Transfer UI (`PotTransferDialog`)

- [ ] 6.1 Create `src/components/PotTransferDialog.tsx` — Dialog with direction selector (into/out of pot), Amount, Date, Notes; pot and account names shown read-only
- [ ] 6.2 Call `createPotTransfer` on submit; show validation errors inline; close dialog on success and refresh balances
- [ ] 6.3 Write component tests for `PotTransferDialog` in `tests/unit/PotTransferDialog.test.tsx`

## 7. Accounts Screen — Pot Child Rows

- [ ] 7.1 Update `src/components/AccountsScreen.tsx` to render pot child rows beneath each parent account: indented row showing pot name, balance, and a dropdown actions menu (Edit, Transfer, Close/Reactivate, Delete)
- [ ] 7.2 Add "Add pot" button per account row; opens `PotFormSheet` in create mode for that account
- [ ] 7.3 Add "Show closed pots" toggle per account (local state, defaults off); when enabled, shows closed pots in muted style
- [ ] 7.4 Wire pot actions: Edit → opens `PotFormSheet` in edit mode; Transfer → opens `PotTransferDialog`; Close → calls `closePot` (with warning if non-zero balance); Reactivate → calls `reactivatePot`; Delete → shows `AlertDialog` confirmation then calls `deletePot`
- [ ] 7.5 Update `AccountsScreen` tests in `tests/unit/AccountsScreen.test.tsx` to cover pot child row rendering and actions

## 8. Combined Balance View (`PotBalanceChart`)

- [ ] 8.1 Install / confirm Recharts is available in the project; create `src/components/PotBalanceChart.tsx` — Recharts `PieChart` showing account own balance + each active pot balance as segments with name and balance labels
- [ ] 8.2 Add breakdown toggle (shadcn `Switch`) within Account Detail view (or within `AccountsScreen` account row detail area); defaults off; hides chart when account has no active pots
- [ ] 8.3 Write component tests for `PotBalanceChart` in `tests/unit/PotBalanceChart.test.tsx`

## 9. E2E Tests

- [ ] 9.1 Write E2E test `tests/e2e/pot-management.test.ts` covering: create a pot, edit a pot, add a tag, show/hide closed pots toggle, close a pot with zero balance, close a pot with non-zero balance (verify auto-transfer warning + balance update), reactivate a pot, hard delete a pot (verify confirmation dialog and removal)
- [ ] 9.2 Extend or add E2E test covering manual pot transfer: open transfer dialog, transfer into pot, verify pot balance increases; transfer out of pot, verify pot balance decreases
- [ ] 9.3 Add E2E scenario verifying account balance excludes pot balances and combined breakdown chart appears when toggle enabled
