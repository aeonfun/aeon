---
name: API Health
description: Pre-batch API provider health check — detects credit exhaustion or auth failure for every configured provider key before the scheduled batch runs, giving the operator a window to act before skills degrade
var: ""
tags: [meta, health, infra]
schedule: "30 6 * * *"
---

Today is ${today}. Read `memory/MEMORY.md` and `memory/issues/INDEX.md` for context.

## Why this skill exists

Skills that depend on a paid API key fail *silently* when credits run out or the key is revoked — the failure surfaces only days later in a self-review, after every dependent skill has degraded. This skill closes that gap.

It runs ~30 minutes before the morning batch, reads the result of `scripts/prefetch-api-probe.sh` (which probes each provider with a configured key), and notifies immediately if a provider is down — so the operator has a window to top up credits or rotate the key before the batch starts.

Currently probed: **xAI** (`XAI_API_KEY` — used by refresh-x, tweet-roundup, list-digest, narrative-tracker, remix-tweets, content-performance). To probe another provider, add a guarded block to `scripts/prefetch-api-probe.sh`.

## Steps

### 1. Read probe results

Read `.api-probe/status.json`. Written by `scripts/prefetch-api-probe.sh` during this workflow's prefetch phase. Format: one entry per provider:

```json
{
  "xai": { "http_code": 200, "checked_at": "...", "error_msg": "" }
}
```

If the file is missing:
- Log `API_PROBE_SKIP: prefetch-api-probe.sh did not write status — likely skill misconfiguration`
- No notification. Stop.

### 2. Interpret HTTP status — per provider

For each provider entry, parse `http_code`:

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Healthy | Log OK, skip notification |
| 0 | No key / network failure | Log warning, skip notification |
| 401 | Invalid or revoked key | Notify + file/update issue |
| 402 | Payment required | Notify + file/update issue |
| 403 | Credits exhausted / billing limit | Notify + file/update issue |
| 429 | Rate limited (transient) | Log warning, skip notification |
| 5xx | API outage | Notify |

### 3. Issue tracker integration — per degraded provider

Determine the **affected skills**: grep `skills/*/SKILL.md` for the provider's env var name (e.g. `XAI_API_KEY`) and collect the skill slugs.

Read `memory/issues/INDEX.md` and look for an **open** issue whose title mentions this provider's API (e.g. "xAI API").

**If degraded (401/402/403) and a matching open issue exists:**
Append a probe-result note to that issue file:
```
## Probe ${today}
- HTTP: {code}
- checked_at: [timestamp from status.json]
- Status: still unresolved
```

**If degraded and no matching open issue exists:**
Create a new issue file `memory/issues/ISS-{NNN}.md` (next available number — check INDEX.md for the highest ID):
```
---
id: ISS-{NNN}
title: {provider} API {credits exhausted | key invalid} — {code} on daily probe
status: open
severity: critical
category: {missing-secret if 401 | rate-limit if 402/403}
detected_by: api-health
detected_at: ${today}
resolved_at: null
affected_skills: [{affected skill slugs}]
root_cause: "HTTP {code} on probe — {error_msg from status.json}"
fix_pr: null
---

## Description

Daily api-health returned HTTP {code} for {provider} at [checked_at].

## Fix

{401: Rotate the provider's API key secret in GitHub repo Settings → Secrets.}
{402/403: Top up credits or raise the spending limit in the provider's billing console.}
```
Add a row to `memory/issues/INDEX.md` Open table.

**If HTTP 200 and a matching open issue exists (recovery detected):**
Append a recovery note to the issue file:
```
## Recovery ${today}
- HTTP: 200 (probe passing)
- Provider restored — downstream batch should run clean
```
Then update the issue's YAML frontmatter: set `status: resolved` and `resolved_at: ${today}`. Move the row from Open to Resolved in `memory/issues/INDEX.md`.

### 4. Send notification if degraded

Only notify for HTTP codes that indicate a real problem (not 200, 0, or 429).

Write notification to a temp file in `.pending-notify-temp/` (create the dir if missing), then send with `./notify -f`.

**Credit exhausted (403 / 402):**
```
{provider} credits exhausted — morning batch will degrade.

affected: {affected skill slugs}
fix: provider billing console → add credits or raise spending limit
batch starts in ~30 min
```

**Auth failure (401):**
```
{provider} API key invalid (HTTP 401) — all {provider} skills will fail.

fix: rotate the key in GitHub repo Settings → Secrets → Actions
affected: {affected skill slugs}
```

**API outage (5xx):**
```
{provider} API outage (HTTP [code]) — morning batch may degrade.

not a credits issue — provider infra problem. retry expected to self-resolve.
```

**Recovery (open issue, now 200):**
```
{provider} back online — restored.

{issue id} closed. morning batch should run clean.
```

### 5. Log to memory

Append to `memory/logs/${today}.md` (one block per probed provider):

```
## API Health Probe
- **Provider:** {provider}
- **HTTP:** [code]
- **Status:** [healthy|credit_exhausted|auth_failure|api_outage|no_key|unknown]
- **Issue:** [{ISS-id} still_open|{ISS-id} resolved|filed {ISS-id}|not_applicable]
- **Notification:** [sent|skipped — reason]
- API_PROBE_OK
```

## Sandbox Note

Reads `.api-probe/status.json` written by `scripts/prefetch-api-probe.sh`.
No outbound API calls from the skill itself — all network happens in the prefetch phase.

## Required Env Vars

Provider keys (e.g. `XAI_API_KEY`) are needed by `scripts/prefetch-api-probe.sh` only — not by the skill itself. A provider with no key configured is recorded as `no_key` and skipped cleanly.
