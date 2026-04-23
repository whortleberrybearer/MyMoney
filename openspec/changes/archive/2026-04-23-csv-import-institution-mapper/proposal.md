## Why

The app currently supports OFX/QFX imports but has no CSV import capability. CSV is the most universally supported export format across UK banks and financial institutions, and without it a large portion of accounts cannot import transactions at all. Each institution structures its CSV exports differently, so a one-time column mapping step is required before CSV files can be processed automatically.

## What Changes

- New institution column mapper screen — triggered automatically on first CSV import from an institution when no saved mapping exists; captures column assignments, amount convention, and date format with a live CSV preview
- Column mappings are saved against the institution and reused on all subsequent CSV imports
- New CSV import handler — reads the file using the institution's saved column mapping, normalises amounts to the app's signed-real convention, evaluates categorisation and pot allocation rules, runs duplicate detection, and shows the standard import result screen
- Duplicate detection for CSV imports — flags potential duplicates based on date + amount + at least one of notes/payee/reference; flagged transactions are held for manual review and excluded from the main transaction list
- Schema additions: `institution_column_mapping` table to store per-institution CSV column and format configuration; `duplicate_candidate` table (or flag) to hold flagged transactions pending review

**Dependencies:** [F-04] Institution Management must exist (accounts link to institutions). [F-07] Import entry point (account + file selection) and import result screen are already specced in `transaction-import`.

A Drizzle migration is required for the new tables.

## Capabilities

### New Capabilities

- `csv-column-mapper`: Institution column mapping setup screen — triggered on first CSV import; captures column assignments, amount convention, and date format; saves mapping to DB against the institution
- `csv-import`: CSV import handler — applies saved institution column mapping, parses CSV, normalises transactions, runs categorisation/pot allocation rules, performs duplicate detection, returns import result counts

### Modified Capabilities

- `transaction-import`: CSV routing in the import entry point already references a CSV handler; no requirement change needed — the CSV handler specs fulfil the existing routing contract

## Impact

- New DB tables: `institution_column_mapping`, and a mechanism to hold duplicate candidates (could be a flag on the `transaction` table or a separate join table)
- New Tauri commands: `get_institution_column_mapping`, `save_institution_column_mapping`, `import_csv_transactions`
- Frontend screens: `CsvColumnMapperScreen`, integration into the existing import wizard flow
- Papa Parse is already a project dependency — no new deps required for CSV parsing
- Affects: `src-tauri/src/` (new commands), `src/screens/` or equivalent (new screens), DB migration
