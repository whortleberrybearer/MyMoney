## Why

The app currently has reference tables for institutions, account types, and tags but no `account` table and no UI to manage financial accounts. Account management is a prerequisite for every other feature (transactions, balances, imports) so it must be in place before anything else can be built.

## What Changes

- Add an `account` table to the database schema with all required fields (name, institution, account type, currency, opening balance, opening date, tag, notes, is_active)
- Add a Drizzle migration for the new table
- Implement institution management UI (create, edit, delete with confirmation)
- Implement account management UI (create, edit, deactivate/reactivate, delete with confirmation, show inactive toggle)
- Wire all CRUD operations through Tauri commands backed by Drizzle ORM

## Capabilities

### New Capabilities

- `institution-management`: Create, edit, and delete institutions that accounts are linked to
- `account-management`: Create, edit, deactivate/reactivate, and delete financial accounts; includes an inactive toggle in the accounts view

### Modified Capabilities

<!-- No existing capabilities are changing requirements -->

## Impact

- **Schema**: New `account` table; requires a new Drizzle migration (migration number `0001`)
- **Tauri commands**: New commands for institution and account CRUD
- **Frontend**: New accounts screen accessible from the dashboard shell; institution management likely embedded as a sub-flow within account creation/editing
- **Dependencies**: Depends on reference data already being seeded (`account_type`, `tag`, `currency` setting from settings); no other features are blocked by this change
