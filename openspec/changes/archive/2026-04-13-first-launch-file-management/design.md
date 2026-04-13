## Context

My Money is a Tauri v2 desktop app (React 19 + TypeScript frontend, Rust backend). The app is at a blank-slate stage — only shadcn/ui components and the SQL plugin (`tauri-plugin-sql` with SQLite) are wired up. There is no routing, no persistent state, and no concept of a "data file" yet.

The `.pfdata` file is a SQLite database. The Tauri SQL plugin opens databases via a path-based connection string (`sqlite:${absolutePath}`). This change establishes the file-lifecycle foundation the rest of the app will build on.

## Goals / Non-Goals

**Goals:**
- Implement a state-based startup flow: loading → welcome | file-not-found | dashboard
- Add native file dialogs for creating and opening `.pfdata` files
- Persist the last-used file path across sessions
- Auto-backup the data file on every successful startup (max 2 backups)
- Add a settings screen with a "Switch data file" action
- Add an empty dashboard shell as the post-load landing screen

**Non-Goals:**
- Any financial data features (accounts, transactions, budgets)
- Multi-file or concurrent file support
- Cloud sync or remote backups
- File integrity validation beyond existence checks

## Decisions

### 1. Screen state machine over a router

**Decision:** Model the app's top-level view as a React state machine with five states — `loading`, `welcome`, `file-not-found`, `dashboard`, `settings` — rather than introducing React Router.

**Rationale:** The screens are not URL-addressable concepts and there is no browser history needed in a desktop app. A single `AppScreen` discriminated union kept in a React context is simpler, more typesafe, and avoids adding a routing dependency at this stage.

**Alternatives considered:**
- React Router — overkill for five sequential states; adds bundle weight and history semantics that don't apply.

---

### 2. `tauri-plugin-dialog` for native file pickers

**Decision:** Use `tauri-plugin-dialog` (`open` and `save` dialogs) for all file selection.

**Rationale:** Tauri v2 provides a first-party plugin for native OS dialogs. It supports file extension filters and default filenames. This is the idiomatic approach and avoids custom Rust commands.

**New dependency:** `tauri-plugin-dialog` (Rust + JS) must be added to `Cargo.toml` and registered in `lib.rs`.

---

### 3. `localStorage` for last-used file path persistence

**Decision:** Store the last-used file path in `localStorage` under the key `lastOpenedFilePath`.

**Rationale:** The only piece of data that needs to persist across sessions at this stage is a single file path string. `localStorage` in Tauri's WebView2 (Windows) persists across app restarts without any additional plugins or Rust code. It is the zero-friction choice for a single scalar value.

**Alternatives considered:**
- `tauri-plugin-store` — correct for larger config objects, but unnecessary overhead for one key. Can be adopted later if config grows.
- App config file via `tauri-plugin-fs` — more portable but more complex for no gain at this stage.

---

### 4. `tauri-plugin-fs` for backup operations

**Decision:** Use `tauri-plugin-fs` for file copy (backup creation) and directory listing + deletion (backup retention).

**Rationale:** Backup logic requires reading a directory, copying a file, and deleting old files — all native filesystem operations. `tauri-plugin-fs` is the standard Tauri v2 way to do this from the frontend without writing custom Rust commands.

**New dependency:** `tauri-plugin-fs` (Rust + JS) must be added and its permissions declared in the capability file.

---

### 5. Backup retention: keep 2 most recent by date-stamp sort

**Decision:** Scan the data file's parent directory for files matching `{basename}.*.bak`, sort lexicographically (ISO date strings sort correctly), and delete all but the two most recent.

**Rationale:** ISO date-stamped filenames (`YYYY-MM-DD`) sort correctly as strings. Same-day backups overwrite (same filename) — no accumulation within a day. Deletion happens before opening the database to avoid locking issues.

---

### 6. Database connection opened after file selection

**Decision:** The SQLite connection is opened (via `tauri-plugin-sql`) only after a file path is confirmed — not at startup.

**Rationale:** The connection string requires an absolute path. The path is not known until after file selection or the last-used path is validated. The SQL plugin is used for financial data features (future work); this change only establishes the file path and connection lifecycle, opening the connection when navigating to the dashboard.

## Risks / Trade-offs

- **`localStorage` cleared by browser data wipe** → Mitigation: Document that clearing WebView2 storage will reset the last-opened file preference. Acceptable for v1; migrate to `tauri-plugin-store` if users report this as an issue.
- **Backup on a large file could delay startup** → Mitigation: Run backup asynchronously after the dashboard is shown, not before. If backup fails, log and continue — never block the user.
- **No file integrity check** → A `.pfdata` file that exists but is corrupt will fail to open as a SQLite DB. Mitigation: Catch SQL open errors and redirect to the error screen with an appropriate message (deferred to when SQL is first used).
- **Windows-only path assumptions** → The app targets Windows per the proposal. Path separators and dialog behaviour are Windows-specific for now.

## Migration Plan

This is a greenfield feature on a blank-slate app — no migration is needed. The change introduces new files and registers new Tauri plugins; no existing behaviour is modified.

Plugin registration steps (part of implementation):
1. Add `tauri-plugin-dialog` and `tauri-plugin-fs` to `Cargo.toml`
2. Register both plugins in `src-tauri/src/lib.rs`
3. Declare required permissions (`dialog:allow-open`, `dialog:allow-save`, `fs:allow-read`, `fs:allow-write`, `fs:allow-remove`) in the capability file

## Open Questions

- None blocking implementation.
