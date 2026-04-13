### Requirement: Create new data file via native save dialog
The app SHALL open a native Windows save dialog when the user initiates "Create new data file". The dialog MUST be pre-populated with the default filename `my-money.pfdata` and filtered to `.pfdata` files only.

#### Scenario: Save dialog opens with correct defaults
- **WHEN** the user clicks "Create new data file"
- **THEN** a native Windows save dialog opens
- **AND** the default filename is `my-money.pfdata`
- **AND** the dialog filters files to `.pfdata` extension only

#### Scenario: User confirms a save location
- **WHEN** the user selects a save location in the dialog and confirms
- **THEN** a new empty `.pfdata` file is created at the chosen path
- **AND** the chosen path is stored in `localStorage` as `lastOpenedFilePath`
- **AND** the user is routed to the dashboard

#### Scenario: User cancels the save dialog
- **WHEN** the user opens the save dialog
- **AND** the user dismisses or cancels the dialog
- **THEN** no file is created
- **AND** the user remains on the current screen (welcome or error)

---

### Requirement: Open existing data file via native open dialog
The app SHALL open a native Windows open dialog when the user initiates "Open existing data file". The dialog MUST be filtered to `.pfdata` files only.

#### Scenario: Open dialog shows only pfdata files
- **WHEN** the user clicks "Open existing data file"
- **THEN** a native Windows open dialog opens
- **AND** the dialog filters files to `.pfdata` extension only

#### Scenario: User selects a file to open
- **WHEN** the user selects a `.pfdata` file in the open dialog and confirms
- **THEN** the selected path is stored in `localStorage` as `lastOpenedFilePath`
- **AND** the user is routed to the dashboard

#### Scenario: User cancels the open dialog
- **WHEN** the user opens the open dialog
- **AND** the user dismisses or cancels the dialog
- **THEN** no path is stored or changed
- **AND** the user remains on the current screen (welcome or error)
