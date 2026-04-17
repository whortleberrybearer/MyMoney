## ADDED Requirements

### Requirement: [F-10] Rule builder form creates and edits rules with conditions and actions

The app SHALL provide a rule builder form (sheet or dialog) for creating and editing categorisation rules. The form SHALL include:
- A **name** field (required, text)
- One or more **condition rows** — each with field selector, operator selector, and value input
- One or more **action rows** — each with action type selector and a type-dependent value input
- **Add Condition** and **Add Action** buttons to insert additional rows
- **Remove** (×) button on each condition and action row (at least one condition and one action must remain)
- **Save** and **Cancel** buttons

When opened for edit, all existing values are pre-populated. When opened for create (including from the Uncategorised Review Screen), the form opens blank with one empty condition row and one empty action row.

The operator options available for a condition are filtered by the selected field:
- `amount` field → `equals`, `greater_than`, `less_than`
- All other fields → `contains`, `starts_with`, `equals`

```
┌─────────────────────────────────────────────────────┐
│  New Rule                                           │
├─────────────────────────────────────────────────────┤
│  Name *   [Starbucks Coffee                      ]  │
│                                                     │
│  Conditions (all must match)                        │
│  [Description ▼] [contains   ▼] [Starbucks    ] [×]│
│  [Amount     ▼] [less_than  ▼] [0             ] [×]│
│                                      [+ Condition] │
│                                                     │
│  Actions                                            │
│  [Assign category ▼] [Coffee & Dining          ] [×]│
│                                         [+ Action] │
│                                                     │
│                              [Cancel]      [Save]   │
└─────────────────────────────────────────────────────┘
```

shadcn/ui components: `Sheet` or `Dialog`, `Input`, `Select` (field, operator, action type), `CategoryCombobox` (reuse existing), `Button`, `Label`, `Form`.

#### Scenario: Save is disabled until name, one condition, and one action are all provided
- **GIVEN** the rule builder form is open
- **WHEN** any of: name is empty, condition is incomplete, or action is incomplete
- **THEN** the Save button is disabled

#### Scenario: Creating a rule saves it as the lowest priority
- **GIVEN** two existing rules with sort_order 1 and 2
- **WHEN** the user creates a new rule and saves
- **THEN** the new rule is saved with sort_order = 3 (appended to the end)

#### Scenario: Editing a rule updates existing values
- **GIVEN** an existing rule with name "Starbucks"
- **WHEN** the user opens the edit form, changes the name to "Starbucks Coffee", and saves
- **THEN** the rule name is updated to "Starbucks Coffee"
- **AND** sort_order and is_active are unchanged

#### Scenario: Adding a condition row appends an empty row
- **GIVEN** the form has one condition row
- **WHEN** the user clicks "+ Condition"
- **THEN** a new empty condition row is added below the existing one

#### Scenario: Removing the only condition row is not allowed
- **GIVEN** the form has exactly one condition row
- **WHEN** the user inspects the × button on that row
- **THEN** the × button is disabled or not shown

#### Scenario: Removing the only action row is not allowed
- **GIVEN** the form has exactly one action row
- **WHEN** the user inspects the × button on that row
- **THEN** the × button is disabled or not shown

#### Scenario: Selecting "Assign category" action shows category picker
- **GIVEN** an action row with type = `Assign category`
- **THEN** a category combobox is shown (reusing the existing CategoryCombobox component)

#### Scenario: Selecting "Set note" action shows text input
- **GIVEN** an action row with type = `Set note`
- **THEN** a text input is shown for the note value

#### Scenario: Operator options are filtered by field type
- **GIVEN** the user selects `amount` as the condition field
- **THEN** only `equals`, `greater_than`, `less_than` are available as operators
- **AND** `contains` and `starts_with` are not shown

#### Scenario: Form opened from Uncategorised Review Screen is blank
- **GIVEN** the user navigates to rule creation from the Uncategorised Review Screen
- **WHEN** the rule builder form opens
- **THEN** the name field is empty
- **AND** one empty condition row is present with no pre-filled values
- **AND** one empty action row is present with no pre-filled values
