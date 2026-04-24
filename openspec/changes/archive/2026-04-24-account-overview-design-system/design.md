## Context

The app currently has a flat header-based navigation pattern in `DashboardShell`: a single horizontal bar with a logo, profile selector, and icon buttons for Import, Rules, and Settings. All content lives in `AccountsScreen` directly below. There is no concept of separate top-level views — "Dashboard" and everything else are implicitly the same screen.

The new wireframe design system (Claude Design handoff) specifies:
- A persistent **dark navy sidebar** (200px wide) with logo, pinned accounts section, and nav links
- A **top bar** (52px) per page with title and search
- An **Accounts Overview** page as a first-class screen distinct from the current dashboard
- Light and dark themes for the full layout including the sidebar

The current `app-context.tsx` `AppScreen` union drives all navigation. The existing screens (settings, import, rules, transaction-list, etc.) remain unchanged in content — only their outer wrapping changes.

## Goals / Non-Goals

**Goals:**
- Introduce `AppLayout` as a persistent sidebar shell rendered around all post-welcome screens
- Create `AccountsOverviewScreen` matching the wireframe: account cards grouped by type, with tags and inline pots
- Add an `accounts-overview` screen to the navigation state machine
- Update design tokens in `App.css` to expose the new colour palette (navy, teal, teal-light, etc.) as CSS custom properties, consistent with existing OKLCH variables and dark mode
- Sidebar nav includes Dashboard, Accounts, and Settings links — wired to the existing navigation actions

**Non-Goals:**
- Redesigning the internals of AccountsScreen, TransactionListScreen, SettingsScreen, etc.
- Implementing the "pinned accounts" sidebar section with live data (shown as static placeholder initially)
- Building the Mortgage, Pension, Stocks & Shares, or Spending Insights screens from the wireframe
- Adding search functionality to the top bar

## Decisions

### Decision 1: AppLayout as a wrapper, not a replacement

**Choice:** Introduce `AppLayout` as a thin presentational wrapper that accepts `activeScreen`, `onNavigateTo*` callbacks, and renders the sidebar + a `children` slot. Each screen component stays independent and renders inside `<AppLayout>`.

**Alternative considered:** Fold the sidebar directly into `DashboardShell` and special-case it per screen. Rejected because it scatters layout concerns across many files.

**Rationale:** AppLayout is a single source of truth for the sidebar. Screens remain testable in isolation.

### Decision 2: Sidebar nav state driven by AppScreen, not local state

**Choice:** The sidebar receives an `activeScreen` string derived from `current.screen` in `App.tsx`. It highlights the active link visually but does not own navigation state.

**Rationale:** The existing `app-context.tsx` state machine is already the authoritative navigation source. Adding a second navigation atom would create synchronisation bugs.

### Decision 3: Design tokens as CSS custom properties alongside existing OKLCH variables

**Choice:** Add new design-system tokens (`--ds-navy`, `--ds-teal`, `--ds-bg`, etc.) to `App.css` in `:root` and `.dark` blocks alongside the existing shadcn/ui OKLCH variables. Components use `var(--ds-*)` for design-system-specific colours.

**Alternative considered:** Replace all existing shadcn OKLCH variables with the new tokens. Rejected — breaks all existing shadcn/ui components that depend on the current variable names.

**Rationale:** Additive change; zero risk to existing UI.

### Decision 4: AccountsOverviewScreen reads from existing `listAccounts` and `listPots` functions

**Choice:** Reuse the existing `listAccounts()` and `listPots()` lib functions. The overview screen maps the returned `AccountType` values to the five display categories (current/savings/pensions/mortgages/loans).

**Rationale:** No new data access layer needed. The account type field on the `account` table already encodes the category. Tags are already available via `account.tags` from the existing join.

### Decision 5: ProfileSelector moves into the sidebar

**Choice:** The `ProfileSelector` (tag filter) moves from the `DashboardShell` header into the sidebar, below the pinned accounts section. It only affects the Dashboard (AccountsScreen) content, so it is passed down through `AppLayout` as an optional prop.

**Alternative considered:** Keep it in a top bar. Rejected — the wireframe sidebar has the pinned accounts section; the profile filter logically belongs alongside account filtering.

## Risks / Trade-offs

- **Sidebar width reduces content area** — 200px sidebar means existing screens (e.g., transaction table) have less horizontal space. At typical desktop widths (1280px+) this is fine. → No mitigation needed for initial cut; monitor if user reports cramping on smaller windows.
- **AccountsOverview account-type mapping** — The `account_type` column values in the DB may not map 1:1 to the five display categories from the wireframe. → Map at render time in the component; unknown types fall through to a catch-all "Other" section.
- **Pinned accounts section is static placeholder** — Requires a future feature (account pinning preference) to become dynamic. → Render static placeholder text "No pinned accounts" initially.

## Migration Plan

No database migration. The change is purely frontend:
1. Add CSS tokens to `App.css`
2. Create `AppLayout.tsx`
3. Create `AccountsOverviewScreen.tsx`
4. Update `app-context.tsx` with new screen variant
5. Update `App.tsx` to wrap screens in `AppLayout` and add the new case
6. Refactor `DashboardShell.tsx` to remove the header (sidebar is now in `AppLayout`)

Rollback: revert the five changed/new files — no DB state involved.

## Open Questions

- Should the `ProfileSelector` remain visible on all screens or only on the Dashboard? (Current assumption: only shown when Dashboard is active.)
- Should the sidebar show live account totals in the "Pinned Accounts" section from day one, or is a static placeholder acceptable for this change? (Current assumption: static placeholder.)
