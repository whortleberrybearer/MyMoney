## 1. Database Schema & Migration

- [x] 1.1 Add Drizzle schema for `institution_api_connection` table (id, institution_id, api_type, keychain_key, last_synced_at, created_at, updated_at)
- [x] 1.2 Add `is_api_synced INTEGER NOT NULL DEFAULT 0` column to Drizzle `account` schema
- [x] 1.3 Add `external_id TEXT` (nullable) column to Drizzle `transaction` schema
- [x] 1.4 Add `api_sync` seed value to `transaction_type` reference data
- [x] 1.5 Generate Drizzle migration and add it to the inlined migrations array in `src/lib/db/index.ts`
- [x] 1.6 Write integration tests verifying the migration runs cleanly on a fresh and existing database

## 2. Rust Dependencies & Keychain Integration

- [x] 2.1 Add `tauri-plugin-keyring` to `Cargo.toml` and register it in `src-tauri/src/lib.rs`
- [x] 2.2 Add `reqwest` (async, with `tokio` runtime) to `Cargo.toml`
- [x] 2.3 Implement `get_keychain_secret(key: &str)` and `set_keychain_secret(key: &str, value: &str)` helpers in a new `src-tauri/src/keychain.rs` module
- [x] 2.4 Write unit tests for keychain helper using a mock keyring backend

## 3. Starling API Integration Trait & Handler

- [x] 3.1 Define `ApiIntegration` Rust trait with `discover_accounts` and `fetch_transactions` methods in `src-tauri/src/api/mod.rs`
- [x] 3.2 Implement `StarlingIntegration` struct in `src-tauri/src/api/starling.rs` using `reqwest` for HTTP calls
- [x] 3.3 Implement Starling account → MyMoney account mapper (name, currency, account_type)
- [x] 3.4 Implement Starling transaction → MyMoney transaction mapper (external_id, date, amount sign, description)
- [x] 3.5 Write unit tests for account mapper covering all field translations
- [x] 3.6 Write unit tests for transaction mapper covering credit (positive) and debit (negative) amount logic
- [x] 3.7 Write unit tests for unknown account type fallback behaviour

## 4. Sync Tauri Command

- [x] 4.1 Implement `sync_starling_accounts(connection_id)` Tauri command in `src-tauri/src/commands/`
- [x] 4.2 Implement initial sync logic: fetch 1 year of transactions when `last_synced_at` is NULL
- [x] 4.3 Implement subsequent sync logic: fetch from `last_synced_at` to now
- [x] 4.4 Implement upsert-by-external_id: insert new, overwrite changed (preserving notes/category/tags), skip unchanged
- [x] 4.5 Emit `api-sync-progress` Tauri events during sync (per account, with transaction count)
- [x] 4.6 Call categorisation rules engine on newly inserted/updated transactions
- [x] 4.7 Recalculate running balances for affected accounts after sync
- [x] 4.8 Update `institution_api_connection.last_synced_at` on success
- [x] 4.9 Register `sync_starling_accounts` in `lib.rs` invoke handler
- [x] 4.10 Write unit tests for sync command with mock HTTP responses (new transactions, overwrite, skip unchanged)
- [x] 4.11 Write unit test verifying user-defined fields (notes, category) are preserved on overwrite
- [x] 4.12 Write integration tests for sync command against a real SQLite test database

## 5. Connection Management Tauri Commands

- [x] 5.1 Implement `create_api_connection(institution_id, api_type, pat)` command: generate `keychain_key`, store PAT in keychain, insert `institution_api_connection` row
- [x] 5.2 Implement `update_api_connection_pat(connection_id, new_pat)` command: overwrite keychain entry, update `updated_at`
- [x] 5.3 Implement `discover_starling_accounts(connection_id)` command: retrieve PAT from keychain, call Starling API, return account list
- [x] 5.4 Implement `create_synced_accounts(connection_id, selected_accounts[])` command: create `account` rows with `is_api_synced = 1` and trigger initial sync
- [x] 5.5 Implement `remove_synced_account(account_id)` command: hard-delete account row and all its transactions (only hard-delete path)
- [x] 5.6 Register all new commands in `lib.rs` invoke handler
- [x] 5.7 Write unit tests for `create_api_connection` (PAT stored in keychain, DB row created, PAT absent from DB)
- [x] 5.8 Write unit tests for `remove_synced_account` (account and transactions hard-deleted)
- [x] 5.9 Write unit tests for `import_csv_transactions` guard rejecting API-connected institution accounts

