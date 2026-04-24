## Why

The app currently uses a horizontal header bar for navigation, which limits scalability and doesn't match the professional banking aesthetic defined in the new wireframe design system. Introducing a persistent left sidebar and an Account Overview screen aligns the UI with the signed-off design direction and gives users a financial-dashboard feel consistent with apps like Starling.

## What Changes

- Replace the horizontal header in `DashboardShell` with a persistent dark navy left sidebar (logo, pinned accounts, nav links: Dashboard, Accounts, Settings)
- Add a top bar component with page title and search placeholder that sits inside the main content area
- Create a new **Account Overview** screen (`AccountsOverviewScreen`) showing all accounts grouped by type (Current, Savings, Pensions, Mortgages, Loans) in a card grid with tags, pots, and per-category colour accents
- Add an `accounts-overview` screen state to `AppScreen` in `app-context.tsx` and wire navigation from the sidebar
- Wrap all existing screens (Dashboard/AccountsScreen, Settings, Import, Rules, TransactionList, PotTransactionList) inside the new `AppLayout` shell so the sidebar is always present when the app is open
- Update `App.css` design tokens to reflect the new design system colour palette alongside the existing OKLCH theme variables (both light and dark)
- No schema changes; no new DB tables; no Drizzle migration required

## Capabilities

### New Capabilities

- `app-layout`: Persistent sidebar shell that wraps all authenticated screens, providing navigation between Dashboard, Accounts Overview, and Settings
- `accounts-overview`: Grid view of all accounts grouped by category (Current, Savings, Pensions, Mortgages, Loans), with account cards showing balance, bank name, tags, and inline pot breakdowns

### Modified Capabilities

- `dashboard-shell`: Navigation is moved from the horizontal header to the sidebar; existing AccountsScreen content remains but is now wrapped in the new layout shell
- `theme-preference`: CSS custom properties updated to include design-system colour tokens (navy, teal, etc.) alongside existing OKLCH variables so both the sidebar and content area theme correctly in light/dark mode

## Impact

- `src/components/DashboardShell.tsx` — refactored; header replaced by sidebar wrapper
- `src/components/AppLayout.tsx` — new file
- `src/components/AccountsOverviewScreen.tsx` — new file
- `src/lib/app-context.tsx` — `AppScreen` union gains `accounts-overview` variant
- `src/App.tsx` — new case added to screen switch
- `src/App.css` — design token variables extended
- No new npm dependencies required; existing shadcn/ui primitives and Lucide icons are sufficient
