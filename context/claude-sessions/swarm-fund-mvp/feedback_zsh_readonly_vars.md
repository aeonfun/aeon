---
name: Don't use zsh read-only variable names in shell loops
description: zsh has reserved read-only vars (status, pipestatus, RANDOM, SECONDS, etc.) that cause "read-only variable" errors in any assignment. Use different names in Monitor / Bash loops.
type: feedback
originSessionId: 1172f14b-8997-432c-a6d2-1e5e5a26b289
---
zsh treats certain variable names as read-only by default. Assigning to them inside any script or one-liner — including inside `for` loops in `Monitor` or `Bash` tool calls — causes `(eval):N: read-only variable: NAME` and the script exits with code 1.

**Avoid these names** as locals in shell scripts run on this machine:
- `status` ← bit me twice on Monitor scripts polling HTTP status codes
- `pipestatus` (array form of the above)
- `RANDOM`, `SECONDS`, `LINENO`
- `EUID`, `EGID`, `UID`, `GID`, `PPID`, `PWD`, `HOST`, `LOGNAME`, `USERNAME`, `SHLVL`, `TTY`, `ARGC`, `argv`, `ZSH_VERSION`

**Use instead** for the common case (HTTP polling):
- `code` or `http_code` instead of `status`
- `tries` or `iter` instead of leaning on auto-vars

**Why:** the user's shell is zsh (`/bin/zsh`). The Monitor and Bash tools eval scripts in zsh, so zsh's reserved-var protection applies. Bash wouldn't have this problem; zsh does.

**How to apply:** when writing a Monitor or Bash one-liner with a `for` / `while` loop, scan the loop body for any of the names above before submitting. If you spot one, rename. The cost of getting this wrong is a failed monitor run after waiting through several ticks.

Source: 2026-04-27 — two consecutive Monitor scripts failed (`bb56148x7`, `bto13ky5q`) when polling `https://rswarm.ai/investors` and `https://rswarm.ai/investors/onepager.html`. Both used `status=$(curl -s -o /dev/null -w "%{http_code}" ...)`. zsh refused both, exit 1, after the first tick.
