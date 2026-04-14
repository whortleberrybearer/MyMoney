## ADDED Requirements

### Requirement: [F-05] Profile selector is displayed in the navigation bar

The system SHALL display a profile selector in the application header. The selector SHALL offer "All" as the default option plus one option per tag that exists in the database. The selected profile SHALL be displayed prominently as the selector's current value.

```
┌──────────────────────────────────────────────────────────────┐
│ My Money    [All ▼]                                  [⚙ ]    │
└──────────────────────────────────────────────────────────────┘
                 ↑
         Profile selector
         (All / Personal / Joint / ...)
```

shadcn/ui component: `Select` (SelectTrigger, SelectContent, SelectItem).

#### Scenario: Profile selector shows All plus one entry per tag
- **WHEN** the user opens the application with tags "Personal" and "Joint" seeded
- **THEN** the profile selector shows "All", "Personal", and "Joint" as options

#### Scenario: Profile selector defaults to All on app start
- **WHEN** the application starts (or a new file is opened)
- **THEN** the profile selector is set to "All"

#### Scenario: New tag appears in profile selector after creation
- **WHEN** the user creates a new tag inline from the account form
- **THEN** the profile selector's options are refreshed to include the new tag

---

### Requirement: [F-05] Profile selection filters the account list

The system SHALL filter the accounts list to show only accounts that are linked (via `account_tag`) to the currently selected profile tag. Selecting "All" removes the filter and shows every account regardless of tag assignment.

#### Scenario: Selecting a profile hides accounts not linked to that tag
- **WHEN** the user selects "Personal" from the profile selector
- **THEN** only accounts whose `account_tag` row references the "Personal" tag are shown
- **AND** accounts with no tag or a different tag are hidden

#### Scenario: Selecting All shows every account
- **WHEN** the user selects "All" from the profile selector
- **THEN** all accounts are shown (subject to the existing inactive toggle state)

#### Scenario: Inactive toggle is independent of profile filter
- **WHEN** the user has "Personal" selected and toggles "Show inactive" on
- **THEN** inactive accounts belonging to the "Personal" tag are also shown
- **AND** inactive accounts belonging to other tags remain hidden

---

### Requirement: [F-05] Profile selection persists within the session

The selected profile SHALL remain active as the user navigates between screens (e.g. dashboard to settings and back). The profile SHALL reset to "All" when the application is restarted or a different file is opened.

#### Scenario: Profile persists when navigating to settings and back
- **WHEN** the user selects "Joint" from the profile selector
- **AND** the user navigates to the settings screen and returns
- **THEN** the profile selector still shows "Joint"

#### Scenario: Profile resets when a new file is opened
- **WHEN** the user opens a different data file
- **THEN** the profile selector resets to "All"
