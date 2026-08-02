# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` - `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

- **Map and ticket labels**: use `wayfinder:map`, `wayfinder:research`,
  `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Create a child ticket**:
  `gh issue create --parent <map-number> --title "..." --body "..." --label "wayfinder:<type>"`.
- **Wire blockers after ticket creation**:
  `gh issue edit <ticket-number> --add-blocked-by <blocking-ticket-number>`.
  Use `--add-blocking` only when starting from the blocker.
- **List the map's children**:
  `gh api repos/rupertgermann/rowing-tracker/issues/<map-number>/sub_issues`.
- **Find the frontier**: inspect each open child with
  `gh issue view <number> --json title,state,assignees,blockedBy,url`. A frontier
  ticket is open, unassigned, and has no open `blockedBy` issue.

Create all tickets first, then add dependency relationships in a second pass.
Refer to maps and tickets by their linked titles in user-facing text, not by bare
issue numbers.
