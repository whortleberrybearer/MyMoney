## Why

The app needs a way to group accounts into named profiles (e.g. Personal, Joint) so that the entire UI can be filtered to show only the accounts — and their associated balances and transactions — that belong to that profile. This is the foundational feature (F-05) that enables multi-profile personal finance tracking in a single data file.

## What Changes

- The tag field on the account create/edit form changes from a dropdown to a free-text input with autocomplete, enabling inline tag creation (no separate tag management screen needed).
- A profile selector is added to the navigation bar, offering "All" plus one entry per tag. Selecting a profile filters the account list (and future views) to accounts with that tag.
- Profile selection persists for the session but resets on app restart.
- Inactive accounts continue to be hidden by default; their visibility is independent of the active profile.
- No schema changes required — the `tag` and `account_tag` tables already exist.
- The `Personal` and `Joint` seed tags must be present on first run; this is already wired in `reference-data-seed` but must be verified.

**Dependency:** F-02 (account management) must be complete — ✅ already shipped.

## Capabilities

### New Capabilities

- `profile-selector`: Global profile/tag context held in app state. A selector rendered in the nav bar allows the user to choose "All" or a specific tag. The selected profile is passed as a filter to any view that lists accounts.

### Modified Capabilities

- `account-management`: Tag field on the create/edit form changes from a `<Select>` dropdown to a free-text combobox with autocomplete against existing tags. Typing a name not in the list and confirming creates the tag automatically. The `listAccounts` query gains an optional `tagId` parameter to support profile filtering.
- `dashboard-shell`: The navigation bar gains the profile selector component. The shell must source the tag list and thread the selected profile through to child screens.

## Impact

- `src/lib/reference-data.ts` — add `createTag` function for inline tag creation.
- `src/lib/accounts.ts` — `listAccounts` gains an optional `tagId` filter parameter.
- `src/components/AccountFormSheet.tsx` — tag field replaced with a combobox component.
- `src/components/AccountsScreen.tsx` — receives active `tagId` from parent and passes to `listAccounts`.
- `src/components/DashboardShell.tsx` — hosts profile selector state and renders the `ProfileSelector` component in the header.
- New component: `src/components/ProfileSelector.tsx`.
- New shadcn/ui component needed: `combobox` (popover + command palette pattern from shadcn docs).
- No Drizzle migration needed — schema already supports tags.
