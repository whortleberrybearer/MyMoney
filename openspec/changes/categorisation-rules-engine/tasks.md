## 1. Database Schema & Migration

- [ ] 1.1 Add `categorisation_rule` table to Drizzle schema (`src/lib/db/schema.ts`): id, name, sort_order, is_active
- [ ] 1.2 Add `rule_condition` table to Drizzle schema: id, rule_id (FK), field, operator, value (all text)
- [ ] 1.3 Add `rule_action` table to Drizzle schema: id, rule_id (FK), action_type, category_id (nullable FK), note (nullable text)
- [ ] 1.4 Generate Drizzle migration file for the three new tables
- [ ] 1.5 Write unit tests for schema: verify tables exist with correct columns and constraints after migration

## 2. Rules Engine — Tauri Command

- [ ] 2.1 Create `apply_rules` Tauri command: accepts optional list of transaction IDs (None = all non-void)
- [ ] 2.2 Implement condition evaluation: fetch active rules ordered by sort_order, evaluate conditions per transaction using field/operator/value with AND logic
- [ ] 2.3 Implement `contains`, `starts_with`, `equals` string operators (case-insensitive)
- [ ] 2.4 Implement `greater_than`, `less_than` numeric operators for amount field; treat invalid cast as non-match
- [ ] 2.5 Implement first-match-wins: stop evaluating rules for a transaction once one matches; assign Uncategorised if no rule matches
- [ ] 2.6 Implement action execution: `assign_category` sets category_id; `set_note` overwrites notes
- [ ] 2.7 Return count of transactions categorised (non-Uncategorised result) from `apply_rules`
- [ ] 2.8 Write unit tests for engine: first-match-wins, Uncategorised fallback, inactive rules skipped, void transactions skipped
- [ ] 2.9 Write unit tests for each operator type (contains, starts_with, equals, greater_than, less_than)
- [ ] 2.10 Write unit tests for multi-condition AND logic (all must match)
- [ ] 2.11 Write unit tests for multiple actions on a single rule (both applied)

## 3. Rule CRUD — Tauri Commands

- [ ] 3.1 Create `get_rules` Tauri command: returns all rules ordered by sort_order with their conditions and actions
- [ ] 3.2 Create `create_rule` Tauri command: inserts rule, conditions, and actions; appends to end (max sort_order + 1)
- [ ] 3.3 Create `update_rule` Tauri command: replaces rule name, conditions, and actions (delete-and-reinsert child rows)
- [ ] 3.4 Create `delete_rule` Tauri command: deletes rule and cascades to conditions and actions
- [ ] 3.5 Create `toggle_rule_active` Tauri command: flips is_active on a single rule
- [ ] 3.6 Create `reorder_rules` Tauri command: accepts ordered array of rule IDs, updates sort_order values in a single transaction
- [ ] 3.7 Write unit tests for each CRUD command (create, read, update, delete, toggle, reorder)

## 4. Rules Management Screen

- [ ] 4.1 Create `RulesManagementScreen` component with route entry from app navigation
- [ ] 4.2 Fetch and display rules list ordered by sort_order using `get_rules`
- [ ] 4.3 Implement drag-and-drop reordering (use @dnd-kit or equivalent); call `reorder_rules` on drop
- [ ] 4.4 Implement `is_active` toggle per row; call `toggle_rule_active` on change
- [ ] 4.5 Implement Delete button with confirmation dialog; call `delete_rule` on confirm
- [ ] 4.6 Implement empty state message when no rules exist
- [ ] 4.7 Add "Re-run rules on all transactions" button with confirmation dialog; call `apply_rules` with no ID filter; show success toast with count
- [ ] 4.8 Wire "+ New Rule" button to open rule builder form
- [ ] 4.9 Write E2E tests: list renders, toggle updates, delete with confirmation, reorder persists, re-run toast

## 5. Rule Builder Form

- [ ] 5.1 Create `RuleBuilderForm` component (Sheet or Dialog) with name field, dynamic condition rows, dynamic action rows
- [ ] 5.2 Implement condition row: field selector (description, reference, amount, transaction_type, payee, account, category), operator selector (filtered by field type), value input
- [ ] 5.3 Implement action row: action type selector (Assign category, Set note); show CategoryCombobox for assign_category, text input for set_note
- [ ] 5.4 Implement "+ Condition" and "+ Action" add-row buttons; "×" remove-row button disabled when only one row remains
- [ ] 5.5 Implement Save button disabled until name, all conditions, and all actions are complete
- [ ] 5.6 On Save (create mode): call `create_rule`; new rule appears at bottom of rules list; close form
- [ ] 5.7 On Save (edit mode): call `update_rule`; rules list refreshes; close form
- [ ] 5.8 Implement edit mode: pre-populate all fields from existing rule data when opened from Edit button
- [ ] 5.9 Write E2E tests: create rule, edit rule, operator filtering by field, min-1-condition enforcement, min-1-action enforcement, cancel discards changes

## 6. Import Integration — Rules Engine Post-Import

- [ ] 6.1 Update OFX import Tauri command to call `apply_rules` with the IDs of newly imported transactions after saving them
- [ ] 6.2 Update import result data structure to include `categorised_count` alongside existing counts
- [ ] 6.3 Update `ImportResultScreen` to display "Categorised" and "Uncategorised" counts from engine output
- [ ] 6.4 Write unit tests for import command: verify `apply_rules` is called post-import and categorised_count is returned
- [ ] 6.5 Write E2E tests: import with matching rules categorises transactions; import with no rules shows all uncategorised on result screen

## 7. Category Change Shortcut

- [ ] 7.1 After a successful transaction category save in the edit drawer, show "Apply to future transactions?" dialog with three options: No, Future only, All transactions
- [ ] 7.2 "No" closes dialog; no rule created
- [ ] 7.3 "Future only" opens rule builder pre-populated (name from payee/notes, condition on notes contains, assign_category action); saving rule does not trigger re-run
- [ ] 7.4 "All transactions" opens rule builder pre-populated; saving rule triggers `apply_rules` on all non-void transactions and shows success toast
- [ ] 7.5 Do not show prompt if the category field was not changed when saving
- [ ] 7.6 Write E2E tests: no prompt on non-category save; "No" creates no rule; "Future only" creates rule without re-run; "All transactions" creates rule and re-runs

## 8. Navigation & Integration

- [ ] 8.1 Add "Rules" navigation entry to the main sidebar/nav to reach `RulesManagementScreen`
- [ ] 8.2 Wire rule builder form launch from Uncategorised Review Screen (F-09) — opens blank form
- [ ] 8.3 Verify rules management screen is reachable and returns correctly to previous screen on cancel
- [ ] 8.4 Write E2E tests for navigation: rules screen reachable from nav; rule builder opens from uncategorised review screen
