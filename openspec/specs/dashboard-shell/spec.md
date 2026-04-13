### Requirement: Dashboard shell is displayed after a file is loaded
The app SHALL display an empty dashboard shell as the main screen once a data file has been successfully opened. The dashboard shell represents the primary application view and acts as the landing screen after file selection.

#### Scenario: Dashboard shown after creating a new file
- **WHEN** the user creates a new data file
- **THEN** the dashboard shell is displayed
- **AND** the welcome screen is no longer visible

#### Scenario: Dashboard shown after opening an existing file
- **WHEN** the user opens an existing data file
- **THEN** the dashboard shell is displayed

#### Scenario: Dashboard shown on reopen of last-used file
- **WHEN** the app starts with a valid last-used file path
- **AND** the file is found and opened
- **THEN** the dashboard shell is displayed directly without showing the welcome screen

---

### Requirement: Dashboard shell provides navigation to settings
The dashboard shell SHALL include a means for the user to navigate to the settings screen.

#### Scenario: User navigates to settings from dashboard
- **WHEN** the user is on the dashboard
- **AND** the user activates the settings navigation control
- **THEN** the settings screen is displayed
