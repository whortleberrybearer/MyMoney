### Requirement: App layout shell wraps all authenticated screens
The app SHALL render a persistent `AppLayout` shell for all screens that require an open data file (dashboard, accounts-overview, settings, import, rules, transaction-list, pot-transaction-list). The shell SHALL contain a 200px dark navy sidebar on the left and a main content area occupying the remaining width.

```
┌────────────┬─────────────────────────────────────────────┐
│  MyMoney   │  <TopBar: title + search>                   │
│  Personal  ├─────────────────────────────────────────────┤
│  Finance   │                                             │
│──────────  │                                             │
│  Pinned    │          <Screen Content>                   │
│  Accounts  │                                             │
│──────────  │                                             │
│  Dashboard │                                             │
│  Accounts  │                                             │
│  Settings  │                                             │
└────────────┴─────────────────────────────────────────────┘
```

shadcn/ui components: none required (sidebar uses Tailwind utility classes only).

#### Scenario: Sidebar is visible on dashboard screen
- **WHEN** the app navigates to the dashboard screen
- **THEN** the AppLayout sidebar is rendered with the "Dashboard" nav item highlighted

#### Scenario: Sidebar is visible on accounts-overview screen
- **WHEN** the app navigates to the accounts-overview screen
- **THEN** the AppLayout sidebar is rendered with the "Accounts" nav item highlighted

#### Scenario: Sidebar is visible on settings screen
- **WHEN** the app navigates to the settings screen
- **THEN** the AppLayout sidebar is rendered with the "Settings" nav item highlighted

#### Scenario: AppLayout is not shown on welcome or loading screens
- **WHEN** the app is displaying the welcome, loading, file-not-found, or migration-error screen
- **THEN** the AppLayout sidebar is NOT rendered

---

### Requirement: Sidebar navigation links
The sidebar SHALL contain three navigation links: Dashboard, Accounts, and Settings. Activating a link SHALL navigate to the corresponding screen. The currently active screen's link SHALL be visually highlighted with a teal left border accent and teal icon colour.

shadcn/ui components: Button (ghost variant) or plain div with Tailwind hover styles.

#### Scenario: Clicking Dashboard navigates to dashboard
- **WHEN** the user clicks the "Dashboard" sidebar link
- **THEN** the app navigates to the dashboard screen

#### Scenario: Clicking Accounts navigates to accounts overview
- **WHEN** the user clicks the "Accounts" sidebar link
- **THEN** the app navigates to the accounts-overview screen

#### Scenario: Clicking Settings navigates to settings
- **WHEN** the user clicks the "Settings" sidebar link
- **THEN** the app navigates to the settings screen

#### Scenario: Active link is highlighted
- **WHEN** the current screen is "Accounts"
- **THEN** the Accounts sidebar link has the teal left border and teal icon
- **AND** the Dashboard and Settings links have no highlight

---

### Requirement: Sidebar branding header
The sidebar SHALL display the app name "MyMoney" and the subtitle "Personal Finance" at the top in the logo area, separated from the nav links by a horizontal rule.

#### Scenario: Branding is always visible
- **WHEN** any authenticated screen is displayed
- **THEN** the sidebar shows "MyMoney" in bold and "Personal Finance" as a subtitle beneath it

---

### Requirement: Sidebar pinned accounts placeholder
The sidebar SHALL contain a "Pinned Accounts" section below the branding area. In this initial implementation it SHALL display a static placeholder ("No pinned accounts") rather than live data.

#### Scenario: Pinned accounts section shows placeholder
- **WHEN** the sidebar is rendered
- **THEN** the "Pinned Accounts" section is visible with a placeholder message indicating no accounts are pinned

---

### Requirement: Design token CSS custom properties
`App.css` SHALL define the following design-system CSS custom properties in `:root` (light) and `.dark` overrides:

| Token | Light | Dark |
|---|---|---|
| `--ds-navy` | `#1A1A2E` | `#1A1D2C` |
| `--ds-bg` | `#FAFAF8` | `#0E1017` |
| `--ds-surface` | `#FFFFFF` | `#181B2A` |
| `--ds-teal` | `#4A9E8A` | `#5BBFAB` |
| `--ds-teal-light` | `#E8F4F1` | `#142620` |
| `--ds-border` | `#E2DDD6` | `#252838` |
| `--ds-text` | `#1A1A2E` | `#E2DFFA` |
| `--ds-text-mid` | `#B8B0A4` | `#44475A` |
| `--ds-text-dim` | `#8C8478` | `#8888A8` |
| `--ds-red` | `#C94040` | `#E06868` |
| `--ds-green` | `#2E8A5A` | `#4AAA70` |

#### Scenario: Design tokens are available in light mode
- **WHEN** the `.dark` class is absent from `<html>`
- **THEN** `var(--ds-navy)` resolves to `#1A1A2E`

#### Scenario: Design tokens update in dark mode
- **WHEN** the `.dark` class is present on `<html>`
- **THEN** `var(--ds-navy)` resolves to `#1A1D2C`
- **AND** `var(--ds-bg)` resolves to `#0E1017`
