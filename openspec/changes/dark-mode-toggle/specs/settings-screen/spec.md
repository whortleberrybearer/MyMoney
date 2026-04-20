## ADDED Requirements

### Requirement: [Settings Screen] Settings screen provides a Theme preference control
The settings screen SHALL include a theme preference control with three options: **Light**, **Dark**, and **System**. The control SHALL reflect the currently active preference and update it immediately when the user changes it.

UI mockup:

```
┌─────────────────────────────────────────────┐
│ ← Settings                                  │
├─────────────────────────────────────────────┤
│                                             │
│  DATA FILE                                  │
│  /path/to/file.pfdata                       │
│  [ Switch data file ]                       │
│                                             │
│  APPEARANCE                                 │
│  Choose how the app looks.                  │
│  ┌───────────────────────┐                  │
│  │ System          ▼     │  (ToggleGroup)   │
│  └───────────────────────┘                  │
│   or:                                       │
│  [ Light ] [ Dark ] [ System ]  (selected)  │
│                                             │
│  CATEGORIES                                 │
│  ...                                        │
└─────────────────────────────────────────────┘
```

Use shadcn/ui `ToggleGroup` / `ToggleGroupItem` for the three-way selector.

#### Scenario: Settings screen shows current theme preference
- **WHEN** the user navigates to the settings screen
- **THEN** the theme control displays the currently active preference (Light, Dark, or System)
- **AND** the active option is visually indicated as selected

#### Scenario: User changes theme preference
- **WHEN** the user clicks a different theme option in the control
- **THEN** the new preference is applied immediately (per theme-preference capability)
- **AND** the selected option in the control updates to reflect the new preference
- **AND** no save or confirm action is required

#### Scenario: Default state shown when no preference persisted
- **WHEN** the user navigates to settings and no preference has previously been set
- **THEN** "System" is shown as the selected option
