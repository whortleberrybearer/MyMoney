## Context

MyMoney currently imports bank data exclusively via CSV (F-04). All business logic runs in Tauri Rust commands; the React frontend only handles UI and delegates to those commands. The database is SQLite managed by Drizzle ORM on the frontend side.

The Starling AISP API is a REST API authenticated by a Personal Access Token (PAT). The PAT must not be stored in SQLite — it belongs in the OS keychain. Sync must not block the UI; progress must be streamed back to React in real time.

## Goals / Non-Goals

**Goals:**
- Add a Starling Bank sync integration that fetches accounts and transactions via PAT auth
- Store PATs in the OS keychain (never SQLite)
- Stream sync progress to the UI without blocking
- Re-use the existing categorisation rules engine on newly synced transactions
- Enforce read-only restrictions on API-sourced account and transaction fields in the UI
- Disable CSV import for API-connected institution accounts
- Produce a correct Drizzle migration for all schema changes

**Non-Goals:**
- OAuth / authorisation code flow
- Writing any data back to Starling
- Scheduled background sync (startup + manual trigger only)
- Any institution other than Starling
- Merging API-discovered accounts with existing manually-created accounts

## Decisions

### 1 — HTTP client lives in Rust (Tauri command)

**Decision:** Call the Starling REST API from a Rust Tauri command using `reqwest` (async, with `tokio`).

**Rationale:** All business logic is already in Rust commands. Calling the API from the frontend would expose the PAT to JavaScript. Rust gives us direct access to the keychain plugin and keeps the secret server-side.

**Alternative considered:** Calling Starling from React via `fetch`. Rejected because the PAT would live in JS memory and be visible to DevTools.

---

### 2 — Keychain via `tauri-plugin-keyring`

**Decision:** Add `tauri-plugin-keyring` to store and retrieve the PAT. A unique `keychain_key` string (stored in `institution_api_connection`) identifies the keychain entry — the PAT itself is never written to SQLite.

**Rationale:** Tauri's keyring plugin wraps the OS keychain (Credential Manager on Windows, Keychain on macOS, Secret Service on Linux), which is the appropriate secure store for credentials in a desktop app.

**Alternative considered:** Encrypting the PAT and storing it in SQLite. Rejected because it requires managing an encryption key, which reintroduces the same problem.

---

### 3 — Sync progress via Tauri events

**Decision:** The sync Tauri command emits `api-sync-progress` events to the window as it processes each account. React listens with `listen()` and updates a progress store.

**Rationale:** Tauri commands are async but return a single value at the end. Events allow streaming intermediate state (e.g., "fetching account X, N transactions processed") without requiring a polling loop.

**Alternative considered:** Polling a `get_sync_status` command from React. Rejected because it adds unnecessary round-trips and complexity.

---

### 4 — Transaction deduplication by Starling transaction ID

**Decision:** Store the Starling transaction ID in a new `external_id` column on the `transaction` table. On re-sync, query by `(account_id, external_id)`; if found and data differs, overwrite the local row (Starling is source of truth). If not found, insert as new. No duplicate review queue is involved.

**Rationale:** The issue explicitly states Starling wins on conflict. Keeping external IDs enables idempotent re-syncs without fetching all local transactions into memory.

---

### 5 — Read-only enforcement at the UI layer

**Decision:** The frontend checks `account.is_api_synced` (and `transaction.transaction_type === 'api_sync'`) to conditionally disable form fields and action buttons. No additional DB constraints are added.

**Rationale:** The application layer already enforces invariants (e.g., account_id / pot_id exclusivity). Adding DB-level constraints for read-only would complicate migration and offer limited value in a single-user local app.

---

### 6 — Account removal purges data

**Decision:** Removing a synced account from the API Connections screen calls a dedicated Tauri command that hard-deletes the account row and all its transactions. This is the only hard-delete path in the app.

**Rationale:** The issue explicitly defines this as an intentional exception to the soft-delete principle. The command is gated behind the API Connections screen, not the standard account management UI.

---

### 7 — Initial sync fetches 1 year of history

**Decision:** On first sync for an account, fetch transactions from `now - 365 days`. Subsequent syncs fetch from `last_synced_at` stored in `institution_api_connection`.

**Rationale:** Matches the issue specification. Using `last_synced_at` avoids re-fetching the full history on every manual sync.

---

### 8 — Integration handler pattern

**Decision:** A Rust trait `ApiIntegration` is defined with methods `discover_accounts`, `fetch_transactions`, etc. The Starling implementation (`StarlingIntegration`) is the sole concrete type for Phase 1. Future institutions implement the same trait.

**Rationale:** Keeps Starling-specific code isolated and makes the extension path explicit, without over-engineering it before a second institution is needed.

---

### 9 — Testing strategy

**Decision:**
- **Unit tests** (Rust `#[test]`): Test `StarlingIntegration` mapping/translation logic, deduplication logic, and `keychain_key` generation using a mock HTTP layer (injected via trait or `mockito`).
- **Integration tests** (Rust `#[test]` with test DB): Test the full sync command against a real SQLite test database to verify schema writes, running balance recalculation, and categorisation rule application.
- **E2E tests** (Playwright via `@playwright/test` + Tauri WebDriver): Cover the API Connections settings flow (adding a connection, triggering a sync, verifying accounts appear) using a mock Starling server (e.g., `msw` or a small `axum` test server).

**Rationale:** The user explicitly requires both tests and e2e tests. Unit tests are fast and catch mapping bugs; integration tests verify DB correctness; E2E tests verify the full user journey without relying on a live Starling API.

## Risks / Trade-offs

- **Starling API breaking changes** → Mitigation: version-pin API usage and add an integration test against a recorded fixture. The `StarlingIntegration` trait boundary isolates the change surface.
- **Keyring unavailable on some Linux DEs** → Mitigation: detect keyring failure and surface a clear error rather than silently falling back to plaintext storage.
- **Running balance recalculation on large history** → Mitigation: the existing running balance logic already operates per-account; 1 year of Starling transactions is bounded in practice. No special batching needed for Phase 1.
- **E2E test flakiness against real Tauri window** → Mitigation: use a controlled mock Starling server with deterministic fixture data; avoid real network calls in CI.
- **PAT rotation** → The UI must allow updating the PAT; if keychain write fails, surface the error and do not proceed.

## Migration Plan

1. Add `tauri-plugin-keyring` to `Cargo.toml` and register in `lib.rs`
2. Add `reqwest` (with `tokio` feature) to `Cargo.toml`
3. Generate Drizzle migration:
   - New table: `institution_api_connection`
   - New column: `account.is_api_synced integer not null default 0`
   - New column: `transaction.external_id text` (nullable; populated only for API-synced transactions)
   - New seed row: `transaction_type` with value `api_sync`
4. Apply migration through the existing migration pipeline (no schema version conflicts expected)
5. Rollback: drop new table and columns; remove seed row. No existing data is affected.

## Open Questions

- Which specific `tauri-plugin-keyring` version is compatible with the current Tauri 2.x pin? Confirm before adding to `Cargo.toml`.
- Should the Starling integration use Starling's `/api/v2/accounts` endpoint directly or the AISP-specific path? Confirm with the Starling AISP docs before implementing.
- Is Playwright already set up in the project for E2E tests, or does it need to be bootstrapped from scratch?
