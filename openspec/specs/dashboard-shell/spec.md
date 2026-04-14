### Requirement: Dashboard shell is displayed after a file is loaded

The app SHALL display the dashboard shell as the main screen once a data file has been successfully opened. The dashboard shell SHALL include:

- An application header containing the app name, a profile selector, and a settings button.
- The accounts screen below the header.

```
┌──────────────────────────────────────────────────────────────┐
│ My Money    [All ▼]                                  [⚙ ]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  (AccountsScreen — filtered by selected profile)            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Scenario: Dashboard shown after creating a new file
- **WHEN** the user creates a new data file
- **THEN** the dashboard shell is displayed with the profile selector set to "All"
- **AND** the welcome screen is no longer visible

#### Scenario: Dashboard shown after opening an existing file
- **WHEN** the user opens an existing data file
- **THEN** the dashboard shell is displayed with the profile selector set to "All"

#### Scenario: Dashboard shown on reopen of last-used file
- **WHEN** the app starts with a valid last-used file path
- **AND** the file is found and opened
- **THEN** the dashboard shell is displayed directly without showing the welcome screen
- **AND** the profile selector is set to "All"

---

### Requirement: Dashboard shell provides navigation to settings

The dashboard shell SHALL include a means for the user to navigate to the settings screen. The settings navigation control SHALL be displayed in the header alongside the profile selector.

#### Scenario: User navigates to settings from dashboard
- **WHEN** the user is on the dashboard
- **AND** the user activates the settings navigation control
- **THEN** the settings screen is displayed

---

### Requirement: [F-05] Dashboard shell hosts the profile selector state

The dashboard shell SHALL own the `selectedTagId` state (type `number | null`, default `null` = "All"). It SHALL load the tag list on mount and pass it to the `ProfileSelector` component. When a tag is created inline from the account form, the dashboard shell SHALL refresh its tag list.

#### Scenario: Profile state initialises to All on mount
- **WHEN** the dashboard shell mounts (file opened or app started)
- **THEN** `selectedTagId` is `null` and the profile selector displays "All"

#### Scenario: Selecting a profile updates selectedTagId
- **WHEN** the user selects a tag in the profile selector
- **THEN** `selectedTagId` is set to that tag's id
- **AND** the accounts list re-renders showing only accounts for that tag

#### Scenario: Tag list refreshes after inline tag creation
- **WHEN** a new tag is created from within the account form
- **THEN** the dashboard shell re-fetches the tag list
- **AND** the new tag appears in the profile selector's options
