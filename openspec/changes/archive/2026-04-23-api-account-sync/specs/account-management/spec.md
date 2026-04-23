## ADDED Requirements

### Requirement: [F-API-17] API-sourced account fields are read-only in the UI

For accounts where `is_api_synced = 1`, the following fields SHALL be displayed as read-only and MUST NOT be editable via the account form: name, institution, account type, currency, opening balance, opening date. User-defined fields (notes, tags) remain editable.

#### Scenario: API-sourced account form shows read-only API fields
- **WHEN** the user opens an account form for an account with `is_api_synced = 1`
- **THEN** the name, institution, account type, currency, opening balance, and opening date fields are disabled (not interactive)
- **AND** the notes and tag fields remain editable

#### Scenario: Standard account fields remain fully editable
- **WHEN** the user opens an account form for an account with `is_api_synced = 0`
- **THEN** all fields are editable as normal

---

### Requirement: [F-API-18] API-sourced account cannot be deleted via standard account management

For accounts where `is_api_synced = 1`, the standard delete/deactivate action SHALL be hidden or disabled. Account removal is only available via the API Connections management screen.

#### Scenario: Delete option is hidden for API-synced accounts
- **WHEN** the user views an account with `is_api_synced = 1`
- **THEN** no delete or deactivate button is shown in the standard account management UI

#### Scenario: Standard delete remains available for non-synced accounts
- **WHEN** the user views an account with `is_api_synced = 0`
- **THEN** the delete/deactivate option is shown as normal

---

### Requirement: [F-API-19] API-sourced transaction fields are read-only in the UI

For transactions with `transaction_type = 'api_sync'`, API-provided fields (date, description, amount) SHALL be displayed as read-only. User-defined fields (notes, category, tags) remain editable.

#### Scenario: API-synced transaction form shows read-only API fields
- **WHEN** the user opens a transaction form for a transaction with `transaction_type = 'api_sync'`
- **THEN** the date, description, and amount fields are disabled
- **AND** the notes, category, and tag fields remain editable

#### Scenario: API-synced transactions cannot be voided
- **WHEN** the user views a transaction with `transaction_type = 'api_sync'`
- **THEN** no void action is available

---

### Requirement: [F-API-20] Unit tests for read-only enforcement

The read-only enforcement logic SHALL be covered by unit tests.

#### Scenario: AccountFormSheet renders disabled fields for API-synced accounts
- **WHEN** unit tests are run
- **THEN** a test verifies that the account form with `is_api_synced = 1` disables the correct fields

#### Scenario: E2E test verifies read-only account fields
- **WHEN** e2e tests are run
- **THEN** a Playwright test opens an API-synced account and asserts that name/institution fields are not editable
