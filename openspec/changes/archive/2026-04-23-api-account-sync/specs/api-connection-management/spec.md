## ADDED Requirements

### Requirement: [F-API-01] institution_api_connection schema

The system SHALL store API connection metadata in an `institution_api_connection` table. A Drizzle migration MUST be generated.

```
institution_api_connection
  id              INTEGER  PK AUTOINCREMENT
  institution_id  INTEGER  NOT NULL  FK → institution.id
  api_type        TEXT     NOT NULL  -- e.g. 'starling'
  keychain_key    TEXT     NOT NULL  -- key used to retrieve PAT from OS keychain
  last_synced_at  TEXT               -- ISO datetime of last successful sync (nullable)
  created_at      TEXT     NOT NULL  -- ISO datetime
  updated_at      TEXT     NOT NULL  -- ISO datetime
```

#### Scenario: Migration creates institution_api_connection table
- **WHEN** the app opens a database that does not yet have the `institution_api_connection` table
- **THEN** the migration creates the table with all specified columns and no errors

#### Scenario: Migration is idempotent
- **WHEN** the migration is applied to a database that already has the table
- **THEN** no error is thrown and existing data is unchanged

---

### Requirement: [F-API-02] is_api_synced column on account

The `account` table SHALL have an `is_api_synced INTEGER NOT NULL DEFAULT 0` column. A Drizzle migration MUST add this column to the existing table.

#### Scenario: Migration adds is_api_synced column
- **WHEN** the migration runner executes on a database whose `account` table lacks `is_api_synced`
- **THEN** the column is added with `NOT NULL DEFAULT 0` and existing rows remain intact

---

### Requirement: [F-API-03] external_id column on transaction

The `transaction` table SHALL have an `external_id TEXT` (nullable) column to store the bank-provided unique transaction identifier. A Drizzle migration MUST add this column.

#### Scenario: Migration adds external_id column
- **WHEN** the migration runner executes on a database whose `transaction` table lacks `external_id`
- **THEN** the column is added as nullable and existing rows have `external_id = NULL`

---

### Requirement: [F-API-04] api_sync transaction_type seed

A new seed value `api_sync` SHALL be added to the `transaction_type` reference table. This value is used exclusively for transactions fetched via API sync.

#### Scenario: Seed is present after migration
- **WHEN** the database is initialised (new or migrated)
- **THEN** a row with `value = 'api_sync'` exists in `transaction_type`

---

### Requirement: [F-API-05] User can connect an institution via PAT

The system SHALL allow the user to connect an institution by entering a Personal Access Token (PAT). The PAT MUST be stored in the OS keychain — never in SQLite. A unique `keychain_key` SHALL be generated (e.g. `mymoney.starling.<institution_id>`) and stored in `institution_api_connection`.

UI layout (shadcn/ui `Dialog` + `Form` + `Input`):

```
┌──────────────────────────────────────┐
│  Connect Starling Bank               │
├──────────────────────────────────────┤
│  Personal Access Token               │
│  ┌────────────────────────────────┐  │
│  │ ••••••••••••••••••••••••       │  │
│  └────────────────────────────────┘  │
│  Your PAT is stored securely in      │
│  your OS keychain.                   │
│                                      │
│         [ Cancel ]  [ Connect ]      │
└──────────────────────────────────────┘
```

#### Scenario: PAT is stored in keychain on connect
- **WHEN** the user submits the connect form with a valid PAT
- **THEN** the PAT is stored in the OS keychain under the generated `keychain_key`
- **AND** a row is inserted into `institution_api_connection` with `api_type = 'starling'` and the `keychain_key`
- **AND** the PAT is not present in any SQLite column

#### Scenario: Empty PAT is rejected
- **WHEN** the user submits the connect form with an empty PAT field
- **THEN** an inline validation error is shown and no keychain entry is written

#### Scenario: Keychain write failure surfaces an error
- **WHEN** the OS keychain rejects the write (e.g. permission denied)
- **THEN** an error notification is shown to the user
- **AND** no `institution_api_connection` row is created

---

### Requirement: [F-API-06] User can update a PAT

The system SHALL allow the user to update the PAT for a connected institution. The new PAT MUST overwrite the existing keychain entry.

#### Scenario: PAT is updated in keychain
- **WHEN** the user submits the update PAT form with a new non-empty PAT
- **THEN** the keychain entry identified by `keychain_key` is overwritten with the new PAT
- **AND** `institution_api_connection.updated_at` is updated to the current datetime

