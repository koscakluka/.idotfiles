# Commit Strategy

When committing changes, default to a small, structured commit strategy:

1. Prefer 3-5 focused commits over 1 large mixed commit when changes span:

- API surface/plumbing
- behavior/refactor logic
- new feature package/module
- deprecations/docs/changelog

2. Split by intent, not by file type. Each commit should represent one logical unit:

- extension point / wiring
- behavioral refactor
- new implementation
- compatibility + deprecation

3. Commit message format:

- Conventional style: feat|refactor|fix|docs|deprecate(scope): short summary
- Body: 1-2 lines describing why, not just what.
- Type selection guardrails (required):
  - `docs`: documentation-only changes (README/markdown/changelog/comments/docstrings), including comment-only edits in `.go` files.
  - `refactor`: behavior-preserving code changes to structure/organization (not docs-only).
  - `fix`: behavior correction for a bug/regression.
  - `feat`: net-new user-facing capability.
  - `deprecate`: introducing or expanding deprecation paths/notices.
  - If a commit mixes docs and code, choose the dominant code intent; use `docs` only when no runtime behavior code changes.

4. Before finalizing split, run this checklist:

- Can each commit compile independently?
- Could this commit be reverted without breaking unrelated parts?
- Is the commit understandable from message + diff alone?

5. If uncertain, propose both:

- one-commit option
- recommended multi-commit option
  and let user choose.

6. Never include unrelated formatting or incidental edits in a logical commit.

7. Commit scope rules (required):

- Scope must be a single word.
- Derive scope from module path, not feature nickname.
- `core/events/**` -> `events`
- `core/*.go` orchestration/public wiring -> `core`
- `CHANGELOG.md`-only -> `changelog`
- If `CHANGELOG.md` is committed alongside code, use the dominant code scope (never force `changelog`).

8. Scope preflight check (required before proposing commits):

- Map every changed file to a scope.
- If proposed scope conflicts with file-path taxonomy, revise before presenting.
- If changes span multiple scopes, split commits by intent so each commit has one dominant scope.

9. Ambiguity fallback:

- If scope is still ambiguous after file mapping, ask one targeted question and include a recommended default.

10. Changelog coupling (required):

- Every functional commit should include its matching `CHANGELOG.md` update when practical.
- Changelog-only follow-up commits are allowed only for missed or corrective release-note entries.

## Delegation

- Default to `explore-locate` for finding files, symbols, usages, and code paths, and `validate-check` for tests, lint, typechecks, and acceptance-criteria verification instead of the built-in general-purpose delegation agents.
- Use `explore-analyze` for cross-module behavior tracing, root-cause investigation, and dependency analysis, and `validate-review` for correctness, edge-case, regression, and test-coverage review.
- Select specialized roles (`explore-analyze`, and `validate-review`) automatically when the task's complexity, cross-module scope, or correctness risk warrants their expertise. No explicit user request or approval is required for role selection. Use `validate-review` proactively when changes warrant correctness review, while retaining `validate-check` for routine verification. Keep scoped roles as defaults for routine work; specialized delegation is not mandatory for every task and must stay within the user's requested scope.
- Keep architecture decisions, task coordination, and final synthesis with the primary agent.
- Delegate change-summary drafting to `changes-summary` with the selected scope and relevant evidence. It remains summary-only; do not bind `/checkpoint` directly to it.
- Delegate checkpoint requests to `checkpoint` by default, including inspection, secret checks, authorized staging, commit creation, and verification. The primary agent first supplies a detailed context handoff through Task, then retains coordination and the final response. Keep `/checkpoint` unbound so the primary agent can prepare that handoff. The checkpoint agent drafts its own subject without another summary-agent hop. Primary-agent execution is reserved for a user explicitly requesting primary-agent execution or unavailable delegation, never to bypass permissions; use the same workflow and safeguards.
- Checkpoint handoffs must include the absolute repository/worktree path, explicit user authorization and requested mode (`staged` by default or explicit `all`), change intent, relevant implementation decisions, known user or concurrent changes, verification commands and actual results, failures, exclusions, and unknowns. Pause concurrent Git mutations during delegation. Context explains intent but does not override the live diff or authorize a broader selection. If exclusions conflict with the requested mode, stop and resolve the scope before staging or committing.
- Specialized workflows may use their designated agents, such as `ralph`.
- Default roles use GPT-6 Luna; specialized roles use GPT-6 Sol. Model and reasoning variant assignments live in the agent definitions, not their names.
- These agent definitions are based on the installed built-in `build`, `explore`, and `general` settings at setup time, with model/variant overrides, purpose-specific guidance, and validation-specific restrictions. They do not automatically inherit future upstream changes. Explore retains the built-in search prompt; validate adds checking or review instructions to the general-agent defaults.

### Detailed Handoffs

For every delegation to `explore-locate`, `explore-analyze`, `validate-check`, `validate-review`, `changes-summary`, or `checkpoint`, the primary agent must provide a detailed, self-contained brief. Never assume the subagent shares the conversation history. Supply relevant discoveries and decisions explicitly instead of referring to "the above" or asking it to infer the task.

Each brief must include:

- Working directory: the verified absolute active worktree root (or active project directory outside Git), how it was verified, and the absolute working directory for commands when different. For Git projects, verify the root with `git rev-parse --show-toplevel` from the current task directory; otherwise verify that the project directory exists. Never substitute a parent checkout, Git common directory, or sibling worktree.
- Path resolution: explicitly label relative project paths as relative to the supplied active root. For example, with root `/projects/project-a/main`, `src/index.js` means `/projects/project-a/main/src/index.js`, not `/projects/project-a/src/index.js`. Require explicit search roots for Glob/Grep, absolute paths for Read, and explicit `workdir` for Bash. Missing files must be searched for within that worktree first; parent/sibling worktrees and external directories require explicit inclusion in scope and normal tool permissions.
- Objective: the concrete outcome, why it is needed, and whether the assignment is implementation, read-only exploration, validation, or summary drafting.
- Context: relevant files, symbols, existing patterns, discovered evidence, and applicable project instructions. Distinguish confirmed facts from leads; if locations are unknown, provide a bounded search scope.
- Approach and boundaries: the agreed design and actionable steps, constraints, permitted changes, explicit exclusions, and any concurrent or existing changes that must be preserved. Keep architecture decisions with the primary agent.
- Acceptance criteria: observable completion conditions and relevant edge cases. State what must remain unchanged.
- Verification: exact relevant commands, their working directories, and expected results. If commands are not yet known, specify how to identify them without guessing. If execution is outside the role's scope, say so explicitly and supply available verification evidence instead.
- Return format: the required findings or changes, file/line references where relevant, evidence, commands and results, and remaining gaps. Preserve role-specific output requirements, such as the single-line checkpoint subject for `changes-summary`.
- Blocker handling: report missing material information, conflicting requirements, or decisions beyond the agreed scope to the primary agent. Do not guess, expand scope, bypass permissions, or silently switch roles.

Delegation briefs are exempt from caveman compression. Use complete, precise instructions with enough detail for a fresh-context agent to execute reliably; keep user-facing updates concise.

# Caveman Mode

Activate caveman mode:

Respond terse like smart caveman. Drop articles, filler, pleasantries, hedging.
Fragments OK. Technical terms exact. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].

Behavior persists until session ends or user says "stop caveman" / "normal mode".
Code, commits, security warnings: write normal English.
