# Agents

## OpenSpec: auto-commit per task

When implementing an OpenSpec change by working through its tasks (typically `openspec/changes/<change>/tasks.md`):

- Treat each task as the smallest shippable unit.
- After completing **one** task:
  1. Update the tasks file checkbox (`- [ ]` → `- [x]`) for that single task.
  2. Stage all relevant changes (including the tasks file).
  3. Create a git commit immediately.

### Commit rules

- Prefer **1 task = 1 commit**.
- Commit message format:
  - `openspec(<change>): <short task summary>`
- If there are no changes to commit, do not force an empty commit; continue.
- Do not mark a task complete unless the implementation is complete and committed.
- If the user explicitly requests no intermediate commits (or wants a single squashed commit), follow the user request and skip per-task commits.

### Safety

- Do not commit secrets.
- If a commit introduces obvious build/test failures for the touched area, fix before moving to the next task (or revert and explain).
