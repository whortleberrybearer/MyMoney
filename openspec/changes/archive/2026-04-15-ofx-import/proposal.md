## Why

The app currently has no way to import transactions. OFX and QFX files are the standardised bank export format used by most institutions — they carry a unique transaction ID per row (`FITID`), making duplicate detection reliable without fuzzy matching. Adding OFX support gives users a zero-configuration import path that requires no column mapping setup.

## What Changes

- New `transaction_fitid` table to store per-transaction FITIDs (scoped per account) — Drizzle migration required
- OFX/QFX file parsing in the backend (Tauri command) — fields read directly from the OFX standard; no institution configuration needed
- Shared import entry point: account selection + file type detection (`.ofx`/`.qfx` vs `.csv`)
- FITID-based duplicate detection replacing the date+amount+description matching used for CSV
- Optional closing-balance validation — if the OFX file includes a closing balance, it is compared against the calculated running balance after import; mismatch blocks the import
- Categorisation rules and pot allocation rules run on OFX-imported transactions, identical to CSV import
- Import result summary screen (total rows, imported, duplicates flagged, uncategorised count) is shared with the CSV import flow

**Dependency**: This change shares the import entry point and result screen with issue #38 (CSV Import). The `transaction-import` capability defined here covers the shared scaffolding; OFX-specific logic is isolated in `ofx-import`.

## Capabilities

### New Capabilities

- `transaction-import`: Shared import flow — account selection, file type detection (OFX vs CSV routing), and import result summary screen
- `ofx-import`: OFX/QFX file parsing, FITID-based duplicate detection, closing-balance validation, and transaction insertion

### Modified Capabilities

<!-- No existing import specs to modify -->

## Impact

- **Schema**: New `transaction_fitid` table; Drizzle migration required
- **Backend**: New Tauri commands for OFX parsing and import; running balance recalculation after insert
- **Frontend**: File picker accepting `.ofx` and `.qfx`; new import wizard screens (account select, result summary)
- **Rules engines**: Categorisation and pot allocation rules invoked on each imported OFX transaction
- **Dependencies**: Shares import entry point and result screen with #38 (CSV Import); should be implemented alongside or after #38
