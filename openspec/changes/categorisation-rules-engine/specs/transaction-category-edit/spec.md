## ADDED Requirements

### Requirement: [F-09] Category change shortcut — prompt to create a rule

When the user manually changes a transaction's category via the edit drawer, the app SHALL display a prompt after saving: *"Apply to future transactions like this?"*. The prompt SHALL offer three choices:

- **No** — save the category change only; no rule is created
- **Future transactions only** — create a categorisation rule and do not re-run the engine
- **All transactions** — create a categorisation rule and immediately re-run the engine against all non-void transactions

When the user selects "Future transactions only" or "All transactions", the rule builder form SHALL open, pre-populated as follows:
- Name: derived from the transaction's payee or notes (e.g. payee if present, else first 30 chars of notes)
- Condition: field=`description` (notes), operator=`contains`, value=the transaction's notes value
- Action: type=`assign_category`, category=the newly selected category

The user MAY edit the pre-populated values before saving the rule.

```
┌────────────────────────────────────────┐
│  Apply to future transactions?         │
├────────────────────────────────────────┤
│  You changed the category to           │
│  "Groceries".                          │
│                                        │
│  Create a rule to apply this           │
│  automatically?                        │
│                                        │
│  [No]  [Future only]  [All transactions]│
└────────────────────────────────────────┘
```

shadcn/ui components: `Dialog`, `Button`.

#### Scenario: No prompt shown if category was not changed
- **GIVEN** the user opens the edit drawer and saves without changing the category
- **THEN** no "Apply to future transactions?" prompt is shown

#### Scenario: Selecting No closes prompt without creating a rule
- **GIVEN** the user saves a category change
- **AND** the prompt is shown
- **WHEN** the user selects No
- **THEN** the prompt closes
- **AND** no categorisation rule is created

#### Scenario: Selecting Future only opens pre-populated rule builder
- **GIVEN** the user saves a category change to "Groceries" on a transaction with notes="TESCO STORES"
- **WHEN** the user selects "Future transactions only"
- **THEN** the rule builder form opens
- **AND** a condition is pre-populated: field=`description`, operator=`contains`, value=`TESCO STORES`
- **AND** an action is pre-populated: type=`assign_category`, category=`Groceries`
- **AND** saving the rule creates it without triggering a re-run

#### Scenario: Selecting All transactions opens rule builder then re-runs on save
- **GIVEN** the user saves a category change
- **WHEN** the user selects "All transactions"
- **THEN** the rule builder form opens pre-populated
- **AND** when the user saves the rule, the engine is immediately re-run against all non-void transactions
- **AND** a success toast shows the count of transactions categorised by the re-run

#### Scenario: User can edit pre-populated rule values before saving
- **GIVEN** the rule builder opens with pre-populated values from the category change shortcut
- **WHEN** the user edits the condition value or name
- **THEN** the edited values are used when the rule is saved

#### Scenario: Closing the rule builder from the shortcut flow does not create a rule
- **GIVEN** the rule builder opened via the category change shortcut
- **WHEN** the user clicks Cancel
- **THEN** no rule is created
- **AND** the category change on the original transaction is retained
