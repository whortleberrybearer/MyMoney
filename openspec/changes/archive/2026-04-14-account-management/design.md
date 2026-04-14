## Context

The reference tables (`institution`, `account_type`, `tag`) exist and are seeded, but there is no `account` table and no UI for managing accounts or institutions. The app uses a state-machine navigation model with all screens rendered as React components — there is no router library. Tauri commands are the only way to reach the database; all business logic lives in Rust, not in React.

## Goals / Non-Goals

**Goals:**
- Add the `account` table and an `account_tag` junction table to the schema
- Add a Drizzle migration for the new tables
- Implement institution management (create, edit, delete) as a dialog within the accounts screen
- Implement account management (create, edit, deactivate/reactivate, delete) with an inactive toggle
- All mutations go through Tauri commands backed by Drizzle ORM

**Non-Goals:**
- Transaction management — opening balance is stored on the account but no transaction rows are created yet
- Profile filtering by tag — the tag field is stored but the filter UI is a future feature
- Pot management — out of scope for this change
- Currency reference table — currency is stored as a text code on the account

## Decisions

### 1. Account deletion: soft-delete via `is_deleted` flag

**Decision:** Deleting an account sets `is_deleted = 1`. No row is ever hard-deleted.

**Rationale:** The project convention is "nothing is ever hard deleted." Accounts already use `is_active` for deactivation; a separate `is_deleted = 1` flag handles deletion. Deleted accounts are invisible to all queries and cannot be recovered through the UI.

**Alternative considered:** Hard delete — simpler but breaks the project convention and makes data recovery impossible.

**Constraint:** Deletion is blocked if the account has any transaction rows (a future-proofing guard even though no transactions exist yet).

---

### 2. Tag relationship: `account_tag` junction table (single tag enforced in UI)

**Decision:** Use an `account_tag` junction table as specified in the project architecture, but the UI only allows selecting at most one tag per account.

**Rationale:** The architecture document explicitly calls out `account_tag` as a planned junction table. The issue language ("A tag") describes the UI intent — one tag at a time — not a schema constraint. Storing it as a junction table avoids a future migration if multi-tag support is ever needed.

**Alternative considered:** `tag_id INTEGER` FK directly on the `account` table — simpler but contradicts the stated architecture.

---

### 3. Currency: stored as text code on the account

**Decision:** `currency TEXT NOT NULL` on the `account` table, defaulting to the app's configured default currency (read from settings at form open time).

**Rationale:** No currency reference table exists and none is planned in this change. A text code (e.g., `"GBP"`) is simple, human-readable, and easy to migrate if a currency table is added later.

**Alternative considered:** FK to a future `currency` table — premature; blocks this change on a table that doesn't exist yet.

---

### 4. Institution management: dialog within accounts screen

**Decision:** Institution CRUD is surfaced via a Dialog triggered from within the accounts screen (or within the account create/edit form). No new top-level screen state is added.

**Rationale:** Institution management is a supporting action for account creation, not a first-class destination. Using a Dialog keeps navigation simple and avoids polluting the `AppScreen` union type with a low-traffic screen.

**Alternative considered:** Separate `institutions` screen state — heavier, unnecessary for an infrequent operation.

---

### 5. Account create/edit: Sheet (slide-in panel)

**Decision:** Use the shadcn/ui `Sheet` component for the account create/edit form.

**Rationale:** The account form has many fields (8+) which makes a Dialog feel cramped. A Sheet provides enough vertical space for all fields without scrolling.

**Alternative considered:** Dialog — too compact for 8+ fields; page-level form — unnecessary navigation overhead for a CRUD action.

---

### 6. Accounts screen placement: new content inside DashboardShell

**Decision:** Add an Accounts tab/section inside `DashboardShell` rather than a new top-level screen state.

**Rationale:** The dashboard shell already handles the main navigation. Accounts are one of several sections (alongside future Transactions, Reports, etc.). A tab-based layout inside the shell scales better than per-section screen states.

## Risks / Trade-offs

- **Opening balance semantics** → The opening balance is stored on the account but does not create a transaction row. Future features must handle the opening balance when computing running balances. Mitigation: document this clearly; the first transaction feature will handle it.
- **No currency validation** → Storing currency as free text means invalid codes are possible. Mitigation: populate the currency dropdown from a hard-coded list in the UI; the field is never a free-text input.
- **Blocking deletion when transactions exist** → The check requires a JOIN that doesn't yet exist (no transaction table). Mitigation: for now, deletion is always permitted since no transactions can exist; add the guard when the transaction table is added.

## Migration Plan

1. Add `account` and `account_tag` table definitions to `src/lib/db/schema.ts`
2. Run `drizzle-kit generate` to produce `0001_<name>.sql`
3. Add the new migration SQL to the inlined migrations array in `src/lib/db/index.ts`
4. No data backfill needed; both tables start empty
5. Rollback: remove the migration entry and schema definitions (tables are empty so no data loss)
