---
name: pr-conveyor
description: Coordinate a GitHub PR conveyor for this repo. Use when the user asks Codex to spin up builder and reviewer threads, make or monitor a PR, loop on review comments until approval, merge once CI/review gates pass, or continue to the next ready GitHub issue.
---

# PR Conveyor

## Overview

Run a supervised state machine that separates implementation, review, feedback repair, and merge decisions across Codex threads. Keep this thread as the orchestrator.

Exact tool-call shapes for every Codex thread tool used below (`create_thread`, `send_message_to_thread`, `read_thread`, `list_threads`, `automation_update`, `set_thread_archived`) live in `references/codex-tools.md`. Track every `threadId` returned across the run.

## Inputs

- Issue number or "next ready issue".
- Existing PR number or URL when the PR is already open.
- Optional merge policy if the user wants something other than the repo default.

If the user says to use an existing PR, start at **Review Existing PR** instead of creating a builder thread.

## Workflow

1. Establish the target.
   - Read `docs/agents/issue-tracker.md` for issue conventions.
   - Use `gh` inside the repo to inspect the issue or PR.
   - Define success criteria before creating or steering other threads.
   - Completion: target issue or PR, base branch, head branch, and success criteria are known.

2. Create or identify the builder.
   - For new work, call `list_projects` to get the repo's `projectId`, then `create_thread` (worktree from the base branch) with `references/prompts.md#builder-new-work`. See `references/codex-tools.md`.
   - For an existing PR, treat the PR author/current thread as the builder unless the user points to a different thread.
   - `read_thread` the builder to capture the reported PR URL, branch, and validation results.
   - Completion: there is a PR URL or a builder thread actively working toward one.

3. Review the PR.
   - `create_thread` for a separate reviewer in a worktree from the PR base branch, with `references/prompts.md#reviewer-pr`.
   - The reviewer is read-only: it must inspect code, run non-mutating commands, and report findings; it must not edit files, commit, push, or merge.
   - `read_thread` the reviewer to collect findings and its final `REVIEW_RESULT:` line.
   - Completion: reviewer reports `REVIEW_RESULT: clean` or `REVIEW_RESULT: blocking` with findings.

4. Route feedback.
   - If the reviewer or GitHub reviews report actionable findings, `send_message_to_thread` to the builder with `references/prompts.md#builder-address-feedback`.
   - After the builder pushes fixes, `send_message_to_thread` the reviewer to repeat the pass, then `read_thread` for the new result.
   - Stop and ask the user after three failed loops on the same blocker, merge conflicts, unclear feedback, or validation that cannot be run.
   - Completion: no blocking reviewer findings remain, or the workflow is deliberately stopped.

5. Install a heartbeat when the user wants the loop to keep running.
   - `automation_update` with `mode=create`, `kind=heartbeat`, `destination=thread`, `status=ACTIVE`, and an `rrule` (e.g. `FREQ=MINUTELY;INTERVAL=10`) sized to the urgency. See `references/codex-tools.md`.
   - Use `references/prompts.md#heartbeat`, embedding the tracked builder/reviewer thread IDs and PR number.
   - Completion: the heartbeat exists, or the user explicitly declined background monitoring.

6. Merge gate.
   - Read `references/github-gates.md`.
   - Merge only when all required gates pass.
   - Use `gh pr merge` only after confirming the gate state from GitHub.
   - Completion: PR merged, or the exact failing gate is reported.

7. Continue the conveyor.
   - Close or label the completed issue if appropriate.
   - Start the next ready issue with a new builder thread only after the merge succeeds.
   - `set_thread_archived` (`archived=true`) for completed builder/reviewer threads when they no longer need attention.
   - Completion: next builder is started, or there is no next ready issue.

## Existing PR Test Path

For "use this existing PR as the first test":

1. Inspect the PR with `gh pr view` (fields in `references/github-gates.md`).
2. `create_thread` for a reviewer with the reviewer prompt; `read_thread` for its result.
3. Route any findings back to the builder/current thread with `send_message_to_thread`.
4. Do not merge during the test unless the user explicitly says this test run should merge when gates pass.

## References

- `references/codex-tools.md`: exact Codex thread/automation tool-call shapes.
- `references/prompts.md`: copyable thread and heartbeat prompts.
- `references/github-gates.md`: GitHub checks, review states, merge gates, and stop conditions.
