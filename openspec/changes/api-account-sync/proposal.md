## Why

MyMoney currently supports account data entry only through manual CSV import (F-04), which requires the user to export and re-import files from their bank regularly. Institutions such as Starling Bank expose a read-only AISP API that can automate this entirely — eliminating manual steps and making the data more timely and reliable.

## What Changes

- A new **API Connections** section is added to Settings where users can register a Personal Access Token (PAT) for Starling Bank, discover their accounts, and manage ongoing sync
- Starling accounts discovered via API are created fresh in the database and synced automatically on startup and on demand
- **1 year of transaction history** is fetched on initial sync; subsequent syncs match by transaction ID and overwrite local data if there is a conflict (Starling is source of truth)
- The categorisation rules engine (F-08) runs automatically against newly synced transactions
- CSV import is **disabled** for any account belonging to an API-connected institution
- API-sourced account and transaction fields provided by the API are **read-only** in the UI; only user-defined fields (notes, category, tags) remain editable
- PATs are stored in the OS keychain via Tauri's keyring plugin — never in SQLite
- **BREAKING**: Two new database columns (`institution_api_connection` table; `is_api_synced` on `account`) and a new `transaction_type` seed value (`api_sync`) require a Drizzle migration

## Capabilities

### New Capabilities

- `api-connection-management`: Settings UI for connecting/disconnecting institutions, entering and updating PATs, and per-institution account management (add/remove synced accounts)
- `api-account-sync`: Core sync engine — startup and manual sync, Starling API integration (account discovery, transaction fetch), transaction deduplication/overwrite logic, progress reporting, and error handling

### Modified Capabilities

- `account-management`: API-sourced accounts have restricted field editability (read-only API fields) and cannot be hard-deleted independently; deletion is only available via the API Connections management screen
- `csv-import`: Import must be blocked (UI disabled + command guard) for accounts belonging to an API-connected institution
- `settings-screen`: New **API Connections** section added alongside existing settings panels

## Impact

- **New Tauri plugin dependency**: `tauri-plugin-keyring` (or equivalent) for OS keychain storage
- **New HTTP client dependency**: Required for calling Starling's AISP REST API from Tauri commands
- **Database schema**: New `institution_api_connection` table; new `is_api_synced` column on `account`; new `api_sync` seed value in `transaction_type`; Drizzle migration required
- **Depends on**: institution management (institution records must exist before connections are stored), categorisation rules engine (F-08), settings screen (F-??), account management (F-01)
- **Affects**: CSV import flow (F-04), transaction import pipeline, account list / transaction list UI (read-only state indicators)
