## 1. Data Layer — `src/lib/categories.ts`

- [ ] 1.1 Create `src/lib/categories.ts` with `listCategories` (alphabetical order), `createCategory` (case-insensitive uniqueness check), and `deleteCategory` (accepts optional `replacementId`; throws `CATEGORY_IN_USE` error code when in-use and no replacement provided; reassigns transactions then hard-deletes when replacement is given; blocks deletion of system categories)
- [ ] 1.2 Re-export `listCategories` from `src/lib/reference-data.ts` to keep existing callers working without changes
- [ ] 1.3 Write unit tests in `tests/unit/categories.test.ts` covering: `listCategories` (returns all, alphabetical order), `createCategory` (success, duplicate name rejected, blank name rejected), `deleteCategory` (success when unused, system category blocked, in-use throws CATEGORY_IN_USE, reassigns transactions and deletes when replacement provided, replacement must be a valid different category)

## 2. UI — `CategoryCombobox` Component

- [ ] 2.1 Create `src/components/CategoryCombobox.tsx` using `<Popover>` + `<Command>` (shadcn combobox pattern). Props: `categories`, `value` (category id or null), `onChange`. `Uncategorised` is always the first entry and represents a null/cleared category. Supports keyboard-accessible search/filter.
- [ ] 2.2 Write unit tests in `tests/unit/CategoryCombobox.test.tsx` covering: renders all categories, typing filters list (case-insensitive), selecting a category fires onChange, Uncategorised is always present, pre-selects current value

## 3. UI — Transaction Form Sheet: Replace Select with CategoryCombobox

- [ ] 3.1 Update `src/components/TransactionFormSheet.tsx` to replace the `<Select>` category field with `<CategoryCombobox>`, loading categories via `listCategories` from `src/lib/categories.ts`
- [ ] 3.2 Update `tests/unit/TransactionFormSheet.test.tsx` to cover: category combobox is rendered, selecting a category updates form state, selecting Uncategorised clears category_id, category is pre-populated when editing a transaction with an existing category

## 4. UI — `CategoryManagementDialog` Component

- [ ] 4.1 Create `src/components/CategoryManagementDialog.tsx`. Displays all categories in alphabetical order; shows system indicator for `Uncategorised`; Add button opens inline input for new category name; Delete button per row (disabled for system categories); on delete of unused category shows confirmation `AlertDialog`; on delete of in-use category shows replacement picker `AlertDialog` with a dropdown of all other categories (including Uncategorised) and Confirm disabled until a selection is made
- [ ] 4.2 Write unit tests in `tests/unit/CategoryManagementDialog.test.tsx` covering: renders category list alphabetically, Uncategorised has delete disabled, add new category succeeds and refreshes list, add duplicate name shows error, add blank name shows error, delete unused category shows confirmation then deletes, cancel deletion leaves list unchanged, delete in-use category shows replacement picker with correct options (excludes category being deleted), confirm replacement reassigns and deletes, confirm button is disabled until replacement is selected

## 5. UI — Wire `CategoryManagementDialog` into Settings Screen

- [ ] 5.1 Update `src/components/SettingsScreen.tsx` to add a Categories section with an "Add / Manage" button (or inline section) that opens `CategoryManagementDialog`

## 6. E2E Tests — Category Management

- [ ] 6.1 Create `tests/e2e/category-management.test.ts` covering: seeded categories are visible in Settings, user can add a new category and it appears in the list, adding a duplicate name shows an error, Uncategorised delete button is disabled, user can delete an unused category after confirmation, cancelling deletion leaves list unchanged
- [ ] 6.2 Add E2E scenarios to `tests/e2e/category-management.test.ts` for the in-use deletion flow: create a transaction with a category, navigate to Settings, delete that category, confirm replacement picker appears, select Uncategorised as replacement, confirm — verify category is deleted and transaction now shows Uncategorised

## 7. E2E Tests — Transaction Category Edit

- [ ] 7.1 Create `tests/e2e/transaction-category-edit.test.ts` covering: category combobox is visible in the add transaction drawer, user can type to filter categories, user can select a category and save — transaction list shows the new category, user can edit a transaction and change its category, selecting Uncategorised clears the category (shows blank in list)
