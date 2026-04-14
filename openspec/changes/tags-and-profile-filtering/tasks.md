## 1. Data Layer — Tag Creation and Account Filtering

- [x] 1.1 Add `createTag(name: string): Promise<Tag>` to `src/lib/reference-data.ts` — inserts a row into the `tag` table (unique name, trimmed) and returns the created tag; throws if a tag with that name already exists
- [x] 1.2 Add tests for `createTag` covering: successful creation, duplicate name rejected, name is trimmed before insert
- [x] 1.3 Update `listAccounts` in `src/lib/accounts.ts` to accept an optional `tagId: number | null` parameter; when set, add a `.where` condition filtering `account_tag.tag_id = tagId`
- [x] 1.4 Add tests for `listAccounts` covering: returns all accounts when `tagId` is null, returns only matching accounts when `tagId` is set, combined `tagId` + `showInactive = false` filter

## 2. shadcn/ui — Add Popover and Command Components

- [x] 2.1 Copy the `popover` component from the shadcn/ui source into `src/components/ui/popover.tsx` (required by the combobox pattern)
- [x] 2.2 Copy the `command` component from the shadcn/ui source into `src/components/ui/command.tsx` (required by the combobox pattern)

## 3. TagCombobox Component

- [x] 3.1 Create `src/components/TagCombobox.tsx` — a controlled combobox that accepts `tags: Tag[]`, `value: number | null`, `onChange: (tagId: number | null) => void`, and `onTagCreated: (tag: Tag) => void`; renders a `Popover` + `Command` with filtered tag options and a "Create `<name>`" item when no match exists
- [x] 3.2 Add tests for `TagCombobox` covering: renders existing tags in the list, filters options as the user types, selecting an existing tag calls `onChange` with the tag id, selecting "Create" calls `createTag` then `onTagCreated` and `onChange`, clearing the selection calls `onChange` with null

## 4. Account Form — Replace Tag Dropdown with TagCombobox

- [x] 4.1 Update `src/components/AccountFormSheet.tsx` to replace the tag `<Select>` with `<TagCombobox>`; wire `value`, `onChange`, and `onTagCreated` (the callback should propagate up to `DashboardShell` for profile selector refresh)
- [x] 4.2 Add an `onTagCreated?: (tag: Tag) => void` prop to `AccountFormSheet` and thread it through to `TagCombobox`
- [x] 4.3 Add tests for `AccountFormSheet` covering: tag combobox renders in create mode, tag combobox is pre-populated in edit mode with the account's existing tag, saving the form with a newly created tag persists the correct `tagId`

## 5. ProfileSelector Component

- [x] 5.1 Create `src/components/ProfileSelector.tsx` — a controlled `Select` that accepts `tags: Tag[]`, `value: number | null` (null = "All"), and `onChange: (tagId: number | null) => void`; renders "All" as the first option followed by one option per tag
- [x] 5.2 Add tests for `ProfileSelector` covering: renders "All" plus one item per tag, selecting a tag calls `onChange` with the tag id, selecting "All" calls `onChange` with null

## 6. DashboardShell — Host Profile State and Render ProfileSelector

- [ ] 6.1 Update `src/components/DashboardShell.tsx` to load the tag list via `listTags()` on mount and store it in local state
- [ ] 6.2 Add `selectedTagId: number | null` state (default `null`) to `DashboardShell`; pass it and its setter to `ProfileSelector` and as a prop to `AccountsScreen`
- [ ] 6.3 Render `<ProfileSelector>` in the `DashboardShell` header between the app name and the settings button
- [ ] 6.4 Add a `handleTagCreated` callback in `DashboardShell` that re-fetches the tag list and passes it down as `onTagCreated` to `AccountFormSheet` (via `AccountsScreen`)
- [ ] 6.5 Add tests for `DashboardShell` covering: profile selector is rendered in the header, tag list is loaded on mount and passed to `ProfileSelector`, tag list refreshes after `handleTagCreated` is called

## 7. AccountsScreen — Accept and Apply Tag Filter

- [ ] 7.1 Update `src/components/AccountsScreen.tsx` to accept a `tagId: number | null` prop and an `onTagCreated: (tag: Tag) => void` prop; pass `tagId` to `listAccounts` and `onTagCreated` through to `AccountFormSheet`
- [ ] 7.2 Re-fetch accounts when `tagId` changes (add it to the `useEffect` dependency array)
- [ ] 7.3 Add tests for `AccountsScreen` covering: account list re-fetches when `tagId` prop changes, only accounts matching the `tagId` are displayed when a profile is active

## 8. Integration and Regression Tests

- [ ] 8.1 Add an integration test covering the full profile filter flow: seed "Personal" and "Joint" tags and two accounts (one per tag), select "Personal" profile, verify only the Personal account is shown
- [ ] 8.2 Add an integration test for inline tag creation flow: open account form, type a new tag name, confirm creation, verify tag appears in the profile selector and is saved to the DB
- [ ] 8.3 Verify existing account management tests still pass (no regression from `listAccounts` signature change)
