## Context

Transactions currently arrive from imports with `category_id = NULL`. The user must manually categorise each one. This change introduces a rules engine that runs immediately after each import and can also be re-run on demand, applying user-defined rules in priority order.

No rules tables exist yet in the Drizzle schema — this is greenfield. The issue references `categorisation_rule_action` being renamed to `rule_action`; this refers to the previously spec'd name, not existing production code.

## Goals / Non-Goals

**Goals:**

- Rules engine runs in Tauri (Rust) — all matching logic, condition evaluation, and action application live in Tauri commands, not React
- First-match-wins: once a rule matches a transaction, no further rules are evaluated for it
- Engine runs on every import and can be manually re-run against all non-void transactions
- Support conditions on: `description` (mapped to `notes`), `reference`, `amount`, `transaction_type` (the `type` column), `payee`, `account` (account_id), `category` (category_id)
- Support operators: `contains`, `starts_with`, `equals`, `greater_than`, `less_than`
- Support actions: `assign_category` (sets `category_id`), `set_note` (overwrites `notes`)
- Priority ordering via drag-and-drop — stored as an integer `sort_order` on the rule row
- Rules can be enabled/disabled (`is_active`)
- Category change shortcut: prompt user after manual category edit to optionally create a rule

**Non-Goals:**

- OR logic between conditions (AND-only for now)
- Regex or wildcard operators
- Rule scheduling or time-based triggers
- Nested rule groups

## Decisions

### Schema: three new tables

`categorisation_rule`, `rule_condition`, `rule_action`.

- `categorisation_rule`: id, name, sort_order, is_active
- `rule_condition`: id, rule_id (FK), field (text enum), operator (text enum), value (text — all values stored as text, cast at evaluation time for numeric comparisons)
- `rule_action`: id, rule_id (FK), action_type (`assign_category` | `set_note`), category_id (nullable FK), note (nullable text)

**Why not a single table with JSON conditions?** Normalised rows are easier to query, validate, and extend. SQLite handles small condition sets well. JSON blobs would require application-side parsing for every evaluation pass.

**Why store `value` as text in rule_condition?** Conditions span text fields (contains, starts_with) and numeric fields (greater_than, less_than on amount). A single text column keeps the schema simple; the engine casts to the appropriate type at evaluation time based on `field` + `operator`.

**Why `categorisation_rule` not `rule`?** Avoids a collision with SQL reserved words in some contexts, and keeps the table name scoped to its domain.

### Engine location: Tauri command

The rules engine is a Tauri command (`apply_rules`) that accepts a list of transaction IDs (or `null` for all non-void transactions). It fetches all active rules ordered by `sort_order ASC`, evaluates each transaction against them, and writes results back to the `transaction` table.

**Why Tauri, not frontend?** Architecture convention: all business logic lives in Tauri commands. Running the engine in React would require fetching all transactions into the frontend, which is slow and fragile.

### Drag-and-drop reorder: sort_order integer

Priority is a user-controlled integer stored on `categorisation_rule.sort_order`. The frontend uses a drag-and-drop list; on drop it calls a `reorder_rules` Tauri command with an ordered array of rule IDs. The command updates all `sort_order` values in a single transaction.

**Why not a linked list?** Integer sort_order is simpler to query (ORDER BY sort_order ASC), and reordering requires only a batch UPDATE rather than pointer updates.

### Category change shortcut: prompt → rule creation

When a user saves a category edit on a transaction, the frontend calls a `update_transaction_category` Tauri command. On success, React shows a modal: *"Apply to future transactions like this?"* with three options: **No**, **Future only**, **All transactions**.

- "Future only": creates rule with a `contains` condition on `notes` (the transaction's notes value) and `assign_category` action — no re-run
- "All transactions": same rule creation, then immediately calls `apply_rules` for all transactions

The pre-fill is intentionally opinionated: the condition uses the transaction's `notes` value as a starting point. The user can edit it before confirming.

## Risks / Trade-offs

- **Re-run performance on large datasets** → Mitigation: `apply_rules` fetches rules once and iterates transactions in a single pass. For very large files (10k+ transactions) this may block the Tauri thread briefly; acceptable for a desktop single-user app. If needed, a progress indicator can be added later.
- **Condition value casting errors** → Mitigation: if casting fails for `greater_than`/`less_than`, the condition is treated as non-matching (not an error). The rule builder validates numeric operators only appear on `amount`.
- **sort_order gaps after delete** → No mitigation needed. Gaps in sort_order are fine; ORDER BY sort_order ASC still produces a deterministic priority sequence.
- **"Apply to all" overwrites manual edits** → Re-run applies rules to ALL non-void transactions including ones the user manually categorised. This is the intended behaviour per the spec, but should be clearly communicated in the UI confirmation dialog.

## Migration Plan

1. Add a new Drizzle migration file creating `categorisation_rule`, `rule_condition`, `rule_action` tables
2. Migration runs automatically on next file open (existing database-migrations infrastructure)
3. No data migration required — tables start empty
4. Rollback: not supported for SQLite file-based migrations; user would need to restore a backup

## Open Questions

- Should the rules list show a count of transactions matched by each rule? (Nice to have — deferred)
- Should `set_note` append to existing notes or overwrite? (Spec says overwrite — confirmed)
