## Context

The `account` table and full account CRUD UI are in place. Reference tables (`tag`, `account_tag`) exist. The app has no concept of pots yet — no `pot` table, no `pot_tag` junction, and no UI for sub-account management. Virtual transfer logic does not exist. The `show_combined_balance` column was speced on `account` but never implemented; this change removes it.

The project uses a soft-delete convention: nothing is ever hard-deleted. However, the issue spec for pots explicitly calls out a "hard delete" operation for pots (with all virtual transactions removed). This is a deliberate exception documented below.

## Goals / Non-Goals

**Goals:**
- Add `pot` and `pot_tag` tables with a Drizzle migration
- Remove the unused `show_combined_balance` column from `account`
- Implement full pot lifecycle: create, edit, close (deactivate), hard delete
- Implement manual pot-to-account and account-to-pot transfers (virtual transfer pairs)
- Update Accounts List to show pot child rows under each parent account
- Add combined balance breakdown (pie/donut chart) inside Account Detail view

**Non-Goals:**
- Automatic pot allocation rules (F-10) — future feature
- Importing transactions directly to a pot — future feature
- Pot-level transaction history UI — future feature (pots have a balance but no transaction list view in this change)
- Profile filtering by pot tag — tags are stored, filter UI is future scope

## Decisions

### 1. Pot deletion: hard delete as a deliberate exception

**Decision:** Deleting a pot permanently removes the `pot` row, all its `pot_tag` rows, and all virtual transfer transactions associated with the pot.

**Rationale:** The issue spec explicitly calls this out: "permanently removes the pot and all its virtual transactions." Pots have no imported transactions — only user-created virtual transfers — so a hard delete is safe and reversible in the sense that the user created everything being removed. The UI requires a confirmation warning that this is permanent and irreversible.

**Constraint:** A prominent confirmation dialog must be shown before hard delete proceeds. The warning must state that all transactions will be permanently removed.

**Alternative considered:** Soft-delete (is_deleted flag) — simpler and consistent with the project convention, but contradicts the issue spec and leaves orphaned virtual transfer records with no meaningful pot to belong to.

---

### 2. Pot close (deactivate): auto-transfer if non-zero balance

**Decision:** Closing a pot sets `is_active = 0`. If the pot's current balance is non-zero, the user is warned and a virtual transfer automatically moves the remaining balance back to the parent account before deactivation.

**Rationale:** Closing a pot with a non-zero balance would leave money "lost" from the user's perspective — the balance would disappear from the pot view without appearing anywhere. The auto-transfer ensures balance integrity.

**Implementation:** Pot balance = `opening_balance + SUM(virtual transfer amounts credited to pot)`. If non-zero at close time, create one virtual transfer pair: debit on pot, credit on parent account, dated today.

**Alternative considered:** Block closure until balance is zero — forces the user to manually drain the pot first, which is worse UX for a simple close operation.

---

### 3. Virtual transfer representation

**Decision:** A manual transfer between a pot and its parent account creates two transaction rows in the `transaction` table: one with `account_id` set (the account side) and one with `pot_id` set (the pot side). Amounts are signed: debit = negative, credit = positive. The two rows are linked via a `transfer_id` column (a shared UUID or auto-increment ID).

**Rationale:** The project context states "account_id and pot_id are mutually exclusive on the transaction table — enforced at the application layer." Two rows, one per side, means each side's balance calculation (SUM of amounts) stays correct with no conditional logic. A `transfer_id` link allows the pair to be managed atomically (e.g., deleted together on pot hard delete).

**Note:** The `transaction` table does not yet exist in the schema. This change introduces it as a minimal virtual-transfer-only table. Full transaction import/management is a separate future feature.

**Alternative considered:** Single row with both `account_id` and `pot_id` — breaks the "mutually exclusive" project constraint and complicates balance calculation.

---

### 4. Pot balance calculation

**Decision:** A pot's current balance = `opening_balance + SUM(amount for transactions where pot_id = pot.id AND is_void = 0)`. The opening_balance is stored directly on the pot row; no synthetic opening transaction is created.

**Rationale:** Consistent with how account opening balances work. Avoids an extra transaction row for a simple starting value. Balance is always computed from the source of truth (SUM of signed amounts) rather than stored as a mutable field — no risk of drift.

**Alternative considered:** Storing `current_balance` on the pot row — fast reads but requires keeping it in sync on every transfer, leading to potential drift bugs.

---

### 5. Accounts List: pot child rows always visible

**Decision:** Pots are shown as indented child rows directly beneath their parent account in the Accounts List. No expand/collapse control. Pots are fetched alongside accounts in the same list query.

**Rationale:** The issue spec states "no expand/collapse, always visible." This keeps the UI simple and ensures pots are never accidentally hidden during normal browsing. The list is already sorted by institution/account; pots slot in naturally after their parent row.

**Alternative considered:** Expandable accordion per account — more compact for accounts with many pots, but adds interaction complexity and hides information by default.

---

### 6. Show closed pots toggle: scoped to account

**Decision:** A "Show closed pots" toggle is displayed within the pots section of each account (not a global toggle). It defaults to off (closed pots hidden). The toggle state is local React state, not persisted.

**Rationale:** The issue spec scopes this toggle "to the pots view within an account." Local state is sufficient — a persisted preference for this is unnecessary complexity.

---

### 7. Pot create/edit: Sheet component

**Decision:** Use the shadcn/ui `Sheet` for the pot create/edit form.

**Rationale:** Pot form has 6+ fields (name, opening balance, opening date, notes, tag, plus action buttons). Consistent with the account form pattern. A Dialog would be too cramped.

---

### 8. Pot transfer: Dialog component

**Decision:** The manual transfer form uses a `Dialog` (modal), not a `Sheet`.

**Rationale:** Transfer has only 3 fields (amount, date, notes) plus direction (to/from pot). A Dialog is appropriately sized. Consistent with the institution management dialog pattern for focused, low-field actions.

---

### 9. Removing show_combined_balance from account

**Decision:** Drop the `show_combined_balance` column from the `account` table in this migration.

**Rationale:** The issue spec explicitly calls this out: the column was speced but superseded. The combined view is a UI-level display feature, not a stored preference. Removing it keeps the schema clean.

**Risk:** If any code references this column, it must be removed in the same PR. A grep confirms it was never implemented.

## Risks / Trade-offs

- **Introducing transaction table early** → The `transaction` table is minimal (virtual transfers only). Future transaction import features will need to extend it. Risk: early schema decisions constrain future design. Mitigation: keep the schema minimal — only the columns needed for virtual transfers; document that the table will be extended.
- **Pot balance drift on concurrent edits** → Calculated balance (SUM) means no drift from concurrent edits. No risk here.
- **Hard delete removes all virtual transactions** → If a user accidentally hard-deletes a pot, all transfer history is gone. Mitigation: confirmation dialog with explicit "permanent and irreversible" warning.
- **Auto-transfer on close creates a transaction dated "today"** → If the user closes a pot with a backdated opening date, the auto-transfer will be dated today. Mitigation: this is acceptable UX — the transfer is a real-time action.
- **No rollback for hard delete** → By design. The user is warned.

## Migration Plan

1. Add `pot`, `pot_tag`, and `transaction` table definitions to `src/lib/db/schema.ts`
2. Remove `show_combined_balance` from the `account` schema definition
3. Run `drizzle-kit generate` to produce the next migration SQL file
4. Add the migration SQL to the inlined migrations array in `src/lib/db/index.ts`
5. No data backfill needed (all new tables; `show_combined_balance` was never populated)
6. Rollback: remove the migration entry and revert schema definitions
