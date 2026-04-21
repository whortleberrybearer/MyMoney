## MODIFIED Requirements

### Requirement: [F-08] Transaction list screen — view account transactions

The app SHALL display a transaction list screen when the user selects an account from the dashboard. The screen SHALL show all transactions belonging to the account (rows where `account_id = accountId` and `is_void = 0`), plus the account-side legs of virtual transfers to/from pots of that account.

Columns displayed:

| Column | Notes |
| --- | --- |
| Date | Transaction date (YYYY-MM-DD) |
| Payee | Free-text payee name |
| Notes | User notes / bank description |
| Amount | Signed amount (positive = credit, negative = debit) |
| Category | Category name or blank if uncategorised |
| Running Balance | Persisted running balance for the account |
| Reference | Payment reference |
| Type | `imported`, `manual`, or `virtual-transfer` — visually distinct |
| Pot | Assignment dropdown — only shown when the account has at least one active pot; hidden for virtual-transfer rows |

Virtual transfer rows SHALL be visually distinct (e.g., italic or badge) from imported and manual rows.

Default sort: date descending (newest first), with id ascending as tiebreaker within the same date.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← My Account                                                 [+ Add Transaction] [🔍]    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ [Date range ▼] [Category ▼] [Type ▼] [Reference...]  [Payee...]                         │
├────────────┬──────────────┬──────────────┬──────────┬──────────┬─────────┬──────┬────────┤
│ Date ↕     │ Payee        │ Notes        │ Amount ↕ │ Category │ Bal.    │ ⋮   │ Pot    │
├────────────┼──────────────┼──────────────┼──────────┼──────────┼─────────┼──────┼────────┤
│ 2024-03-15 │ Starbucks    │ Coffee       │  -3.50   │ Food     │ 496.50  │  ⋮   │[Acct▼] │
│ 2024-03-14 │ Employer     │ March salary │ +2500.00 │ Income   │ 500.00  │  ⋮   │[Acct▼] │
│ …          │              │              │          │          │         │      │        │
└────────────┴──────────────┴──────────────┴──────────┴──────────┴─────────┴──────┴────────┘
```

shadcn/ui components: `DataTable` (TanStack Table), `Button`, `Badge` (type), `Select` (filters and pot assignment), `Input` (text filters).

#### Scenario: User navigates to transaction list from dashboard
- **GIVEN** the dashboard is displayed with at least one account row
- **WHEN** the user clicks on an account row
- **THEN** the transaction list screen is displayed for that account
- **AND** the screen title shows the account name
- **AND** transactions are listed newest-first by default

#### Scenario: Account with no transactions shows empty state
- **GIVEN** the user navigates to an account with no transactions
- **WHEN** the transaction list screen loads
- **THEN** an empty state message is shown (e.g., "No transactions yet")
- **AND** the Add Transaction button is visible

#### Scenario: Virtual transfer transactions are visually distinct
- **GIVEN** the account has virtual transfer transactions
- **WHEN** the transaction list is displayed
- **THEN** virtual transfer rows are visually differentiated from imported and manual rows (e.g., a type badge)

#### Scenario: Back navigation returns to dashboard
- **GIVEN** the transaction list screen is displayed
- **WHEN** the user clicks the back button
- **THEN** the app navigates back to the dashboard

#### Scenario: Pot assignment column shown when account has active pots
- **GIVEN** the account has at least one active pot
- **WHEN** the transaction list screen is displayed
- **THEN** a Pot assignment column is shown with a Select dropdown on each non-virtual-transfer row

#### Scenario: Pot assignment column hidden when account has no active pots
- **GIVEN** the account has no active pots
- **WHEN** the transaction list screen is displayed
- **THEN** no Pot assignment column is shown
