## ADDED Requirements

### Requirement: [F-07] Import entry point — account selection and file routing

The app SHALL provide an import wizard as the shared entry point for all transaction file imports. The user SHALL select a target account, then pick a file. The app SHALL detect the file type by extension and route to the appropriate import handler (`.ofx` / `.qfx` → OFX import; `.csv` → CSV import). No institution selection or column mapping step is shown for OFX files.

```mermaid
flowchart TD
    A([User opens Import]) --> B[Select Account]
    B --> C[Pick File]
    C --> D{Extension?}
    D -- .ofx / .qfx --> E[OFX Import Handler]
    D -- .csv --> F[CSV Import Handler]
    D -- other --> G[Show error: unsupported file type]
    E --> H[Import Result Screen]
    F --> H
```

**Required:** Account selection, file picker accepting `.ofx`, `.qfx`, `.csv`

```
┌─────────────────────────────────────────┐
│  Import Transactions                    │
├─────────────────────────────────────────┤
│  Account *                              │
│  [Select account ▼                    ] │
│                                         │
│  File *                                 │
│  [No file selected        ] [Browse...] │
│                                         │
│  Supported: .ofx, .qfx, .csv           │
│                                         │
│                          [Cancel] [Next]│
└─────────────────────────────────────────┘
```

shadcn/ui components: `Select` (account picker), `Button`, `Dialog` or routed screen.

#### Scenario: User selects account and OFX file, proceeds to OFX handler
- **GIVEN** the import screen is open
- **WHEN** the user selects a valid account and picks a `.ofx` file
- **AND** clicks Next
- **THEN** the OFX import handler is invoked with the selected account ID and file path

#### Scenario: User selects account and QFX file, proceeds to OFX handler
- **GIVEN** the import screen is open
- **WHEN** the user selects a valid account and picks a `.qfx` file
- **AND** clicks Next
- **THEN** the OFX import handler is invoked (QFX is treated identically to OFX)

#### Scenario: User selects account and CSV file, proceeds to CSV handler
- **GIVEN** the import screen is open
- **WHEN** the user selects a valid account and picks a `.csv` file
- **AND** clicks Next
- **THEN** the CSV import handler is invoked with the selected account ID and file path

#### Scenario: Unsupported file type shows error
- **GIVEN** the import screen is open
- **WHEN** the user picks a file with an extension that is not `.ofx`, `.qfx`, or `.csv`
- **THEN** an inline error is shown stating the file type is not supported
- **AND** the Next button remains disabled

#### Scenario: Cannot proceed without account selection
- **GIVEN** the import screen is open
- **WHEN** no account has been selected
- **THEN** the Next button is disabled

#### Scenario: Cannot proceed without file selection
- **GIVEN** an account has been selected
- **WHEN** no file has been picked
- **THEN** the Next button is disabled

---

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

---

### Requirement: [F-07] OFX import — store transactions with extended schema

The OFX import command SHALL store imported transactions using the extended `transaction` schema. Each imported transaction SHALL have `type = 'imported'`. The `payee` column SHALL be populated from the OFX `<NAME>` field where present. The `notes` column SHALL be populated from the OFX `<MEMO>` field (existing behaviour). The `reference` column SHALL be populated from the OFX `<CHECKNUM>` field where present. The `running_balance` SHALL be recalculated for all affected account transactions after import completes (ordered by date ascending, id ascending as tiebreaker). `category_id` is left NULL on import (transactions start uncategorised).

The `description` column no longer exists on the `transaction` table; all bank description text maps to `notes`.

#### Scenario: OFX import populates payee from NAME field
- **GIVEN** an OFX file contains a transaction with `<NAME>Starbucks</NAME>`
- **WHEN** the user imports the file for an account
- **THEN** the imported transaction has `payee = 'Starbucks'`

#### Scenario: OFX import populates notes from MEMO field
- **GIVEN** an OFX file contains a transaction with `<MEMO>Coffee purchase</MEMO>`
- **WHEN** the user imports the file for an account
- **THEN** the imported transaction has `notes = 'Coffee purchase'`

#### Scenario: OFX import populates reference from CHECKNUM field
- **GIVEN** an OFX file contains a transaction with `<CHECKNUM>REF12345</CHECKNUM>`
- **WHEN** the user imports the file for an account
- **THEN** the imported transaction has `reference = 'REF12345'`

#### Scenario: Running balance is recalculated after OFX import
- **GIVEN** an account with existing transactions
- **WHEN** an OFX file is imported with new transactions
- **THEN** running balances for all transactions on or after the earliest imported date are recalculated

#### Scenario: OFX import with no NAME field leaves payee null
- **GIVEN** an OFX file contains a transaction with no `<NAME>` element
- **WHEN** the user imports the file
- **THEN** the imported transaction has `payee = NULL`
