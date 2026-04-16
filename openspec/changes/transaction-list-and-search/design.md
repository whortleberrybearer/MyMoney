## Context

The app can import transactions via OFX/QFX but has no UI to view or manage them. The `transaction` table is missing several columns the feature needs: `payee`, `reference`, `category_id`, `running_balance`. The `description` column that existed in the original schema has been superseded by `notes` (OFX import already maps bank text to `notes`), so `description` must be formally removed. This change delivers the transaction list screen and the backend commands to support it, including hard-delete with running balance recalculation.

Existing prior art to follow: `accounts.ts` / `AccountsScreen.tsx` / `AccountFormSheet.tsx` for the data-layer and UI patterns; `tests/unit/accounts.test.ts` and `tests/e2e/account-management.test.ts` for test patterns.

## Goals / Non-Goals

**Goals:**
- Extend the `transaction` table schema and generate a Drizzle migration
- Tauri-layer commands: list with sorting/filtering, create, update, hard-delete with running balance recalculation
- `TransactionListScreen` React component wired into the app router
- Navigate to the screen by clicking an account row on the dashboard
- Unit tests for all business logic (list, filter, create, update, delete, running balance)
- E2E tests covering the golden path (view, create, edit, delete) and key edge cases

**Non-Goals:**
- CSV import column mapping (separate change)
- Duplicate detection / review UI (separate change)
- Pot transaction views (pot has its own screen scope, out of scope here)
- Bulk operations (select-all delete, bulk categorise)
- Export / print

## Decisions

### D1: Hard-delete transactions, not soft-delete

**Decision:** Transactions use hard-delete (`DELETE FROM transaction`), not `is_void` / soft-delete.

**Rationale:** The issue spec explicitly calls this out: "No soft delete / void — transactions are deleted permanently." The existing `is_void` column was a placeholder convention; for transactions the product direction is intentional hard-delete. Audit history is not a requirement.

**Alternative considered:** Keep `is_void = 1` for deleted transactions and filter them out in queries. Rejected — adds query complexity everywhere and the product spec is explicit.

**Impact:** The `is_void` column becomes unused by this feature. It stays in the schema for now (removing it would require another migration) but is never set to 1. A follow-up migration can drop it once all import paths are confirmed to not rely on it.

### D2: Running balance stored per row, recalculated in the Tauri command layer

**Decision:** `running_balance` is a persisted column on each transaction row, recalculated synchronously within the same SQLite transaction whenever a transaction is created, updated (if date or amount changes), or deleted.

**Rationale:** Consistent with the existing architectural convention ("Running balance: stored on each transaction row — not calculated on the fly"). Simplifies the frontend to a simple read. SQLite's single-writer model means there are no concurrent-write races.

**Recalculation scope:** After any mutation, recalculate balances for all transactions with `date >= changed_transaction_date` for the affected account (ordered by date ASC, then by id ASC as tiebreaker). This is a full re-walk of the tail, not a delta — acceptable for personal finance volumes (thousands of rows, not millions).

**Alternative considered:** Calculate running balance in the frontend on read. Rejected — violates the architecture rule that business logic lives in Tauri commands.

### D3: `payee` as a plain text field on the transaction row

**Decision:** `payee` is a nullable `TEXT` column on the `transaction` table, not a normalised lookup table.

**Rationale:** The issue spec describes payee as "who the money went to or came from" — free text populated from bank import data or entered manually. Normalising it (like `category`) would add join complexity for unclear benefit at this stage. It can be promoted to a reference table in a future change if payee-based rules or analytics are needed.

### D4: Category as a nullable FK to the existing `category` table

**Decision:** `category_id` is a nullable integer FK referencing `category.id`. No category = uncategorised.

**Rationale:** The `category` table already exists (seeded with reference data in F-03). Reusing it avoids duplication. Nullable because imported transactions start uncategorised.

### D5: Transactions shown in the account list include virtual transfers from pots

**Decision:** `listTransactions` for an account returns both `account_id = accountId` rows AND rows where `transfer_id` links to a pot transfer into/out of a pot belonging to this account.

**Rationale:** Issue spec: "The account's own transactions + virtual transfers to/from pots belonging to this account." Pot transactions themselves (`pot_id IS NOT NULL`) are NOT shown here.

**Implementation:** JOIN `transfer` on `transfer_id` to find pot-side legs; include the account-side leg of the transfer in the list (it already has `account_id`). The pot-side leg (with `pot_id`) is excluded.

### D6: Navigation — new `transaction-list` screen in the app router

**Decision:** Add a `transaction-list` screen state to `app-context.tsx` carrying `{ screen: "transaction-list", filePath, accountId, accountName }`. Clicking an account row on the dashboard navigates to this screen. A back button returns to the dashboard.

**Rationale:** Follows the existing screen-switch pattern (no React Router). Keeps routing simple and consistent with all other screens.

## Risks / Trade-offs

- **Running balance recalculation cost** → Mitigated by limiting recalc to rows after the changed date. For accounts with thousands of transactions, this is still fast in SQLite (single file, local disk, no network).
- **Schema migration removes `description`** → If any existing import code references `description` directly, it will break. Mitigated: OFX import already writes to `notes`; CSV import is not yet implemented. A search for `description` in src/lib/ should be done before migration is applied.
- **`is_void` stays in schema** → Slight schema noise. No functional risk; filtered out in list query (`WHERE is_void = 0`).

## Migration Plan

1. Add Drizzle migration: add `payee TEXT`, `reference TEXT`, `category_id INTEGER REFERENCES category(id)`, `running_balance REAL NOT NULL DEFAULT 0`; drop `description TEXT`.
2. Run `npx drizzle-kit generate` and commit the migration file.
3. On first app launch with the new build, Drizzle applies the migration automatically.
4. Existing imported transactions get `running_balance = 0` by default; the user can trigger a recalc by editing/deleting a transaction (or a future "recalculate all" tool).
5. Rollback: revert the migration file and the schema change. Data loss risk: `payee`, `reference`, `category_id`, `running_balance` values entered after migration would be lost.

## Open Questions

- Should sorting within the same date use a stable secondary sort (e.g. by `id` ascending)? **Assumed yes** — id insertion order is the natural tiebreaker.
- Should the filter panel be a sidebar or a top toolbar? **Assumed top toolbar with collapsible filter row** — consistent with shadcn/ui DataTable patterns.
