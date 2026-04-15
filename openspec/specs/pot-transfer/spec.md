## ADDED Requirements

### Requirement: [F-06] Transaction table schema for virtual transfers

The system SHALL store virtual transfer transactions in a `transaction` table. This table is introduced in this change to support pot transfers; it will be extended by future transaction import features.

```
transaction
  id           INTEGER  PK AUTOINCREMENT
  account_id   INTEGER  FK → account.id  -- NULL if pot_id is set
  pot_id       INTEGER  FK → pot.id      -- NULL if account_id is set
  transfer_id  INTEGER                   -- links the two rows of a transfer pair
  amount       REAL     NOT NULL         -- signed: positive = credit, negative = debit
  date         TEXT     NOT NULL         -- ISO date YYYY-MM-DD
  notes        TEXT
  type         TEXT     NOT NULL         -- 'virtual_transfer'
  is_void      INTEGER  NOT NULL DEFAULT 0
```

Constraints (enforced at application layer):
- Exactly one of `account_id` or `pot_id` MUST be set on each row (never both, never neither)
- A virtual transfer pair MUST consist of exactly two rows sharing the same `transfer_id`
- The sum of the two paired amounts MUST be zero (one debit, one credit)

#### Scenario: Schema migration creates transaction table
- **WHEN** the app opens a database file that does not yet have the transaction table
- **THEN** the migration creates `transaction` with no errors

#### Scenario: Transaction table enforces signed amounts
- **WHEN** a virtual transfer pair is created
- **THEN** one row has a positive amount (credit) and one has a negative amount (debit) of equal magnitude

---

### Requirement: [F-06] User can create a manual transfer between a pot and its parent account

The system SHALL allow the user to move money between a pot and its parent account via a manual transfer dialog. The transfer creates two transaction rows (a virtual transfer pair): a debit on one side and a credit of equal magnitude on the other. The user SHALL specify the amount, date, and notes. The user SHALL also select the direction (money in to pot, or money out of pot).

**Required fields:** Amount (positive number), Date, Direction (into pot / out of pot)
**Optional fields:** Notes

#### Scenario: Transfer into pot (account → pot)
- **WHEN** the user submits a transfer with direction "into pot" and amount £100
- **THEN** two transaction rows are created: a debit of −100 on the account side and a credit of +100 on the pot side, sharing the same `transfer_id`
- **AND** the pot's displayed balance increases by £100

#### Scenario: Transfer out of pot (pot → account)
- **WHEN** the user submits a transfer with direction "out of pot" and amount £50
- **THEN** two transaction rows are created: a debit of −50 on the pot side and a credit of +50 on the account side, sharing the same `transfer_id`
- **AND** the pot's displayed balance decreases by £50

#### Scenario: Zero or negative amount is rejected
- **WHEN** the user submits a transfer with amount zero or a negative value
- **THEN** an inline validation error is shown and no transaction rows are created

#### Scenario: Missing required field is rejected
- **WHEN** the user submits the transfer form with a required field empty
- **THEN** inline validation errors are shown and no transaction rows are created

---

### Requirement: [F-06] Pot current balance reflects virtual transfer history

The system SHALL calculate a pot's current balance as `opening_balance + SUM(amount)` for all non-void transaction rows where `pot_id` matches. This balance SHALL be displayed alongside the pot in the accounts list.

#### Scenario: Pot balance matches opening balance when no transfers
- **WHEN** a pot has no virtual transfer transactions
- **THEN** the displayed balance equals the pot's `opening_balance`

#### Scenario: Pot balance increases after a transfer into it
- **WHEN** a virtual transfer credits the pot
- **THEN** the pot's displayed balance increases by the credited amount

#### Scenario: Pot balance decreases after a transfer out of it
- **WHEN** a virtual transfer debits the pot
- **THEN** the pot's displayed balance decreases by the debited amount

#### Scenario: Voided transactions are excluded from balance
- **WHEN** a transaction row has `is_void = 1`
- **THEN** it is excluded from the pot balance calculation

---

### Requirement: [F-06] Manual transfer dialog

The system SHALL present the manual transfer form as a Dialog (modal). The form SHALL show the direction selector and required fields clearly.

```
┌─────────────────────────────────────┐
│ Transfer Funds                  [X] │
├─────────────────────────────────────┤
│ Pot: Holiday Fund                   │
│ Account: Barclays Current Acc       │
│                                     │
│ Direction                           │
│ ● Into pot   ○ Out of pot           │
│                                     │
│ Amount *                            │
│ [___________________________]       │
│                                     │
│ Date *                              │
│ [DD/MM/YYYY_________________]       │
│                                     │
│ Notes                               │
│ [___________________________]       │
│                                     │
│              [Cancel] [Transfer]    │
└─────────────────────────────────────┘
```

shadcn/ui components: `Dialog`, `DialogContent`, `Input`, `RadioGroup`, `Button`.

#### Scenario: Dialog shows pot and account names
- **WHEN** the transfer dialog opens for a pot
- **THEN** the pot name and parent account name are shown as read-only context

#### Scenario: Direction defaults to "into pot"
- **WHEN** the transfer dialog opens
- **THEN** the direction is pre-selected as "into pot"

#### Scenario: Successful transfer closes dialog and updates balance
- **WHEN** the user submits a valid transfer
- **THEN** the dialog closes and the pot's balance in the accounts list reflects the transfer
