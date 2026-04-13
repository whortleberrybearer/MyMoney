## ADDED Requirements

### Requirement: App shows loading indicator on startup
The app SHALL display a loading indicator immediately on startup while it determines which screen to show. No other UI SHALL be rendered during this check.

#### Scenario: Loading state is shown before routing
- **WHEN** the app starts
- **THEN** a loading indicator is displayed
- **AND** no other screen content is visible until routing completes

---

### Requirement: First launch routes to welcome screen
The app SHALL route to the welcome screen when no last-used file path is stored in `localStorage`.

#### Scenario: No previously stored file path
- **WHEN** the app starts
- **AND** `localStorage` does not contain a `lastOpenedFilePath` value
- **THEN** the welcome screen is displayed

---

### Requirement: Subsequent launch with valid file routes to dashboard
The app SHALL automatically open the last-used file and route to the dashboard when a stored file path exists and the file is accessible.

#### Scenario: Last-used file exists and is accessible
- **WHEN** the app starts
- **AND** `localStorage` contains a `lastOpenedFilePath` value
- **AND** the file at that path exists on the filesystem
- **THEN** the welcome screen is NOT shown
- **AND** the user is routed directly to the dashboard

---

### Requirement: Subsequent launch with missing file routes to error screen
The app SHALL display the file-not-found error screen when a stored file path exists but the file cannot be accessed.

#### Scenario: Last-used file path stored but file is missing
- **WHEN** the app starts
- **AND** `localStorage` contains a `lastOpenedFilePath` value
- **AND** the file at that path does NOT exist on the filesystem
- **THEN** the file-not-found error screen is displayed
- **AND** the full stored file path is shown on the error screen

---

### Requirement: Error screen offers create and open options
The file-not-found error screen SHALL provide two actions: "Open data file" and "Create new data file".

#### Scenario: User chooses to open a file from error screen
- **WHEN** the file-not-found error screen is displayed
- **AND** the user clicks "Open data file"
- **THEN** the open file dialog is shown (same behaviour as file-selection capability)

#### Scenario: User chooses to create a file from error screen
- **WHEN** the file-not-found error screen is displayed
- **AND** the user clicks "Create new data file"
- **THEN** the create file dialog is shown (same behaviour as file-selection capability)
