---
name: Interactive shell aliases on this Mac block scripted file ops
description: User's zsh has mv -i, cp -v, mkdir -v aliased — scripts can hang or print extra output unless using backslash-escape
type: feedback
originSessionId: dec92819-f012-4a80-83c9-1d7fe6407c85
---
`mv`, `cp`, `mkdir` on this machine print verbose output and `mv` prompts on
overwrite. Confirmed 2026-04-27 while testing port-guard hook.

**Why:** The user's interactive shell aliases (likely `mv='mv -i'`, `cp='cp -v'`,
`mkdir='mkdir -v'`) leak into Bash tool invocations because the shell is loaded
from the user's profile. A scripted `mv overwrite` will hang waiting for stdin
that never comes, blocking the entire Bash call.

**How to apply:**
- For scripted overwrites, use `\mv -f` (backslash bypasses the alias) or
  `command mv -f` or pipe `yes` to it.
- Don't expect mkdir/cp to be silent — extra output lines are normal, not bugs.
- If a Bash call goes background and never returns output, suspect an interactive
  prompt is blocking it. Run with stdin redirected (`< /dev/null`) or use
  non-interactive flags.
