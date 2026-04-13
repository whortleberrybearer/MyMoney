## 1. Database Schema and Migration

- [ ] 1.1 Add `account` table definition to `src/lib/db/schema.ts` with columns: id, name, institution_id (FK), account_type_id (FK), currency, opening_balance, opening_date, notes, is_active, is_deleted
- [ ] 1.2 Add `account_tag` junction table definition to `src/lib/db/schema.ts` with columns: account_id (FK), tag_id (FK), composite PK
- [ ] 1.3 Run `drizzle-kit generate` to produce the `0001_*.sql` migration file
- [ ] 1.4 Add the new migration SQL to the inlined migrations array in `src/lib/db/index.ts`
- [ ] 1.5 Verify the app starts and migration `0001` runs without errors on a fresh database

## 2. Tauri Commands — Institution CRUD

- [ ] 2.1 Implement `list_institutions` command returning all institution rows ordered by name
- [ ] 2.2 Implement `create_institution` command with unique-name validation (case-insensitive); return the new row
- [ ] 2.3 Implement `update_institution` command with unique-name validation excluding the updated row; return the updated row
- [ ] 2.4 Implement `delete_institution` command that checks for linked accounts and returns an error if any exist; otherwise deletes the row
- [ ] 2.5 Register all institution commands in the Tauri `invoke_handler`

## 3. Tauri Commands — Account CRUD

- [ ] 3.1 Implement `list_accounts` command accepting a `show_inactive: bool` parameter; returns accounts with `is_deleted = 0`, filtered by `is_active` when `show_inactive` is false; join institution, account_type, and first tag
- [ ] 3.2 Implement `create_account` command with unique-name validation (excluding deleted accounts); inserts into `account` and optionally `account_tag`; return the new row
- [ ] 3.3 Implement `update_account` command updating all account fields; replace `account_tag` entry if tag changed; return the updated row
- [ ] 3.4 Implement `set_account_active` command accepting `account_id` and `is_active: bool`; sets `is_active` on the row
- [ ] 3.5 Implement `delete_account` command that sets `is_deleted = 1` (soft-delete) on the account and removes its `account_tag` rows
- [ ] 3.6 Register all account commands in the Tauri `invoke_handler`

## 4. Accounts Screen — List View

- [ ] 4.1 Add an Accounts tab/section to `DashboardShell` replacing the "No data yet" placeholder; add the necessary navigation control
- [ ] 4.2 Create `AccountsScreen` component that fetches and renders the accounts list via `list_accounts`
- [ ] 4.3 Build the accounts table with columns: Institution, Name, Type, Currency, Opening Balance, and a row actions menu (Edit, Deactivate/Reactivate, Delete)
- [ ] 4.4 Add the "Show inactive" `Switch` toggle; inactive accounts shown when toggle is on, rendered with muted/greyed styling
- [ ] 4.5 Add the "+ Add Account" button that opens the account form Sheet

## 5. Institution Management Dialog

- [ ] 5.1 Create `InstitutionManagementDialog` component displaying all institutions in a list with Edit and Delete buttons per row
- [ ] 5.2 Implement inline "Add Institution" row with a text input and save/cancel controls; call `create_institution` on save
- [ ] 5.3 Implement inline edit row for renaming; call `update_institution` on save
- [ ] 5.4 Implement delete with `AlertDialog` confirmation; call `delete_institution` on confirm; show an error message if the institution has linked accounts

## 6. Account Create/Edit Form (Sheet)

- [ ] 6.1 Create `AccountFormSheet` component with controlled inputs for all fields: Name, Institution (Select), Account Type (Select), Currency (Select), Opening Balance (number Input), Opening Date (date Input), Tag (Select, optional), Notes (Textarea, optional)
- [ ] 6.2 Pre-populate Currency with the app's default currency setting when opening in create mode
- [ ] 6.3 Pre-populate all fields with existing values when opening in edit mode
- [ ] 6.4 Add a "Manage" link next to the Institution select that opens `InstitutionManagementDialog` without closing the Sheet; refresh the institution list after the dialog closes
- [ ] 6.5 Implement form validation: required-field errors for Name, Institution, Account Type, Currency, Opening Balance, Opening Date; duplicate-name error from command response
- [ ] 6.6 Wire Save button to `create_account` (create mode) or `update_account` (edit mode); close Sheet and refresh accounts list on success

## 7. Delete and Deactivate Actions

- [ ] 7.1 Implement account delete flow: show `AlertDialog` with account name; call `delete_account` on confirm; refresh accounts list
- [ ] 7.2 Implement deactivate/reactivate flow: call `set_account_active` with toggled value; refresh accounts list; no confirmation required
