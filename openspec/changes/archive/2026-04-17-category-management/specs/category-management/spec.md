## ADDED Requirements

### Requirement: [F-09] Category list is displayed in Settings

The app SHALL display a Category Management section on the Settings screen. The section SHALL list all categories in alphabetical order. Each category row SHALL show the category name. The `Uncategorised` system category SHALL be visually indicated as a system category and its delete action SHALL be disabled.

```
┌──────────────────────────────────────────────┐
│  Settings                                    │
├──────────────────────────────────────────────┤
│  Data file                                   │
│  ...                                         │
│                                              │
│  CATEGORIES                   [+ Add]        │
│  ┌────────────────────────────────────┐      │
│  │ Bills                     [Delete] │      │
│  │ Charity                   [Delete] │      │
│  │ Clothing                  [Delete] │      │
│  │ ...                                │      │
│  │ Uncategorised (system)    [——]     │      │
│  └────────────────────────────────────┘      │
└──────────────────────────────────────────────┘
```

shadcn/ui components: `Button`, `Dialog`, `AlertDialog`, `Input`, `Command`, `Popover`.

#### Scenario: Settings screen shows all categories alphabetically
- **WHEN** the user navigates to the Settings screen
- **THEN** the Categories section is visible
- **AND** all categories are listed in ascending alphabetical order
- **AND** the `Uncategorised` category is shown with a system indicator
- **AND** the delete button for `Uncategorised` is disabled

#### Scenario: Seeded categories are visible on first open
- **GIVEN** the app has just been opened with a fresh data file
- **WHEN** the user navigates to the Settings screen
- **THEN** all 30 seeded categories are listed in the Categories section

---

### Requirement: [F-09] User can add a new category

The app SHALL allow the user to add a new category by entering a name. Category names MUST be unique (case-insensitive). The new category SHALL appear immediately in the list after creation.

#### Scenario: Successful category creation
- **WHEN** the user clicks "Add" and enters a unique name and confirms
- **THEN** the new category is persisted to the `category` table
- **AND** the category list refreshes to include the new category in alphabetical order

#### Scenario: Duplicate category name is rejected
- **WHEN** the user enters a name that already exists (case-insensitive)
- **THEN** an inline error is shown and the category is not saved

#### Scenario: Blank name is rejected
- **WHEN** the user submits the add form with an empty or whitespace-only name
- **THEN** an inline validation error is shown and the category is not saved

---

### Requirement: [F-09] User can delete a category not in use

The app SHALL allow the user to delete a category that is not assigned to any non-voided transactions. A confirmation dialog MUST be shown before deletion.

#### Scenario: Delete confirmation shown for unused category
- **GIVEN** the category has no transactions assigned to it
- **WHEN** the user clicks Delete on a category
- **THEN** a confirmation dialog is shown asking the user to confirm deletion

#### Scenario: Category is deleted after confirmation
- **GIVEN** the confirmation dialog is shown
- **WHEN** the user confirms deletion
- **THEN** the category row is removed from the `category` table
- **AND** the category no longer appears in the list

#### Scenario: User cancels deletion
- **GIVEN** the confirmation dialog is shown
- **WHEN** the user cancels
- **THEN** the category is not deleted and the list is unchanged

---

### Requirement: [F-09] User must select a replacement when deleting a category in use

The app SHALL detect when a category is assigned to one or more non-voided transactions. In this case the user MUST select a replacement category before deletion proceeds. On confirmation, all transactions referencing the deleted category SHALL be reassigned to the replacement, then the category SHALL be deleted.

```
┌─────────────────────────────────────────────┐
│  Delete "Food"                              │
├─────────────────────────────────────────────┤
│  "Food" is assigned to 14 transactions.     │
│  Choose a replacement category:             │
│                                             │
│  [Groceries                             ▼]  │
│                                             │
│  [Cancel]                     [Confirm]     │
└─────────────────────────────────────────────┘
```

The replacement picker SHALL show all categories except the one being deleted. `Uncategorised` SHALL be a valid replacement target.

#### Scenario: In-use category triggers replacement picker
- **GIVEN** the category is assigned to one or more non-voided transactions
- **WHEN** the user clicks Delete on the category
- **THEN** a dialog is shown informing the user how many transactions reference the category
- **AND** a dropdown allows the user to select a replacement category
- **AND** the category being deleted is NOT shown as an option in the replacement picker

#### Scenario: Transactions are reassigned on confirmation
- **GIVEN** the replacement picker dialog is shown with a replacement selected
- **WHEN** the user clicks Confirm
- **THEN** all transactions previously assigned to the deleted category have their `category_id` updated to the replacement category's id
- **AND** the deleted category's row is removed from the `category` table
- **AND** the category no longer appears in the list

#### Scenario: Uncategorised is a valid replacement target
- **GIVEN** the user is deleting a category that is in use
- **WHEN** the replacement picker is shown
- **THEN** `Uncategorised` is available as a replacement option

#### Scenario: Replacement picker requires a selection before confirming
- **GIVEN** the replacement picker dialog is open
- **WHEN** no replacement category is selected
- **THEN** the Confirm button is disabled

---

### Requirement: [F-09] System category cannot be deleted

The app SHALL prevent deletion of any category with `is_system = 1`. The delete action SHALL be visually disabled for system categories.

#### Scenario: Delete action is disabled for Uncategorised
- **WHEN** the category list is displayed
- **THEN** the Delete button for `Uncategorised` is disabled and non-interactive
