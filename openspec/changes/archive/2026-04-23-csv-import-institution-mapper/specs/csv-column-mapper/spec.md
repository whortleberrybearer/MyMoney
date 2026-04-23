## ADDED Requirements

### Requirement: [F-07] institution_column_mapping schema

The app SHALL store per-institution CSV column mapping configuration in an `institution_column_mapping` table. Each institution SHALL have at most one saved mapping (UNIQUE on `institution_id`). The mapping SHALL capture: column index assignments for date, payee, notes, amount, debit, credit, balance, and reference; the amount convention (single signed column or separate debit/credit columns); the date format string; and whether the CSV has a header row. Column assignments that are not used SHALL be stored as NULL. A Drizzle migration SHALL create this table.

```
institution_column_mapping
  id              INTEGER  PK AUTOINCREMENT
  institution_id  INTEGER  FK → institution.id  NOT NULL  UNIQUE
  mapping_json    TEXT     NOT NULL
  created_at      TEXT     NOT NULL
  updated_at      TEXT     NOT NULL
```

#### Scenario: Migration creates institution_column_mapping table
- **GIVEN** the app opens a database that does not yet have the `institution_column_mapping` table
- **WHEN** the migration runner executes
- **THEN** the table is created with the correct schema and no errors

#### Scenario: Unique constraint prevents duplicate institution mappings
- **GIVEN** a mapping row exists for `institution_id = 1`
- **WHEN** another insert attempts `institution_id = 1`
- **THEN** the insert fails with a unique constraint violation

#### Scenario: Different institutions can each have a mapping
- **GIVEN** a mapping row exists for `institution_id = 1`
- **WHEN** a mapping row is inserted for `institution_id = 2`
- **THEN** the insert succeeds without error

---

### Requirement: [F-07] Column mapper screen — triggered on first CSV import from an institution

The app SHALL display the column mapper screen automatically when the user initiates a CSV import for an account whose institution has no saved column mapping. The mapper screen SHALL show a preview of the first 5 data rows of the uploaded CSV (excluding the header row if `hasHeaderRow` is true) to help the user identify columns.

```
┌─────────────────────────────────────────────────────────┐
│  Set Up CSV Import — Barclays                           │
├─────────────────────────────────────────────────────────┤
│  This is the first CSV import for Barclays.            │
│  Map your columns to get started.                       │
│                                                         │
│  CSV Preview (first 5 rows)                            │
│  ┌──────────┬───────────────┬──────────┬────────┐      │
│  │ Col 0    │ Col 1         │ Col 2    │ Col 3  │      │
│  │ 15/03/24 │ TESCO STORES  │ -12.50   │        │      │
│  │ 14/03/24 │ SALARY BACS   │ 2500.00  │        │      │
│  │ …        │ …             │ …        │ …      │      │
│  └──────────┴───────────────┴──────────┴────────┘      │
│                                                         │
│  CSV has header row?  [✓]                               │
│                                                         │
│  Column Assignments                                     │
│  Date       [Col 0 ▼]    Date Format [dd/MM/yyyy ▼]    │
│             Preview: 15 March 2024                      │
│  Payee      [Col 1 ▼]                                  │
│  Notes      [Ignore ▼]                                 │
│  Reference  [Ignore ▼]                                 │
│                                                         │
│  Amount convention                                      │
│  ● Single column (positive = credit, negative = debit) │
│  ○ Separate debit / credit columns                      │
│                                                         │
│  Amount     [Col 2 ▼]                                  │
│                                                         │
│                          [Cancel]  [Save & Import]     │
└─────────────────────────────────────────────────────────┘
```

shadcn/ui components: `Table` (CSV preview), `Select` (column pickers, date format), `Checkbox` (header row), `RadioGroup` (amount convention), `Button`.

#### Scenario: Column mapper screen is shown on first CSV import for an institution
- **GIVEN** the user selects an account whose institution has no saved column mapping
- **AND** picks a `.csv` file in the import wizard
- **WHEN** they click Next
- **THEN** the column mapper screen is displayed before any import is attempted

#### Scenario: Column mapper screen is NOT shown when a mapping already exists
- **GIVEN** the user selects an account whose institution already has a saved column mapping
- **AND** picks a `.csv` file
- **WHEN** they click Next
- **THEN** the column mapper screen is skipped and the import proceeds directly

