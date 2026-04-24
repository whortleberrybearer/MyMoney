## 1. Design Tokens

- [x] 1.1 Add `--ds-*` CSS custom properties to `src/App.css` in `:root` (light) and `.dark` blocks as specified in the app-layout spec

## 2. AppLayout Component

- [x] 2.1 Create `src/components/AppLayout.tsx` with the dark navy sidebar (200px), logo/branding header, "Pinned Accounts" static placeholder section, and nav links (Dashboard, Accounts, Settings)
- [x] 2.2 Wire the active-link highlight in `AppLayout`: accept `activeScreen` prop and apply teal left border + teal icon colour to the matching nav item
- [x] 2.3 Add a `TopBar` sub-component inside `AppLayout` (or as a separate file) that renders the page title and a search placeholder input

## 3. AppScreen & Navigation Wiring

- [x] 3.1 Add `accounts-overview` variant to the `AppScreen` union in `src/lib/app-context.tsx`
- [x] 3.2 Add `onNavigateToAccountsOverview` callback to `App.tsx` and wire it to the new screen case
- [x] 3.3 In `App.tsx`, wrap the authenticated screen cases (dashboard, settings, import, rules, transaction-list, pot-transaction-list) with `AppLayout`, passing the correct `activeScreen` prop and navigation callbacks

## 4. DashboardShell Refactor

- [x] 4.1 Remove the horizontal header (`<header>` element with logo, ProfileSelector, icon buttons) from `DashboardShell.tsx`
- [x] 4.2 Move the Import, Rules, and Settings icon buttons to be passed as navigation callbacks through `AppLayout` (already handled by App.tsx wiring in task 3.3)
- [x] 4.3 Render the `ProfileSelector` inside the `DashboardShell` content area (above `AccountsScreen`), not in a header

## 5. AccountsOverviewScreen

- [x] 5.1 Create `src/components/AccountsOverviewScreen.tsx` that fetches all active accounts and their pots on mount
- [x] 5.2 Implement the account-type-to-category mapping (Current, Savings, Pensions, Mortgages, Loans, Other) and group accounts accordingly
- [x] 5.3 Build the `AccountCard` sub-component: coloured top border, account name, bank name, balance (or pots total + pot list if pots exist), tags as badges
- [x] 5.4 Build the category section layout: colour dot, uppercase label, account count, 3-column grid of `AccountCard`s
- [x] 5.5 Wire account card click to navigate to the `transaction-list` screen for that account

## 6. Integration & Verification

- [x] 6.1 Verify sidebar navigation works end-to-end: Dashboard → AccountsOverview → Settings and back
- [x] 6.2 Verify dark mode: toggle to dark in Settings and confirm sidebar, top bar, and AccountsOverviewScreen all use the `--ds-*` dark tokens
- [x] 6.3 Verify existing screens (TransactionList, Import, Rules, PotTransactionList) still function correctly inside the new AppLayout shell
- [x] 6.4 Verify ProfileSelector still filters accounts on the Dashboard screen
