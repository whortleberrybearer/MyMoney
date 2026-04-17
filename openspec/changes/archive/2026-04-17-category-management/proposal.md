## Why

The `category` table and seed data have existed since F-01, and transactions already store a `category_id`, but there is no UI for managing categories. Users have no way to add or remove categories, and no way to change the category assigned to a transaction through the UI.

## What Changes

- Add a **Category Management** settings section: lists all categories alphabetically, allows adding new categories, and supports deleting categories (with mandatory replacement selection when the category is in use by transactions or categorisation rules)
- The `Uncategorised` system category is protected from deletion
- Wire the **category field** into the existing transaction side-drawer edit flow as a searchable dropdown, including `Uncategorised` as a valid selection

## Capabilities

### New Capabilities

- `category-management`: CRUD UI for the category list — add, delete (with reassignment flow), and protected system-category handling. Lives on the Settings screen.
- `transaction-category-edit`: Category field in the transaction side-drawer (edit form) as a searchable dropdown over all categories including `Uncategorised`.

### Modified Capabilities

- `transaction-list`: Category filter dropdown and Category column already exist. No requirement changes — implementation details only (category data is already displayed; this change adds the edit path via the existing drawer).

## Impact

- **Frontend:** new `CategoryManagementSection` component (settings), updates to `TransactionFormSheet` to add category dropdown, new `useCategoryManager` hook or equivalent
- **Backend (Tauri commands):** `get_categories`, `add_category`, `delete_category` (with reassignment param)
- **Database:** No schema changes — `category` table and `category_id` on `transaction` already exist. No migration required.
- **Dependencies:** F-01 (category seed), F-08 (transaction list + drawer edit flow) must be complete before this work ships
