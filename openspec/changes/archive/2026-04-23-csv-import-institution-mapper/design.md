## Context

The app supports OFX/QFX import but has no CSV path. CSV export is the most common format across UK banks. Because every institution lays out its CSV columns differently, a one-time per-institution column mapping step is required before automated imports can work.

The existing import wizard (account + file selection) and import result screen are already specced in `transaction-import`. This design covers the two missing pieces: the column mapper setup screen and the CSV import handler.

## Goals / Non-Goals

**Goals:**
- Save per-institution column mappings in the DB and reuse them automatically
- Parse CSV files in the frontend using Papa Parse (already a project dep)
- Normalise amounts to the app's signed-real convention in the Tauri import command
- Run categorisation and pot allocation rules after import (same as OFX)
- Detect duplicate candidates and hold them for manual review
- Cover all new behaviour with unit tests and e2e tests

**Non-Goals:**
- Editing an existing column mapping (Phase 1 scope, per the issue)
- Duplicate review UI (holding mechanism only; review screen is a separate capability)
- Any server-side or cloud processing

## Decisions

### 1. Store column mapping as a single JSON blob per institution

**Decision:** `institution_column_mapping` stores column assignments and settings as a JSON value in a single `mapping_json` TEXT column, with one row per institution.

**Rationale:** The mapping structure (which CSV column maps to which field, plus amount convention and date format) is read and written as a unit. There is no query need to filter by individual column slots. A normalised row-per-slot design adds join complexity with no benefit. JSON blob is simpler and consistent with how other config-like data is handled in SQLite when no per-field querying is required.

**Alternatives considered:** Separate columns per logical field (date_col, payee_col, …) — rejected because the column list is long (~9 fields), the amount convention and date format are not column indices, and new fields would require schema migrations.

```
institution_column_mapping
  id              INTEGER  PK AUTOINCREMENT
  institution_id  INTEGER  FK → institution.id  NOT NULL  UNIQUE
  mapping_json    TEXT     NOT NULL
  created_at      TEXT     NOT NULL  -- ISO timestamp
  updated_at      TEXT     NOT NULL  -- ISO timestamp
```

The `mapping_json` shape (TypeScript type as documentation):
```ts
type ColumnMapping = {
  columns: {
    date: number | null;
    payee: number | null;
    notes: number | null;
    amount: number | null;     // used when amountConvention = 'single'
    debit: number | null;      // used when amountConvention = 'split'
    credit: number | null;     // used when amountConvention = 'split'
    balance: number | null;
    reference: number | null;
  };
  amountConvention: 'single' | 'split';
  dateFormat: string;          // e.g. 'dd/MM/yyyy'
  hasHeaderRow: boolean;
};
```

### 2. Duplicate candidates: flag on the transaction row

**Decision:** Add `is_duplicate_candidate INTEGER NOT NULL DEFAULT 0` to the `transaction` table (0/1 boolean per app convention). Flagged transactions are excluded from the main transaction list by default.

**Rationale:** The existing soft-delete pattern already uses flags on the transaction row (`is_void`). Adding a second flag keeps duplicate state co-located with the transaction and avoids a join. A separate `duplicate_candidate` table would need FK management and adds query complexity for no query-time benefit in Phase 1.

**Alternatives considered:** Separate join table — rejected because there is no Phase 1 need to store metadata about the candidate pair (e.g., which existing transaction it matched); the flag alone is sufficient for the count on the import result screen and for filtering.

### 3. CSV parsing in the frontend; amount normalisation in the Tauri command

**Decision:** Papa Parse runs in the frontend (existing convention). The frontend reads the file, parses it to raw string rows, and passes them to a `import_csv_transactions` Tauri command along with the account ID. The Tauri command applies the saved column mapping, normalises amounts, runs deduplication, and fires the rules engines.

**Rationale:** Keeping all business logic (normalisation, dedup, rules) in Rust/Tauri commands matches the existing architecture. Papa Parse is already a frontend dep and is the right tool for tokenising CSV lines. The boundary: frontend tokenises rows → backend does everything else.

**Amount normalisation rule (applied in the Tauri command):**
- `single` convention: raw value is already signed (positive = credit, negative = debit). Store as-is.
- `split` convention: `amount = credit - debit` (both are positive values in the CSV). Yields a signed real.

### 4. Duplicate detection algorithm

A transaction is flagged as a duplicate candidate if, for the same account, an existing (non-void) transaction matches on **date** AND **amount** AND at least one of { notes, payee, reference }.

String comparisons are case-insensitive and trim whitespace. NULL fields do not match (a NULL notes cannot satisfy the notes match condition).

Flagged transactions are inserted with `is_duplicate_candidate = 1` and are not shown in the main transaction list. They count toward the `duplicate_candidates` total on the import result screen.

### 5. Column mapper: live date preview and first-5-rows CSV preview in the frontend

The mapper screen shows the first 5 parsed rows of the uploaded CSV to help the user assign columns. Date format selection shows a live preview of the parsed date from the selected date column using the selected format. Both are purely frontend logic — no Tauri round-trip needed.

## Risks / Trade-offs

- **Ambiguous amount sign** → If the user selects `single` convention but the CSV encodes debits as positive values, amounts will be sign-inverted. Mitigation: show a preview of computed amounts in the mapper with a clear positive=credit / negative=debit label so the user can spot the issue before saving.
- **CSV header row detection** → Some CSVs have a header row, some don't. The mapper includes a `hasHeaderRow` toggle; if true, row 0 is skipped during import and used as column label hints in the mapper UI.
- **Date format mismatches at import time** → If a bank changes its export format, the saved mapping will produce parse errors. Mitigation: the import command returns a structured error per failed row; the result screen shows a parse-error count if > 0.
- **No mapping edit UI in Phase 1** → If a user saves a wrong mapping, they have no way to correct it via the UI. Mitigation: document this as a known Phase 1 limitation; the data exists in the DB for a Phase 2 edit screen.

## Migration Plan

1. Add Drizzle migration: create `institution_column_mapping` table
2. Add Drizzle migration: add `is_duplicate_candidate` column to `transaction` table (default 0, NOT NULL)
3. Both migrations run automatically on app launch via the existing migration runner
4. Rollback: migrations are additive only — no data is removed. Reverting would require a manual schema patch (acceptable for a local desktop app with no production fleet).

## Open Questions

- Should balance (from the CSV balance column) be stored and used to validate the calculated running balance? → Deferred to Phase 2; store the column mapping but do not validate balance in Phase 1.
- Should the duplicate review screen be in scope for this change? → No, per the issue. Flagged transactions are held silently; count is shown on result screen.
