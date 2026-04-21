## 1. Refactor: Extract pot running balance recalculation

- [x] 1.1 Move `recalculatePotRunningBalance` from `src/lib/pot-allocation-engine.ts` to `src/lib/transactions.ts` as an exported function
- [x] 1.2 Update `src/lib/pot-allocation-engine.ts` to import `recalculatePotRunningBalance` from `src/lib/transactions.ts`
- [x] 1.3 Update `tests/unit/transactions.test.ts` to add unit tests for `recalculatePotRunningBalance` (mirrors the existing `recalculateRunningBalance` test cases but using `pot_id`)

## 2. Backend: `reassignTransaction` function

- [x] 2.1 Add `reassignTransaction(transactionId: number, target: { accountId: number } | { potId: number })` to `src/lib/transactions.ts`
  - Fetch the transaction; throw if not found, void, or is a virtual-transfer
  - Resolve the parent accountId (from transaction.accountId or pot.accountId if currently in a pot)
  - Validate that the target pot (if any) belongs to the same parent account
  - Update `account_id` / `pot_id` on the transaction row
  - Recalculate running balance for the source container from the transaction's date
  - Recalculate running balance for the destination container from the transaction's date
- [x] 2.2 Add unit tests for `reassignTransaction` in `tests/unit/transactions.test.ts`:
  - Reassign from account to pot — balances recalculated for both
  - Reassign from pot back to account — balances recalculated for both
  - Reassign from one pot to another — balances recalculated for both
  - Throws when transaction is void
  - Throws when transaction is a virtual-transfer
  - Throws when target pot belongs to a different account

## 3. Frontend: pot assignment query and data

- [x] 3.1 Add a query helper (e.g. `getPotsForAccount(accountId)`) or reuse the existing pots query to expose the active pots for a given account to the transaction list view
- [x] 3.2 Pass the active pots list into the transaction list component (or fetch via React Query alongside the transactions query)

## 4. Frontend: PotAssignmentSelect component

- [x] 4.1 Create `src/components/PotAssignmentSelect.tsx` — a `Select` (shadcn/ui) that renders: main account as first option, then each active pot; current assignment selected by default; calls `reassignTransaction` on change and invalidates the transaction query
- [x] 4.2 Add unit tests for `PotAssignmentSelect` in `tests/unit/PotAssignmentSelect.test.tsx`:
  - Renders account option and pot options
  - Current assignment is pre-selected
  - Does not render when account has no active pots
  - Calls reassign and invalidates query on selection change

## 5. Frontend: integrate assignment column into transaction list

- [x] 5.1 Add a Pot column to the account transaction list screen — shown only when the account has at least one active pot; hidden for virtual-transfer rows; renders `PotAssignmentSelect`
- [x] 5.2 Add a Pot column to the pot transaction list screen — shown on non-virtual-transfer rows; renders `PotAssignmentSelect`
- [x] 5.3 Update `tests/unit/TransactionListScreen.test.tsx` (or equivalent) to cover:
  - Pot column is visible when account has active pots
  - Pot column is hidden when account has no active pots
  - Virtual-transfer rows do not show `PotAssignmentSelect`

## 6. E2E tests

- [ ] 6.1 Add e2e test file `tests/e2e/pot-transaction-assignment.test.ts`:
  - Reassign a transaction from main account to a pot and verify it appears in the pot transaction list
  - Reassign a transaction from a pot back to the main account and verify it appears in the account transaction list
  - Reassign a transaction from one pot to another and verify it appears only in the destination pot
  - Verify the pot assignment dropdown does not appear on virtual-transfer rows
  - Verify the pot column is hidden for accounts with no active pots
