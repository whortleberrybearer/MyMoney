### Requirement: [Theme Preference] App applies theme on startup
The app SHALL read the persisted theme preference from `localStorage` on startup and apply the corresponding theme before the first render. If no preference is stored, the default SHALL be `system`.

#### Scenario: No preference stored — defaults to system
- **WHEN** the app starts and no `themePreference` key exists in `localStorage`
- **THEN** the OS preferred colour scheme is read once via `window.matchMedia('(prefers-color-scheme: dark)').matches`
- **AND** if the OS preference is dark, the `.dark` class is added to `<html>`
- **AND** if the OS preference is light (or not detectable), no `.dark` class is added

#### Scenario: Light preference stored
- **WHEN** the app starts and `localStorage.themePreference` is `"light"`
- **THEN** no `.dark` class is present on `<html>`

#### Scenario: Dark preference stored
- **WHEN** the app starts and `localStorage.themePreference` is `"dark"`
- **THEN** the `.dark` class is added to `<html>`

#### Scenario: System preference stored
- **WHEN** the app starts and `localStorage.themePreference` is `"system"`
- **THEN** the OS preferred colour scheme is read once via `window.matchMedia('(prefers-color-scheme: dark)').matches`
- **AND** the `.dark` class is added to `<html>` if and only if the OS preference is dark

---

### Requirement: [Theme Preference] Theme applies immediately when preference changes
The app SHALL apply the selected theme class to `<html>` synchronously when the preference changes — no save or confirm step is required.

#### Scenario: User selects Light
- **WHEN** the user selects "Light" on the Settings screen
- **THEN** `localStorage.themePreference` is set to `"light"`
- **AND** the `.dark` class is removed from `<html>` immediately

#### Scenario: User selects Dark
- **WHEN** the user selects "Dark" on the Settings screen
- **THEN** `localStorage.themePreference` is set to `"dark"`
- **AND** the `.dark` class is added to `<html>` immediately

#### Scenario: User selects System
- **WHEN** the user selects "System" on the Settings screen
- **THEN** `localStorage.themePreference` is set to `"system"`
- **AND** the OS preference is re-read once via `window.matchMedia`
- **AND** the `.dark` class is toggled accordingly

---

### Requirement: [Theme Preference] App does not react dynamically to OS theme changes
The app SHALL NOT update the theme in response to OS theme changes while the app is running. The OS preference is only evaluated once: at startup (or when the user selects System from the Settings screen).

#### Scenario: OS theme changes while app is running with System preference
- **WHEN** `localStorage.themePreference` is `"system"`
- **AND** the user changes their OS theme while the app is running
- **THEN** the app theme does NOT change
- **AND** the theme remains as it was set at last startup or last explicit System selection

---

### Requirement: [Theme Preference] Preference is persisted across restarts
The theme preference SHALL be stored in `localStorage` under the key `themePreference` and restored when the app next opens.

#### Scenario: Preference survives app restart
- **WHEN** the user sets the theme to "Dark"
- **AND** the app is closed and reopened
- **THEN** the dark theme is applied immediately on startup without user interaction
