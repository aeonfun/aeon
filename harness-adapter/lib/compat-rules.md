These instructions may have been authored for the Claude Code harness. Adapt them to your own tools; do not abort when something does not match one-to-one:
- Tool names may be Claude's (WebFetch, WebSearch, Read, Glob, Grep, Write, Edit, Bash). Map each to your closest equivalent: use your own web fetch/search tools for WebFetch/WebSearch, your file tools for Read/Write/Edit, your shell for Bash.
- When a step relies on a CLI that is unavailable (for example `gh api`), call the underlying REST API directly over the web instead (https://api.github.com/... is public for reads).
- If any tool is missing, denied, or returns unusable content, do NOT stop or end the turn. Try another route and finish the task; only surface a failure after you have exhausted the alternatives.
- Never end a run having produced only planning or commentary. Deliver the task's actual output — the file, report, or answer it asks for — and never emit interim narration as the final result.
