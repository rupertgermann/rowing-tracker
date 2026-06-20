---
name: pr-conveyor
description: Coordinate a GitHub PR conveyor for this repo. Use when the user asks Codex to spin up builder and reviewer threads, make or monitor a PR, loop on review comments until approval, merge once CI/review gates pass, or continue to the next ready GitHub issue.
---

# PR Conveyor

## Overview

Run a supervised state machine that separates implementation, review, feedback repair, and merge decisions across Codex threads. Keep this thread as the orchestrator.

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
   - For new work, call `list_projects`, then `create_thread` in a Codex worktree for this project.
   - Give the builder the prompt from `references/prompts.md#builder-new-work`.
   - For an existing PR, treat the PR author/current thread as the builder unless the user points to a different thread.
   - Completion: there is a PR URL or a builder thread actively working toward one.

3. Review the PR.
   - Create a separate reviewer thread in a worktree from the PR base branch.
   - Use `references/prompts.md#reviewer-pr`.
   - The reviewer is read-only: it must inspect code, run non-mutating commands, and report findings; it must not edit files, commit, push, or merge.
   - Completion: reviewer reports either findings or "no blocking findings".

4. Route feedback.
   - If the reviewer or GitHub reviews report actionable findings, send the builder `references/prompts.md#builder-address-feedback`.
   - After the builder pushes fixes, repeat the reviewer pass.
   - Stop and ask the user after three failed loops on the same blocker, merge conflicts, unclear feedback, or validation that cannot be run.
   - Completion: no blocking reviewer findings remain, or the workflow is deliberately stopped.

5. Install a heartbeat when the user wants the loop to keep running.
   - Use `automation_update` with `kind=heartbeat`, `destination=thread`, and a minute interval appropriate to the urgency.
   - Use `references/prompts.md#heartbeat`.
   - Completion: the heartbeat exists, or the user explicitly declined background monitoring.

6. Merge gate.
   - Read `references/github-gates.md`.
   - Merge only when all required gates pass.
   - Use `gh pr merge` only after confirming the gate state from GitHub.
   - Completion: PR merged, or the exact failing gate is reported.

7. Continue the conveyor.
   - Close or label the completed issue if appropriate.
   - Start the next ready issue with a new builder thread only after the merge succeeds.
   - Archive completed builder/reviewer threads when they no longer need attention.
   - Completion: next builder is started, or there is no next ready issue.

## Existing PR Test Path

For "use this existing PR as the first test":

1. Inspect the PR with `gh pr view`.
2. Start a reviewer thread with the reviewer prompt.
3. Route any findings back to the builder/current thread.
4. Do not merge during the test unless the user explicitly says this test run should merge when gates pass.

## References

- `references/prompts.md`: copyable thread and heartbeat prompts.
- `references/github-gates.md`: GitHub checks, review states, merge gates, and stop conditions.
