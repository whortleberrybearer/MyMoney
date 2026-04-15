## MODIFIED Requirements

### Requirement: [F-02] Accounts view with inactive toggle

The system SHALL provide an accounts screen that lists all active accounts by default and includes a toggle to reveal inactive accounts. Inactive accounts, when shown, SHALL be displayed in a visually muted style (e.g., reduced opacity, greyed text).

Pots SHALL be shown as indented child rows directly under their parent account row. Pots are always visible (no expand/collapse). Each pot SHALL display its own current balance. The parent account balance displayed in the list SHALL exclude pot balances.

An "Add pot" action SHALL be accessible for each account row. A "Show closed pots" toggle SHALL appear per account to reveal closed pots in a muted style.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Accounts                                          [Show inactive ○] [+ Add]      │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Institution   Name           Type       Currency   Balance          Actions       │
│ ──────────────────────────────────────────────────────────────────────────────── │
│ Barclays      Current Acc    Current    GBP        £1,500.00        [⋮]          │
│   ├─ Holiday Fund            (pot)                   £800.00        [⋮]          │
│   └─ Emergency               (pot)                   £200.00        [⋮]          │
│                                         [Show closed pots ○] [+ Add pot]         │
│                                                                                  │
│ Monzo         Savings        Savings    GBP          £500.00        [⋮]          │
│                                         [Show closed pots ○] [+ Add pot]         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

shadcn/ui components: `Table`, `Switch` (inactive toggle, show closed pots toggle), `Button`, `Sheet` (create/edit form), `AlertDialog` (delete confirmation), `Badge` (account type), `DropdownMenu` (actions).

#### Scenario: Default view shows only active accounts
- **WHEN** the user opens the accounts screen with the inactive toggle off
- **THEN** only accounts with `is_active = 1` and `is_deleted = 0` are shown

#### Scenario: Inactive toggle reveals deactivated accounts
- **WHEN** the user enables the inactive toggle
- **THEN** accounts with `is_active = 0` and `is_deleted = 0` are also shown, styled in a muted appearance

#### Scenario: Deleted accounts are never shown
- **WHEN** the accounts screen is viewed with any toggle state
- **THEN** accounts with `is_deleted = 1` are never shown

#### Scenario: Active pot child rows shown under parent account
- **WHEN** the accounts screen loads
- **THEN** active pots (`is_active = 1`) for each account are shown as indented child rows directly beneath their parent account
- **AND** each pot row shows the pot name and its current calculated balance

#### Scenario: Parent account balance excludes pot balances
- **WHEN** an account has pots with balances
- **THEN** the balance shown in the account row is the account's own balance (excluding all pot balances)

#### Scenario: Closed pot child rows hidden by default
- **WHEN** the "Show closed pots" toggle for an account is off
- **THEN** pots with `is_active = 0` under that account are not shown

#### Scenario: Closed pot child rows shown when toggle enabled
- **WHEN** the user enables the "Show closed pots" toggle for an account
- **THEN** closed pots under that account appear in a muted style
- **AND** closed pots under other accounts remain hidden

#### Scenario: Add pot button is accessible per account
- **WHEN** the accounts screen is visible
- **THEN** each account row area has an "Add pot" button that opens the pot creation Sheet pre-filled with that account as the parent
