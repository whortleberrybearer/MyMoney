## ADDED Requirements

### Requirement: [F-12] Pot allocation rule builder form creates and edits rules

The app SHALL provide a rule builder form (Sheet) for creating and editing pot allocation rules. The form SHALL include:
- A **name** field (required, text)
- One or more **condition rows** — each with field selector, operator selector, and value input
- One or more **action rows** — each with a target pot selector and a fixed allocation amount input
- **Add Condition** and **Add Pot** buttons to append additional rows
- A **Remove** (×) button on each condition and action row (at least one condition and one action must remain)
- **Save** and **Cancel** buttons

When opened for edit, all existing values are pre-populated. When opened for create, the form opens with one empty condition row and one empty action row.

The operator options available for a condition are filtered by the selected field:
- `amount` field → `equals`, `greater_than`, `less_than`
- All other fields → `contains`, `starts_with`, `equals`

```
┌─────────────────────────────────────────────────────┐
│  New Pot Allocation Rule                        [X] │
├─────────────────────────────────────────────────────┤
│  Name *                                             │
│  [____________________________________]             │
│                                                     │
│  Conditions (all must match)                        │
│  [Description ▼] [contains   ▼] [SALARY      ] [×] │
│  [Amount     ▼] [greater_than▼] [1000         ] [×] │
│                                    [+ Condition]   │
│                                                     │
│  Pot Actions                                        │
│  [Holiday pot ▼] [£ 200.00  ] [×]                  │
│  [Rainy day   ▼] [£ 100.00  ] [×]                  │
│                                       [+ Add Pot]  │
│                                                     │
│                              [Cancel]      [Save]   │
└─────────────────────────────────────────────────────┘
```

shadcn/ui components: `Sheet`, `SheetContent`, `Input`, `Select` (field, operator), `Combobox` (pot selector), `Button`, `Label`, `Form`.

#### Scenario: Save is disabled until name, one condition, and one action are all provided
- **GIVEN** the rule builder form is open
- **WHEN** any of: name is empty, condition is incomplete, or action is incomplete
- **THEN** the Save button is disabled

#### Scenario: Creating a rule saves it as the lowest priority for the account
- **GIVEN** the account has two existing rules with priority 1 and 2
- **WHEN** the user creates a new rule and saves
- **THEN** the new rule is saved with priority = 3 (appended to the end)

#### Scenario: Editing a rule updates existing values
- **GIVEN** an existing rule named "Salary split"
- **WHEN** the user opens the edit form, changes the name to "Salary allocation", and saves
- **THEN** the rule name is updated to "Salary allocation"
- **AND** priority and is_active are unchanged

#### Scenario: Adding a condition row appends an empty row
- **GIVEN** the form has one condition row
- **WHEN** the user clicks "+ Condition"
- **THEN** a new empty condition row is added below the existing one

#### Scenario: Adding a pot action row appends an empty row
- **GIVEN** the form has one action row
- **WHEN** the user clicks "+ Add Pot"
- **THEN** a new empty action row is added below the existing one

#### Scenario: Removing the only condition row is not allowed
- **GIVEN** the form has exactly one condition row
- **WHEN** the user inspects the × button on that row
- **THEN** the × button is disabled or not shown

#### Scenario: Removing the only action row is not allowed
- **GIVEN** the form has exactly one action row
- **WHEN** the user inspects the × button on that row
- **THEN** the × button is disabled or not shown

#### Scenario: Operator options are filtered by field type
- **GIVEN** the user selects `amount` as the condition field
- **THEN** only `equals`, `greater_than`, `less_than` are available as operators
- **AND** `contains` and `starts_with` are not shown

#### Scenario: Pot selector shows only active pots belonging to the account
- **GIVEN** the account has 3 active pots and 1 closed pot
- **WHEN** the user opens the pot selector in an action row
- **THEN** only the 3 active pots are shown
- **AND** the closed pot is not shown

#### Scenario: Allocation amount must be a positive number
- **GIVEN** the user enters a non-positive or non-numeric value in an action amount field
- **WHEN** the user attempts to save
- **THEN** an inline validation error is shown and the rule is not saved
