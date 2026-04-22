## 1. Database Migrations

- [x] 1.1 Create Drizzle migration: add `institution_column_mapping` table with `id`, `institution_id` (UNIQUE FK), `mapping_json`, `created_at`, `updated_at`
- [x] 1.2 Create Drizzle migration: add `is_duplicate_candidate INTEGER NOT NULL DEFAULT 0` column to `transaction` table

## 2. Drizzle Schema

- [x] 2.1 Add `institutionColumnMapping` table definition to the Drizzle schema file
- [x] 2.2 Add `isDuplicateCandidate` column to the `transaction` table schema definition
- [x] 2.3 Define the `ColumnMapping` TypeScript type (columns, amountConvention, dateFormat, hasHeaderRow) and export it for use in frontend and Tauri command layer

## 3. Tauri Commands — Column Mapping

- [x] 3.1 Implement `get_institution_column_mapping` command: accepts `institution_id`, returns the saved `ColumnMapping` JSON or null if none exists
- [x] 3.2 Implement `save_institution_column_mapping` command: accepts `institution_id` and `ColumnMapping` JSON, upserts to `institution_column_mapping` table, sets `created_at` on insert and `updated_at` on update

## 4. Tauri Command — CSV Import

- [x] 4.1 Implement `import_csv_transactions` command: accepts `account_id` and `csv_content` string; loads institution column mapping; returns error if no mapping exists
- [x] 4.2 Implement CSV row extraction: apply column index assignments from mapping to each row; skip header row when `hasHeaderRow` is true
- [x] 4.3 Implement amount normalisation: `single` convention stores value as-is (signed real); `split` convention computes `credit - debit`
- [x] 4.4 Implement date parsing: convert date strings to ISO `YYYY-MM-DD` using `dateFormat`; rows with unparseable dates are counted in `parseErrors` and skipped
- [x] 4.5 Implement duplicate detection: for each parsed row, query existing non-void non-duplicate-candidate transactions on the account with matching date and amount; flag as duplicate if at least one of notes/payee/reference also matches (case-insensitive, trimmed); insert with `is_duplicate_candidate = 1`
- [x] 4.6 Run categorisation rules engine after all rows are inserted (excluding duplicate candidates)
- [x] 4.7 Run pot allocation rules engine after categorisation
- [x] 4.8 Recalculate running balances for all non-void, non-duplicate-candidate transactions on the account, ordered by date asc then id asc
- [x] 4.9 Return structured result: `{ totalRows, imported, duplicateCandidates, categorised, uncategorised, potAllocations, allocationFailures, parseErrors }`

## 5. Frontend — CSV Column Mapper Screen

- [x] 5.1 Create `CsvColumnMapperScreen` component: receives CSV file contents and institution name as props; renders CSV preview table (first 5 data rows), column assignment selects, date format picker, amount convention radio group, and header row checkbox
- [x] 5.2 Implement CSV preview: use Papa Parse to tokenise the file in the frontend; display first 5 data rows; use header values as column labels when `hasHeaderRow` is true, otherwise use "Col 0", "Col 1" etc.
- [x] 5.3 Implement live date preview: when both a date column and date format are selected, parse the first data row's date cell and display a human-readable result; show error message if parsing fails
- [x] 5.4 Implement amount convention toggle: show `amount` picker only for single convention; show `debit` and `credit` pickers only for split convention
- [x] 5.5 Implement Save & Import button: disabled until `date` column, `dateFormat`, and required amount columns are all assigned; on click, calls `save_institution_column_mapping` then triggers the CSV import

## 6. Frontend — Import Wizard Integration

- [x] 6.1 Update the CSV routing in the import wizard: after the user picks a `.csv` file and clicks Next, call `get_institution_column_mapping` for the account's institution
- [x] 6.2 If no mapping exists, navigate to `CsvColumnMapperScreen` before importing
- [x] 6.3 If a mapping exists, call `import_csv_transactions` directly (skip the mapper screen)
- [x] 6.4 On cancel from `CsvColumnMapperScreen`, return to the import wizard entry screen

## 7. Frontend — Import Result Screen

- [x] 7.1 Update the import result screen to accept and display `parseErrors` count; show the row only when `parseErrors > 0`
- [x] 7.2 Ensure `duplicateCandidates` count from CSV imports is displayed correctly alongside the existing OFX result fields

## 8. Transaction List — Filter Duplicate Candidates

- [x] 8.1 Update the `get_transactions` (or equivalent) Tauri command to exclude rows where `is_duplicate_candidate = 1` from the default transaction list query

## 9. Unit Tests

- [x] 9.1 Unit tests for `get_institution_column_mapping` command: returns null when no mapping exists; returns saved mapping when one exists
- [x] 9.2 Unit tests for `save_institution_column_mapping` command: inserts on first call; upserts on second call for same institution
- [x] 9.3 Unit tests for CSV row extraction: correct field mapping; header row skipped when hasHeaderRow=true; header row included when hasHeaderRow=false
- [x] 9.4 Unit tests for amount normalisation: single convention preserves signed value; split convention computes credit - debit correctly for debit-only, credit-only, and mixed rows
- [x] 9.5 Unit tests for date parsing: valid dates with each supported format are converted to ISO YYYY-MM-DD; invalid dates increment parseErrors count
- [x] 9.6 Unit tests for duplicate detection: flagged when date+amount+notes match; flagged when date+amount+payee match; flagged when date+amount+reference match; NOT flagged when only date+amount match with no secondary match; NOT flagged when amount differs; case-insensitive and whitespace-trimmed matching
- [x] 9.7 Unit tests for running balance recalculation: duplicate candidates excluded; ordered by date then id
- [x] 9.8 Unit tests for `CsvColumnMapperScreen`: renders CSV preview with correct row count; live date preview updates on column/format change; Save & Import disabled until required fields assigned; convention toggle shows/hides correct pickers
- [x] 9.9 Unit tests for import wizard routing: shows mapper screen when no mapping exists; skips mapper screen when mapping exists

## 10. E2E Tests

- [x] 10.1 E2E test: first CSV import from a new institution — mapper screen is shown, user completes mapping, import succeeds, result screen shows correct counts
- [x] 10.2 E2E test: second CSV import from same institution — mapper screen is skipped, import proceeds directly using saved mapping
- [x] 10.3 E2E test: CSV import with split amount convention — debits become negative, credits become positive in the transaction list
- [x] 10.4 E2E test: CSV import duplicate detection — importing the same CSV twice flags second-pass transactions as duplicate candidates; they do not appear in the transaction list; result screen shows duplicate candidates count
- [x] 10.5 E2E test: CSV import with unparseable date rows — parse errors count shown on result screen; valid rows are imported
- [x] 10.6 E2E test: cancel on mapper screen returns to import wizard entry without saving a mapping
- [x] 10.7 E2E test: CSV import triggers categorisation rules — imported transactions matching a rule have their category set
- [x] 10.8 E2E test: import result screen shows parse errors row only when count > 0
