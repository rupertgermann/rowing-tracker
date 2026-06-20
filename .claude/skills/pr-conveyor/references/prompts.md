# PR Conveyor Prompts

Use these prompts as templates. Replace bracketed values before sending.

## Builder New Work

```text
Use $do-work for issue #[issue-number] in rupertgermann/rowing-tracker.

You are the builder thread for the PR conveyor. Work in your Codex worktree. Read AGENTS.md and docs/agents/issue-tracker.md before editing.

Success criteria:
- Implement only issue #[issue-number].
- Validate with the repo's relevant checks. At minimum run npm run build; run npm run lint when the change touches lint-covered code. Run focused tests when available.
- Commit the changes.
- Push a branch named codex/issue-[issue-number]-[short-slug].
- Open a GitHub PR against [base-branch].
- Report the PR URL, branch, validation results, and any known risks.

Do not merge the PR.
```

## Reviewer PR

```text
Review PR [pr-url-or-number] in rupertgermann/rowing-tracker.

You are the reviewer thread for the PR conveyor. This is a read-only review:
- Do not edit files.
- Do not commit.
- Do not push.
- Do not merge.

Use gh CLI to inspect the PR metadata and diff. Ignore existing PR comments unless the orchestrator explicitly includes them. Review only the code and tests in the PR.

Prioritize correctness bugs, regressions, missing tests for changed behavior, data loss risks, security/privacy issues, and migration/deployment risks. Keep style comments out unless they hide a real defect.

Output:
- Blocking findings first, each with file path, line or smallest relevant area, severity, and concrete reason.
- Then non-blocking risks, if any.
- Then validation you ran or could not run.
- End with exactly one of:
  REVIEW_RESULT: blocking
  REVIEW_RESULT: clean
```

## Builder Address Feedback

```text
Continue the PR conveyor builder work for PR [pr-url-or-number].

Address these blocking findings:
[paste findings]

Rules:
- Reproduce or inspect each issue before changing code.
- Make the smallest safe fix.
- Add or adjust focused tests when the finding describes behavior.
- Run relevant validation.
- Commit and push to the existing PR branch.
- Report what changed, validation results, and any finding you believe is invalid with evidence.

Do not merge the PR.
```

## Heartbeat

```text
Continue the PR conveyor loop for PR [pr-url-or-number].

On each wake-up:
1. Inspect PR state with gh CLI.
2. Check CI, review decision, latest reviews, and unresolved actionable comments.
3. If new blocking feedback exists, send it to the builder thread [builder-thread-id] using the builder feedback prompt.
4. If the builder pushed since the last review, start or message the reviewer thread [reviewer-thread-id] for another read-only pass.
5. If the PR is approved and all merge gates pass, report that it is ready to merge. Merge only if this run has explicit merge authorization.
6. Stop and ask the user after three loops on the same blocker, merge conflicts, failed permissions, or unclear feedback.

Do not report anything when there is no state change unless a stop condition is reached.
```
