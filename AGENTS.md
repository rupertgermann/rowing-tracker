# RULES

1. Think Before Coding: Don’t assume. Don’t hide confusion. Surface tradeoffs.

2. Simplicity First: Minimum code that solves the problem. Nothing speculative.

3. Surgical Changes: Touch only what you must. Clean up only your own mess.

4. Goal-Driven Execution: Define success criteria. Loop until verified.

## Agent skills

### PR conveyor

Use the repo-local `pr-conveyor` skill for Codex-orchestrated PR workflows that create builder/reviewer threads, loop on review feedback, gate merges, and continue to the next ready issue.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `rupertgermann/rowing-tracker`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` plus root `docs/adr/` when present. See `docs/agents/domain.md`.
