---
name: self-improve
description: Improve the agent itself — better skills, prompts, workflows, and config based on recent performance
var: ""
tags: [meta]
---
> **${var}** — Specific area to improve (e.g. "heartbeat", "notifications", "memory"). If empty, finds the highest-impact issue from recent logs.

If `${var}` is set, focus on improving that specific area.

Read memory/MEMORY.md for context.
Read the last 2 days of memory/logs/ for recent errors, failures, and quality issues.

## Steps

1. **Check for open improvement PRs** — don't pile up unreviewed work:
   ```bash
   OPEN_PRS=$(gh pr list --state open --json title,number --jq '[.[] | select(.title | test("^(fix|feat|chore)\\("; "i"))] | length')
   ```
   If there are already 3+ open improvement PRs, log "self-improve: 3+ open PRs, waiting for review" and exit. Don't create more debt.

2. **Identify what to improve.** If `${var}` is empty, scan for issues:
   - Read `memory/logs/` from last 2 days — look for:
     - Skills that failed or produced low-quality output
     - Errors, timeouts, "zero output", rate limiting
     - Notifications that didn't send or were truncated
     - Memory consolidation problems
   - Read `memory/cron-state.json` for skills with low success rates
   - Read `articles/repo-actions-*.md` from last 7 days for self-improvement ideas
   - Pick the **highest-impact, smallest-effort** fix. One change per run.

3. **Understand the area you're fixing.** Read the relevant files:
   - Skills: `skills/{name}/SKILL.md`
   - Config: `aeon.yml`
   - Workflows: `.github/workflows/*.yml`
   - Agent instructions: `CLAUDE.md`
   - Dashboard: `apps/dashboard/` (if UI-related)
   
   Understand the current behavior before changing anything.

4. **Implement the fix.** Make minimal, targeted changes:
   - If a skill prompt is unclear → rewrite the ambiguous section
   - If a skill is hitting rate limits → add backoff logic or reduce frequency
   - If output quality is low → tighten the prompt, add examples, clarify format
   - If a notification is broken → fix the formatting or truncation
   - If a config is wrong → fix aeon.yml

   Do NOT:
   - Rewrite entire skills from scratch
   - Add new features (that's build-skill's job)
   - Change the core architecture
   - Modify secrets or environment variables

5. **Create a branch and PR:**
   ```bash
   git checkout -b fix/self-improve-${today}
   git add -A
   git commit -m "fix: [description of what was improved]

   Problem: [what was failing/degraded]
   Fix: [what was changed]
   Evidence: [log entries, error messages, success rates]"
   ```
   Open a PR:
   ```bash
   gh pr create --title "fix: [short description]" \
     --body "## Problem
   [What was failing or degraded — cite specific log entries or error messages]

   ## Fix
   [What was changed and why]

   ## Evidence
   - [Relevant log entries]
   - [Success rate before: X%]
   - [Error pattern: ...]"
   ```

6. **Notify.** Send via `./notify`:
   ```
   self-improve: [what was fixed] — PR: [url]
   ```

7. **Log.** Append to `memory/logs/${today}.md`:
   ```
   ## Self Improve
   - **Target:** [what was improved]
   - **Problem:** [what was failing]
   - **Fix:** [what was changed]
   - **PR:** [url]
   ```

## Guidelines

- ONE fix per run. Don't bundle unrelated changes.
- Smallest viable fix. A one-line prompt tweak > a full rewrite.
- If you can't find anything to improve, that's fine. Log "self-improve: everything looks healthy" and exit.
- Never modify workflow files (.github/workflows/) — only skill files, CLAUDE.md, and aeon.yml.
- Don't create circular improvements (e.g. don't improve self-improve).
