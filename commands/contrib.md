---
description: Create or update scoped CONTRIBUTING policy files
---
Create or update `CONTRIBUTING.md` files for this request:

Task/targets: $ARGUMENTS

Required workflow:
1) Infer target directories from the task text.
2) Ensure a repo-root `CONTRIBUTING.md` exists. Create it if missing.
3) For each area needing stricter local rules (for example `services/`), create or update a directory-local `CONTRIBUTING.md`.
4) Write policy as explicit required/forbidden behavior with clear scope.
5) Preserve existing intent when updating; extend/clarify instead of replacing wholesale.
6) If local policy differs from parent, document the override explicitly.
7) If scope is ambiguous, ask one targeted question with a recommended default.
8) For policy-only requests, do not edit unrelated source files.
9) After editing, list all created/updated `CONTRIBUTING.md` files and the precedence order that will apply during implementation.

Initial authoring guidance for new files (keep it very basic):
- If creating a new `CONTRIBUTING.md`, start with a minimal structure.
- Prefer short, actionable bullets over long prose.
- Include these sections in order:
  1) `# Scope` (what paths this file covers)
  2) `# Rules` (required/forbidden behavior)
  3) `# Precedence` (nearest file wins, parent defaults)
  4) `# Local Overrides` (only if different from parent)

Starter template for a new file:
```md
# Scope
Applies to `<path>` and all subdirectories.

# Rules
- Required: follow the folder/module boundaries defined here.
- Required: keep changes focused and consistent with existing patterns.
- Forbidden: move logic across architectural layers unless this policy allows it.

# Precedence
- This file overrides parent `CONTRIBUTING.md` rules for this scope.
- For conflicts, the nearest `CONTRIBUTING.md` to a changed file wins.

# Local Overrides
- None.
```

Then, when implementation work is requested, resolve and follow applicable `CONTRIBUTING.md` files as hard constraints.

Output format:
- Files changed
- Effective precedence per target path
- Key required/forbidden rules added or updated
