---
name: PVR Triage
description: Lifecycle check on submitted private vulnerability reports — polls triage state, detects maintainer acceptance or rejection, surfaces action items when PVRs age past 30 days with no response
var: ""
tags: [security, meta]
requires: [GH_GLOBAL?]
---

> **${var}** — Optional `GHSA-xxxx-xxxx-xxxx` to check a single advisory on demand.

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Voice

If `soul/SOUL.md` and `soul/STYLE.md` are populated, match the operator's voice in the notification. If empty or absent, use a clear, direct, neutral tone.

## Why this skill exists

`pvr-watchlist` monitors repos *waiting to open* PVR. This skill monitors PVRs that have **already been submitted** and tracks their lifecycle: `triage` → `draft` (accepted) → `published` (public) or `withdrawn` (rejected). Without this, submitted advisories sit unmonitored until manually recalled from memory.

Source of truth: `memory/pending-disclosures/*.md` files with `channel: pvr` frontmatter. Each file must have `ghsa`, `repo`, `state`, `submitted_at` fields.

## Configuration

The skill can reference an optional **tracking issue** in the operator's own repo — useful for cross-linking advisory state with an internal issue board. Resolve from (priority order):

1. `aeon.yml` top-level key `pvr_triage.tracking_issue:` (e.g. `pvr_triage: { tracking_issue: "owner/repo#123" }`)
2. environment variable `AEON_PVR_TRACKING_ISSUE`
3. unset — skip cross-linking entirely

If a tracking issue is configured, mention its URL in notifications and the per-advisory write-up so the operator can navigate to the canonical tracker.

## Steps

### 1. Discover in-flight PVRs

Scan `memory/pending-disclosures/` for all `.md` files. Parse the YAML frontmatter. Keep only those with `channel: pvr`.

If `${var}` is set, filter to just the matching `ghsa` value (one-off mode).

If no PVR files found:
```
PVRT_SKIP: no submitted PVRs on disk
```
Log and stop. No notification.

### 2. Probe each advisory's triage state

For each entry, determine `repo` and `ghsa` from frontmatter.

```bash
REPO="owner/repo"
GHSA="GHSA-xxxx-xxxx-xxxx"

gh api "repos/${REPO}/security-advisories/${GHSA}" \
  --jq '{state: .state, cve_id: .cve_id, published_at: .published_at}' 2>&1
```

Expected outcomes:

| Response | Meaning |
|----------|---------|
| `{state: "triage", ...}` | Maintainer hasn't reviewed yet |
| `{state: "draft", ...}` | Accepted — maintainer is working on it |
| `{state: "published", ...}` | Published — fully resolved |
| `{state: "withdrawn", ...}` | Rejected or withdrawn by reporter |
| HTTP 403 | Private advisory, we don't have read access — state unknown, treat as still `triage` |
| HTTP 404 | Advisory deleted / repo private / GHSA invalid — flag as `not-found` |

**Sandbox note:** `gh api` uses `GH_TOKEN` internally (workflow wires `GH_GLOBAL`). If blocked, fall back to:
```bash
curl -s -H "Authorization: Bearer $GH_GLOBAL" \
  "https://api.github.com/repos/${REPO}/security-advisories/${GHSA}" \
  | grep -o '"state":"[a-z]*"'
```

### 3. Detect state changes

Compare the probed `state` to the `state` in the frontmatter.

- **No change:** note it, continue.
- **Changed:** this is the primary event. Log old → new state.

Also flag:
- **Aged triage:** `state=triage` AND (`today` − `submitted_at`) > 30 days → escalate. Most maintainers respond within 30 days; silence past that is actionable.
- **Accepted (draft):** surface the patch branch from `patch_branch` frontmatter field — maintainer may want a PR instead of a private advisory.
- **Published:** advisory is live. The finding is closed. Update state and mark for removal.
- **Withdrawn:** rejected. Note the reason if visible. Mark for cleanup.

### 4. Update frontmatter in-place

For each file with a state change, rewrite just the `state` field in the YAML frontmatter. Also update a `last_checked` field (add it if absent).

Do NOT modify the body of the advisory file — only update frontmatter.

Example frontmatter update:
```yaml
state: draft          # was: triage
last_checked: 2026-05-21
```

For `published` or `withdrawn` entries, add:
```yaml
resolved_at: 2026-05-21
```

### 5. Decide whether to notify

- **All entries still `triage`, no changes, none aged:** no notification. Log silently.
- **Any state change, aged entry, or action item:** notify.

### 6. Format notification

Write to `.pending-notify-temp/pvrt-${today}.md`, then: `./notify -f .pending-notify-temp/pvrt-${today}.md`

```
pvr triage: {total} advisories in flight. {changed_count} changed.

CHANGED:
- {repo} {ghsa} — {old_state} → {new_state}
  {action_item}

AGED (>30d no response):
- {repo} {ghsa} — {days}d in triage. {severity}. escalate or close.
  patch: {patch_branch}

STILL TRIAGE:
{n} advisories waiting. oldest: {repo} ({days}d).

{if tracking_issue configured}
tracker: {tracking_issue_url}
{end}
```

Action items by transition:
- `triage → draft` → "maintainer accepted — offer to PR the patch branch: {patch_branch}"
- `triage → published` → "published as {cve_id}. remove from tracking."
- `triage → withdrawn` → "rejected. remove from tracking and note in vuln-scanned.json."
- aged triage (>30d) → "30d+ no response. consider pinging maintainer or withdrawing."

### 7. Clean up resolved entries

For entries where `state=published` or `state=withdrawn` AND `resolved_at` is set: move the file from `memory/pending-disclosures/` to `memory/pending-disclosures/resolved/` (create the directory if needed).

Do NOT delete — keep as a historical record.

### 8. Log to memory

Append to `memory/logs/${today}.md`:

```
## PVR Triage Monitor
- **Checked:** {total} advisories
- **Changed:** {changed_count} ({list})
- **Aged (>30d):** {aged_count}
- **Still triage:** {waiting_count}
- **Tracking issue:** {url or "none"}
- **Notification:** {sent|skipped}
- PVRT_OK
```

## Required Env Vars

- `GH_GLOBAL` — GitHub PAT with `public_repo` + `repository_advisories:write` scope. Same token used by `vuln-scanner` and `pvr-watchlist`.

## Pending Disclosure File Schema

`memory/pending-disclosures/*.md` files tracked by this skill must include:

```yaml
---
repo: owner/repo
ghsa: GHSA-xxxx-xxxx-xxxx
ghsa_url: https://github.com/owner/repo/security/advisories/GHSA-xxxx-xxxx-xxxx
channel: pvr
state: triage          # triage | draft | published | withdrawn
submitted_at: 2026-05-12T19:54:42Z
last_checked: 2026-05-15  # added/updated by this skill
severity: high
cwe: [CWE-xxx]
patch_branch: https://github.com/<fork-owner>/repo/tree/security/branch-name
patch_commit: abc1234
---
```

Required fields: `repo`, `ghsa`, `channel: pvr`, `state`, `submitted_at`.
Optional: `patch_branch`, `patch_commit`, `cwe`, `ghsa_url`.
