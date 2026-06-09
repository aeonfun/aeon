---
name: disclosure-tracker
description: Audit of the pending vulnerability disclosure queue — tracks draft advisories in memory/pending-disclosures/, alerts on aging CRITICAL/HIGH findings.
var: ""
tags: [security, meta]
---

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Goal

Monitor the pending vulnerability disclosure backlog. The `vuln-scanner` skill queues draft advisories to `memory/pending-disclosures/` when Private Vulnerability Reporting (PVR) auto-submission fails or when the disclosure path is email-only. Without daily visibility, CRITICAL/HIGH advisories silently age past responsible-disclosure windows. This skill surfaces the queue state every morning and escalates when findings have been sitting too long.

## Steps

### 1. Scan the backlog

Check `memory/pending-disclosures/` for draft advisory files.

```bash
ls memory/pending-disclosures/ 2>/dev/null
```

If the directory doesn't exist or is empty:
- Log `DISCLOSURE_TRACKER_SKIP: no pending advisories` and stop. No notification needed.

### 2. Parse each advisory file

For each `.md` file in `memory/pending-disclosures/`:

**From the filename** (pattern: `{repo-slug}-{YYYY-MM-DD}.md` or `{repo-slug}-{YYYY-MM-DD}-{ampm}.md`):
- Extract target repo slug (everything before the last date segment)
- Extract filed date

**From the YAML frontmatter** (if present) parse:
- `repo:` — overrides the filename slug when present (canonical target)
- `severity:` — CRITICAL / HIGH / MEDIUM / LOW
- `status:` — see step 2.5 for the controlled vocabulary

**From the file content** (fallback for files without frontmatter), look for these fields near the top of the file:
- `Severity:` or `**Severity:**` — one of CRITICAL / HIGH / MEDIUM / LOW
- `CVE/CWE:` or similar identifier
- Short title (first non-blank heading line)

If severity is not parseable, treat as MEDIUM.

Compute age: `today - filed date` in days.

### 2.5. Classify each advisory's disclosure state

Before counting any draft as a past-threshold escalation, decide whether the draft is genuinely pending or already covered. A draft can be in one of these states:

- `escalate` — pending, no canonical PR found, past the severity-tier threshold
- `pending` — pending, no canonical PR found, within the threshold window
- `operator-todo` — needs operator-only action (email send, PVR enable nudge); not an agent failure
- `covered-by-pr` — a canonical disclosure PR has already been filed against the target repo and is `OPEN` or recently merged
- `superseded-upstream` — the bypass / vuln is fixed in upstream already, draft is dead-weight
- `submitted` — already submitted via PVR / GHSA; awaiting maintainer response

Resolution rules:

1. **Check frontmatter `status:` first** — map the literal value to a state:
   - `superseded-upstream` → `superseded-upstream`
   - `submitted`, `submitted-via-pvr`, `disclosed-via-pr-{N}` → `submitted` or `covered-by-pr`
   - `pending-operator-send`, `queued for operator manual send`, any string mentioning "operator" → `operator-todo`
   - `pending`, blank, or missing → fall through to rule 2

2. **Cross-reference `memory/topics/pr-status.md`** (if present) — grep for the `{repo}` slug (frontmatter `repo:` or filename) in the Open section and Recent Merges section. If a row exists with a `fix(security)` or `chore(security)` title against that repo, opened on or after the draft's `detected_at` / `reconstructed_at` / filed-date, classify as `covered-by-pr` and capture the PR number / title for the summary. If `memory/topics/pr-status.md` doesn't exist, skip this lookup and fall to rule 3.

3. **Fall through** — if no status hint and no canonical PR found, classify as `pending`. Then check age vs the severity-tier threshold (CRITICAL 3d / HIGH 7d / MED-LOW 14d) — if past, promote to `escalate`.

This is the load-bearing step. Without cross-referencing already-merged fix PRs the tracker generates false-positive escalations for drafts that have already been resolved.

### 3. Build the summary

Group advisories by **state first**, then by severity within each state. The three buckets are:

- **Escalate** — `escalate` state only (truly stuck, past threshold, no canonical PR)
- **Operator-todo** — `operator-todo` state (email-only sends, PVR-enable nudges, anything awaiting human action)
- **Cleanup candidates** — `covered-by-pr`, `submitted`, `superseded-upstream` (draft files that can be removed from `memory/pending-disclosures/`)

Severity tiers and thresholds (only apply to `escalate` and `pending` states):
- **CRITICAL** (age threshold: 3 days — escalate immediately)
- **HIGH** (age threshold: 7 days — escalate at 7d)
- **MEDIUM / LOW** (threshold: 14 days)

For each advisory, produce one line:
```
- {repo-slug} | {severity} | {age}d | {short title}{state-suffix}
```
where `{state-suffix}` is empty for `escalate` / `pending`, `[operator-todo: {reason}]` for operator-todo, and `[covered: PR #{N}]` / `[superseded-upstream]` / `[submitted]` for cleanup candidates.

Count totals. Identify advisories in the `escalate` state — those are the only ones that drive the urgent notification path.

### 4. Check for upstream PVR / token issues

