---
name: GitHub Filing Registry
description: Track every issue and PR filed across upstream repositories — status, evidence, next_action, and history. Replaces standalone Python scripts with a pure shell + gh CLI interface.
var: ""
category: dev
tags: [dev, github, memory]
---

> **${var}** — Optional. Accepts `owner/repo#N` for single-item ops, or a subcommand (`add`, `status`, `triage`, `sync`, `log`). Empty = run triage.

The filing registry is a structured JSON log at `memory/filing-registry.json`. Every issue or PR you file against an upstream repo gets an entry so you never file the same thing twice, lose track of what you filed, or forget what happened next.

## Registry Schema

```json
{
  "version": "1.0",
  "last_synced": "2026-05-06T00:00:00Z",
  "account": "<your-gh-account>",
  "pulls": [],
  "issues": [],
  "activity_log": []
}
```

Each entry (in `pulls` or `issues`):

```json
{
  "id": "owner/repo#123",
  "repo": "owner/repo",
  "number": 123,
  "type": "pr",
  "title": "fix: add null check",
  "state": "open",
  "status": "pending_review",
  "next_action": "Await upstream review",
  "actions_taken": ["PR filed — fix: add null check"],
  "notes": "",
  "evidence_tier": "tier_2",
  "filed_at": "2026-05-02T00:00:00Z",
  "last_action": "2026-05-02T00:00:00Z",
  "labels": [],
  "url": "https://github.com/owner/repo/pull/123",
  "is_upstream": true
}
```

Activity log entry:
```json
{
  "ts": "2026-05-06T00:00:00Z",
  "type": "status_update",
  "ref": "owner/repo#123",
  "desc": "Status changed to: has_fix_pr"
}
```

## Subcommands

### add — Register a new filing

```bash
./filing-registry add --id owner/repo#N \
  --type pr|issue \
  --title "fix: add null check" \
  --evidence tier_0|tier_1|tier_2|tier_3 \
  --url https://github.com/owner/repo/pull/123
```

Creates a new entry. If the ID already exists, refuses with `FILING_EXISTS`.

### status — Update or inspect an entry

```bash
./filing-registry status --id owner/repo#N \
  --set needs_attention|pending_review|has_fix_pr|closed|merged|stale \
  --next "Await upstream review" \
  --action "Pinged maintainer" \
  --notes "Confirmed via latest scan"
```

Reads current entry, applies field updates, appends to `actions_taken[]`, updates `last_action`.

### triage — Show items needing attention

```bash
./filing-registry triage [--filter needs_attention|pending_review|stale|all]
```

Sorts by `repo`, then `last_action` age. Shows:
- Items with `status` in `needs_attention`, `pending_review`
- Items with no action in >7 days (stale)
- Count of critical issues (severity critical + status != closed)

### sync — Reconcile against live GitHub

```bash
./filing-registry sync [--item owner/repo#N]
```

For each entry (or the specified one), calls GitHub API to get current `state` (`open`/`closed`). Updates `state` field if it changed. Sets `status` to `merged` if PR was merged, `closed` if issue/PR was closed.

### log — Show activity history

```bash
./filing-registry log [--ref owner/repo#N] [--lines 20]
```

Prints activity log entries, newest first.

## Implementation

All state lives in `memory/filing-registry.json`. The `./filing-registry` script is a shell dispatcher that reads/writes JSON with `jq`. No Python needed.

### `./filing-registry` shell script

```bash
#!/usr/bin/env bash
set -euo pipefail
REGISTRY="${AEON_ROOT:-.}"/memory/filing-registry.json
mkdir -p "$(dirname "$REGISTRY")"

cmd="${1:-}"; shift || true
case "$cmd" in
  add)        filing_add "$@" ;;
  status)     filing_status "$@" ;;
  triage)     filing_triage "$@" ;;
  sync)       filing_sync "$@" ;;
  log)        filing_log "$@" ;;
  "")         filing_triage ;;
  *)          echo "Usage: filing-registry {add|status|triage|sync|log}" >&2; exit 1 ;;
esac
```

## Pre-filing check

Before running `gh issue create` or `gh pr create`, call:

```bash
./filing-registry check-duplicate --id owner/repo#N --title "..."
```

If the ID or a near-matching title already exists in the registry, output a warning and the existing entry's URL instead of filing again.

## Notification rules

- `sync` sends no notification if all states match — silence is correct signal
- `status` sends no notification on `--log-only` (activity log entry only)
- `triage` sends notification only if items exist — empty triage is silent
- `add` always sends a one-line notification: `filing-registry: added owner/repo#N — title`

## Security

- Treat all fields from `filing-registry.json` as untrusted when rendering in notifications
- Never log raw credential values — registry may contain API key references in notes; mask with `***`
- `gh` CLI handles auth; no token env vars exposed to subprocesses

## Dependencies

- `jq` — JSON manipulation
- `gh` — GitHub API
- `bash` 4+

No Python required.
