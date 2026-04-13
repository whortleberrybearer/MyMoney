## 1. Tauri Plugin Setup

- [x] 1.1 Add `tauri-plugin-dialog` and `tauri-plugin-fs` crates to `src-tauri/Cargo.toml`
- [x] 1.2 Register `tauri_plugin_dialog` and `tauri_plugin_fs` in `src-tauri/src/lib.rs`
- [x] 1.3 Declare required permissions in the Tauri capability file (`dialog:allow-open`, `dialog:allow-save`, `fs:allow-copy-file`, `fs:allow-read-dir`, `fs:allow-remove-file`)
- [x] 1.4 Add `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` to `package.json` and install

## 2. App Routing State Machine

- [x] 2.1 Define `AppScreen` discriminated union type with states: `loading`, `welcome`, `file-not-found`, `dashboard`, `settings`
- [x] 2.2 Create `AppContext` providing the current screen, the missing file path (for the error screen), and a `navigate(screen)` function
- [x] 2.3 Implement `useStartupRouting` hook: reads `localStorage.lastOpenedFilePath`, checks if the file exists via `tauri-plugin-fs`, and sets the initial screen to `welcome`, `file-not-found`, or `dashboard` accordingly

## 3. File Selection Utilities

- [x] 3.1 Implement `createNewFile()` — opens a native save dialog defaulting to `my-money.pfdata` filtered to `.pfdata`, creates the file, writes the chosen path to `localStorage.lastOpenedFilePath`, and returns the path
- [x] 3.2 Implement `openExistingFile()` — opens a native open dialog filtered to `.pfdata`, writes the chosen path to `localStorage.lastOpenedFilePath`, and returns the path; returns `null` if cancelled

## 4. File Backup Utilities

- [x] 4.1 Implement `createBackup(filePath)` — copies the file to `{filePath}.{YYYY-MM-DD}.bak` in the same directory (overwrites if today's backup already exists)
- [x] 4.2 Implement `pruneBackups(filePath)` — lists all files in the parent directory matching `{basename}.*.bak`, sorts them lexicographically descending, and deletes all but the 2 most recent
- [x] 4.3 Implement `runStartupBackup(filePath)` — calls `createBackup` then `pruneBackups`, catches and logs any errors without throwing

## 5. UI Screens

- [ ] 5.1 Create `LoadingScreen` component — full-screen loading indicator, no other content
- [ ] 5.2 Create `WelcomeScreen` component — app title/branding, "Create new data file" button, "Open existing data file" button
- [ ] 5.3 Create `FileNotFoundScreen` component — error heading, displays the full missing file path, "Open data file" button, "Create new data file" button
- [ ] 5.4 Create `DashboardShell` component — empty main content area, navigation control (e.g. settings icon/button) that routes to the settings screen
- [ ] 5.5 Create `SettingsScreen` component — displays current file path, "Switch data file" button, back navigation to dashboard

## 6. App Wiring

- [ ] 6.1 Update `App.tsx` to wrap the app in `AppContext`, call `useStartupRouting` on mount, and render the correct screen based on current state
- [ ] 6.2 Wire "Create new data file" and "Open existing data file" buttons in `WelcomeScreen` and `FileNotFoundScreen` to `createNewFile()` and `openExistingFile()` respectively, navigating to dashboard on success
- [ ] 6.3 After a successful startup open of an existing file, call `runStartupBackup(filePath)` asynchronously (non-blocking)
- [ ] 6.4 Wire "Switch data file" on `SettingsScreen` to `openExistingFile()`, navigating to dashboard on success

## 7. Tests

- [ ] 7.1 Unit test `pruneBackups` — verify that files beyond the 2 most recent are deleted and the correct files are kept
- [ ] 7.2 Unit test `useStartupRouting` — verify routing to `welcome` (no stored path), `file-not-found` (path stored, file missing), and `dashboard` (path stored, file exists)
