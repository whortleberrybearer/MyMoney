## 1. Database Schema & Migration

- [x] 1.1 Add `potAllocationRule`, `potAllocationRuleCondition`, and `potAllocationRuleAction` Drizzle schema tables to `src/lib/db/schema.ts`
- [x] 1.2 Generate a Drizzle migration for the three new tables and add it to the inlined migrations array in `src/lib/db/index.ts`
- [x] 1.3 Write unit tests in `tests/unit/` verifying the migration applies cleanly and the schema is queryable

## 2. Pot Allocation Rules Library (`src/lib/pot-allocation-rules.ts`)

- [x] 2.1 Implement `getPotAllocationRules(accountId, opts?)` — fetch all rules for an account ordered by `priority ASC`, joining conditions and actions
- [x] 2.2 Implement `createPotAllocationRule(accountId, input)` — insert rule row with `priority = max + 1`, insert condition and action rows
- [x] 2.3 Implement `updatePotAllocationRule(id, input)` — update rule name, delete-and-reinsert conditions and actions
- [x] 2.4 Implement `deletePotAllocationRule(id)` — hard delete rule, conditions, and actions
- [x] 2.5 Implement `togglePotAllocationRuleActive(id)` — flip `is_active` 0↔1
- [x] 2.6 Implement `reorderPotAllocationRules(orderedIds)` — update `priority` values in a single pass
- [x] 2.7 Write unit tests in `tests/unit/pot-allocation-rules.test.ts` covering all CRUD operations and edge cases (duplicate priority, empty conditions/actions)

## 3. Pot Allocation Engine (`src/lib/pot-allocation-engine.ts`)

- [x] 3.1 Implement condition evaluation — support fields `description`, `reference`, `amount`, `transaction_type`; operators `contains`, `starts_with`, `equals`, `greater_than`, `less_than` (with numeric cast guard)
- [x] 3.2 Implement first-match-wins rule evaluation loop (AND conditions per rule, priority order)
- [x] 3.3 Implement insufficient-balance check: sum all action `allocation_value` fields for the matched rule; compare against current running balance; block the entire rule if insufficient
- [x] 3.4 Implement virtual transfer creation: insert account debit + per-action pot credit pairs sharing a `transferId`; assign "Savings transfer" category (auto-create if absent); set `notes = "Auto-transfer to <pot name>"`; set `type = "virtual_transfer"`
- [x] 3.5 Implement post-transfer running balance recalculation for the account and all affected pots
- [x] 3.6 Return structured result: `{ allocations: number; failures: { ruleName: string; potNames: string[] }[] }`
- [x] 3.7 Write unit tests in `tests/unit/pot-allocation-engine.test.ts` covering: rule match, no match, insufficient balance block, multi-action rule, balance updated after each transfer in same import batch, inactive rules skipped, rules from other accounts skipped

## 4. Wire Engine into Import Pipeline

- [x] 4.1 Replace the `applyPotAllocationRules()` stub in `src/lib/ofx-import.ts` with a real call to the engine, passing `importedIds` and `accountId`
- [x] 4.2 Update the `ImportResult` type in `src/lib/import.ts` to include `potAllocations: number` and `allocationFailures: { ruleName: string; potNames: string[] }[]`
- [x] 4.3 Update `src/lib/ofx-import.ts` to incorporate the engine result into the returned `ImportResult`
- [x] 4.4 Update CSV import (if applicable) to also invoke the engine and return updated `ImportResult`
- [x] 4.5 Write unit tests in `tests/unit/ofx-import.test.ts` covering: pot allocation runs after categorisation, failure entries appear in result, no allocation when no active rules exist

## 5. Import Result Screen

- [x] 5.1 Update `ImportResultScreen.tsx` to display `potAllocations` count in the summary row
- [x] 5.2 Add an allocation failures section to `ImportResultScreen.tsx` that renders when `allocationFailures.length > 0`, listing each failure as "Rule '{ruleName}' — insufficient balance for {pot names}"
- [x] 5.3 Update `tests/unit/ImportResultScreen.test.tsx` to cover: pot allocations count shown, failure section shown with correct text, failure section hidden when no failures

## 6. Rules Tab in Account View

- [x] 6.1 Add a **Rules** `TabsTrigger` and `TabsContent` to the account view component (alongside the existing Transactions tab)
- [x] 6.2 Create `PotAllocationRulesTab.tsx` — renders rules list, empty state, drag-to-reorder (using `@dnd-kit/core`), active toggle, Edit/Delete per row, and "+ New Rule" button
- [x] 6.3 Wire drag-end handler to call `reorderPotAllocationRules` and re-fetch the list
- [x] 6.4 Wire active toggle to call `togglePotAllocationRuleActive` and update the row
- [x] 6.5 Wire Delete to show a `AlertDialog` confirmation, then call `deletePotAllocationRule` and remove from list
- [x] 6.6 Write unit tests in `tests/unit/PotAllocationRulesTab.test.tsx` covering: rules listed in priority order, empty state shown, toggle fires correct handler, delete confirmation flow

## 7. Pot Allocation Rule Builder Sheet

- [x] 7.1 Create `PotAllocationRuleBuilderSheet.tsx` — Sheet with name field, condition rows (field/operator/value selectors), action rows (pot selector + amount), Add Condition / Add Pot buttons, per-row remove buttons, Save/Cancel
- [x] 7.2 Implement field→operator filtering (amount → numeric operators only; other fields → text operators only)
- [x] 7.3 Implement pot selector using a Combobox showing only active pots belonging to the account
- [x] 7.4 Implement Save validation: name required, at least one complete condition, at least one valid action (positive numeric amount, pot selected); Save button disabled while invalid
- [x] 7.5 Wire Save to call `createPotAllocationRule` (create mode) or `updatePotAllocationRule` (edit mode), then close sheet and refresh the rules list
- [x] 7.6 Pre-populate all fields when opened in edit mode
- [x] 7.7 Write unit tests in `tests/unit/PotAllocationRuleBuilderSheet.test.tsx` covering: Save disabled when incomplete, operator list filtered by field, remove button disabled when only one row, create/update calls on save, pot selector shows only active pots for account

## 8. End-to-End Tests

- [x] 8.1 Write `tests/e2e/pot-allocation-rules-management.test.ts` — create rule, verify it appears in list; toggle active; drag to reorder; delete with confirmation
- [x] 8.2 Write `tests/e2e/pot-allocation-import.test.ts` — import OFX with a matching active rule, verify virtual transfer transactions created on account and pot, verify import result screen shows allocation count; import with insufficient balance, verify failure shown on result screen
