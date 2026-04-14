## Context

The app already has `tag` and `account_tag` tables in the schema and the account form exposes a tag dropdown. What's missing is:

1. **Inline tag creation** — the current tag field is a static `<Select>` populated from the DB; the user cannot create a new tag from the form.
2. **Profile selector** — no global filter exists; all views always show all accounts.

The `DashboardShell` is the root of the "in-session" UI. It renders a header and hosts `AccountsScreen`. Any global filter state needs to live here (or in a context it provides) so that future views (transactions, net worth) can consume it without prop-drilling through the full component tree.

## Goals / Non-Goals

**Goals:**
- Add a profile selector to the nav bar (All + one per tag) that filters the accounts list.
- Enable inline tag creation from the account form via a free-text combobox with autocomplete.
- Keep profile selection in React state (session-only, no persistence to DB or local storage).
- Ensure `listAccounts` accepts an optional tag filter to support profile-scoped queries.

**Non-Goals:**
- Filtering transactions, net worth, or dashboard balance widgets — those views don't exist yet.
- Tag rename or delete operations.
- Persisting the selected profile across app restarts.
- Multi-tag accounts (the schema supports it but the UI continues to allow only one tag per account).

## Decisions

### Decision 1: Profile state lives in `DashboardShell` (not a new context)

**Choice:** Store `selectedTagId: number | null` as local state in `DashboardShell` and pass it as a prop to `AccountsScreen`. `null` means "All".

**Rationale:** Only `AccountsScreen` consumes the filter today. Adding a context for one consumer before there are multiple consumers is premature abstraction. When future views (transactions, net worth) are added, the state can be promoted to a context at that point. DashboardShell already acts as the layout root and owns the header, so profile state fits naturally there.

**Alternative considered:** A new `ProfileContext`. Rejected — there's only one consumer now and it adds indirection with no current benefit.

---

### Decision 2: Tag list loaded once in `DashboardShell`, shared to both `ProfileSelector` and `AccountFormSheet`

**Choice:** `DashboardShell` fetches the tag list on mount and passes it as a prop to `ProfileSelector`. `AccountFormSheet` continues to fetch its own tag list on open, but gains a callback to signal when a new tag is created so `DashboardShell` can refresh.

**Rationale:** `ProfileSelector` needs the tag list to render its options. `AccountFormSheet` also needs the tag list for autocomplete. Loading in two places is a minor duplication but it keeps the components independent and avoids threading a stale list through multiple layers. The profile selector refresh on new tag creation is the critical path.

**Alternative considered:** A shared tag list prop passed from `DashboardShell` down to `AccountFormSheet`. Rejected — `AccountFormSheet` opens asynchronously and already manages its own ref data loading lifecycle; threading the list adds unnecessary coupling.

---

### Decision 3: Combobox implemented using shadcn/ui Popover + Command pattern

**Choice:** Implement the tag combobox as a new `TagCombobox` component using the `Popover` and `Command` components from shadcn/ui (the standard shadcn combobox recipe). If `Command` is not yet present in the project, copy it in.

**Rationale:** The shadcn combobox pattern (Popover + Command) is the canonical way to do searchable selects in this project's UI stack. It avoids a third-party dependency and stays consistent with the rest of the UI.

**Alternative considered:** A plain `<Input>` with a `<datalist>`. Rejected — no keyboard navigation, poor accessibility, and inconsistent styling.

---

### Decision 4: Inline tag creation in the combobox — create-on-confirm

**Choice:** When the user types a name that doesn't match any existing tag and presses Enter (or clicks a "Create `<name>`" item in the dropdown), call `createTag(name)` immediately, append the new tag to the local list, and select it. The DB write is fire-and-forget within the combobox; errors are surfaced inline.

**Rationale:** The issue explicitly states "no dedicated tag management screen is needed at this stage." Inline creation with immediate persistence keeps the UX simple and eliminates the need for a deferred-save pattern.

**Alternative considered:** Create the tag only when the account form is saved. Rejected — it complicates the save path and means the tag doesn't exist in the DB until the account is saved, which breaks the `ProfileSelector` refresh flow.

---

### Decision 5: `listAccounts` gains an optional `tagId` filter

**Choice:** Add an optional `tagId: number | null` parameter to `listAccounts`. When `null`, all accounts are returned (current behaviour). When set, only accounts linked to that tag via `account_tag` are returned (in addition to the existing `showInactive` filter).

**Rationale:** The DB join to `account_tag` is already present in the query. Adding a `.where` condition is the minimal change.

## Risks / Trade-offs

- **[Risk] Stale profile selector after tag creation** → After the user creates a new tag inline in `AccountFormSheet`, `DashboardShell` must re-fetch the tag list so the new tag appears in `ProfileSelector`. Mitigation: `AccountFormSheet` accepts an `onTagCreated` callback; `DashboardShell` uses it to trigger a tag list reload.

- **[Risk] Combobox component not yet in the project** → `Popover` and `Command` may not be present. Mitigation: copy them in from shadcn/ui before implementing `TagCombobox`. The tasks file will include this as an explicit step.

- **[Risk] `listAccounts` tag filter applies an INNER JOIN semantic** → If a tag filter is active, accounts with no tag entry in `account_tag` will be excluded. This is the intended behaviour but could surprise developers adding the filter. Mitigation: document the filter semantics in the function's JSDoc.

## Migration Plan

No DB migration required. The `tag` and `account_tag` tables already exist. The seed data (`Personal`, `Joint`) should already be present via `reference-data-seed`; no additional seeding is needed.

Deployment is a standard app build — no rollback complexity.

## Open Questions

- None. The scope is fully bounded by the existing account-management feature and the `DashboardShell` layout.
