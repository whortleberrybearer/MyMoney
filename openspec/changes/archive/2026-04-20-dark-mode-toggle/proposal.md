## Why

The app currently has no theme control — it renders in whatever system default the OS provides, with no user override. A dark mode toggle gives users explicit control over visual comfort, which is especially important for a finance app used across different lighting environments.

## What Changes

- Add a theme preference setting (Light / Dark / System) accessible from the Settings screen
- The preference defaults to **System** and is persisted via Tauri's config store
- On startup, if preference is **System**, the OS theme is read once and applied — the app does not react dynamically to OS theme changes while running
- The theme applies immediately when the user changes the preference — no save/confirm step

## Capabilities

### New Capabilities

- `theme-preference`: Stores, restores, and applies a user-selected theme preference (Light, Dark, or System). Exposes a Tauri command for reading/writing the preference and a React context for consuming it.

### Modified Capabilities

- `settings-screen`: Adds a theme preference control (Light / Dark / System selector) to the existing Settings screen.

## Impact

- **Frontend**: New React context (`ThemeContext`) wrapping the app shell; Settings screen gains a new control
- **Tauri**: New commands `get_theme_preference` / `set_theme_preference` backed by `tauri-plugin-store`
- **Styling**: Tailwind dark-mode class strategy (`class` strategy) — toggled via `document.documentElement.classList`
- **Dependencies**: `tauri-plugin-store` (already used for `lastOpenedFilePath` persistence) — no new deps required
- **Schema changes**: None — preference stored in Tauri config store, not SQLite
- **Migration**: Not required
