## Context

The `category` table and its 30 seed rows exist since F-01. Transactions already carry `category_id` as a nullable FK. The transaction side-drawer (`TransactionFormSheet`) already renders a `<Select>` for category using `listCategories()` from `reference-data.ts`.

What is missing:
1. A settings section to add and delete categories.
2. The category select in the transaction drawer is currently a plain `<Select>` — the issue requires a searchable dropdown (combobox pattern).
3. A `categories.ts` data-layer module to encapsulate CRUD (currently `listCategories` is in `reference-data.ts` alongside read-only lookups).

Categorisation rules (issue #10) are not yet implemented — the schema has no rules table. The deletion flow must handle transaction reassignment now, and stub the rules-reassignment path for when #10 ships.

## Goals / Non-Goals

**Goals:**
- Settings page section: list categories alphabetically, add new, delete (with in-use reassignment flow)
- Protect the `Uncategorised` system category from deletion
- Upgrade the category field in the transaction drawer from `<Select>` to a searchable combobox
- All business logic (add, delete, reassign) in the frontend data layer (`src/lib/categories.ts`)
- Full unit tests for the data layer and component-level tests for the UI
- E2E (Playwright) tests covering the critical flows

**Non-Goals:**
- Renaming categories (explicitly out of scope per issue)
- Manual sort-order reordering
- Categorisation rules integration (issue #10) — stub the path, don't implement it
- A new Drizzle migration — no schema changes needed

## Decisions

### Data layer: new `src/lib/categories.ts` module

Rather than adding mutation functions to `reference-data.ts` (which is a read-only lookup helper used at form load time), category CRUD gets its own module. This matches the pattern used by `institutions.ts` and `transactions.ts`.

`listCategories` will be moved here (or re-exported from here) to keep the module cohesive. `reference-data.ts` will delegate to it.

### In-use check: query `transaction` table only

The categorisation rules table does not exist yet (issue #10). The "in-use" check queries `transaction` for rows where `category_id = id AND is_void = 0`. When issue #10 lands it will add the rules table check. The `deleteCategory` function will accept an optional `replacementId` parameter; the caller is responsible for providing it when the category is in use.

### Category in-use detection: before showing the dialog

`deleteCategory` will:
1. Count transactions using the category.
2. If count > 0 AND no `replacementId` is provided — throw an error with a machine-readable code (`CATEGORY_IN_USE`) so the UI can show the replacement picker.
3. If `replacementId` is provided — reassign transactions then delete.
4. If count = 0 — delete directly (after confirming the category is not a system category).

### Searchable category dropdown: shadcn Combobox pattern

`command.tsx` and `popover.tsx` are already present. A reusable `CategoryCombobox` component will be built using `<Popover>` + `<Command>` (standard shadcn combobox pattern), replacing the plain `<Select>` in `TransactionFormSheet`. `Uncategorised` is always the first entry.

### Settings UI: inline section, not a modal

Institution management lives in a dialog (`InstitutionManagementDialog`) opened from a button in the settings screen. Categories will follow the same approach — a `CategoryManagementDialog` opened from the settings screen — keeping the settings page layout consistent.

### Unique name check: case-insensitive

Consistent with institution names (`lower(name) = lower(input)`).

## Risks / Trade-offs

- **[Risk] Categorisation rules stub** — the deletion flow silently skips rules reassignment until issue #10 ships. If a user deletes a category before rules are implemented, no data is lost (transactions are reassigned). When issue #10 lands the rules reassignment must be added.  
  → Mitigation: document the stub clearly in `deleteCategory` with a `// TODO(#10)` comment.

- **[Risk] `listCategories` relocation** — moving or re-exporting from `reference-data.ts` could break existing callers (`TransactionFormSheet`, `TransactionListScreen`).  
  → Mitigation: re-export from `reference-data.ts` to keep existing imports valid; migrate callers in the same PR.

## Migration Plan

No database migration required. The `category` table already exists with the correct schema.

## Open Questions

None — scope is fully defined by issue #9.
