## ADDED Requirements

### Requirement: Settings screen displays current data file path
The settings screen SHALL display the full absolute path of the currently open data file.

#### Scenario: Settings screen shows current file path
- **WHEN** the user navigates to the settings screen
- **THEN** the full absolute path of the currently open data file is displayed

---

### Requirement: Settings screen provides a Switch data file action
The settings screen SHALL include a "Switch data file" button that allows the user to open a different `.pfdata` file.

#### Scenario: User switches to a different file
- **WHEN** the user clicks "Switch data file" on the settings screen
- **THEN** the native open file dialog is shown (same behaviour as file-selection capability)
- **AND** when the user selects a file, the new file becomes the active file
- **AND** the new file path is stored in `localStorage` as `lastOpenedFilePath`
- **AND** the user is routed to the dashboard

#### Scenario: User cancels the switch dialog
- **WHEN** the user clicks "Switch data file"
- **AND** the user dismisses or cancels the open dialog
- **THEN** the currently open file remains unchanged
- **AND** the user remains on the settings screen
