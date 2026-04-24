### Requirement: Accounts Overview screen displays all active accounts grouped by type
The Accounts Overview screen SHALL fetch all active accounts and display them in a grid, grouped into five named categories: Current Accounts, Savings, Pensions, Mortgages, and Loans. Each category SHALL show a coloured dot, category label, and account count. Accounts whose `account_type` does not map to a known category SHALL appear in an "Other" catch-all section.

```
Accounts Overview
─────────────────────────────────────────────────────────────
● CURRENT ACCOUNTS (2)
┌──────────────────────┐  ┌──────────────────────┐
│ Starling Personal    │  │ Starling Joint  [Joint]│
│ Starling Bank        │  │ Starling Bank         │
│ Pots total           │  │ Pots total            │
│ £4,700               │  │ £2,150                │
│ ─────────────────    │  │ ─────────────────     │
│ • Holiday Fund £1,200│  │ • House Expenses£1,200│
│ • Emergency   £3,500 │  │ • Holiday      £950   │
│ + New Pot            │  │ + New Pot             │
└──────────────────────┘  └──────────────────────┘

● SAVINGS (3)
┌──────────────────────┐  ...
│ Easy Access ISA      │
│ Moneybox             │
│ £8,200               │
│ 2.9% AER             │
└──────────────────────┘
```

shadcn/ui components: Badge (for tags), Card/div for account cards.

#### Scenario: Overview loads all active accounts on mount
- **WHEN** the accounts-overview screen mounts
- **THEN** all accounts where `is_active = 1` are fetched and rendered
- **AND** accounts are grouped by their mapped display category

#### Scenario: Category header shows correct count
- **WHEN** the overview renders a category with 2 accounts
- **THEN** the category header displays "(2)" after the label

#### Scenario: Empty category is not shown
- **WHEN** no active accounts exist for a category (e.g. Loans)
- **THEN** that category section is not rendered in the overview

---

### Requirement: Account cards display balance, bank name, and optional tags
Each account card SHALL display the account name, bank/institution name, and current balance. If the account has associated tags (e.g. "Joint"), they SHALL be shown as badges. The card SHALL have a coloured top border matching its category colour.

#### Scenario: Account card shows name, bank, and balance
- **WHEN** an account card is rendered
- **THEN** the account name, bank name, and balance are all visible

#### Scenario: Tags are shown as badges
- **WHEN** an account has one or more tags
- **THEN** each tag is rendered as a coloured badge in the top-right of the card

#### Scenario: Account without tags shows no badges
- **WHEN** an account has no tags
- **THEN** no badge elements are rendered on the card

---

### Requirement: Pot accounts display pots inline instead of a single balance
When an account is a "pot parent" (i.e. it has at least one active pot), the account card SHALL display "Pots total" and the sum of all pot balances as the headline figure, then list each pot name and balance below a separator line. The operational account balance SHALL NOT be shown as the headline.

#### Scenario: Pot parent card shows pots total and pot list
- **WHEN** an account has at least one active pot
- **THEN** the card headline shows the sum of all pot balances labelled "Pots total"
- **AND** each pot is listed with its name and balance below the separator

#### Scenario: Account without pots shows the account balance directly
- **WHEN** an account has no pots
- **THEN** the card shows the account balance as the headline with no pot list section

---

### Requirement: Clicking an account card navigates to the account detail
Clicking an account card SHALL navigate to the transaction list for that account (using the existing `transaction-list` screen state).

#### Scenario: Click navigates to transaction list
- **WHEN** the user clicks an account card
- **THEN** the app navigates to the `transaction-list` screen for that account

---

### Requirement: AccountsOverviewScreen maps account types to display categories
The mapping from `account_type` DB values to display categories SHALL be:

| `account_type` value | Display Category |
|---|---|
| `current`, `checking` | Current Accounts |
| `savings`, `isa` | Savings |
| `pension` | Pensions |
| `mortgage` | Mortgages |
| `loan`, `credit` | Loans |
| anything else | Other |

#### Scenario: Current account appears in Current Accounts group
- **WHEN** an account has `account_type = "current"`
- **THEN** it is rendered under the "Current Accounts" category header

#### Scenario: Unknown account type appears in Other group
- **WHEN** an account has `account_type = "investment"` (not in the map)
- **THEN** it is rendered under the "Other" category header
