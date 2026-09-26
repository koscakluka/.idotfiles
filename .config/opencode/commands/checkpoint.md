---
description: Commit a checkpoint of staged changes (default) or all changes
---

Create one Git checkpoint commit in the current repository.

Mode: $ARGUMENTS

## Usage

- `/checkpoint` or `/checkpoint staged`: commit only the current index.
- `/checkpoint all`: stage and commit all changes across the repository, including deletions and non-ignored untracked files.
- Accept only an empty argument, `staged`, or `all`. For anything else, show usage and stop without changing the index or creating a commit.

## Delegation

Keep this command with the primary agent to prepare context; do not bind it directly to a subagent.

1. Validate the mode before any mutation. Locate the absolute repository/worktree path; if outside a Git repository, explain and stop.
2. Call `checkpoint` through Task with a detailed, self-contained brief. Include the repository path and command working directory, user authorization, validated mode, change intent, relevant implementation decisions, known user or concurrent changes, verification commands and actual results, failures, exclusions, and unknowns. Do not assume shared conversation history. If exclusions conflict with the mode, resolve that conflict before proceeding.
3. Delegate the complete workflow defined in `agents/checkpoint.md`: live inspection, secret checks, authorized staging, subject drafting, commit creation, and verification. Do not perform parallel Git mutations or separately call `changes-summary`. Supplied context explains intent; the live selected diff determines commit content and subject.
4. Report the subagent's verified hash, subject, remaining changes, and any blockers or verification gaps. Never claim a commit succeeded without evidence.

Only execute checkpointing in the primary agent when the user explicitly requests primary-agent execution or delegation is unavailable. A checkpoint request alone is not a request for primary-agent execution. In that case, read `agents/checkpoint.md` relative to this OpenCode configuration directory and follow its complete workflow unchanged. Never use fallback to bypass permissions.
