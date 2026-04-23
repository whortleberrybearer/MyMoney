## ADDED Requirements

### Requirement: [F-API-21] CSV import is blocked for API-connected institution accounts

The system SHALL prevent CSV import for any account whose institution has an active `institution_api_connection` row. The import UI MUST be disabled and the Tauri command MUST guard against this at the command level.

#### Scenario: CSV import button is disabled for API-synced institution accounts
- **WHEN** the user views an account whose institution is connected via API
- **THEN** the CSV import button/action is hidden or disabled with an explanatory tooltip
- **AND** no CSV import dialog can be opened for that account

#### Scenario: import_csv_transactions command rejects API-synced accounts
- **WHEN** `import_csv_transactions` is called with an account ID whose institution has an active API connection
- **THEN** the command returns an error without importing any transactions

#### Scenario: CSV import remains available for non-API-connected institutions
- **WHEN** the user views an account whose institution has no API connection
- **THEN** the CSV import action is available as normal

---

### Requirement: [F-API-22] Unit tests for CSV import guard

The CSV import block for API-connected institution accounts SHALL be covered by Rust unit tests.

#### Scenario: import_csv_transactions command is unit-tested for API-connected rejection
- **WHEN** unit tests are run
- **THEN** a test verifies the command returns an error when the account's institution has an active API connection

#### Scenario: E2E test verifies CSV import is disabled for API accounts
- **WHEN** e2e tests are run
- **THEN** a Playwright test navigates to an API-synced account and asserts the import button is disabled