## 6. Startup Sync

- [x] 6.1 On app startup (after DB open), query all `institution_api_connection` rows and call `sync_starling_accounts` for each in parallel
- [x] 6.2 Ensure startup sync failure surfaces an error notification without blocking app launch

## 7. API Connections Settings UI

- [x] 7.1 Create `ApiConnectionsSection` React component displaying connected institutions list with last synced time
- [x] 7.2 Add empty state to `ApiConnectionsSection` when no connections exist
- [x] 7.3 Create `ConnectInstitutionDialog` React component (PAT input form using shadcn/ui `Dialog` + `Form` + `Input`)
- [x] 7.4 Create `DiscoverAccountsDialog` React component (checkbox list of discovered accounts, shadcn/ui `Dialog` + `Checkbox`)
- [x] 7.5 Create `UpdatePatDialog` React component for updating the PAT
- [x] 7.6 Wire "Re-sync" button to call `sync_starling_accounts` and show per-institution progress indicator (disable button during sync)
- [x] 7.7 Wire "Remove" button per account to call `remove_synced_account` with confirmation dialog
- [x] 7.8 Add `ApiConnectionsSection` to `SettingsScreen.tsx` below existing content
- [x] 7.9 Subscribe to `api-sync-progress` Tauri events and update progress state in the UI

## 8. Read-Only Enforcement in Account & Transaction UI

- [ ] 8.1 In `AccountFormSheet.tsx`, detect `is_api_synced = 1` and disable name, institution, account type, currency, opening balance, opening date fields
- [ ] 8.2 In `AccountFormSheet.tsx`, hide delete/deactivate action for API-synced accounts
- [ ] 8.3 In `TransactionFormSheet.tsx`, detect `transaction_type = 'api_sync'` and disable date, description, amount fields
- [ ] 8.4 In `TransactionFormSheet.tsx`, hide void action for API-synced transactions
- [ ] 8.5 Write unit tests for `AccountFormSheet` verifying disabled fields when `is_api_synced = 1`
- [ ] 8.6 Write unit tests for `TransactionFormSheet` verifying disabled fields for `transaction_type = 'api_sync'`

## 9. CSV Import Guard

- [ ] 9.1 In the CSV import UI entry point, check if the account's institution has an active `institution_api_connection` and disable/hide the import action with an explanatory tooltip if so
- [ ] 9.2 Add a guard in the `import_csv_transactions` Tauri command rejecting accounts from API-connected institutions

## 10. E2E Tests (Playwright)

- [ ] 10.1 Bootstrap Playwright E2E test setup if not already present (configure `playwright.config.ts`, add Tauri WebDriver integration)
- [ ] 10.2 Create a mock Starling API server (using `msw` or a small fixture server) for use in E2E tests
- [ ] 10.3 Write E2E test: navigate to Settings → API Connections, verify empty state
- [ ] 10.4 Write E2E test: connect Starling with fixture PAT, discover accounts, import selected accounts, verify they appear in the accounts list
- [ ] 10.5 Write E2E test: trigger manual re-sync, verify transactions appear in the transaction list
- [ ] 10.6 Write E2E test: open an API-synced account form, verify name/institution fields are not editable
- [ ] 10.7 Write E2E test: open an API-synced transaction form, verify date/amount fields are not editable and void action is absent
- [ ] 10.8 Write E2E test: navigate to an API-synced institution account and verify the CSV import action is disabled
- [ ] 10.9 Write E2E test: remove a synced account via Settings and verify it disappears from the accounts list
