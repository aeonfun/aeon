---
name: ecosystem-entrants
description: Diff of ECOSYSTEM.md against the last run — surfaces newly-added projects (and projects removed) as a discrete signal so new entrants aren't lost in the static list. Pairs with ecosystem-pulse (liveness).
var: ""
tags: [research, community]
---

> **${var}** — Optional. `dry-run` skips notify (state still updates and article still writes). Empty = normal run.

Today is ${today}. `ECOSYSTEM.md` is the curated list of projects, agents, and products building on top of Aeon. New rows arrive in irregular bursts — two ecosystem PRs landed within 90 seconds of each other on 2026-06-02 (HivemindOS #320, EchoOracle #321). Each new entrant is a potential co-marketing partner, integration target, or community member worth following up with. Currently `ecosystem-pulse` tracks the **liveness** of projects already in `ECOSYSTEM.md`, but nothing surfaces new arrivals as a discrete weekly signal. At the current contribution velocity new projects arrive faster than a human scanning the PR queue would catch.

This skill closes that gap. It is a weekly Monday diff of `ECOSYSTEM.md` against the previous week's snapshot — what was added, what was removed, both reported as a structured digest. Read-only against `ECOSYSTEM.md`; curation stays a human PR decision per the file's own "Add your project" rules.

Read `memory/MEMORY.md` for context.
Read the last 8 days of `memory/logs/` for prior-run context.
Read `soul/SOUL.md` + `soul/STYLE.md` if populated to match voice in the notification and article.

## Why a separate skill from ecosystem-pulse

| Skill | Question answered | Cadence | Slot |
|-------|-------------------|---------|------|
| `ecosystem-pulse` | "Are listed projects shipping this week?" | Weekly (Mon 11:00 UTC) | Liveness of *existing* entries |
| **`ecosystem-entrants`** | **"What was added to ECOSYSTEM.md this week?"** | **Weekly (Mon 11:45 UTC)** | **First-touch of *new* entries** |

The two skills compose. `ecosystem-pulse` reports star/fork/last-push deltas for every entry that can be matched to a GitHub repo; `ecosystem-entrants` reports the appearance and disappearance of rows. A row that was added and immediately matched a stale repo will appear in both digests on the same Monday — that's expected and not a duplication problem (the two skills answer different questions and one mention per skill is the operator-facing artefact).

Building this layer into `ecosystem-pulse` would have entangled the diff/liveness boundaries: the entrants signal is binary (added / removed / unchanged) and unconditional on whether the project matches a GitHub repo; the liveness signal is gradated and conditional on a repo match. Keeping them separate keeps each skill structurally simple.

## Inputs

| Source | Purpose | Auth |
|--------|---------|------|
| `ECOSYSTEM.md` (repo root) | Current project list — parsed from the markdown table at the top of the file | Local file |
| `memory/topics/ecosystem-entrants-state.json` | Prior-week snapshot of the project list, keyed by canonical URL | Local file |
| `git log` (local) | Optional: when an entrant is detected, walk `ECOSYSTEM.md` history to surface the PR / merge SHA that added it | Local git |
| `gh api search/issues?q=...` | Best-effort match of "added row" to a merged PR for the notification's "added by" link | `GH_TOKEN` |

No new secrets. GitHub access uses the `gh` CLI (`GH_TOKEN`), which handles auth internally — see Sandbox note.

Writes:
- `memory/topics/ecosystem-entrants-state.json` — current parsed entries (keyed by URL) + last_run timestamp + last_status
- `articles/ecosystem-entrants-${today}.md` — digest on every non-error run (including QUIET; the article is the durable record even when the notification is suppressed)
- `memory/logs/${today}.md` — one log block per run
- Notification via `./notify` — only when ≥1 added or removed entry since the last run (see step 6)

## Row schema

`ECOSYSTEM.md` rows have a stable shape — pipe-delimited markdown with logo, name, and links columns. The skill parses each row into:

```json
{
  "name": "string",
  "logo_url": "https://...",
  "links": [{"label": "@handle", "url": "https://x.com/handle"}, ...],
  "primary_url": "https://x.com/handle",
  "raw_row": "| <img ...> | Name | [@handle](https://x.com/handle) |"
}
```

`primary_url` is the **canonical key** for an entry. Resolution order:
1. First `https://github.com/{owner}/{repo}` URL in the links column.
2. Otherwise, first `https://x.com/{handle}` URL.
3. Otherwise, first non-empty URL in the row.
4. Otherwise, the lowercased project name (last-resort fallback for rows with no link at all — these are surfaced as `(no canonical URL)` in the article so the operator can fix the row).

Resolution is **deterministic and order-stable** so a row that swaps which link appears first still maps to the same entry. A row whose primary_url changes between runs (e.g. an X-only project that added a GitHub repo) is reported as an `updated` entry, not an add+remove pair (which would noisily fire two notifications for one operator action).

## State schema

`memory/topics/ecosystem-entrants-state.json`:

```json
{
  "last_run": "2026-06-03",
  "last_status": "OK",
  "entries": {
    "https://x.com/aeonbook_": {
      "name": "aeonbook",
      "primary_url": "https://x.com/aeonbook_",
      "links": [{"label": "@aeonbook_", "url": "https://x.com/aeonbook_"}],
      "logo_url": "https://...",
      "first_seen": "2026-04-20",
      "last_seen": "2026-06-03"
    }
  }
}
```

`first_seen` is the date this entry first appeared in any run — never overwritten. `last_seen` is the most recent run where the entry was present — overwritten every run that sees it. An entry whose `last_seen` is more than 28 days old is **pruned** from the state file (so a project that was added, removed, and then re-added much later is treated as a fresh entrant, not a "restored" one — the operator's question on re-add is "what is this project?" not "did it come back?"). Pruning is silent (no notify).

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles
[ -f memory/topics/ecosystem-entrants-state.json ] || cat > memory/topics/ecosystem-entrants-state.json <<'EOF'
{"last_run":null,"last_status":null,"entries":{}}
EOF
```

If `jq empty` fails on the state file (corrupt JSON from an aborted write), back it up to `.bak`, reset to the empty template, and tag the run `STATE_CORRUPT`. Continue — a fresh state file means re-notifying every currently-listed project as a fresh entrant on this one run, which is the safer post-corruption outcome than silently swallowing a real new arrival.

### 1. Parse var

- Lowercase, trim. If the resulting string equals `dry-run`, set `MODE=dry-run`. Empty → `MODE=execute`.
- Any other non-empty value → log `ECOSYSTEM_ENTRANTS_BAD_VAR: ${var}` and exit (no writes, no notify).

### 2. Parse ECOSYSTEM.md

If `ECOSYSTEM.md` does not exist at the repo root → log `ECOSYSTEM_ENTRANTS_NO_ECOSYSTEM_FILE`, write a one-line notification (`ecosystem-entrants: ECOSYSTEM.md not found at repo root`), exit. The file is the floor — if it's missing the skill has no signal to compute on.

Read every line that begins with `| ` and contains at least 2 `|` separators after the leading one (so the header line `| Logo | Project | Links |` and the divider line `|------|---------|-------|` are both rejected). For each accepted row:

- Extract the project **name** as the trimmed text of the second pipe-delimited cell.
- Extract the **logo_url** by matching `src="(https?://[^"]+)"` in the first cell (allow rows without a logo — `logo_url=null`).
- Extract every Markdown link `[label](url)` in the third pipe-delimited cell, in order.
- Compute `primary_url` per the resolution order above.
- Build the `entry` object.

