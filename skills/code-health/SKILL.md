---
name: Code Health
description: Report on TODOs, dead code, and test coverage gaps
var: ""
tags: [dev]
---
> **${var}** — Repo (owner/repo) to audit. If empty, audits all watched repos.

If `${var}` is set, only audit that repo (owner/repo format).


## Config

This skill reads repos from `memory/watched-repos.md`. If the file doesn't exist yet, create it or skip this skill.

```markdown
# memory/watched-repos.md
- owner/repo
- another-owner/another-repo
```

---

Read memory/MEMORY.md and memory/watched-repos.md for repos to audit.

Steps:
1. For each repo in watched-repos.md, clone or checkout:
   ```bash
   gh repo clone owner/repo /tmp/repo-audit -- --depth 1
   ```
2. Scan for code health signals:
   - **TODOs/FIXMEs**: `grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.{js,ts,py,sol,rs,go}" /tmp/repo-audit`
   - **Dead code indicators**: unused exports, commented-out blocks, unreachable code
   - **Test coverage**: check if test files exist for key modules, note untested areas
   - **Large files**: files over 500 lines that might need splitting
   - **Secrets in code**: scan for hardcoded API keys, tokens, passwords
3. Compile a health report and save to articles/code-health-${today}.md:
   ```markdown
   # Code Health Report — ${today}

   ## repo-name
   ### TODOs (N found)
   - file:line — TODO text

   ### Concerns
   - description

   ### Recommendations
   - action item
   ```
4. Send a summary via `./notify`.
5. Log what you did to memory/logs/${today}.md.
