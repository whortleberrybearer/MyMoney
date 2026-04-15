## 1. Database Schema

- [x] 1.1 Add `transactionFitid` table to `src/lib/db/schema.ts` with columns `id`, `transactionId`, `accountId`, `fitid` and a unique index on `(accountId, fitid)`
- [x] 1.2 Run `drizzle-kit generate` to produce a new migration SQL file
- [x] 1.3 Add the new migration import to `tests/unit/db-helper.ts` so unit tests run against the updated schema

## 2. OFX Parser

- [x] 2.1 Evaluate and install a TypeScript OFX/QFX parser library (e.g. `ofx-js`) — verify it can parse a sample `.ofx` file and extract `FITID`, `DTPOSTED`, `TRNAMT`, `NAME`/`MEMO`, and `LEDGERBAL`
- [x] 2.2 Create `src/lib/ofx-parser.ts` that wraps the library and returns a typed `OfxStatement` object: `{ transactions: OfxTransaction[], closingBalance: number | null, closingBalanceDate: string | null }`
- [x] 2.3 Write `tests/unit/ofx-parser.test.ts` covering: valid OFX file parses to correct transaction list; QFX file parses identically to OFX; closing balance extracted when present; `closingBalance = null` when `LEDGERBAL` is absent; invalid file content returns descriptive error

## 3. Import Logic

- [x] 3.1 Create `src/lib/import.ts` with shared types: `ImportResult { total, imported, duplicateCandidates, uncategorised }` and a `detectFileType(filename: string): "ofx" | "csv" | "unknown"` utility
- [x] 3.2 Create `src/lib/ofx-import.ts` implementing `importOfxFile(accountId: number, fileContents: string): Promise<ImportResult>` — reads file, calls parser, runs import pipeline
- [x] 3.3 Implement FITID-based duplicate detection inside `importOfxFile`: for each parsed transaction, query `transaction_fitid` for `(accountId, fitid)` and count matches as duplicate candidates (do not insert)
- [x] 3.4 Implement transaction inserts inside a single `db.transaction()`: insert `transaction` row then `transaction_fitid` row for each non-duplicate; roll back entire batch on any error
- [x] 3.5 Implement closing balance validation inside `importOfxFile`: after all inserts, compute running balance from `opening_balance + SUM(amount)` for the account; if OFX `closingBalance` is present and differs by more than 0.005, roll back and throw with a descriptive message
- [x] 3.6 Add categorisation rules stub and pot allocation rules stub hooks to `importOfxFile` — stubs return no matches; `uncategorised` count equals imported transactions with no category assigned
- [x] 3.7 Write `tests/unit/ofx-import.test.ts` covering:
  - All new FITIDs → all inserted, result shows imported = N, duplicates = 0
  - Mixed file with existing FITIDs → only new ones inserted, duplicate count is correct
  - Duplicate transactions held as candidates, not auto-imported
  - Same FITID on different account is not treated as duplicate
  - Balance mismatch → rolls back all inserts and throws
  - No closing balance in file → import commits normally
  - DB error mid-import → entire batch rolled back

## 4. UI — Import Entry Point

- [ ] 4.1 Create `src/components/ImportScreen.tsx` with account `Select` dropdown (active accounts only) and a file picker button (`.ofx,.qfx,.csv`)
- [ ] 4.2 Implement file type detection in `ImportScreen` using `detectFileType` from `src/lib/import.ts`; show inline error for unsupported extensions; disable Next until both account and valid file are selected
- [ ] 4.3 Write `tests/unit/ImportScreen.test.tsx` covering: Next disabled with no account; Next disabled with no file; unsupported extension shows error; `.ofx` file accepted; `.qfx` file accepted; `.csv` file accepted

## 5. UI — Import Result Screen

- [ ] 5.1 Create `src/components/ImportResultScreen.tsx` displaying `ImportResult` counts (total, imported, duplicate candidates, uncategorised) and a Done button that navigates to the dashboard
- [ ] 5.2 Write `tests/unit/ImportResultScreen.test.tsx` covering: all counts render correctly; Done button triggers navigation

## 6. App Routing and Dashboard Integration

- [ ] 6.1 Add `"import"` and `"import-result"` screens to the app router in `src/App.tsx`
- [ ] 6.2 Add an Import button to the dashboard shell (`src/components/DashboardShell.tsx`) that navigates to the import screen
- [ ] 6.3 Wire `ImportScreen` to invoke `importOfxFile` (or CSV handler stub) on Next, then navigate to `ImportResultScreen` with the result
- [ ] 6.4 Write `tests/unit/DashboardShell.test.tsx` update: Import button is present on the dashboard

## 7. E2E Tests

- [ ] 7.1 Create `tests/e2e/ofx-import.test.ts` — import a valid OFX fixture file: verify Import button visible on dashboard; select account; pick file; result screen shows expected imported count and 0 duplicates
- [ ] 7.2 E2E: import OFX file where all FITIDs already exist in DB (pre-seeded) — result screen shows 0 imported and correct duplicate candidate count
- [ ] 7.3 E2E: import OFX file with a `LEDGERBAL` that does not match the running balance — import screen shows balance mismatch error, no transactions are persisted
- [ ] 7.4 E2E: import OFX file with no `LEDGERBAL` — import completes normally and result screen is shown
- [ ] 7.5 E2E: attempt to import a file with an unsupported extension (e.g. `.txt`) — unsupported file type error is shown in the import screen, Next remains disabled
