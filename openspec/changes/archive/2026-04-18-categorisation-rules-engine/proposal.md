## Why

Imported transactions are currently left uncategorised, requiring the user to manually assign a category to each one. A rules engine will automate this by matching transactions against user-defined conditions and applying actions (category assignment, note setting) at import time, dramatically reducing post-import effort.

## What Changes

- New **categorisation rules engine** that runs immediately after every import, evaluating rules in priority order (first match wins)
- New **rules management screen** with drag-and-drop priority ordering, enable/disable toggle, and full CRUD
- New **rule builder UI** — each rule has a name, one or more AND-combined conditions (matching on description, reference, amount, transaction_type, payee, account, category), and one or more actions (assign category, set note)
- **Manual re-run** capability to apply the current ruleset against all existing transactions
- **Category change shortcut**: when a user manually changes a transaction's category, they are prompted to create a rule for future or all transactions
- **Rule creation from Uncategorised Review Screen** (F-09 entry point) — opens a blank rule form
- Schema changes: rename `categorisation_rule_action` → `rule_action`; extend `rule_action` to support `assign_category` and `set_note` action types with a Drizzle migration

## Capabilities

### New Capabilities

- `categorisation-rules-engine`: Core rules engine — condition evaluation, action execution, priority ordering, first-match semantics, and manual re-run against all transactions
- `rules-management`: Rules management screen with list view, drag-and-drop reordering, is_active toggle, and CRUD operations for rules
- `rule-builder`: Rule creation/edit form — name field, condition rows (field + operator + value), action rows (type + value), and save/cancel

### Modified Capabilities

- `transaction-import`: Rules engine runs automatically after every import; import result screen updates to reflect categorisation applied
- `transaction-category-edit`: After a manual category change, prompt user to create a rule (future transactions only, or all transactions)

## Impact

- **Schema**: `categorisation_rule_action` table renamed to `rule_action`; `rule_action` gains an `action_type` discriminator column (`assign_category` | `set_note`) and a `note` text column alongside the existing `category_id`; Drizzle migration required
- **Tauri commands**: New commands for rule CRUD, rule reorder, rule engine execution (single import batch + full re-run)
- **Frontend**: New screens — rules list, rule builder form; updated transaction edit flow with post-save prompt
- **Dependencies**: F-07 (transaction import) and F-09 (transaction category edit) must be complete; category management (F-11) must be complete