Reject rows where the second cell is empty after trim — those are decorative separator rows, not project entries.

Header heuristic: if the file contains multiple markdown tables and we accidentally pick up rows from a non-project table, the projects table is the **first** table where the header line includes the word `Project` (case-insensitive). Scope parsing to that table — read every `| ` row from the header until the next blank line or non-pipe line, whichever comes first. If no `Project` header is found → log `ECOSYSTEM_ENTRANTS_NO_PROJECT_TABLE`, exit with no notify (the file shape changed in a way the skill doesn't understand — fail loudly rather than guess).

### 3. Diff against prior state

Let `current` = the set of `primary_url` values from step 2. Let `previous` = the keys of `state.entries`.

- `added` = `current - previous` (entries present this run, absent last run)
- `removed` = `previous - current` (entries present last run, absent this run)
- `updated` = entries where `primary_url` is in both sets but `name`, `links`, or `logo_url` differ from the stored snapshot

If `state.last_run` is null (first run) → `added` is the full `current` set; do **not** report this as N entrants in the notification body — instead notify a single one-liner "baseline run: indexed N projects in ECOSYSTEM.md, will diff from next Monday onward." The full list goes to the article. Reporting a flood of "new!" entries on the first run would be misleading; the entries already existed, this skill just hadn't been measuring them yet.

### 4. Optional PR enrichment for added entries

For each entry in `added` (skip on first/baseline run; skip when `MODE=dry-run` to keep the dry run hermetic), best-effort attribute the row to a merged PR:

```bash
gh api -X GET "search/issues" -f q="repo:aaronjmars/aeon is:pr is:merged ECOSYSTEM.md in:title,body \"${name}\"" \
  --jq '.items[0] | {number, title, html_url, merged_at: .pull_request.merged_at}' \
  > "/tmp/ecosystem-entrants-pr-${i}.json"
```

If the search returns a result whose merge timestamp is within the last 14 days → record `added_by_pr = {number, html_url, merged_at}` on the article row. If the search fails or returns no recent match → leave `added_by_pr = null` and surface the row as `(PR link unavailable)`. **Do not** include a row in the digest based on the search result alone — the diff against state is the source of truth; the search only enriches the display.

Why 14 days, not 7: the skill runs weekly, so a PR merged 8 days ago is a legitimate addition this skill should still attribute. Cap at 14d so a year-old PR can't be falsely matched to a re-added project name.

### 5. Write the article

Overwrite `articles/ecosystem-entrants-${today}.md`:

```markdown
# Ecosystem Entrants — ${today}

*ECOSYSTEM.md projects this week: N total. Added since last run: A. Removed: R. Updated: U.*

## Added ({A})

| Project | Primary link | Other links | PR | First seen |
|---------|--------------|-------------|----|-----------|

## Removed ({R})

| Project | Primary link | First seen | Last seen |
|---------|--------------|------------|-----------|

## Updated ({U})

| Project | Change | Before | After |
|---------|--------|--------|-------|

## Full project list ({N})

*Snapshot of the current ECOSYSTEM.md table — for full attribution see the linked PRs above.*

| Project | Primary link |
|---------|--------------|

---
*Generated by `ecosystem-entrants`. The diff is against the previous run's snapshot — first runs report a "baseline" total instead of treating every existing entry as new. Run again with `var=dry-run` to refresh without sending a notification.*
```

Always write the article on a non-error run, even when added/removed/updated are all zero — the snapshot section is the durable record.

### 6. Decide whether to notify (gated)

Skip notify entirely on `BAD_VAR`, `NO_ECOSYSTEM_FILE`, `NO_PROJECT_TABLE`, `DRY_RUN`, `STATE_CORRUPT`.

Otherwise notify only if any of:

1. **First (baseline) run** — `state.entries` was empty before this run. One-liner per step 3.
2. **≥1 added entry** since the last run.
3. **≥1 removed entry** since the last run.

`updated` entries are reported in the article only — not the notification. An updated row is a cosmetic change (often just a logo URL), and surfacing it as a notification would re-create the dependabot-noise pattern other skills work to suppress.

### 7. Notification format

Baseline (first) run:

```
*Ecosystem Entrants — baseline — ${today}*

ecosystem-entrants is now tracking N projects in ECOSYSTEM.md.
Next Monday will report the diff. Full snapshot in
articles/ecosystem-entrants-${today}.md.
```

Normal run with added/removed entries:

```
*Ecosystem Entrants — ${today}*

ECOSYSTEM.md: N projects · {A} added · {R} removed since last Monday

Added:
- {Project} — {primary_link} {PR #N if found}
- ...

{If R > 0:}
Removed:
- {Project} — {primary_link} (was first seen YYYY-MM-DD)

Full digest: articles/ecosystem-entrants-${today}.md
```

Keep under 900 chars. If `added` has more than 8 entries, list the first 8 and append "+M more (see article)" — preserves the dashboard render and the article carries the full list.

Send via `./notify "$MSG"` (single positional argument).

### 8. Persist state

Atomically overwrite `memory/topics/ecosystem-entrants-state.json` with the post-run snapshot:

- For every entry in `current`: set `last_seen=${today}`; preserve `first_seen` if it exists, otherwise set it to `${today}`; update `name`/`links`/`logo_url` fields to the latest parsed values.
- Drop entries whose `last_seen` is older than 28 days from `${today}` (silent pruning per the state schema rule above).
- Set `last_run=${today}` and `last_status` to the exit-taxonomy code from below.

Write to `memory/topics/ecosystem-entrants-state.json.tmp` first, then `mv` over the live path so a mid-write crash never leaves a half-formed JSON.

### 9. Log

Append to `memory/logs/${today}.md`:

```markdown
## ecosystem-entrants
- **ECOSYSTEM.md projects**: N
- **Added**: A · **Removed**: R · **Updated**: U
- **Baseline run**: yes/no
- **PR enrichment hits**: H/A (PRs successfully attributed to added rows)
- **Article**: articles/ecosystem-entrants-${today}.md
- **Notification**: sent / skipped (gated)
- **Status**: ECOSYSTEM_ENTRANTS_OK
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `ECOSYSTEM_ENTRANTS_OK` | Diff written; at least one added or removed entry, or a baseline run | Yes |
| `ECOSYSTEM_ENTRANTS_QUIET` | Diff written; no added/removed entries since last run | No (article + state still write) |
| `ECOSYSTEM_ENTRANTS_NO_ECOSYSTEM_FILE` | `ECOSYSTEM.md` missing at the repo root | Yes (one-line failure notify) |
| `ECOSYSTEM_ENTRANTS_NO_PROJECT_TABLE` | File present but no `Project`-header table found | Yes (one-line failure notify) |
| `ECOSYSTEM_ENTRANTS_DRY_RUN` | `MODE=dry-run`; article + state wrote, notify skipped | No |
| `ECOSYSTEM_ENTRANTS_STATE_CORRUPT` | State JSON unreadable, recreated; silent recovery this run | No |
| `ECOSYSTEM_ENTRANTS_BAD_VAR` | `${var}` parse failed | No |

`OK` and `QUIET` are the two success states. The split lets the dashboard show "ran clean, nothing changed" without overloading the OK row — the same pattern `ecosystem-pulse`, `competitor-radar`, and `pr-merge` use.

## Design notes (do not edit without reading)

- **Updates are article-only, never notified.** A swapped logo URL or a renamed X handle is cosmetic; surfacing it as a Monday morning notification would dilute the "real entrant" signal. The article carries the full update log for archaeology.
- **Baseline run does not fire N notifications.** On the first run, every currently-listed project is technically "new to the skill", but reporting a flood would be misleading — the entries already existed. A single one-liner baseline notification establishes the watermark; the next week's run reports the actual diff.
- **State entries prune after 28 days of absence.** A project removed from `ECOSYSTEM.md` is reported as `removed` the week of removal, then forgotten 28 days later. A re-add after the prune window is treated as a fresh entrant — that's the operator's actual question on re-add ("what is this project?") rather than a stale "it returned" footnote.
- **Primary URL is the canonical key, and resolution order is fixed.** A row whose links change order doesn't generate a fake add+remove pair. A row whose primary URL genuinely changed (X-only → GitHub) surfaces as `updated`. Two rows whose primary URLs collide would shadow each other in state — but `ECOSYSTEM.md` is a curated list and collision-by-canonical-URL is an actual data integrity issue worth flagging; the skill logs `ECOSYSTEM_ENTRANTS_PRIMARY_URL_COLLISION` to the run log when it sees one (article still writes; later collisions overwrite earlier in state — first-write-wins would silently hide the second; last-write-wins makes the duplicate at least eventually-consistent with the latest text).
- **PR enrichment is best-effort and never gates the digest.** If the GitHub search API fails or returns nothing, the entrant is still reported — the diff against state is the source of truth. The PR link is just a courtesy for the operator's notification.
- **Read-only against `ECOSYSTEM.md`.** Curation is a human PR decision per the file's own "Add your project" rules. This skill never edits the ecosystem list itself.
- **No multi-repo support.** Unlike `ecosystem-pulse` (which could in principle audit liveness of any project list), entrants is scoped to *this repo's* `ECOSYSTEM.md`. If a fork wanted to track entrants on a different file, the path is a `${var}=path/to/list.md` override that future work could add — out of scope for the first version.

## Sandbox Note

All outbound calls use `gh api` (handles `GH_TOKEN` internally per CLAUDE.md), not `curl` with header expansion that the sandbox blocks. The optional PR-enrichment step is best-effort; if `gh api` fails, the entrant is still surfaced — the diff against state is the source of truth, not the search result. No prefetch/postprocess wrapper required. The only other outbound call is `./notify`, which is already sandbox-safe.

## Required Env Vars

- `GH_TOKEN` (or `GITHUB_TOKEN` in CI) — provided by the runner; no new secret to provision.

No third-party API keys. No on-chain reads. No file writes outside `memory/`, `articles/`, and `/tmp/`.
