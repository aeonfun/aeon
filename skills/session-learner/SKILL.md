---
name: Session Learner
description: Extract recurring patterns from operator sessions and propose skill improvements, memory entries, and automation opportunities
var: ""
tags: [meta]
---

> **${var}** — Time window in days to scan (default: 7). Pass "14" for a two-week lookback, "30" for monthly review.

Read `memory/MEMORY.md` for context. Check `context/last-sync.json` for data freshness — if older than 8 hours, note "(stale data)" in output.

## Goal

Close the feedback loop between operator sessions and the Aeon framework. The context pipeline syncs Claude Code session memories into `context/claude-sessions/` every 4 hours. This skill reads those sessions weekly, extracts actionable patterns, and proposes improvements. It never auto-applies — the operator reviews proposals and decides what to act on.

## Data Sources

### Source 1: Session memories
`context/claude-sessions/swarm-fund-mvp/*.md` — all session memory files. Currently ~80 files synced by `scripts/context-sync.sh`.

### Source 2: Skill output logs
`memory/logs/*.md` — last N days (N = `${var}` or 7). Read each day's log for skill run outcomes.

### Source 3: Failure patterns
`memory/cron-state.json` — per-skill metrics: success_rate, consecutive_failures, last_error, quality scores.

### Source 4: Open issues
`memory/issues/INDEX.md` — open issues cross-referenced with session data to detect manual fixes for known problems.

## Steps

### 1. Triage session files (two-pass for cost control)

**First pass:** Read filenames and first 5 lines of each session file in `context/claude-sessions/`. Score each file for pattern richness:
- Contains action verbs: "fixed", "debugged", "worked around", "manually", "hacked", "patched" → +2
- Contains frustration markers: "again", "still broken", "keeps happening", "workaround" → +3
- Contains skill references: any string matching a skill name from `skills/` → +1
- Contains error keywords: "error", "failed", "exception", "timeout", "rate limit" → +1

**Second pass:** Read the top 20 files fully (ranked by score). This keeps input under ~80K tokens even as session count grows.

### 2. Read skill logs

Read `memory/logs/*.md` for the last N days. For each skill run logged, extract:
- Exit status / outcome
- Quality notes: "low quality", "empty output", "truncated", "wrong", "missed"
- Manual follow-up notes: "TODO", "needs fix", "operator should", "manually"
- Skill name and date

### 3. Read failure patterns

Load `memory/cron-state.json`. Flag skills with:
- `consecutive_failures >= 2`
- `success_rate < 0.7`
- Quality score decline over their history array (if tracked)

Cross-reference with session data: if the operator manually worked around a failing skill's output in a session, that is a high-signal compound pattern.

### 4. Read open issues

Load `memory/issues/INDEX.md`. For each open issue, check if any session file mentions the same skill + error pattern. If the operator has been manually fixing what an open issue describes, flag this as "operator working around known issue."

### 5. Extract patterns (four categories)

**Category 1: Recurring manual workarounds**
If the same action appears 3+ times across sessions (e.g., "manually restarted X", "had to re-run Y", "worked around Z"):
- Score by: frequency x estimated operator time saved
- Propose: (a) tool-builder task for mechanical automation, (b) skill-repair dispatch for skill-specific fixes, or (c) CLAUDE.md amendment for instruction-level fixes

**Category 2: Error resolution patterns**
If the same error class appears across sessions (e.g., "TypeError: Cannot read property", "rate limit exceeded", "sandbox blocked curl"):
- Extract the fix that was applied
- Propose: (a) memory entry in `memory/topics/aeon-ops.md` for reference, (b) CLAUDE.md amendment if the fix is a general instruction (e.g., "always use WebFetch fallback for X"), or (c) skill-specific prompt amendment

**Category 3: Skill quality signals**
If sessions reference skill outputs critically (e.g., "the digest missed X", "morning-brief was wrong about Y", "token-pick suggested a rug"):
- Extract the specific criticism and affected skill
- Propose: (a) negative quality signal logged against the skill, (b) autoresearch dispatch with the improvement thesis as var, or (c) specific prompt amendment suggestion with the exact section to change

