## ADDED Requirements

### Requirement: [F-02] Account table schema

The system SHALL store accounts in an `account` table with the following columns. A companion `account_tag` junction table links accounts to zero or one tag.

```
account
  id              INTEGER  PK AUTOINCREMENT
  name            TEXT     NOT NULL
  institution_id  INTEGER  NOT NULL  FK → institution.id
  account_type_id INTEGER  NOT NULL  FK → account_type.id
  currency        TEXT     NOT NULL
  opening_balance REAL     NOT NULL  DEFAULT 0
  opening_date    TEXT     NOT NULL  -- ISO date YYYY-MM-DD
  notes           TEXT
  is_active       INTEGER  NOT NULL  DEFAULT 1  -- 0 = deactivated
  is_deleted      INTEGER  NOT NULL  DEFAULT 0  -- soft-delete

account_tag
  account_id  INTEGER  NOT NULL  FK → account.id
  tag_id      INTEGER  NOT NULL  FK → tag.id
  PRIMARY KEY (account_id, tag_id)
```

A Drizzle migration MUST be generated and added to the inlined migrations array in `src/lib/db/index.ts`.

#### Scenario: Schema migration runs successfully
- **WHEN** the app opens a database file that does not yet have the account tables
- **THEN** migration `0001` creates `account` and `account_tag` with no errors

#### Scenario: Migration is idempotent
- **WHEN** the migration is applied to a database that already has the account tables
- **THEN** no error is thrown and existing data is unchanged

---

### Requirement: [F-02] User can create an account

The system SHALL allow the user to create a new account by submitting a form with all required fields. Name MUST be unique. The account is immediately visible in the accounts list after creation.

**Required fields:** Name, Institution, Account Type, Currency, Opening Balance, Opening Date
**Optional fields:** Tag, Notes

#### Scenario: Successful account creation
- **WHEN** the user submits the create account form with all required fields filled in validly
- **THEN** the account is saved to the database, marked active, and appears in the accounts list

#### Scenario: Duplicate account name is rejected
- **WHEN** the user submits the form with a name already used by another non-deleted account
- **THEN** an inline validation error is shown and the account is not saved

#### Scenario: Missing required field is rejected
- **WHEN** the user submits the form with one or more required fields empty
- **THEN** inline validation errors are shown for the missing fields and the account is not saved

#### Scenario: Currency defaults to app default
- **WHEN** the user opens the create account form
- **THEN** the currency field is pre-populated with the app's configured default currency

---

### Requirement: [F-02] User can edit an account

The system SHALL allow the user to edit all fields of an existing account. All fields remain editable after creation, including the opening balance and opening date.

#### Scenario: Successful account edit
- **WHEN** the user submits the edit account form with valid changes
- **THEN** the account record is updated and the new values are shown in the accounts list

#### Scenario: Edit validates the same rules as create
- **WHEN** the user submits the edit form with invalid data (blank name, duplicate name, etc.)
- **THEN** the same validation errors are shown as for account creation

---

### Requirement: [F-02] User can deactivate and reactivate an account

The system SHALL allow the user to mark an account as inactive (`is_active = 0`). Inactive accounts SHALL be hidden from the default accounts view. The user SHALL be able to reactivate a deactivated account.

#### Scenario: Deactivating an account hides it by default
- **WHEN** the user deactivates an account
- **THEN** the account is no longer shown in the default accounts list (where the inactive toggle is off)

#### Scenario: Inactive accounts appear when the toggle is on
- **WHEN** the user enables the "Show inactive" toggle
- **THEN** inactive accounts are shown in a visually muted style alongside active accounts

#### Scenario: Reactivating an account
- **WHEN** the user reactivates an inactive account
- **THEN** `is_active` is set to 1 and the account appears in the default view again

---

### Requirement: [F-02] User can delete an account with confirmation

The system SHALL allow the user to delete an account. A confirmation prompt MUST be shown before deletion. Deletion sets `is_deleted = 1` (soft-delete); the account is permanently hidden from all views and cannot be recovered through the UI.

