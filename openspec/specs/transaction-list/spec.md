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
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← My Account                                          [+ Add Transaction] [🔍]   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Date range ▼] [Category ▼] [Type ▼] [Reference...]  [Payee...]                 │
├────────────┬──────────────┬──────────────┬──────────┬──────────┬─────────┬──────┤
│ Date ↕     │ Payee        │ Notes        │ Amount ↕ │ Category │ Bal.    │ ⋮   │
├────────────┼──────────────┼──────────────┼──────────┼──────────┼─────────┼──────┤
│ 2024-03-15 │ Starbucks    │ Coffee       │  -3.50   │ Food     │ 496.50  │  ⋮   │
│ 2024-03-14 │ Employer     │ March salary │ +2500.00 │ Income   │ 500.00  │  ⋮   │
│ …          │              │              │          │          │         │      │
└────────────┴──────────────┴──────────────┴──────────┴──────────┴─────────┴──────┘
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

---

### Requirement: [F-08] Transaction list — sorting

The app SHALL allow the user to sort transactions by date or amount. Only one sort column SHALL be active at a time.

#### Scenario: Default sort is date descending
- **GIVEN** the transaction list screen loads
- **WHEN** no sort has been explicitly selected
- **THEN** transactions are ordered by date descending, with id ascending as tiebreaker

#### Scenario: User sorts by amount ascending
- **GIVEN** the transaction list is displayed
- **WHEN** the user clicks the Amount column header
- **THEN** transactions are sorted by amount ascending

#### Scenario: Clicking same column header toggles sort direction
- **GIVEN** transactions are sorted by date descending
- **WHEN** the user clicks the Date column header again
- **THEN** transactions are sorted by date ascending

---

### Requirement: [F-08] Transaction list — filtering

The app SHALL provide filters for date range, category, transaction type, reference (substring), and payee (substring). Filters are additive (AND logic). The app SHALL show a count of results when any filter is active.

#### Scenario: Filter by date range
- **GIVEN** the transaction list is displayed
- **WHEN** the user selects a from-date and/or to-date filter
- **THEN** only transactions within the date range are shown

#### Scenario: Filter by category
- **GIVEN** the transaction list is displayed
- **WHEN** the user selects a category from the category filter
- **THEN** only transactions with that category are shown

#### Scenario: Filter by transaction type
- **GIVEN** the transaction list is displayed
- **WHEN** the user selects a type filter (imported / manual / virtual-transfer)
- **THEN** only transactions of that type are shown

#### Scenario: Filter by reference (substring)
- **GIVEN** the transaction list is displayed
- **WHEN** the user types into the reference filter field
- **THEN** only transactions whose reference contains the typed text (case-insensitive) are shown

#### Scenario: Filter by payee (substring)
- **GIVEN** the transaction list is displayed
- **WHEN** the user types into the payee filter field
- **THEN** only transactions whose payee contains the typed text (case-insensitive) are shown

#### Scenario: Multiple filters are combined with AND logic
- **GIVEN** a date range filter and a category filter are both active
- **WHEN** the transaction list is displayed
- **THEN** only transactions matching both filters are shown

#### Scenario: Clearing filters restores full list
- **GIVEN** one or more filters are active
- **WHEN** the user clears all filters
- **THEN** the full transaction list is shown

---

### Requirement: [F-08] Manual transaction creation

The app SHALL allow the user to manually create a transaction for the account. A create form SHALL accept: date (required), amount (required, signed), payee (optional), notes (optional), reference (optional), category (optional). Type is set to `manual` automatically. Running balance SHALL be recalculated for all transactions on or after the new transaction's date after creation.

```
┌─────────────────────────────────────────┐
│  Add Transaction                        │
├─────────────────────────────────────────┤
│  Date *         [2024-03-15          ]  │
│  Amount *       [          ] (+/-)      │
│  Payee          [                    ]  │
│  Notes          [                    ]  │
│  Reference      [                    ]  │
│  Category       [Select category ▼   ]  │
│                                         │
│                       [Cancel] [Save]   │
└─────────────────────────────────────────┘
```

shadcn/ui components: `Sheet` or `Dialog`, `Form`, `Input`, `Select` (category), `Button`.

