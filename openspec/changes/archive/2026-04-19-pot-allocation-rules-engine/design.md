## Context

Pots can receive virtual transfer transactions, but there is currently no engine to create those transfers automatically. Users must allocate funds to pots manually. The categorisation rules engine (already implemented) establishes the pattern for evaluating rules in priority order during import — the pot allocation rules engine follows the same architecture.

This is greenfield: no `pot_allocation_rule*` tables exist yet. The existing `transaction` table already supports `pot_id` (mutually exclusive with `account_id`) and `linked_transaction_id`, which are the hooks needed for virtual transfer pairs.

## Goals / Non-Goals

**Goals:**

- Rules are scoped to a specific account and only fire for transactions on that account
- First-match-wins evaluation in priority order (consistent with the categorisation engine)
- Conditions use AND logic; supported fields: `description`, `reference`, `amount`, `transaction_type`; supported operators: `contains`, `starts_with`, `equals`, `greater_than`, `less_than`
- Actions allocate a fixed amount to one or more target pots per rule
- Engine fires immediately after each import (after categorisation rules have run)
- Insufficient-balance check blocks the entire rule — no partial allocations
- Virtual transfers auto-assigned "Savings transfer" category; they skip the categorisation engine
- Import result screen surfaces allocation failures with rule name and affected pot(s)
- Rules managed from a Rules tab within the account view (CRUD + drag-to-reorder)
- All business logic lives in Tauri commands, not React

**Non-Goals:**

- Percentage-based allocations (fixed amount only)
- OR logic between conditions
- Re-run on all past transactions (import-triggered only — no manual re-run button)
- Cross-account rules
- Nested rule groups or regex operators

## Decisions

### Schema: three new tables

`pot_allocation_rule`, `pot_allocation_rule_condition`, `pot_allocation_rule_action`.

```
pot_allocation_rule
  id          INTEGER  PK AUTOINCREMENT
  account_id  INTEGER  NOT NULL  FK → account.id
  name        TEXT     NOT NULL
  priority    INTEGER  NOT NULL  -- user-controlled drag order, scoped to account
  is_active   INTEGER  NOT NULL  DEFAULT 1

pot_allocation_rule_condition
  id          INTEGER  PK AUTOINCREMENT
  rule_id     INTEGER  NOT NULL  FK → pot_allocation_rule.id
  field       TEXT     NOT NULL  -- description|reference|amount|transaction_type
  operator    TEXT     NOT NULL  -- contains|starts_with|equals|greater_than|less_than
  value       TEXT     NOT NULL  -- stored as text; cast at evaluation time for numeric

pot_allocation_rule_action
  id               INTEGER  PK AUTOINCREMENT
  rule_id          INTEGER  NOT NULL  FK → pot_allocation_rule.id
  pot_id           INTEGER  NOT NULL  FK → pot.id
  allocation_value REAL     NOT NULL  -- fixed amount, always positive
```

**Why separate the action table from the rule?** A single rule can allocate to multiple pots. Separate rows are easier to query, validate, and render in the rule builder form than a JSON blob.

**Why `priority` not `sort_order`?** Consistency with the issue spec's naming. Functionally identical to the categorisation engine's `sort_order`.

**Why store condition values as text?** Same rationale as the categorisation engine: a single column spans text and numeric comparisons; the engine casts to the appropriate type based on `field` + `operator` at evaluation time.

### Engine location: Tauri command

The engine runs as a `apply_pot_allocation_rules` Tauri command that accepts a list of transaction IDs (the newly imported transactions). It:

1. Fetches active rules for the affected account, ordered by `priority ASC`
2. For each transaction (in import order), evaluates rules in priority order
3. On first match: sums all action `allocation_value` fields and checks against account running balance
4. If sufficient: creates one debit transaction on the account and one credit transaction per pot action, all linked via `linked_transaction_id`
5. If insufficient: records a failure and skips to the next transaction
6. Recalculates running balance for the account and each affected pot after virtual transfers

**Why Tauri not React?** Architecture convention — all business logic stays in Tauri commands.

**Why run after categorisation?** Virtual transfer transactions should not be re-categorised by the categorisation engine. Running pot allocation after categorisation and marking virtual transfers as "Savings transfer" (directly, not via the engine) enforces this cleanly.

### Virtual transfer transaction structure

- Account-side debit: `amount = -allocation_value`, `account_id = <account>`, `pot_id = NULL`, `category_id = <savings-transfer-category>`, `notes = "Auto-transfer to <pot name>"`, `linked_transaction_id = <pot credit row id>`
- Pot-side credit: `amount = +allocation_value`, `pot_id = <pot>`, `account_id = NULL`, `category_id = <savings-transfer-category>`, `notes = "Auto-transfer to <pot name>"`, `linked_transaction_id = <account debit row id>`

**Why auto-assign category directly?** Virtual transfers should never trigger the categorisation engine — assigning the category in the engine command itself is simpler and avoids the engine re-processing its own output.

### Insufficient-balance check

Before creating any virtual transfer for a matching rule, sum all `allocation_value` fields for that rule's actions. Compare against the account's current running balance (after any earlier rules in the same import pass have already been processed). If the total exceeds the balance, skip all actions for that rule and record a failure entry.

**Why block the entire rule (not partial)?** Partial allocations would leave the user's intent partially fulfilled with no clear indication of which pots received funds. An all-or-nothing block is simpler to reason about and matches the spec.

### Import result screen failure surface

The `apply_pot_allocation_rules` command returns a structured result including a list of failures: `{ rule_name, pots: [pot_name] }`. The frontend import result screen renders these under an "Allocation failures" section.

### Priority reorder: per-account integer

`priority` is an integer scoped to each account. On drag-and-drop reorder, the frontend calls a `reorder_pot_allocation_rules` Tauri command with an ordered array of rule IDs for that account. The command updates all `priority` values in a single transaction.

**Why integers over linked list?** Same rationale as the categorisation engine — ORDER BY priority ASC is simple and gaps after deletes are harmless.

## Risks / Trade-offs

- **Running balance race during import batch** → The engine processes each transaction sequentially in import order. After each virtual transfer pair is written, the running balance is updated before the next rule is evaluated. This prevents double-counting within a single import batch.
- **"Savings transfer" category missing** → Mitigation: the engine looks up the category by a fixed well-known name. If it does not exist (e.g. database is new), the command creates it on first use.
- **Condition value casting errors** → If casting fails for `greater_than`/`less_than` (e.g. value is not numeric), the condition is treated as non-matching. The rule builder enforces numeric operators only on `amount`.
- **Priority gaps after delete** → No mitigation needed. Gaps are harmless; ORDER BY priority ASC remains deterministic.

## Migration Plan

1. Add a Drizzle migration creating `pot_allocation_rule`, `pot_allocation_rule_condition`, `pot_allocation_rule_action`
2. Migration runs automatically on next file open via the existing database-migrations infrastructure
3. No data migration required — tables start empty
4. Rollback: not supported for SQLite file-based migrations

## Open Questions

- Should virtual transfer transactions be voidable by the user, or read-only? (Assume voidable for now — consistent with other virtual transactions in the codebase)
- Should the Rules tab show a match count per rule? (Deferred — nice to have, not in scope)
