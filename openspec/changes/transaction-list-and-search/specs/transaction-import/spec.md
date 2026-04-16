## MODIFIED Requirements

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
