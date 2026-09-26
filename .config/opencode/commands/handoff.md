---
description: Generate a handoff from current context, delegate to build, and wait
agent: build
---

Treat the current parent session as the source of truth.

Workflow:
1. Use the `handoff` skill first.
2. Generate a handoff tailored to this focus: `$ARGUMENTS`.
3. Save the handoff document to the OS temp directory, as required by the skill.
4. Capture the saved handoff file path.
5. Delegate the next phase to the built-in `build` agent as a child subtask.
6. Pass both of these to the child subtask:
   - the saved handoff file path
   - the full handoff text inline
7. Instruct the child `build` agent to treat the handoff as the source of truth, create a todo list from the handoff and to work on it until everything mentioned in the handoff is done
8. Wait for the child `build` subtask to finish before responding.

Rules:
- Do not generate the handoff inside the child subtask.
- Do not respond before the child `build` subtask completes or fails.
- If handoff generation fails, stop and report that failure.
- If child delegation fails, report the failure and likely cause.
- Preserve user intent from the current session when generating the handoff.

Final response format:
- Handoff path: `<path>`
- Child agent: `build`
- Status: `completed` | `failed`
- Result: short summary of what the child agent accomplished
- Blockers or follow-ups: `none` or a concise list