#### Scenario: Delete confirmation shown
- **WHEN** the user triggers the delete action for an account
- **THEN** a confirmation dialog is shown naming the account and asking the user to confirm

#### Scenario: Confirmed deletion soft-deletes the account
- **WHEN** the user confirms deletion
- **THEN** `is_deleted` is set to 1 and the account is no longer visible anywhere in the UI

#### Scenario: Delete cancelled leaves account intact
- **WHEN** the user cancels the confirmation dialog
- **THEN** the account is not deleted

---

### Requirement: [F-02] Accounts view with inactive toggle

The system SHALL provide an accounts screen that lists all active accounts by default and includes a toggle to reveal inactive accounts. Inactive accounts, when shown, SHALL be displayed in a visually muted style (e.g., reduced opacity, greyed text).

```
┌──────────────────────────────────────────────────────────────┐
│ Accounts                          [Show inactive ○] [+ Add]  │
├──────────────────────────────────────────────────────────────┤
│ Institution   Name           Type       Currency   Balance    │
│ ─────────────────────────────────────────────────────────── │
│ Barclays      Current Acc    Current    GBP        £1,234.56 │
│ Monzo         Savings        Savings    GBP          £500.00 │
│                                                              │
│ [Inactive - muted when toggle is on]                         │
│ HSBC          Old ISA        ISA        GBP            £0.00 │
└──────────────────────────────────────────────────────────────┘
```

shadcn/ui components: `Table`, `Switch` (inactive toggle), `Button`, `Sheet` (create/edit form), `AlertDialog` (delete confirmation), `Badge` (account type).

#### Scenario: Default view shows only active accounts
- **WHEN** the user opens the accounts screen with the inactive toggle off
- **THEN** only accounts with `is_active = 1` and `is_deleted = 0` are shown

#### Scenario: Inactive toggle reveals deactivated accounts
- **WHEN** the user enables the inactive toggle
- **THEN** accounts with `is_active = 0` and `is_deleted = 0` are also shown, styled in a muted appearance

#### Scenario: Deleted accounts are never shown
- **WHEN** the accounts screen is viewed with any toggle state
- **THEN** accounts with `is_deleted = 1` are never shown

---

### Requirement: [F-02] Account create/edit form (Sheet)

The system SHALL present the account create and edit form as a Sheet (slide-in panel) containing all account fields. The form SHALL use controlled inputs with real-time validation feedback.

```
┌─────────────────────────────────┐
│ New Account                 [X] │
├─────────────────────────────────┤
│ Name *                          │
│ [_________________________]     │
│                                 │
│ Institution *           [Manage]│
│ [Select institution ▼]          │
│                                 │
│ Account Type *                  │
│ [Select type ▼]                 │
│                                 │
│ Currency *                      │
│ [GBP ▼]                         │
│                                 │
│ Opening Balance *               │
│ [0.00_____________________]     │
│                                 │
│ Opening Date *                  │
│ [DD/MM/YYYY_______________]     │
│                                 │
│ Tag                             │
│ [Select tag ▼]                  │
│                                 │
│ Notes                           │
│ [_________________________]     │
│ [_________________________]     │
│                                 │
│          [Cancel] [Save]        │
└─────────────────────────────────┘
```

shadcn/ui components: `Sheet`, `SheetContent`, `Form`, `FormField`, `Input`, `Select`, `Textarea`, `Button`, `DatePicker` (or `Input` with date type).

#### Scenario: Form opens in create mode
- **WHEN** the user clicks the "Add" button on the accounts screen
- **THEN** the Sheet opens with all fields blank (currency pre-filled with app default)

#### Scenario: Form opens in edit mode with existing values
- **WHEN** the user triggers edit for an existing account
- **THEN** the Sheet opens with all fields pre-populated with the account's current values

#### Scenario: Manage institutions link is accessible from the form
- **WHEN** the user clicks the "Manage" link beside the Institution field
- **THEN** the institution management dialog opens without closing the account form
