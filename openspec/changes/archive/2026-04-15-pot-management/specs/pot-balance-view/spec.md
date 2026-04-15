## ADDED Requirements

### Requirement: [F-06] Combined balance breakdown in Account Detail view

The system SHALL provide a view-only combined balance breakdown within the Account Detail view. This breakdown displays the parent account's own balance alongside each pot's balance as a pie/donut chart. It does not affect how balances are stored or calculated.

The breakdown is toggled by a control within the Account Detail view. The toggle defaults to off.

```
┌──────────────────────────────────────────────┐
│ Barclays Current Account                     │
│ Balance: £2,500.00         [Show breakdown ○]│
├──────────────────────────────────────────────┤
│  (pie chart visible when toggle is on)       │
│                                              │
│    ╭────────╮                                │
│   ╱  ████   ╲   ■ Account:      £1,500.00   │
│  │  ██████   │  ■ Holiday Fund:   £800.00   │
│   ╲  ████   ╱   ■ Emergency:     £200.00   │
│    ╰────────╯                                │
│                                              │
│  Total:  £2,500.00                           │
└──────────────────────────────────────────────┘
```

Chart library: Recharts (`PieChart` / `RadialBarChart`).
shadcn/ui components: `Switch` or `Toggle` (for the breakdown toggle), `Card`.

#### Scenario: Breakdown toggle defaults to off
- **WHEN** the user opens the Account Detail view
- **THEN** the breakdown toggle is off and no chart is shown

#### Scenario: Breakdown shows pot and account balances in chart
- **WHEN** the user enables the breakdown toggle
- **THEN** a pie/donut chart is shown with one segment per pot plus one segment for the account's own balance (excluding pots)
- **AND** each segment is labelled with the pot/account name and its balance

#### Scenario: Breakdown total matches sum of account plus all pot balances
- **WHEN** the breakdown is visible
- **THEN** the total displayed equals `account_own_balance + SUM(pot_balances)` for all active pots

#### Scenario: Closed pots are excluded from the breakdown chart
- **WHEN** the breakdown is visible
- **THEN** pots with `is_active = 0` are not included in the chart

#### Scenario: Account with no pots shows no chart toggle
- **WHEN** the Account Detail view is open for an account that has no active pots
- **THEN** the breakdown toggle is hidden (or disabled) since there is nothing to break down

---

### Requirement: [F-06] Account own balance excludes pot balances

The system SHALL calculate and display the parent account's own balance independently from its pots. The parent account balance = `account.opening_balance + SUM(transaction.amount WHERE account_id = account.id AND is_void = 0)`. Pot balances are never included in this figure.

#### Scenario: Account balance is unaffected by pot balances
- **WHEN** a pot under the account has a balance of £500
- **THEN** the account's displayed balance does not include the £500

#### Scenario: Virtual transfer affects both account and pot balance independently
- **WHEN** a virtual transfer moves £200 from the account to a pot
- **THEN** the account's own balance decreases by £200
- **AND** the pot's balance increases by £200
- **AND** the total combined balance (account + pot) remains the same
