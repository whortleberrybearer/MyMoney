### Requirement: [F-11] Pot transaction assignment — reassign transaction to pot or account

The app SHALL allow the user to manually reassign a non-void transaction from the main account to one of that account's active pots, or back to the main account, or from one active pot to another active pot belonging to the same account.

When a transaction is reassigned to a pot:
- `account_id` SHALL be set to `null` and `pot_id` SHALL be set to the target pot's id
- Running balances for the source account and destination pot SHALL be recalculated from the transaction's date

When a transaction is reassigned back to the main account:
- `pot_id` SHALL be set to `null` and `account_id` SHALL be restored to the parent account's id
- Running balances for the source pot and destination account SHALL be recalculated from the transaction's date

When a transaction is reassigned between two pots:
- `pot_id` SHALL be updated to the destination pot's id
- Running balances for both the source pot and destination pot SHALL be recalculated from the transaction's date

A transaction SHALL only be reassignable to pots belonging to the same parent account as the transaction.

Business rules:
- Reassignment SHALL be available for `imported` and `manual` transactions; `virtual-transfer` transactions are NOT reassignable
- Reassignment is fully reversible at any time
- No schema changes are required — the existing `account_id` / `pot_id` mutual exclusivity on the transaction table supports this
- No audit trail is required — only the current assignment state matters

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Barclays Current Account                              [+ Add Transaction] [🔍]     │
├────────────┬──────────────┬──────────────┬──────────┬──────────┬─────────┬──────────┤
│ Date ↕     │ Payee        │ Notes        │ Amount ↕ │ Category │ Bal.    │ Pot      │
├────────────┼──────────────┼──────────────┼──────────┼──────────┼─────────┼──────────┤
│ 2024-03-15 │ Starbucks    │ Coffee       │  -3.50   │ Food     │ 496.50  │ [Account ▼] │
│ 2024-03-14 │ Employer     │ March salary │ +2500.00 │ Income   │ 500.00  │ [Account ▼] │
│ …          │              │              │          │          │         │          │
└────────────┴──────────────┴──────────────┴──────────┴──────────┴─────────┴──────────┘

Pot dropdown options (for an account with two active pots):
  ● Account (current)
  ○ Holiday Fund
  ○ Emergency
```

shadcn/ui components: `Select` (assignment dropdown per row), `DataTable` (TanStack Table).

#### Scenario: User reassigns a transaction from the main account to a pot
- **GIVEN** a main account transaction list is displayed
- **AND** the account has at least one active pot
- **WHEN** the user opens the assignment dropdown on a non-virtual-transfer transaction row and selects a pot
- **THEN** the transaction is removed from the main account transaction list
- **AND** the transaction appears in the selected pot's transaction list
- **AND** the main account's running balance is recalculated from the transaction's date
- **AND** the pot's running balance is recalculated from the transaction's date

#### Scenario: User reassigns a transaction from a pot back to the main account
- **GIVEN** a pot transaction list is displayed
- **AND** the pot has at least one non-virtual-transfer transaction
- **WHEN** the user opens the assignment dropdown and selects the main account
- **THEN** the transaction is removed from the pot's transaction list
- **AND** the transaction appears in the main account's transaction list
- **AND** the pot's running balance is recalculated from the transaction's date
- **AND** the main account's running balance is recalculated from the transaction's date

#### Scenario: User reassigns a transaction from one pot to another pot
- **GIVEN** a pot transaction list is displayed
- **AND** the parent account has at least two active pots
- **WHEN** the user opens the assignment dropdown and selects a different pot
- **THEN** the transaction is removed from the source pot's transaction list
- **AND** the transaction appears in the destination pot's transaction list
- **AND** running balances for both the source pot and destination pot are recalculated from the transaction's date

#### Scenario: Assignment dropdown shows current assignment as selected
- **GIVEN** a transaction is currently assigned to a pot
- **WHEN** the user views the transaction row
- **THEN** the assignment dropdown shows the pot's name as the current value

#### Scenario: Assignment dropdown shows main account and all active pots
- **GIVEN** a transaction list is displayed for an account with two active pots
- **WHEN** the user opens the assignment dropdown on a transaction row
- **THEN** the dropdown shows: the main account name, Pot 1 name, Pot 2 name

#### Scenario: Closed pots do not appear in the assignment dropdown
- **GIVEN** an account has one active pot and one closed pot
- **WHEN** the user opens the assignment dropdown
- **THEN** only the main account and the active pot are shown; the closed pot is not listed

#### Scenario: Virtual transfer transactions do not show assignment dropdown
- **GIVEN** a transaction list contains a virtual transfer row
- **WHEN** the user views that row
- **THEN** no assignment dropdown is shown on the virtual transfer row

#### Scenario: Account with no pots does not show assignment dropdown
- **GIVEN** a transaction list is displayed for an account with no active pots
- **WHEN** the user views any transaction row
- **THEN** no assignment dropdown column is shown

---

### Requirement: [F-11] Pot transaction assignment — running balance recalculation

After a transaction is reassigned, the app SHALL recalculate `running_balance` for all non-void transactions in both the source container and the destination container with a date on or after the reassigned transaction's date, ordered by date ascending then id ascending.

The recalculation for a pot uses the pot's `opening_balance` plus the sum of all non-void pot transactions strictly before the affected date as the starting point.

#### Scenario: Running balances are correct after reassigning a mid-history transaction to a pot
- **GIVEN** a main account with transactions T1 (2024-01-01, +100, bal=100), T2 (2024-01-02, -20, bal=80), T3 (2024-01-03, +50, bal=130)
- **AND** a pot with opening balance 0 and no transactions
- **WHEN** T2 is reassigned to the pot
- **THEN** the main account's running balance for T3 is updated to 150
- **AND** the pot's running balance for T2 (now in the pot) is -20

#### Scenario: Running balances are correct after reassigning back to main account
- **GIVEN** a pot has one transaction T1 (2024-01-15, -50, bal=-50)
- **AND** the main account has transactions before and after 2024-01-15
- **WHEN** T1 is reassigned back to the main account
- **THEN** the pot's running balance is recalculated (pot is now empty, no rows to update)
- **AND** the main account's running balances are recalculated from 2024-01-15 onwards
