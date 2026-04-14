## MODIFIED Requirements

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

## ADDED Requirements

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
