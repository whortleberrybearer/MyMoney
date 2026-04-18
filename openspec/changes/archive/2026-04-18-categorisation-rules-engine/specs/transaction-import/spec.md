## MODIFIED Requirements

### Requirement: [F-07] Import result screen

The app SHALL display a result summary after a successful import. The summary SHALL show: total rows in file, number imported, number flagged as duplicate candidates, and number of categorised transactions (assigned a non-Uncategorised category by the rules engine). The screen SHALL include a button to close and return to the dashboard. The rules engine SHALL run automatically after each import, immediately after transactions are parsed and saved; the result counts SHALL reflect the engine's output.

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
│                                         │
│                               [Done]   │
└─────────────────────────────────────────┘
```

shadcn/ui components: `Card` or summary list, `Button`.

#### Scenario: Result screen shows correct counts after import with rules applied
- **GIVEN** an OFX file with 42 transactions has been imported
- **AND** 2 FITIDs matched existing records (duplicate candidates)
- **AND** the rules engine categorised 34 of the 39 imported transactions
- **AND** 5 imported transactions matched no active rule
- **THEN** the result screen shows: total 42, imported 39, duplicate candidates 2, categorised 34, uncategorised 5

#### Scenario: Result screen shows zero duplicates when all transactions are new
- **GIVEN** an OFX file where no FITIDs exist in the database
- **WHEN** the import completes
- **THEN** the result screen shows duplicate candidates as 0

#### Scenario: Result screen shows all uncategorised when no rules exist
- **GIVEN** no active categorisation rules are defined
- **WHEN** an import completes with 10 transactions
- **THEN** the result screen shows categorised as 0 and uncategorised as 10

#### Scenario: Done button returns to dashboard
- **GIVEN** the result screen is visible
- **WHEN** the user clicks Done
- **THEN** the app navigates back to the dashboard

#### Scenario: Rules engine runs automatically after every import
- **GIVEN** at least one active categorisation rule exists
- **WHEN** any import (OFX or CSV) completes
- **THEN** the rules engine runs against the newly imported transactions before the result screen is shown
- **AND** transactions matching a rule have their category_id updated accordingly
