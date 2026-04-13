## 1. Schema — Define reference tables in Drizzle

- [x] 1.1 [schema] Define `account_type` table in `src/lib/db/schema.ts` with columns: `id` (integer PK autoincrement), `name` (text, not null, unique), `asset_liability` (text, not null)
- [x] 1.2 [schema] Define `transaction_type` table in `src/lib/db/schema.ts` with columns: `id` (integer PK autoincrement), `name` (text, not null, unique)
- [x] 1.3 [schema] Define `tag` table in `src/lib/db/schema.ts` with columns: `id` (integer PK autoincrement), `name` (text, not null, unique)
- [x] 1.4 [schema] Define `category` table in `src/lib/db/schema.ts` with columns: `id` (integer PK autoincrement), `name` (text, not null, unique), `is_system` (integer, not null, default 0), `sort_order` (integer, not null)
- [x] 1.5 [schema] Define `institution` table in `src/lib/db/schema.ts` with columns: `id` (integer PK autoincrement), `name` (text, not null, unique)

## 2. Schema — Generate and edit migration

- [x] 2.1 [schema] Run `drizzle-kit generate` to produce the initial migration SQL file in `src/lib/db/migrations/`
- [x] 2.2 [schema] Append `INSERT OR IGNORE INTO account_type (name, asset_liability) VALUES …` for all 6 account_type seed rows to the migration file
- [x] 2.3 [schema] Append `INSERT OR IGNORE INTO transaction_type (name) VALUES …` for all 3 transaction_type seed rows to the migration file
- [x] 2.4 [schema] Append `INSERT OR IGNORE INTO tag (name) VALUES …` for both tag seed rows to the migration file
- [x] 2.5 [schema] Append `INSERT OR IGNORE INTO category (name, is_system, sort_order) VALUES …` for all 30 category seed rows to the migration file (Uncategorised: is_system=1, sort_order=999; all others: is_system=0)

## 3. Frontend — DB adapter and singleton

- [ ] 3.1 [frontend] Create `src/lib/db/adapter.ts` — a minimal Drizzle SQLite adapter that wraps `@tauri-apps/plugin-sql` `Database` instance, implementing `execute()` and `select()` methods compatible with Drizzle's driver interface
- [ ] 3.2 [frontend] Create `src/lib/db/index.ts` with `openDb(filePath: string): Promise<void>` — opens the SQLite file via `Database.load()`, wraps it with the adapter, runs `migrate(db, migrations)`, and stores the Drizzle instance in module scope; throws on migration failure
- [ ] 3.3 [frontend] Export `getDb(): DrizzleInstance` from `src/lib/db/index.ts` — returns the active instance or throws if `openDb` has not been called

## 4. Frontend — Migration-error screen

- [ ] 4.1 [frontend] Add `{ screen: "migration-error"; filePath: string; error: string }` to the `AppScreen` union in `src/lib/app-context.tsx`
- [ ] 4.2 [frontend] Create `src/components/MigrationErrorScreen.tsx` — displays the error message and a "Return to start" button that navigates to `{ screen: "welcome" }`
- [ ] 4.3 [frontend] Wire `MigrationErrorScreen` into `App.tsx` so it renders when `current.screen === "migration-error"`

## 5. Frontend — Hook migrations into file-open flows

- [ ] 5.1 [frontend] Update `useStartupRouting` in `src/lib/app-context.tsx`: after confirming a file exists, call `openDb(storedPath)` before navigating to `dashboard`; on error, navigate to `{ screen: "migration-error", filePath: storedPath, error: String(err) }`
- [ ] 5.2 [frontend] Update `openExistingFile` in `src/lib/file-selection.ts`: after `saveFilePath()`, call `openDb(filePath)` and return the file path on success; on error, navigate to the migration-error screen (accept `navigate` as a parameter or use a shared helper)
