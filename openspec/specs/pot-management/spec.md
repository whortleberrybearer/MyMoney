## ADDED Requirements

### Requirement: [F-06] Pot table schema

The system SHALL store pots in a `pot` table. A companion `pot_tag` junction table links pots to zero or one tag. The `show_combined_balance` column SHALL be removed from the `account` table (it was previously spec'd but never implemented and is superseded by the UI-level combined view).

```
pot
  id               INTEGER  PK AUTOINCREMENT
  account_id       INTEGER  NOT NULL  FK → account.id
  name             TEXT     NOT NULL
  opening_balance  REAL     NOT NULL  DEFAULT 0
  opening_date     TEXT     NOT NULL  -- ISO date YYYY-MM-DD
  is_active        INTEGER  NOT NULL  DEFAULT 1  -- 0 = closed/deactivated
  notes            TEXT

pot_tag
  pot_id   INTEGER  NOT NULL  FK → pot.id
  tag_id   INTEGER  NOT NULL  FK → tag.id
  PRIMARY KEY (pot_id, tag_id)
```

A Drizzle migration MUST be generated and added to the inlined migrations array in `src/lib/db/index.ts`. The migration MUST also drop the `show_combined_balance` column from `account`.

#### Scenario: Schema migration creates pot tables
- **WHEN** the app opens a database file that does not yet have the pot tables
- **THEN** the migration creates `pot` and `pot_tag` with no errors and drops `show_combined_balance` from `account`

#### Scenario: Migration is idempotent
- **WHEN** the migration is applied to a database that already has the pot tables
- **THEN** no error is thrown and existing data is unchanged

---

### Requirement: [F-06] User can create a pot

The system SHALL allow the user to create a new pot under a parent account. Pot name MUST be unique within the parent account (case-insensitive). The pot is immediately visible as a child row under its parent account in the accounts list.

**Required fields:** Name, Opening Date
**Optional fields:** Opening Balance (defaults to 0), Notes, Tag

#### Scenario: Successful pot creation
- **WHEN** the user submits the create pot form with all required fields filled in validly
- **THEN** the pot is saved with `is_active = 1` and appears as a child row under the parent account

#### Scenario: Opening balance defaults to zero
- **WHEN** the user submits the create pot form without entering an opening balance
- **THEN** `opening_balance` is stored as `0`

#### Scenario: Duplicate pot name within the same account is rejected
- **WHEN** the user submits the form with a name already used by another pot under the same account
- **THEN** an inline validation error is shown and the pot is not saved

#### Scenario: Duplicate pot name under a different account is allowed
- **WHEN** the user creates a pot with a name that already exists under a different account
- **THEN** the pot is saved successfully (uniqueness is scoped to the parent account)

#### Scenario: Missing required field is rejected
- **WHEN** the user submits the form with a required field empty
- **THEN** inline validation errors are shown for the missing fields and the pot is not saved

---

### Requirement: [F-06] User can edit a pot

The system SHALL allow the user to edit all fields of an existing pot (name, opening balance, opening date, notes, tag). All fields remain editable after creation.

#### Scenario: Successful pot edit
- **WHEN** the user submits the edit pot form with valid changes
- **THEN** the pot record is updated and the new values are shown in the accounts list child row

#### Scenario: Edit validates the same rules as create
- **WHEN** the user submits the edit form with invalid data (blank name, duplicate name within account, etc.)
- **THEN** the same validation errors are shown as for pot creation

---

### Requirement: [F-06] User can close (deactivate) a pot

The system SHALL allow the user to close a pot by setting `is_active = 0`. Closed pots SHALL be hidden from the default accounts list view. If the pot's current balance is non-zero at the time of closure, the user SHALL be warned and the remaining balance SHALL be automatically transferred to the parent account via a virtual transfer before deactivation.

#### Scenario: Closing a pot with zero balance
- **WHEN** the user closes a pot whose current balance is zero
- **THEN** `is_active` is set to 0 and the pot is hidden from the default view with no transfer created

#### Scenario: Closing a pot with non-zero balance warns and auto-transfers
- **WHEN** the user triggers close on a pot with a non-zero balance
- **THEN** a warning is shown stating the remaining balance will be transferred to the parent account
- **AND** upon confirmation, a virtual transfer moves the full balance to the parent account
- **AND** `is_active` is then set to 0

#### Scenario: Closed pots hidden by default
- **WHEN** the "Show closed pots" toggle is off
- **THEN** pots with `is_active = 0` are not shown under their parent account

#### Scenario: Closed pots visible with toggle
- **WHEN** the user enables the "Show closed pots" toggle (scoped to an account's pot rows)
- **THEN** closed pots are shown in a visually muted style beneath active pots

#### Scenario: Closed pot can be reactivated
- **WHEN** the user reactivates a closed pot
- **THEN** `is_active` is set to 1 and the pot reappears in the default view

---

### Requirement: [F-06] User can hard delete a pot

The system SHALL allow the user to permanently delete a pot and all of its associated virtual transfer transactions. A confirmation dialog MUST be shown with an explicit warning that the action is permanent and irreversible. Hard deletion removes the `pot` row, all `pot_tag` rows, and all `transaction` rows where `pot_id` matches.

#### Scenario: Delete confirmation dialog shown
- **WHEN** the user triggers the delete action for a pot
- **THEN** a confirmation dialog is shown naming the pot and explicitly stating all transactions will be permanently removed

#### Scenario: Confirmed deletion removes pot and all its transactions
- **WHEN** the user confirms deletion
- **THEN** the pot row, its `pot_tag` rows, and all virtual transfer transactions for that pot are permanently removed from the database
- **AND** the pot no longer appears anywhere in the UI

#### Scenario: Delete cancelled leaves pot intact
- **WHEN** the user cancels the confirmation dialog
- **THEN** the pot is not deleted and remains unchanged

---

### Requirement: [F-06] Pot create/edit form (Sheet)

The system SHALL present the pot create and edit form as a Sheet (slide-in panel). The form SHALL include all pot fields with real-time validation feedback.

```
┌─────────────────────────────────┐
│ New Pot                     [X] │
├─────────────────────────────────┤
│ Account: Barclays Current Acc   │  ← read-only, inherited
│                                 │
│ Name *                          │
│ [_________________________]     │
│                                 │
│ Opening Balance                 │
│ [0.00_____________________]     │
│                                 │
│ Opening Date *                  │
│ [DD/MM/YYYY_______________]     │
│                                 │
│ Tag                             │
│ [Search or create tag... ]      │
│                                 │
│ Notes                           │
│ [_________________________]     │
│ [_________________________]     │
│                                 │
│          [Cancel] [Save]        │
└─────────────────────────────────┘
```

shadcn/ui components: `Sheet`, `SheetContent`, `Input`, `Textarea`, `Button`, `Popover`, `Command` (tag combobox).

#### Scenario: Form opens in create mode with parent account shown
- **WHEN** the user clicks "Add pot" for a specific account
- **THEN** the Sheet opens with the parent account name shown as a read-only field, all other fields blank, opening balance defaulting to 0

#### Scenario: Form opens in edit mode with existing values
- **WHEN** the user triggers edit for an existing pot
- **THEN** the Sheet opens with all fields pre-populated with the pot's current values

#### Scenario: Currency is inherited and shown read-only
- **WHEN** the pot form is open
- **THEN** the currency of the parent account is displayed as a read-only label (no currency selector on the pot form)

---

### Requirement: [F-06] Closed pots toggle is scoped to each account

The system SHALL display a "Show closed pots" toggle scoped to the pots section of each account in the Accounts List. The toggle SHALL default to off. Toggle state is local (not persisted across sessions).

#### Scenario: Toggle defaults to off
- **WHEN** the user opens the accounts screen
- **THEN** the "Show closed pots" toggle is off for all accounts and closed pots are not visible

#### Scenario: Toggle only affects the account it belongs to
- **WHEN** the user enables the "Show closed pots" toggle for Account A
- **THEN** closed pots under Account A are shown
- **AND** closed pots under Account B remain hidden
