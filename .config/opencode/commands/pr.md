---
description: Create or update PR from current branch (intent-driven)
---
Create or update a GitHub PR for the current branch.

Clarifications/specifiers from user: $ARGUMENTS

## Intent Source Of Truth
- Treat the command invocation body as the authoritative intent.
- Treat `$ARGUMENTS` as clarification/specification only (ticket IDs, naming, release notes, explicit deferrals, extra context).
- If command-body intent and `$ARGUMENTS` conflict, prefer command-body intent unless user explicitly provides an `override:` instruction.

## Required Behavior
1. Always compare against `origin/main` (never local `main`).
2. Auto-push branch when upstream is missing or not on origin.
3. If an open PR exists for the current branch, edit it; otherwise create it.
4. Update only managed generated PR content and preserve all non-managed PR text exactly.
5. Ask only when ambiguity materially affects correctness (purpose mismatch, unclear requirement mapping, breaking behavior, migration risk).
6. Keep language stakeholder-friendly: plain-language outcome first, technical detail second.
7. Do not infer out-of-scope/deferred scope from unstaged or untracked files.

## Execution Workflow

1) Gather baseline and branch context
- Run `git fetch origin main --prune`.
- Determine branch with `git rev-parse --abbrev-ref HEAD`.
- If branch is `main` or `master`, stop and ask for a feature branch.
- Gather evidence from:
  - `git log --oneline origin/main..HEAD`
  - `git diff --name-status origin/main...HEAD`
  - `git diff --stat origin/main...HEAD`
- If there are no commits ahead of `origin/main`, report there is nothing to create/update.

2) Ensure remote branch exists
- Check upstream with `git rev-parse --abbrev-ref --symbolic-full-name @{u}`.
- If missing or not on origin, run `git push -u origin <current-branch>`.

3) Detect existing PR
- Run `gh pr list --state open --head <current-branch> --json number,url,title,body,baseRefName,headRefName --limit 1`.
- If one exists, edit it; if none exists, create it.

4) Context sufficiency gate before writing claims
- Use command intent + `$ARGUMENTS` + git evidence.
- If requirement intent, user/business impact, or scope boundaries are unclear, ask exactly one targeted clarification question.
- Do not assert claims not grounded in diff, commits, or explicit user context.
- If uncertain wording depends on unknown project history (for example `adds` vs `updates`), ask or use neutral wording.

5) Generate adaptive PR content from intent and evidence
- Do not follow a fixed section template.
- Always make these topics easy to find:
  - plain-language outcome and why it matters
  - requirement alignment
  - included scope
  - manual-only validation and observed outcomes
  - risk level and rollback/mitigation
- Include additional topics only when relevant:
  - implementation details
  - easy-to-miss reviewer attention points
  - explicit deferred scope
  - tradeoffs/open questions
  - release/coordination notes

6) Writing rules
- Avoid role-addressed headings or phrasing.
- Structure information so mixed stakeholders can find what they need without being told their role.
- Keep jargon minimal and define unavoidable terms briefly.
- Include explicit deferred/out-of-scope content only when explicitly stated and related to the change.
- Never mention unstaged/untracked local workspace state as scope evidence.
- Emphasize manual validation that CI cannot fully automate.
- Do not use CLI test command output as primary validation evidence; reference CI status briefly for automated checks.
- Every major claim must be traceable to diff/commits/intent; otherwise ask one clarification question or label as assumption.

7) Managed update semantics
- Manage only one generated region in PR body:
  - start marker: `<!-- opencode:pr:generated:start -->`
  - end marker: `<!-- opencode:pr:generated:end -->`
- If markers exist, replace only content inside markers.
- If markers do not exist, append one managed region.
- Preserve all non-managed body text byte-for-byte.

8) Create or edit PR
- Edit existing: `gh pr edit <number> --title "<title>" --body-file <temp-body-file>`.
- Create new: `gh pr create --base main --head <current-branch> --title "<title>" --body-file <temp-body-file>`.
- Keep existing title on edit unless `$ARGUMENTS` explicitly asks to change it.
- On create, generate concise intent-aligned title from dominant change.

9) Final output
- Return PR URL.
- Return whether PR was created or updated.
- Return top reviewer attention points (short list).
- Return unresolved tradeoffs/questions (or `none`).
- Return assumptions made due to missing context (if any).

## Quality Bar
- Concise, specific, and evidence-grounded.
- Plain language first; technical depth where needed.
- Adaptive content based on intent and actual change.
- No role-prescriptive language and no generic filler.
