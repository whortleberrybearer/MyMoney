## Why

Pots exist to earmark portions of an account's balance for specific goals, but there is currently no automated way to allocate funds to them. This change introduces a pot allocation rules engine that fires on import and creates virtual transfer pairs between the main account and target pots, enabling automatic fund allocation without manual intervention.

## What Changes

- New database tables: `pot_allocation_rule`, `pot_allocation_rule_condition`, `pot_allocation_rule_action`
- A **Rules tab** added to the account view for managing pot allocation rules
- A rule builder form scoped to a specific account, supporting fixed-amount pot allocations
- Drag-to-reorder rules within the account's Rules tab (first-match-wins priority)
- Engine that fires during import, evaluating rules in priority order and creating virtual debit/credit transaction pairs
- Insufficient-balance check blocks the entire rule (no partial allocations); failures surfaced on the import result screen
- Virtual transfer transactions are auto-assigned the "Savings transfer" category (bypassing the categorisation rules engine)
- Drizzle migration required for the three new tables

## Capabilities

### New Capabilities

- `pot-allocation-rules-management`: Rules tab within the account view — lists rules, supports drag-to-reorder, active toggle, edit and delete actions scoped to the account
- `pot-allocation-rule-builder`: Form for creating/editing a pot allocation rule — name, conditions (AND logic), and one-or-more pot actions (fixed amount each)
- `pot-allocation-rules-engine`: Engine that evaluates rules on import (first-match-wins), creates virtual debit/credit transfer pairs, handles insufficient-balance blocking, and surfaces failures on the import result screen

### Modified Capabilities

- `transaction-import`: Import result screen must surface pot allocation rule failures (rule name + affected pot(s))

## Impact

- **Database**: Three new tables via Drizzle migration; no changes to existing tables
- **Tauri commands**: New commands for CRUD on rules/conditions/actions; new engine command invoked post-import
- **Frontend**: New Rules tab on the account view; new rule builder Sheet; import result screen extended with allocation failure display
- **Categorisation rules engine**: No changes — pot allocation runs after categorisation and virtual transfers skip the categorisation engine entirely
- **Dependencies**: Pot Management (F-06) must be complete (pots must exist to assign actions to); Transaction Import pipeline must be in place