#### Scenario: Empty PAT update is rejected
- **WHEN** the user submits the update PAT form with an empty value
- **THEN** an inline validation error is shown and the keychain entry is unchanged

---

### Requirement: [F-API-07] User can discover and select accounts to import

After connecting, the system SHALL call the institution API to discover available accounts and present them for the user to select which to import.

UI layout (shadcn/ui `Dialog` with `Checkbox` list):

```
┌──────────────────────────────────────┐
│  Select accounts to import           │
├──────────────────────────────────────┤
│  ☑  Personal Current Account         │
│  ☑  Joint Account                    │
│  ☐  Savings Account                  │
│                                      │
│  Selected accounts will be created   │
│  and synced immediately.             │
│                                      │
│         [ Cancel ]  [ Import ]       │
└──────────────────────────────────────┘
```

#### Scenario: Discovered accounts are listed for selection
- **WHEN** the institution API returns a list of accounts
- **THEN** all discovered accounts are shown with checkboxes (all pre-checked by default)
- **AND** the user can deselect any account before confirming

#### Scenario: Selected accounts are created in the database
- **WHEN** the user confirms the selection
- **THEN** each selected account is created in the `account` table with `is_api_synced = 1`
- **AND** no existing manually-created accounts are merged or overwritten

#### Scenario: API error during discovery is surfaced
- **WHEN** the institution API returns an error during account discovery
- **THEN** an error message is shown and the dialog remains open for retry or cancel

#### Scenario: Zero accounts selected is rejected
- **WHEN** the user deselects all accounts and clicks Import
- **THEN** a validation message prompts the user to select at least one account

---

### Requirement: [F-API-08] User can remove a synced account

The system SHALL allow the user to remove a synced account from the API Connections screen. Removal MUST hard-delete the account row and all its transactions. This is the only hard-delete path in the app.

#### Scenario: Account and transactions are hard-deleted on removal
- **WHEN** the user confirms removal of a synced account
- **THEN** the account row is deleted from the `account` table
- **AND** all `transaction` rows for that account are deleted
- **AND** the account no longer appears anywhere in the app

#### Scenario: User is prompted to confirm before deletion
- **WHEN** the user initiates account removal
- **THEN** a confirmation dialog clearly states that all data will be permanently deleted
- **AND** deletion only proceeds if the user explicitly confirms

---

### Requirement: [F-API-09] API Connections section in Settings

The Settings screen SHALL include an **API Connections** section listing all connected institutions. Each institution entry shows:
- Institution name
- Last synced datetime (or "Never synced")
- Update PAT button
- Re-sync button
- Per-account list with remove option

UI layout (shadcn/ui `Card` per institution inside Settings):

```
┌─────────────────────────────────────────────┐
│ API CONNECTIONS                             │
├─────────────────────────────────────────────┤
│  Starling Bank              Last sync: 2m ago│
│  ┌─────────────────────────────────────┐    │
│  │ Personal Current Account  [ Remove ]│    │
│  │ Joint Account             [ Remove ]│    │
│  └─────────────────────────────────────┘    │
│  [ Update PAT ]  [ Re-sync ]  [ Add account]│
│                                             │
│  [ + Connect an institution ]               │
└─────────────────────────────────────────────┘
```

#### Scenario: Connected institutions are listed in Settings
- **WHEN** the user navigates to Settings
- **THEN** all connected institutions are shown in the API Connections section
- **AND** each shows the institution name and last synced datetime

#### Scenario: No connections shows an empty state
- **WHEN** no institutions are connected
- **THEN** the API Connections section shows a prompt to connect an institution

---

### Requirement: [F-API-10] Unit tests for connection management commands

All Tauri commands relating to API connection management (create connection, update PAT, remove account) SHALL have Rust unit tests covering success and error paths.

#### Scenario: create_api_connection command is unit-tested
- **WHEN** tests are run
- **THEN** tests exist that verify PAT is stored in keychain and DB row is created

#### Scenario: remove_synced_account command is unit-tested
- **WHEN** tests are run
- **THEN** tests exist verifying account and transactions are hard-deleted

#### Scenario: E2E test covers connect institution flow
- **WHEN** e2e tests are run
- **THEN** a Playwright test navigates to Settings, connects Starling with a fixture PAT, and verifies the connection appears in the list
