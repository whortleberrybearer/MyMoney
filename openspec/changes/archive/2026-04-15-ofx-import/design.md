## Context

The app has no import capability today. CSV import (issue #38) and OFX import (issue #41) are both planned for Phase 1. Both share an entry point (account selection, file type routing) and a result screen. This document covers the OFX path and the shared import scaffolding.

The current tech stack is relevant:
- All DB access is Drizzle ORM running in the **frontend** (TypeScript) via `tauri-plugin-sql` proxy — there is no Rust DB layer.
- File system operations (open dialog, read file contents) are handled by Tauri commands/plugins.
- Business logic (rules, balance calculations, duplicate detection) lives in `src/lib/` TypeScript modules.
- CSV parsing uses PapaParse in the frontend; OFX parsing should follow the same pattern.

## Goals / Non-Goals

**Goals:**
- Parse `.ofx` and `.qfx` files in the frontend using a TypeScript library
- FITID-based duplicate detection (`account_id` + `fitid` uniqueness)
- Optional closing-balance validation — block import if OFX ledger balance does not match the running balance after insert
- Categorisation and pot allocation rules run on each imported transaction (same path as CSV)
- Shared import entry point: account selection + file type routing
- Shared import result screen: total, imported, duplicates flagged, uncategorised count
- Drizzle migration for `transaction_fitid` table

**Non-Goals:**
- Institution-specific configuration for OFX files — OFX is a standard; no mapping is needed
- Importing from online banking APIs
- Per-transaction review UI during import (duplicates are flagged; review is a separate screen — issue #13)
- Editing or deleting imported transactions in this flow

## Decisions

### Decision 1: Parse OFX in the frontend (TypeScript), not in Rust

**Choice**: Use a TypeScript OFX parser (`ofx-js` or equivalent npm package) in the frontend, consistent with PapaParse for CSV.

**Alternatives considered**:
- Rust OFX crate (e.g., `ofx`) called from a Tauri command — adds a Rust dependency and Tauri command just to parse text; the result still has to be serialised and sent to the frontend for DB insertion.
- Manual regex/SGML parsing in TypeScript — fragile and unnecessary given available libraries.

**Rationale**: The frontend already owns all DB operations. Parsing in the frontend avoids an extra IPC round-trip and keeps the import pipeline entirely in one layer. OFX files are typically small (a few thousand transactions at most), so there is no performance reason to use Rust.

### Decision 2: `transaction_fitid` as a separate table (no nullable column on `transaction`)

**Choice**: Store FITIDs in a dedicated `transaction_fitid` table with `(account_id, fitid)` unique constraint, separate from the main `transaction` table.

**Alternatives considered**:
- Add a nullable `fitid` column directly to `transaction` — simpler schema but introduces sparse nulls on every non-OFX transaction row, and enforcing the `(account_id, fitid)` uniqueness constraint on a nullable column is awkward in SQLite.

**Rationale**: Consistent with the issue spec. Keeps the `transaction` table clean. Uniqueness is trivially enforced with a standard unique index.

### Decision 3: File type detection by extension

**Choice**: Detect file type from the file extension (`.ofx` / `.qfx` → OFX path; `.csv` → CSV path). Detection happens in the shared import entry point before any parsing.

**Alternatives considered**:
- Inspect file contents (magic bytes / SGML header) — more robust but adds complexity for a case that is unlikely to matter in practice (user manually mislabelling files).

**Rationale**: Simple and user-facing file extensions are reliable enough. Error handling in the OFX parser will catch any misidentified files.

### Decision 4: Closing balance blocks the import (not just a warning)

**Choice**: If the OFX file contains a `LEDGERBAL` closing balance and it does not match the account's running balance after inserting all non-duplicate transactions, the entire import is **rolled back** and the user sees an error.

**Alternatives considered**:
- Show a warning but allow import to proceed — risks silently importing incomplete data.
- Skip balance validation entirely — misses the main value of having it.

**Rationale**: The issue spec states "import is blocked". A partial import with a balance mismatch is worse than no import. SQLite transactions make rollback straightforward.

### Decision 5: Import runs inside a single SQLite transaction

**Choice**: All transaction inserts (and FITID inserts) for an import batch run inside a single DB transaction. If the closing-balance check fails, or any insert throws, the whole batch is rolled back.

**Rationale**: Atomicity is required for the balance validation to be meaningful. The Drizzle proxy supports `db.transaction()`.

### Decision 6: Shared import module in `src/lib/import.ts`

**Choice**: Create `src/lib/import.ts` as the shared entry-point module (account selection data, file type routing, result types). OFX-specific logic lives in `src/lib/ofx-import.ts`.

**Rationale**: Keeps the CSV and OFX implementations independently testable while sharing the result type and routing logic.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| OFX parser library has inconsistent field coverage across bank variants | Use `ofx-js` (widely used); add integration tests against real-world sample files; clearly document which fields are required vs optional |
| FITID uniqueness: some banks reuse FITIDs across different account numbers | Uniqueness constraint is `(account_id, fitid)` — account-scoped, as per spec |
| Balance validation rejects valid imports (rounding, currency differences) | Validate to 2 decimal places with a small epsilon; document the comparison in the UI error message so the user understands what mismatched |
| Large OFX files (10k+ transactions) block the JS thread | Acceptable for Phase 1; can be moved to a web worker later if needed |
| Running balance stored per-row — must be recalculated after insert | Insert transactions ordered by date; compute running balance incrementally on insert, same pattern as future transaction-list feature |

## Migration Plan

1. Add `transaction_fitid` table definition to `src/lib/db/schema.ts` (Drizzle schema)
2. Run `drizzle-kit generate` to create a new migration SQL file
3. Migration is applied automatically on next file open (existing `migrate()` call in `openDb`)
4. No data backfill needed — table starts empty

## Open Questions

- **OFX library choice**: `ofx-js` is the most widely referenced TypeScript OFX parser. Needs a quick evaluation against a sample OFX file before committing. If it proves insufficient, a lightweight custom SGML parser is the fallback.
- **Categorisation and pot allocation rules engines**: These are specified in issues #10 and #12 but not yet implemented. The import pipeline should call stub hooks (no-ops) so the import result screen can show correct uncategorised counts once the rules engines ship.
- **Running balance on insert**: The `transaction` table stores `running_balance` per row, but the current schema shown has no such column. This needs clarification — either the column exists but wasn't shown, or it needs to be added as part of this change.