#### Scenario: User creates a valid manual transaction
- **GIVEN** the transaction list screen is displayed
- **WHEN** the user clicks Add Transaction, fills in date and amount, and saves
- **THEN** the transaction is created with type `manual`
- **AND** the transaction appears in the list
- **AND** running balances are recalculated for all transactions on or after the new transaction's date

#### Scenario: Create fails when date is missing
- **GIVEN** the add transaction form is open
- **WHEN** the user clears the date field and attempts to save
- **THEN** a validation error is shown on the date field
- **AND** no transaction is created

#### Scenario: Create fails when amount is missing
- **GIVEN** the add transaction form is open
- **WHEN** the user leaves the amount field empty and attempts to save
- **THEN** a validation error is shown on the amount field
- **AND** no transaction is created

---

### Requirement: [F-08] Transaction editing

The app SHALL allow the user to edit a transaction's payee, notes, category, and reference fields. Date and amount SHALL also be editable for manual transactions; they SHALL be read-only for imported transactions (import data is authoritative). Running balance SHALL be recalculated if date or amount changes.

#### Scenario: User edits notes on an imported transaction
- **GIVEN** the transaction list screen shows an imported transaction
- **WHEN** the user opens the row actions menu and selects Edit
- **THEN** an edit form opens with payee, notes, category, and reference editable
- **AND** date and amount fields are read-only

#### Scenario: User edits amount on a manual transaction
- **GIVEN** the transaction list screen shows a manual transaction
- **WHEN** the user opens the row actions menu and selects Edit, changes the amount, and saves
- **THEN** the transaction is updated with the new amount
- **AND** running balances are recalculated for all transactions on or after the transaction's date

#### Scenario: User saves edit form without changes
- **GIVEN** the edit transaction form is open
- **WHEN** the user clicks Save without making any changes
- **THEN** no update is written and the form closes

---

### Requirement: [F-08] Transaction hard-delete

The app SHALL allow the user to permanently delete a transaction. A confirmation dialog SHALL be shown before deletion. After deletion, running balances SHALL be recalculated for all remaining transactions on or after the deleted transaction's date on the same account. There is no undo.

#### Scenario: User deletes a transaction after confirmation
- **GIVEN** the transaction list screen shows a transaction
- **WHEN** the user opens the row actions menu, selects Delete, and confirms
- **THEN** the transaction is permanently removed from the database
- **AND** running balances are recalculated for all subsequent transactions on the same account
- **AND** the transaction no longer appears in the list

#### Scenario: User cancels the delete confirmation
- **GIVEN** the delete confirmation dialog is shown
- **WHEN** the user clicks Cancel
- **THEN** no transaction is deleted and the list is unchanged

#### Scenario: Deleting the most recent transaction adjusts running balance
- **GIVEN** the account has two transactions: T1 (older) and T2 (newer)
- **WHEN** T2 is deleted
- **THEN** the running balance on T1 is unchanged (T1 has no subsequent transactions to recalculate)
- **AND** T2 no longer appears in the list

---

### Requirement: [F-08] Running balance recalculation

After any transaction create, update, or delete, the Tauri command layer SHALL recalculate `running_balance` for all transactions on the affected account with a date on or after the earliest affected date, ordered by date ascending then id ascending.

The initial `running_balance` for the recalculation walk starts from the account's `opening_balance` plus the sum of all transactions strictly before the earliest affected date.

#### Scenario: Running balance is correct after creating a backdated transaction
- **GIVEN** an account with transactions on 2024-01-01 (balance 100) and 2024-01-03 (balance 150)
- **WHEN** a transaction of -20 is created on 2024-01-02
- **THEN** the 2024-01-01 transaction running balance is unchanged
- **AND** the 2024-01-02 transaction running balance is 80
- **AND** the 2024-01-03 transaction running balance is 130

#### Scenario: Running balance is correct after deleting a transaction mid-history
- **GIVEN** an account with transactions T1 (2024-01-01, +100, bal=100), T2 (2024-01-02, +50, bal=150), T3 (2024-01-03, +25, bal=175)
- **WHEN** T2 is deleted
- **THEN** T1 running balance remains 100
- **AND** T3 running balance is updated to 125
