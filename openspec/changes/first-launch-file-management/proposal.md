## Why

My Money has no mechanism for selecting or managing data files — users cannot create, open, or switch between `.pfdata` files, which means the app has no way to persist any financial data. This is the foundational capability needed before any other feature can be built.

## What Changes

- Add a welcome screen shown on first launch with "Create new data file" and "Open existing data file" options
- Add native Windows save/open dialogs (filtered to `.pfdata`) for creating and opening data files
- Persist the last-used file path so the app reopens it automatically on subsequent launches
- Add a loading indicator shown while startup routing is in progress
- Add an error screen when the last-used file cannot be found, with options to open or create a file
- Auto-backup the data file on every startup (format: `{filename}.{YYYY-MM-DD}.bak`), keeping only the 2 most recent backups
- Add a settings screen showing the current file path and a "Switch data file" button
- Add an empty dashboard shell displayed once a file is successfully loaded

## Capabilities

### New Capabilities

- `launch-routing`: Startup logic that determines which screen to display — loading indicator, welcome screen, error screen, or dashboard — based on whether a last-used file exists and is accessible
- `file-selection`: Native dialog interactions for creating a new `.pfdata` file (save dialog) or opening an existing one (open dialog), plus persisting the chosen path for future launches
- `file-backup`: Automatic backup of the data file on every successful startup, named `{filename}.{YYYY-MM-DD}.bak`, with a retention policy of 2 most-recent backups
- `settings-screen`: Settings UI showing the current data file path and a "Switch data file" button that triggers the open file dialog
- `dashboard-shell`: Empty dashboard screen displayed after a data file is successfully loaded

### Modified Capabilities

## Impact

- **New UI screens**: WelcomeScreen, LoadingScreen, FileNotFoundScreen, SettingsScreen, DashboardShell
- **App router**: Startup routing logic must run before rendering any primary screen
- **Electron / native APIs**: Requires `dialog.showSaveDialog` and `dialog.showOpenDialog` (or equivalent Tauri APIs) for native file pickers
- **Persistent storage**: Needs a mechanism (e.g., `electron-store`, localStorage, or OS config) to persist the last-used file path across sessions
- **File system**: Backup creation, date-stamped naming, and deletion of old backups require Node.js / native file system access
- **No existing features affected** — this is foundational infrastructure with no prior dependencies
