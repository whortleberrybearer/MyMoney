## MODIFIED Requirements

### Requirement: [F-07] Import result screen shows categorisation and allocation summary

The import result screen SHALL display counts for: total rows, imported, duplicate candidates, categorised, uncategorised, and pot allocations. It SHALL also display an allocation failures section when one or more pot allocation rules were blocked due to insufficient balance. Each failure entry SHALL include the rule name and the pot(s) that could not be allocated to. If no failures occurred, the allocation failures section SHALL not be shown.

```
┌─────────────────────────────────────────┐
│  Import Complete                        │
├─────────────────────────────────────────┤
│                                         │
│  ✓ Import finished                      │
│                                         │
│  Total rows          42                 │
│  Imported            39                 │
│  Duplicate candidates  2                │
│  Categorised          34                │
│  Uncategorised         5                │
│  Pot allocations        3               │
│                                         │
│  ⚠ Allocation failures (1)              │
│  Rule 'Salary split' — insufficient     │
│  balance for Holiday pot                │
│                                         │
│                               [Done]   │
└─────────────────────────────────────────┘
```

shadcn/ui components: `Card` or summary list, `Alert`, `Button`.

#### Scenario: Result screen shows correct counts after import with rules applied
- **GIVEN** an OFX file with 42 transactions has been imported
- **AND** 2 FITIDs matched existing records (duplicate candidates)
- **AND** the categorisation rules engine categorised 34 of the 39 imported transactions
- **AND** 5 imported transactions matched no active categorisation rule
- **AND** 3 pot allocation virtual transfer pairs were created
- **THEN** the result screen shows: total 42, imported 39, duplicate candidates 2, categorised 34, uncategorised 5, pot allocations 3

#### Scenario: Result screen shows zero duplicates when all transactions are new
- **GIVEN** an OFX file where no FITIDs exist in the database
- **WHEN** the import completes
- **THEN** the result screen shows duplicate candidates as 0

#### Scenario: Result screen shows all uncategorised when no categorisation rules exist
- **GIVEN** no active categorisation rules are defined
- **WHEN** an import completes with 10 transactions
- **THEN** the result screen shows categorised as 0 and uncategorised as 10

#### Scenario: Done button returns to dashboard
- **GIVEN** the result screen is visible
- **WHEN** the user clicks Done
- **THEN** the app navigates back to the dashboard

#### Scenario: Categorisation rules engine runs automatically after every import
- **GIVEN** at least one active categorisation rule exists
- **WHEN** any import (OFX or CSV) completes
- **THEN** the categorisation rules engine runs against the newly imported transactions before the result screen is shown
- **AND** transactions matching a rule have their category_id updated accordingly

#### Scenario: Pot allocation rules engine runs after categorisation engine
- **GIVEN** at least one active pot allocation rule exists for the imported account
- **WHEN** any import completes
- **THEN** the pot allocation rules engine runs against the newly imported transactions after the categorisation engine
- **AND** virtual transfer pairs are created for matching transactions

#### Scenario: Allocation failures are shown on the result screen
- **GIVEN** a rule named "Salary split" was blocked due to insufficient balance for "Holiday pot"
- **WHEN** the import result screen is shown
- **THEN** an allocation failures section is displayed listing "Rule 'Salary split' — insufficient balance for Holiday pot"

#### Scenario: No allocation failures section when no rules were blocked
- **GIVEN** all pot allocation rules that fired completed without balance failures
- **WHEN** the import result screen is shown
- **THEN** no allocation failures section is displayed
