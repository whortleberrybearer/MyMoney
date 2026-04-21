## Why

Users need a way to manually assign a transaction to a specific pot rather than the main account — without creating virtual transfer pairs. This feature treats pots as true sub-accounts where transactions can be moved between the main account and pots at any time, with balances recalculated accordingly.

## What Changes

- Add a reassignment control to each transaction row in the main account's transaction list and in a pot's transaction list
- Implement a Tauri command to update `account_id` / `pot_id` on a transaction and recalculate running balances for the affected accounts/pots
- The control allows selection of: the main account, or any active pot belonging to that account
- The current assignment is reflected in the control's default value
- Running balances update immediately after reassignment

## Capabilities

### New Capabilities

- `pot-transaction-assignment`: Manually reassign a transaction from a main account to one of its pots (or vice versa, or between pots), updating `account_id`/`pot_id` and recalculating running balances for all affected containers

### Modified Capabilities

- `transaction-list`: Transaction rows in both the main account and pot views gain a reassignment control (dropdown or context menu action) showing the main account and its active pots

## Impact

- **Backend (Tauri commands)**: New `reassign_transaction` command; must recalculate running balances for the source container (account or pot) and destination container
- **Frontend (React)**: Transaction row component updated to include reassignment UI in both account and pot transaction list views
- **Database**: No schema changes — existing `account_id` / `pot_id` mutual exclusivity on the `transaction` table already supports this
- **Dependencies**: F-01 Account Management, F-03 Pot Management, F-06 Transaction List & Search must be in place