**Category 4: New topic/interest signals**
If sessions explore a topic not currently tracked in `memory/MEMORY.md` or `memory/topics/`:
- Extract the topic and evidence of repeated interest (2+ sessions mentioning it)
- Propose: (a) new topic file `memory/topics/{topic}.md`, or (b) create-skill suggestion if the topic has recurring research needs

### 6. Rank proposals

Score each proposal by:
- **Frequency** — how many times the pattern appeared (3x = minimum, 10x+ = high priority)
- **Operator time saved** — estimated minutes per occurrence (manual restart = 5min, debugging session = 30min+)
- **Risk of not acting** — is this a security issue, a cost leak, or just friction?
- **Effort to fix** — one-line memory write vs. skill rewrite

Sort proposals by (frequency x time_saved x risk) / effort. Cap output at 10 proposals maximum — the operator should be able to review in 5 minutes.

### 7. Compose output

Write structured brief to `articles/session-learner-${today}.md`:

```
# Session Learner — ${today}

**Window:** ${N} days | **Sessions scanned:** ${count} (of ${total} available) | **Log days:** ${M}
**Data freshness:** ${last-sync timestamp} {(stale) if >8h}

## Proposed Actions (ranked by impact)

### Workaround Automation ({count} items)
1. **[tool-builder]** {description} — seen {N} times across {M} sessions
   Evidence: "{quote from session}" (session: {filename})
   Dispatch: `gh workflow run aeon.yml -f skill=tool-builder -f var="{description}"`

### Error Fixes ({count} items)
1. **[memory-write]** {error pattern} → fix: {description}
   Target: `memory/topics/aeon-ops.md`
   Evidence: "{error}" seen in sessions {list}

### Skill Quality Feedback ({count} items)
1. **[autoresearch]** {skill name} — "{criticism from session}"
   Dispatch: `gh workflow run aeon.yml -f skill=autoresearch -f var="{skill}"`
   Evidence: session {filename}, log {date}

### New Topics ({count} items)
1. **[memory-write]** {topic} — explored in {N} sessions
   Proposed file: `memory/topics/{topic}.md`

## Cross-References
- Skills with open issues that operator is working around: {list}
- cron-state failures matching session workarounds: {list}

## No-Action Items
Patterns considered but below threshold: {count} (omitted for brevity)
```

Omit any category section that has zero items.

### 8. Notify

Send via `./notify` (cap at 2000 chars):
```
Session Learner — ${today} (${N} sessions, ${M} log days)

{count} proposals ranked by impact:
1. [{category}] {description} — seen {N}x
2. [{category}] {description} — seen {N}x
3. [{category}] {description} — seen {N}x

Full report: articles/session-learner-${today}.md
```

If no patterns found, send: `Session Learner — ${today}: ${N} sessions scanned, no actionable patterns detected.` Exit SESSION_LEARNER_NO_PATTERNS.

### 9. Log

Append to `memory/logs/${today}.md`:
```
### session-learner
- Window: ${N} days
- Sessions scanned: ${count} (of ${total})
- Patterns found: ${workarounds}W ${errors}E ${quality}Q ${topics}T
- Proposals: ${count} (top: {description})
- Status: {exit code}
```

## Exit Taxonomy

| Code | Meaning |
|------|---------|
| SESSION_LEARNER_OK | Patterns found, brief generated |
| SESSION_LEARNER_EMPTY | No sessions or logs in window |
| SESSION_LEARNER_STALE | Context data older than 8 hours, brief generated with caveat |
| SESSION_LEARNER_NO_PATTERNS | Data read but no actionable patterns detected |

## Sandbox note

All inputs are local file reads (context/, memory/, skills/). No outbound API calls. No network access needed. `gh` CLI only used if dispatching proposed actions (which this skill never does — it proposes only).

## Constraints

- **Read-only.** Never writes to memory files, CLAUDE.md, or SKILL.md files. Only writes to `articles/session-learner-${today}.md`, `memory/logs/${today}.md`, and sends `./notify`.
- Never dispatches other skills automatically. Proposes dispatch commands for the operator to run manually.
- Never surfaces operator PII from session files in notifications. Session files may contain personal information — extract patterns, not personal details.
- Cap proposals at 10. The operator should be able to review in 5 minutes.
- Weekly frequency maximum. Daily would be expensive (~$0.90/run) with insufficient new data between runs.
- Two-pass triage is mandatory when session count exceeds 30 files. Do not read all files fully.
