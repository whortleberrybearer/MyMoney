## ADDED Requirements

### Requirement: [F-API-23] Settings screen includes API Connections section

The Settings screen SHALL include an **API Connections** section below the existing content. The section SHALL list all connected institutions (from `institution_api_connection`) with per-institution management options.

UI layout (shadcn/ui `Card` per institution, `Button` for actions):

```
┌─────────────────────────────────────────────────────┐
│  API CONNECTIONS                                    │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐   │
│  │ Starling Bank                                │   │
│  │ Last synced: 23 Apr 2026 10:42               │   │
│  │                                              │   │
│  │  Personal Current Account    [ Remove ]      │   │
│  │  Joint Account               [ Remove ]      │   │
│  │                                              │   │
│  │  [ Update PAT ]  [ Re-sync ]  [ Add account]│   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [ + Connect an institution ]                       │
└─────────────────────────────────────────────────────┘
```

#### Scenario: API Connections section shows connected institutions
- **WHEN** the user navigates to the Settings screen and at least one institution is connected
- **THEN** the API Connections section displays each connected institution with its name and last synced datetime

#### Scenario: Last synced shows "Never synced" when null
- **WHEN** `institution_api_connection.last_synced_at` is NULL
- **THEN** the last synced label shows "Never synced"

#### Scenario: Empty state prompts the user to connect
- **WHEN** no institutions are connected
- **THEN** the API Connections section shows a "Connect an institution" prompt with a button to start the connection flow

#### Scenario: Sync progress indicator is shown in Settings during active sync
- **WHEN** a sync is in progress for a connected institution
- **THEN** a progress indicator (e.g. spinner or status text) is visible next to that institution in the Settings view

---

### Requirement: [F-API-24] E2E tests cover Settings API Connections section

The API Connections section in Settings SHALL be covered by Playwright E2E tests.

#### Scenario: E2E test verifies empty state
- **WHEN** e2e tests are run with no institutions connected
- **THEN** a Playwright test verifies the empty state prompt is visible

#### Scenario: E2E test verifies connected institution appears
- **WHEN** e2e tests are run after connecting a fixture institution
- **THEN** a Playwright test verifies the institution card appears with the correct name and accounts
