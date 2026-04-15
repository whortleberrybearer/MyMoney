## Why

Users need a way to mentally and financially ring-fence portions of an account balance for specific purposes (e.g., a holiday fund, emergency buffer, or car savings) without opening separate real-world accounts. Pots provide virtual sub-accounts that live under a real account, giving a clear picture of earmarked funds while keeping the parent account balance honest.

## What Changes

- Add `pot` table with fields: `id`, `account_id`, `name`, `opening_balance`, `opening_date`, `is_active`, `notes`
- Add `pot_tag` junction table linking pots to tags
- Remove `show_combined_balance` column from `account` table (originally spec'd but superseded — pot balances are never rolled into account balance)
- Add pot CRUD operations: create, edit, close (deactivate), hard delete
- Add manual transfer operation between a pot and its parent account (virtual transfer pair)
- Update Accounts List view to show pot child rows under each parent account
- Add combined balance breakdown view (pie/donut chart) within Account Detail view
- Drizzle migration required for all schema changes (F-05 dependency)

## Capabilities

### New Capabilities

- `pot-management`: Full lifecycle management of pots — create, edit, close (deactivate with optional auto-transfer), hard delete. Pots belong to one account and inherit currency. Tags assignable at creation and edit time. Closed pots hidden by default with a toggle to reveal them.
- `pot-transfer`: Manual money movement between a pot and its parent account. Creates a virtual transfer pair (debit on one side, credit on the other). Requires amount, date, and notes.
- `pot-balance-view`: View-only display in Account Detail showing combined breakdown of account + pot balances as a pie/donut chart. Does not affect stored balances.

### Modified Capabilities

- `account-management`: Accounts List now shows pot child rows directly under each parent account row (always visible, no expand/collapse). Each pot shows its own current balance. Parent account balance excludes pots.

## Impact

- **Schema**: New `pot` and `pot_tag` tables; `show_combined_balance` column removed from `account`
- **Migration**: New Drizzle migration file required
- **API layer**: New `src/lib/pots.ts` module; `src/lib/accounts.ts` updated to join pot rows for list view
- **UI**: `AccountsScreen.tsx` updated for pot child rows; new `PotFormSheet.tsx`, `PotTransferDialog.tsx`, `PotBalanceChart.tsx` components
- **Tests**: Unit tests for pot CRUD and transfer logic; E2E tests for full pot management flow
- **Dependencies**: Requires F-05 (account management) to be in place — accounts must exist before pots can be created
