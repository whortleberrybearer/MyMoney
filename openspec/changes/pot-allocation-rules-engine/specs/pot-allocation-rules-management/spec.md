## ADDED Requirements

### Requirement: [F-12] Pot allocation rules database schema

The system SHALL store pot allocation rules in three tables: `pot_allocation_rule`, `pot_allocation_rule_condition`, and `pot_allocation_rule_action`. A Drizzle migration MUST be generated and added to the inlined migrations array in `src/lib/db/index.ts`.

```
pot_allocation_rule
  id          INTEGER  PK AUTOINCREMENT
  account_id  INTEGER  NOT NULL  FK → account.id
  name        TEXT     NOT NULL
  priority    INTEGER  NOT NULL
  is_active   INTEGER  NOT NULL  DEFAULT 1

pot_allocation_rule_condition
  id          INTEGER  PK AUTOINCREMENT
  rule_id     INTEGER  NOT NULL  FK → pot_allocation_rule.id
  field       TEXT     NOT NULL  -- description|reference|amount|transaction_type
  operator    TEXT     NOT NULL  -- contains|starts_with|equals|greater_than|less_than
  value       TEXT     NOT NULL

pot_allocation_rule_action
  id               INTEGER  PK AUTOINCREMENT
  rule_id          INTEGER  NOT NULL  FK → pot_allocation_rule.id
  pot_id           INTEGER  NOT NULL  FK → pot.id
  allocation_value REAL     NOT NULL
```

#### Scenario: Schema migration creates pot allocation rule tables
- **WHEN** the app opens a database that does not yet have the pot allocation rule tables
- **THEN** the migration creates all three tables with no errors

#### Scenario: Migration is idempotent
- **WHEN** the migration is applied to a database that already has the tables
- **THEN** no error is thrown and existing data is unchanged

---

### Requirement: [F-12] Rules tab within the account view lists pot allocation rules

The app SHALL display a **Rules** tab within the account view. The tab SHALL list all pot allocation rules scoped to that account in priority order (ascending `priority`). Each rule row SHALL show: rule name, a conditions summary, an active/inactive toggle, and Edit/Delete actions. Rules SHALL be reorderable via drag-and-drop. The tab SHALL include a **+ New Rule** button.

```
┌──────────────────────────────────────────────────────────────┐
│  [Transactions]  [Rules]                                     │
├──────────────────────────────────────────────────────────────┤
│  Pot Allocation Rules                      [+ New Rule]      │
├──────────────────────────────────────────────────────────────┤
│  ≡  Salary split  description contains "SALARY"  [●] [Edit][Del] │
│  ≡  Bonus         amount greater_than 1000        [○] [Edit][Del] │
└──────────────────────────────────────────────────────────────┘
```

shadcn/ui components: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, card list, `Switch`, `Button`, drag handle icon, `@dnd-kit/core` or equivalent for drag-and-drop.

#### Scenario: Rules tab displays rules in priority order
- **GIVEN** three rules with priority values 1, 2, 3 for the current account
- **WHEN** the Rules tab is opened
- **THEN** rules are listed top-to-bottom in ascending priority order

#### Scenario: Rules from other accounts are not shown
- **GIVEN** Account A has 2 rules and Account B has 1 rule
- **WHEN** the user views the Rules tab for Account A
- **THEN** only Account A's 2 rules are shown

#### Scenario: Empty state shown when no rules exist
- **GIVEN** no pot allocation rules exist for the account
- **WHEN** the Rules tab is opened
- **THEN** an empty state message is shown (e.g. "No rules yet — create one to get started")
- **AND** the "+ New Rule" button is visible

#### Scenario: Toggling a rule's is_active state saves immediately
- **GIVEN** a rule with `is_active = 1`
- **WHEN** the user clicks the toggle
- **THEN** the rule's `is_active` is set to 0
- **AND** the toggle reflects the new state without a page reload

#### Scenario: Dragging a rule to a new position updates priority
- **GIVEN** rules in order: A(1), B(2), C(3)
- **WHEN** the user drags rule C above rule A
- **THEN** the updated order is C, A, B
- **AND** all three rules' `priority` values are updated accordingly

---

### Requirement: [F-12] User can delete a pot allocation rule

The app SHALL allow the user to delete a pot allocation rule with a confirmation prompt. Deletion is hard delete — the rule row, all its condition rows, and all its action rows are permanently removed.

#### Scenario: Delete shows confirmation before removing
- **GIVEN** a rule exists in the list
- **WHEN** the user clicks Delete
- **THEN** a confirmation dialog is shown
- **AND** the rule is only deleted when the user confirms

#### Scenario: Confirmed deletion removes rule and its conditions and actions
- **GIVEN** a rule with 2 conditions and 3 actions
- **WHEN** the user confirms deletion
- **THEN** the rule row, all 2 condition rows, and all 3 action rows are deleted from the database

#### Scenario: Cancel leaves rule intact
- **GIVEN** the user clicks Delete and a confirmation dialog appears
- **WHEN** the user clicks Cancel
- **THEN** the rule is not deleted and remains in the list unchanged