#### Scenario: CSV preview shows first 5 data rows
- **GIVEN** the uploaded CSV has 10 data rows and a header row
- **AND** hasHeaderRow is true
- **WHEN** the column mapper screen loads
- **THEN** the preview table shows exactly 5 rows (rows 1–5, not the header)

#### Scenario: CSV preview uses column index labels when hasHeaderRow is false
- **GIVEN** hasHeaderRow is false
- **WHEN** the column mapper screen loads
- **THEN** preview column headers are shown as "Col 0", "Col 1", … etc.

#### Scenario: CSV preview uses header values as column labels when hasHeaderRow is true
- **GIVEN** the CSV header row contains "Date", "Description", "Amount"
- **AND** hasHeaderRow is true
- **WHEN** the column mapper screen loads
- **THEN** preview column headers show "Date", "Description", "Amount"

---

### Requirement: [F-07] Column mapper — date format selection with live preview

The date format picker SHALL offer a list of common date format strings. When a date column and format are both selected, the mapper SHALL show a live preview of the parsed date from the first data row's date cell. If parsing fails, the preview SHALL show an error message in place of the date.

Supported formats (at minimum): `dd/MM/yyyy`, `MM/dd/yyyy`, `yyyy-MM-dd`, `d/M/yyyy`, `M/d/yyyy`, `dd-MM-yyyy`, `dd MMM yyyy`, `yyyy/MM/dd`.

#### Scenario: Live date preview updates when date column or format changes
- **GIVEN** the date column is set to Col 0 whose first value is "15/03/2024"
- **WHEN** the user selects format "dd/MM/yyyy"
- **THEN** the preview shows "15 March 2024" (or equivalent human-readable form)

#### Scenario: Live date preview shows error for unparseable value
- **GIVEN** the date column is set to Col 0 whose first value is "N/A"
- **WHEN** the user selects any date format
- **THEN** the preview shows an error message such as "Cannot parse date with this format"

#### Scenario: Live date preview is blank when no date column is selected
- **GIVEN** no date column has been assigned
- **WHEN** the mapper screen is displayed
- **THEN** the date preview area is empty

---

### Requirement: [F-07] Column mapper — amount convention selection

The mapper SHALL offer two amount conventions:
- **Single**: one column holds signed amounts (positive = credit, negative = debit). The user assigns the `amount` column.
- **Split**: separate debit and credit columns (both hold positive values). The user assigns both the `debit` and `credit` columns.

Switching convention SHALL update which column pickers are visible: single convention shows `amount` only; split convention shows `debit` and `credit` only.

#### Scenario: Single convention shows amount picker only
- **GIVEN** the user selects the "Single column" amount convention
- **THEN** only the `amount` column picker is visible
- **AND** the `debit` and `credit` pickers are hidden

#### Scenario: Split convention shows debit and credit pickers only
- **GIVEN** the user selects the "Separate debit / credit columns" convention
- **THEN** the `debit` and `credit` column pickers are visible
- **AND** the `amount` picker is hidden

---

### Requirement: [F-07] Column mapper — save mapping and proceed to import

When the user clicks "Save & Import", the mapper SHALL validate that required fields are assigned, save the mapping to the DB, and proceed to the CSV import. Required assignments: `date` column, `date format`, and either `amount` (single convention) or both `debit` and `credit` (split convention).

The `Save & Import` button SHALL be disabled until all required fields are assigned.

#### Scenario: Save & Import is disabled until required fields are assigned
- **GIVEN** no date column has been assigned
- **THEN** the "Save & Import" button is disabled

#### Scenario: Saving a valid mapping persists it and proceeds to import
- **GIVEN** all required fields are assigned
- **WHEN** the user clicks "Save & Import"
- **THEN** the mapping is saved to `institution_column_mapping` for the account's institution
- **AND** the CSV import begins using the newly saved mapping

#### Scenario: Cancel returns to the import wizard entry screen
- **WHEN** the user clicks Cancel on the column mapper screen
- **THEN** the app returns to the import wizard (account + file selection step)
- **AND** no mapping is saved

#### Scenario: Save fails gracefully on DB error
- **GIVEN** the DB is unavailable when the user clicks "Save & Import"
- **THEN** an error message is displayed
- **AND** the user remains on the column mapper screen
