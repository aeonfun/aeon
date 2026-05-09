---
name: Worktree npm install on first tsc fail
description: Run npm install immediately in worktrees missing node_modules instead of trying multiple tsc paths
type: feedback
---

When a worktree has no `node_modules/`, run `npm install` immediately after the first `tsc` failure rather than trying `npx tsc`, `node_modules/.bin/tsc`, checking main repo's tsc, etc.

**Why:** Worktrees share git objects but NOT node_modules. First tsc failure in a worktree almost always means missing deps. Trying alternative tsc paths wastes 3-4 tool calls.

**How to apply:** In any worktree, if `tsc --noEmit` fails with module resolution errors, run `cd dashboard && npm install` as the immediate next step.
