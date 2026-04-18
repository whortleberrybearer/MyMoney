## ADDED Requirements

### Requirement: [F-10] Rules management screen lists all rules with reorder and toggle

The app SHALL provide a rules management screen that displays all categorisation rules in priority order (ascending `sort_order`). Each rule row SHALL show the rule name, an enabled/disabled toggle, and Edit/Delete actions. Rules SHALL be reorderable via drag-and-drop; dropping a rule in a new position immediately updates all affected `sort_order` values. The screen SHALL include a button to create a new rule (opens the rule builder) and a button to manually re-run the engine against all transactions.

```
┌─────────────────────────────────────────────────────────┐
│  Categorisation Rules                  [+ New Rule]     │
├─────────────────────────────────────────────────────────┤
│  ≡  Starbucks → Coffee         [●] Active  [Edit][Del]  │
│  ≡  Amazon → Shopping          [●] Active  [Edit][Del]  │
│  ≡  Salary credit → Income     [○] Off     [Edit][Del]  │
├─────────────────────────────────────────────────────────┤
│                         [Re-run rules on all transactions]│
└─────────────────────────────────────────────────────────┘
```

shadcn/ui components: `Table` or card list, `Switch` (toggle), `Button`, drag handle icon, drag-and-drop via `@dnd-kit/core` or equivalent.

#### Scenario: Rules are displayed in sort_order priority sequence
- **GIVEN** three rules with sort_order values 1, 2, 3
- **WHEN** the rules management screen loads
- **THEN** rules are listed top-to-bottom in ascending sort_order order

#### Scenario: Toggling a rule's is_active state saves immediately
- **GIVEN** a rule with `is_active = 1`
- **WHEN** the user clicks the toggle
- **THEN** the rule's `is_active` is set to 0
- **AND** the toggle reflects the new state without a page reload

#### Scenario: Dragging a rule to a new position updates priority
- **GIVEN** rules in order: A(1), B(2), C(3)
- **WHEN** the user drags rule C above rule A
- **THEN** the updated order is C, A, B
- **AND** all three rules' sort_order values are updated accordingly
- **AND** the list re-renders in the new order

#### Scenario: Deleting a rule shows confirmation before removing
- **GIVEN** a rule exists in the list
- **WHEN** the user clicks Delete
- **THEN** a confirmation dialog is shown
- **AND** the rule is only deleted when the user confirms

#### Scenario: Deleting a rule removes its conditions and actions
- **GIVEN** a rule with associated conditions and actions
- **WHEN** the user confirms deletion
- **THEN** the rule, all its conditions, and all its actions are deleted from the database

#### Scenario: Empty state shown when no rules exist
- **GIVEN** no categorisation rules have been created
- **WHEN** the rules management screen loads
- **THEN** an empty state message is shown (e.g. "No rules yet — create one to get started")
- **AND** the "New Rule" button is visible

#### Scenario: Re-run button triggers engine on all transactions
- **GIVEN** one or more active rules exist
- **WHEN** the user clicks "Re-run rules on all transactions"
- **THEN** a confirmation dialog is shown warning that existing categories will be overwritten
- **AND** on confirmation, the engine re-runs against all non-void transactions
- **AND** a success toast shows the count of transactions categorised

#### Scenario: Re-run confirmation can be cancelled
- **GIVEN** the user clicks "Re-run rules on all transactions"
- **WHEN** the confirmation dialog is shown
- **AND** the user clicks Cancel
- **THEN** no re-run occurs and no data is modified