Look in `memory/issues/INDEX.md` for any open issues tagged with `pvr`, `repository_advisories`, or `missing-secret` that explain why advisories are stuck. If such an issue exists, note:
- Number of consecutive PVR failures (if logged)
- Fix estimate from the issue notes
- How many of the backlogged advisories are blocked by it

If no such issue exists, treat the queue as routine and skip the "blocked by" line in the notification.

### 5. Decide whether to notify

Compute counts from step 3:
- `escalate_count` — drafts in the `escalate` state
- `pending_count` — drafts in `pending` (in-window) state
- `operator_todo_count` — drafts awaiting operator action
- `cleanup_count` — drafts in `covered-by-pr` / `submitted` / `superseded-upstream`

Decision:
- **Queue empty**: log `DISCLOSURE_TRACKER_SKIP: queue empty` and stop.
- **`escalate_count` > 0**: send the urgent escalation notification.
- **`escalate_count` == 0 but `cleanup_count` > 0**: send a daily digest that includes the cleanup-candidate list so operator can prune `memory/pending-disclosures/`.
- **All `pending` / `operator-todo`, nothing past threshold, no cleanup candidates**: send the daily digest.

Coverage from `covered-by-pr` / `submitted` / `superseded-upstream` is **never** counted as an escalation — those are informational only. Operator-todo is **never** counted as escalation either; it's surfaced separately so operator knows their inbox.

### 6. Format notification

Write to a temp file, then send with `./notify -f`:

```
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/disclosure-tracker-${today}.md
```

**Urgent format** (`escalate_count` > 0):

```
disclosure queue: {escalate_count} past threshold (of {total} drafts).

ESCALATE:
- {repo} — {severity}, {age}d old (threshold: {N}d)
[... others in `escalate` state ...]

operator-todo ({operator_todo_count}):
- {repo} — {severity}, {age}d — {operator-reason}

cleanup candidates ({cleanup_count}):
- {repo} — [covered: PR #{N} / superseded-upstream / submitted] — safe to delete from memory/pending-disclosures/

{IF blocking issue tracked in memory/issues/INDEX.md}
blocked by {ISS-ID} — {short reason}
fix: {fix estimate} unblocks {N} of {escalate_count + pending_count}
{end}
```

**Daily digest format** (no escalation):

```
disclosure queue: {total} drafts. {critical_count} CRITICAL, {high_count} HIGH, {other_count} MED/LOW.
{pending_count} in-window, {operator_todo_count} operator-todo, {cleanup_count} cleanup candidates.
oldest in-window: {repo} ({age}d).
{cleanup section if cleanup_count > 0}
{IF blocking issue tracked in memory/issues/INDEX.md}
blocked by {ISS-ID} — {short reason}.
{end}
```

### 7. Update memory

Append to `memory/logs/${today}.md`:

```
## Disclosure Tracker
- **Queue:** {total} drafts ({critical_count} CRITICAL / {high_count} HIGH / {other_count} MED/LOW)
- **State breakdown:** {escalate_count} escalate / {pending_count} in-window / {operator_todo_count} operator-todo / {cleanup_count} cleanup-candidates
- **Oldest in-window:** {repo} ({age}d)
- **Escalations:** {escalate_count} past threshold (excludes covered / submitted / superseded)
- **Cleanup candidates:** {list of repos with state-suffix}
- **Blocking issue:** {ISS-ID or "none"}
- **Notification:** {sent|skipped}
- DISCLOSURE_TRACKER_OK
```

## Sandbox Note

This skill only reads local files (`memory/pending-disclosures/`, `memory/issues/`, `memory/topics/pr-status.md`). No outbound network or auth required. No sandbox workarounds needed.

## Required Env Vars

None. All data comes from local files written by the `vuln-scanner` skill.

## Notes on File Format

Newer drafts use YAML frontmatter:

```
---
repo: owner/name
severity: HIGH
cwe: CWE-639
status: pending-operator-send      # optional; see controlled vocabulary below
patch_branch: https://github.com/<your-fork-org>/<repo>/tree/<branch>
submit_url: https://github.com/owner/name/security/advisories/new
---

# {Repo}: {Title}
...
```

Older drafts use inline `**Severity:**` lines. Parse defensively — grep for `severity:` and `Severity:` case-insensitively. If unparseable, default to MEDIUM.

### `status:` controlled vocabulary

Set by `vuln-scanner` / operator / cleanup chores. Drives step 2.5 classification:

- (blank or missing) — pending; tracker falls through to PR-tracker cross-ref
- `pending` — same as blank
- `pending-operator-send` / `queued for operator manual send` — operator-todo
- `submitted` / `submitted-via-pvr` — submitted, awaiting maintainer
- `disclosed-via-pr-<N>` — covered-by-pr, draft can be archived
- `superseded-upstream` — bypass is already fixed in upstream; draft is dead
- Any string containing `operator` — operator-todo

When a canonical PR lands but the draft's `status:` was never set, the tracker falls through to step 2.5 rule 2 (cross-ref pr-status.md) and classifies as `covered-by-pr` automatically. The `status:` shortcut is just an explicit hint that bypasses the grep.

### When to delete a draft

Cleanup candidates in the notification can be removed by the operator with `rm memory/pending-disclosures/<file>.md`. Safe to do at any time once the canonical PR is open — the patch branch on the fork remains the authoritative artifact.
