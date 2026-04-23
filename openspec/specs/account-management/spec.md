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

---

### Requirement: [F-02] Account create/edit form (Sheet)

The system SHALL present the account create and edit form as a Sheet (slide-in panel) containing all account fields. The form SHALL use controlled inputs with real-time validation feedback.

The tag field SHALL be a free-text combobox with autocomplete against existing tags. If the user types a name that does not match any existing tag and confirms, the tag SHALL be created automatically in the database. The combobox SHALL support clearing the selection (equivalent to "No tag").

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
│ [Search or create tag... ]      │
│  ┌──────────────────────────┐   │
│  │ Personal                 │   │
│  │ Joint                    │   │
│  │ Create "Family"          │   │  ← shown when no match
│  └──────────────────────────┘   │
│                                 │
│ Notes                           │
│ [_________________________]     │
│ [_________________________]     │
│                                 │
│          [Cancel] [Save]        │
└─────────────────────────────────┘
```

shadcn/ui components: `Sheet`, `SheetContent`, `Input`, `Select`, `Textarea`, `Button`, `Popover`, `Command` (for the tag combobox).

#### Scenario: Form opens in create mode
- **WHEN** the user clicks the "Add" button on the accounts screen
- **THEN** the Sheet opens with all fields blank (currency pre-filled with app default)
- **AND** the tag combobox is empty with placeholder text

#### Scenario: Form opens in edit mode with existing values
- **WHEN** the user triggers edit for an existing account
- **THEN** the Sheet opens with all fields pre-populated with the account's current values
- **AND** the tag combobox shows the account's currently assigned tag name (if any)

#### Scenario: Manage institutions link is accessible from the form
- **WHEN** the user clicks the "Manage" link beside the Institution field
- **THEN** the institution management dialog opens without closing the account form

#### Scenario: Tag combobox filters options as the user types
- **WHEN** the user types into the tag combobox field
- **THEN** the dropdown narrows to tags whose names contain the typed text (case-insensitive)

#### Scenario: Existing tag is selected from the combobox
- **WHEN** the user types a partial name and selects a matching tag from the dropdown
- **THEN** the tag combobox shows the selected tag name
- **AND** no new tag is created in the database

#### Scenario: New tag is created inline when the user confirms a non-matching name
- **WHEN** the user types a name that does not match any existing tag
- **AND** the user selects the "Create `<name>`" item that appears in the dropdown
- **THEN** the new tag is saved to the database immediately
- **AND** the tag combobox shows the new tag name as selected
- **AND** the profile selector is refreshed to include the new tag

#### Scenario: Tag can be cleared from the combobox
- **WHEN** the user has a tag selected in the combobox
- **AND** the user clears the field or selects "No tag"
- **THEN** the tag combobox reverts to its empty/placeholder state
- **AND** saving the account removes any existing `account_tag` row for this account

---

### Requirement: [F-05] Account list can be filtered by tag

The `listAccounts` data function SHALL accept an optional `tagId` parameter. When a `tagId` is provided, only accounts linked to that tag via `account_tag` SHALL be returned. When `tagId` is `null` or `undefined`, all accounts are returned (existing behaviour).

#### Scenario: listAccounts with a tagId returns only matching accounts
- **WHEN** `listAccounts` is called with `tagId = 2` (e.g. "Joint")
- **THEN** only accounts that have an `account_tag` row with `tag_id = 2` are returned

#### Scenario: listAccounts with no tagId returns all accounts
- **WHEN** `listAccounts` is called without a `tagId` (or with `tagId = null`)
- **THEN** all accounts are returned (subject to the `showInactive` flag)

#### Scenario: Tag filter and inactive filter are applied together
- **WHEN** `listAccounts` is called with `tagId = 1` and `showInactive = false`
- **THEN** only active accounts (is_active = 1) linked to tag 1 are returned

---

### Requirement: [F-API-17] API-sourced account fields are read-only in the UI

For accounts where `is_api_synced = 1`, the following fields SHALL be displayed as read-only and MUST NOT be editable via the account form: name, institution, account type, currency, opening balance, opening date. User-defined fields (notes, tags) remain editable.

#### Scenario: API-sourced account form shows read-only API fields
- **WHEN** the user opens an account form for an account with `is_api_synced = 1`
- **THEN** the name, institution, account type, currency, opening balance, and opening date fields are disabled (not interactive)
- **AND** the notes and tag fields remain editable

#### Scenario: Standard account fields remain fully editable
- **WHEN** the user opens an account form for an account with `is_api_synced = 0`
- **THEN** all fields are editable as normal

---

### Requirement: [F-API-18] API-sourced account cannot be deleted via standard account management

For accounts where `is_api_synced = 1`, the standard delete/deactivate action SHALL be hidden or disabled. Account removal is only available via the API Connections management screen.

#### Scenario: Delete option is hidden for API-synced accounts
- **WHEN** the user views an account with `is_api_synced = 1`
- **THEN** no delete or deactivate button is shown in the standard account management UI

#### Scenario: Standard delete remains available for non-synced accounts
- **WHEN** the user views an account with `is_api_synced = 0`
- **THEN** the delete/deactivate option is shown as normal

---

### Requirement: [F-API-19] API-sourced transaction fields are read-only in the UI

For transactions with `transaction_type = 'api_sync'`, API-provided fields (date, description, amount) SHALL be displayed as read-only. User-defined fields (notes, category, tags) remain editable.

#### Scenario: API-synced transaction form shows read-only API fields
- **WHEN** the user opens a transaction form for a transaction with `transaction_type = 'api_sync'`
- **THEN** the date, description, and amount fields are disabled
- **AND** the notes, category, and tag fields remain editable

#### Scenario: API-synced transactions cannot be voided
- **WHEN** the user views a transaction with `transaction_type = 'api_sync'`
- **THEN** no void action is available

---

### Requirement: [F-API-20] Unit tests for read-only enforcement

The read-only enforcement logic SHALL be covered by unit tests.

#### Scenario: AccountFormSheet renders disabled fields for API-synced accounts
- **WHEN** unit tests are run
- **THEN** a test verifies that the account form with `is_api_synced = 1` disables the correct fields

#### Scenario: E2E test verifies read-only account fields
- **WHEN** e2e tests are run
- **THEN** a Playwright test opens an API-synced account and asserts that name/institution fields are not editable
