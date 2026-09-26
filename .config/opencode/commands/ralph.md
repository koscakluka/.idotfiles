---
description: Work a single GitHub issue by number with the RALPH workflow
agent: ralph
---

# Task

Work issue `#$1` only.

The list above has already been filtered to issues ready for work and is the sole source of truth for what work exists. Do not run your own unfiltered query to find more issues — if the list is empty, there is nothing to do.

Additional user context: $ARGUMENTS

## Issue

!`gh issue view $1 --comments`

If the issue references a parent PRD or linked planning issue, pull that in before making changes.

## Recent RALPH commits (last 10)

!`git log --oneline --grep="RALPH" -10`
