# GitHub Gates

## Inspect

Use `gh` from the repository checkout.

```bash
gh pr view <pr> --json number,title,url,state,isDraft,baseRefName,headRefName,mergeStateStatus,reviewDecision,latestReviews,statusCheckRollup
gh pr checks <pr>
gh pr diff <pr>
```

Use `gh pr view <pr> --comments` only when comments are part of the current loop. For thread-level review state, prefer GitHub GraphQL through `gh api graphql` if flat comments are ambiguous.

## Required Merge Gates

All gates must pass before merging:

- PR `state` is `OPEN`.
- PR is not draft.
- `mergeStateStatus` is not blocked by conflicts or missing base updates.
- `reviewDecision` is `APPROVED`, or branch protection does not require review and the user explicitly allows merge without approval.
- No latest review requests changes.
- Required status checks are successful or skipped by branch protection.
- The reviewer thread has no blocking findings on the latest head SHA.
- The builder has reported successful relevant local validation.

## Stop Conditions

Stop and ask the user instead of continuing when:

- GitHub reports conflicts or an unknown mergeability state after a refresh.
- CI fails for the same reason twice after a fix attempt.
- The same review finding returns three times.
- Required secrets, credentials, or external services are missing.
- The merge command is rejected by permissions or branch protection.
- A human reviewer requests changes that conflict with the automated reviewer.

## Merge

Use the repo's established merge policy when known. If no policy is known, prefer:

```bash
gh pr merge <pr> --squash --delete-branch
```

Do not merge during an "existing PR test" run unless the user explicitly authorizes merge for that test.
