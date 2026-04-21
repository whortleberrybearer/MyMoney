## Context

Transactions currently have mutually exclusive `account_id` / `pot_id` columns enforced at the application layer. Running balance recalculation for accounts lives in `src/lib/transactions.ts` (`recalculateRunningBalance`); a mirrored function for pots exists as a private helper in `src/lib/pot-allocation-engine.ts` (`recalculatePotRunningBalance`). There is no existing mechanism to move a transaction between containers.

## Goals / Non-Goals

**Goals:**
- Allow a user to reassign any non-void transaction to: the main account that originally imported it, or any active pot belonging to that account
- Recalculate running balances for the source and destination containers after reassignment
- Surface the reassignment control in both the account transaction list and the pot transaction list
- No schema migration required

**Non-Goals:**
- Automatic/import-time assignment
- Moving transactions across different accounts
- Audit trail or history of reassignments
- Bulk reassignment

## Decisions

### 1. Extract `recalculatePotRunningBalance` to `transactions.ts`

Currently the pot running balance recalculation is a private function in `pot-allocation-engine.ts`. To avoid duplication, it should be extracted and exported from `transactions.ts` alongside `recalculateRunningBalance`. `pot-allocation-engine.ts` then imports it from there.

**Alternative considered:** Duplicate the function in a new module. Rejected — unnecessary duplication of non-trivial logic.

### 2. New `reassignTransaction` function in `transactions.ts`

The reassignment logic belongs in `transactions.ts` (not a new file) since it is a mutation on the transaction table and follows the same pattern as `updateTransaction` and `voidTransaction`. It:
1. Fetches the current transaction to determine its original `account_id` (stored on the transaction or derived from the account the pot belongs to)
2. Validates that the target pot (if any) belongs to the same account as the original transaction
3. Updates `account_id` / `pot_id` on the transaction row atomically
4. Recalculates running balance for the source container (old `account_id` or `pot_id`) from the transaction date
5. Recalculates running balance for the destination container from the transaction date

**Note on original account_id:** When a transaction moves to a pot, `account_id` becomes `null`. We need to be able to move it back. The pot's parent `account_id` is stored on the `pot` table, so we can always derive the original account. No additional column needed.

### 3. UI: inline dropdown on the transaction row

A compact `Select` (shadcn/ui) is added to each transaction row showing: "Main Account" as the first option, then all active pots for that account. The current assignment is the default selected value. On change, it calls `reassignTransaction` and invalidates the transaction list query.

**Alternative considered:** Context menu action. Rejected — a dropdown is more discoverable and allows seeing the current state at a glance.

### 4. Account ID tracking through reassignment

When a transaction is assigned to a pot, `account_id` is set to `null`. The transaction must still be traceable back to the parent account for validation (to prevent cross-account reassignment). We use the pot's `account_id` column as the source of truth for the parent account when `transaction.account_id` is `null`.

## Risks / Trade-offs

- **Running balance recalculation scope**: Recalculation updates all rows from `fromDate` onwards. For accounts with many historical transactions, this is O(n). Acceptable for a single-user local app; no need for incremental updates.
- **Concurrent mutations**: SQLite serialises writes, so no transaction isolation concern for this app.
- **Pot running balance private function**: Extracting `recalculatePotRunningBalance` to `transactions.ts` is a minor refactor that touches `pot-allocation-engine.ts`. Low risk but must be tested.
