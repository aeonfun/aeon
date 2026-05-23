---
name: pvr-watchlist
description: Weekly probe of repos on the security watchlist — check if private vulnerability reporting has been enabled, notify when status flips, re-submit any queued advisories or flag for re-research when draft was lost
var: ""
tags: [security, meta]
---

> **${var}** — Optional `owner/repo` to probe on demand instead of running the full watchlist.

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, match the operator's voice in the notification. If empty or absent, use a clear, direct, neutral tone.

## Why this skill exists

When `vuln-scanner` finds a HIGH/CRITICAL issue in a repo with no PVR, no SECURITY.md, and no reachable maintainer contact, it has no safe disclosure channel — so it logs the finding in `memory/vuln-scanned.json` as `"channel": "skipped"` and marks the advisory as pending a PVR re-check. Without a weekly probe, those findings silently age until the responsible-disclosure window closes. This skill closes that loop.

Active watchlist: `memory/security-watchlist.md`

## Steps

### 1. Load the watchlist

Read `memory/security-watchlist.md`. Parse each row in the table:
```
| owner/repo | severity | short-title | first-checked | last-checked | status |
```

If `${var}` is set, skip the file and probe only that target (one-off mode).

If the watchlist is empty or the file doesn't exist:
```
PVRL_SKIP: watchlist empty
```
Log it and stop. No notification needed.

### 2. Probe each entry for PVR status

For each repo, run:

```bash
REPO="owner/repo"
gh api "repos/${REPO}/private-vulnerability-reporting" --jq '.enabled' 2>&1
```

Expected responses:
- `true` — PVR is now enabled. **This is the flip we're watching for.**
- `false` — PVR still disabled. Note it, move on.
- `404` — Repo may have been deleted / renamed / made private. Flag as `not-found`.
- `403` — Token lacks scope or it's a private repo. Flag as `access-denied`.

**Sandbox note:** `gh` CLI handles auth internally — no token-in-URL needed. If `gh api` is blocked by the sandbox, fall back to:
```bash
curl -s -H "Authorization: Bearer $GH_GLOBAL" \
  "https://api.github.com/repos/${REPO}/private-vulnerability-reporting" | grep -o '"enabled":[a-z]*'
```

### 3. Handle PVR-enabled flips

For each repo where PVR flipped to `true`:

**a) Check for a recoverable draft**

Look in `memory/pending-disclosures/` for a file whose name starts with the repo slug (replacing `/` with `-`).

```bash
SLUG=$(echo "$REPO" | tr '/' '-')
ls memory/pending-disclosures/${SLUG}*.md 2>/dev/null
```

**b) If a draft exists and status is not `shipped`:**

Attempt auto-submission via PVR API:

```bash
gh api "repos/${REPO}/security-advisories" \
  --method POST \
  --input <draft-content-as-json>
```

Build the JSON body from the draft file fields:
- `summary` → first heading line
- `description` → full advisory body
- `severity` → from `**Severity:**` field
- `cwe_ids` → array from `**CWE:**` field (e.g. `["CWE-639"]`)
- `vulnerabilities` → array with `{ "package": { "ecosystem": "other", "name": "$REPO" } }`

If the POST returns 201: mark draft as `status: submitted`, update `memory/vuln-scanned.json` channel to `pvr-submitted`, and note in the watchlist row `status: submitted`.

If the POST returns 403 (scope still missing): keep status as `pvr-enabled-pending-submit`. Notify operator to submit manually via the GitHub web form.

**c) If no draft exists (draft was lost):**

Do NOT attempt a blind submission. Instead, flag the entry as `pvr-enabled-needs-reresearch`: the finding needs to be re-discovered before it can be submitted. This should trigger a targeted `vuln-scanner` run on the repo.

### 4. Update the watchlist file

Rewrite `memory/security-watchlist.md` with updated `last-checked` and `status` for every entry. Status values: `pvr-disabled` | `pvr-enabled-pending-submit` | `submitted` | `not-found` | `access-denied` | `pvr-enabled-needs-reresearch`.

Remove entries where `status: submitted` AND the submission happened more than 30 days ago (they're done; lifecycle tracking is handled by `pvr-triage-monitor` from there).

### 5. Decide whether to notify

- **All entries still `pvr-disabled`:** no notification. Log counts and stop.
- **Any status flip detected (pvr-enabled, not-found, access-denied, submitted):** send notification.
- **Any `pvr-enabled-needs-reresearch`:** send urgent notification — window may be closing.

### 6. Format notification

Write to a temp file, then: `./notify -f .pending-notify-temp/pvr-watchlist-${today}.md`

```
pvr watchlist: {total} repos. {flip_count} flipped this run.

FLIPPED:
- {repo} — {severity}, PVR now enabled. {draft_status}
  [draft found → auto-submitted | draft found → bot 403, manual submit needed | no draft → re-research needed]

STILL WAITING:
{n} repos still pvr-disabled. oldest: {repo} ({days}d since first scan).

watchlist: memory/security-watchlist.md
```

If a re-research is needed, escalate urgency:
```
pvr watchlist: {repo} flipped. no draft — needs re-research before the window closes.

HIGH severity. scanned {first_checked}. {days_since}d ago.
no draft on disk. need a targeted vuln-scanner run to recover the finding.

run: gh workflow run aeon.yml -f skill=vuln-scanner -f var={repo}
```

### 7. Log to memory

Append to `memory/logs/${today}.md`:

```
## PVR Watchlist
- **Watched:** {total} repos
- **Flipped:** {flip_count} ({repos_that_flipped})
- **Submitted:** {submitted_count}
- **Still waiting:** {waiting_count}
- **Notification:** {sent|skipped}
- PVRL_OK
```

## Required Env Vars

- `GH_GLOBAL` — GitHub PAT with `public_repo` + `repository_advisories:write` scope. Same token used by `vuln-scanner`. Required for cross-repo `gh api` calls.

## Sandbox Note

`gh api` uses the `GH_TOKEN` env var internally (the workflow wires `GH_GLOBAL` in). If the sandbox blocks `gh api`, use the `curl` fallback in step 2. No outbound auth-required calls except `gh api` — no pre-fetch needed.

## Watchlist File Format

`memory/security-watchlist.md` is a Markdown table maintained by this skill. Add new entries manually or via `vuln-scanner`'s "no safe channel" branch. Schema:

```markdown
# Security Watchlist

Repos where we have a staged advisory but no disclosure channel yet.
Updated automatically by pvr-watchlist skill.

| Repo | Severity | Finding | First Checked | Last Checked | Status |
|------|----------|---------|---------------|--------------|--------|
| owner/repo | HIGH | Short title | YYYY-MM-DD | YYYY-MM-DD | pvr-disabled |
```
