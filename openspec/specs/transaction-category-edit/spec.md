## ADDED Requirements

### Requirement: [F-09] Category field in transaction edit drawer is a searchable dropdown

The transaction create and edit form (side drawer) SHALL present the category field as a searchable combobox. The user SHALL be able to type to filter the list of categories. `Uncategorised` SHALL always be available as a selection, allowing the user to explicitly clear a category assignment. The combobox SHALL display all categories including `Uncategorised`.

```
┌─────────────────────────────────────────────┐
│  Edit Transaction                           │
├─────────────────────────────────────────────┤
│  Date         [2024-03-15               ]   │
│  Amount       [-3.50                    ]   │
│  Payee        [Starbucks                ]   │
│  Notes        [Coffee                   ]   │
│  Reference    [                         ]   │
│  Category     [Groceries            ▼   ]   │
│               ┌─────────────────────────┐   │
│               │ 🔍 Search categories... │   │
│               ├─────────────────────────┤   │
│               │ ✓ Groceries             │   │
│               │   Food                  │   │
│               │   Uncategorised         │   │
│               └─────────────────────────┘   │
│                                             │
│  [Cancel]                       [Save]      │
└─────────────────────────────────────────────┘
```

shadcn/ui components: `Sheet`, `Command`, `Popover`, `Button`, `Input`, `Label`.

#### Scenario: Category combobox shows all categories
- **GIVEN** the transaction edit drawer is open
- **WHEN** the user clicks the category combobox
- **THEN** a searchable list of all categories is shown
- **AND** `Uncategorised` is included in the list

#### Scenario: Typing filters the category list
- **GIVEN** the category combobox is open
- **WHEN** the user types a partial category name
- **THEN** only categories whose names contain the typed text (case-insensitive) are shown

#### Scenario: Selecting a category saves the value
- **GIVEN** the category combobox is open
- **WHEN** the user selects a category
- **THEN** the combobox closes and the selected category name is shown
- **AND** submitting the form saves the selected `category_id` to the transaction

#### Scenario: Selecting Uncategorised clears the category
- **GIVEN** a transaction has a category assigned
- **WHEN** the user selects `Uncategorised` from the combobox and saves
- **THEN** the transaction's `category_id` is set to the `Uncategorised` category's id
- **AND** the transaction row in the list shows the category as blank (or `Uncategorised`)

#### Scenario: Category combobox pre-selects current value when editing
- **GIVEN** a transaction with category "Groceries" is being edited
- **WHEN** the edit drawer opens
- **THEN** the category combobox shows "Groceries" as the current selection

#### Scenario: Category field is available when creating a manual transaction
- **WHEN** the user opens the Add Transaction drawer
- **THEN** the category combobox is present and defaults to no selection (treated as Uncategorised)
