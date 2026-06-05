---
name: atrium-catalog-watcher
description: Weekly diff of the Atrium marketplace catalog at https://atriumhermes.tech/.well-known/skills/index.json against the prior snapshot — surfaces newly-published skills, removed skills, and updated descriptions. Supply-side complement to sparkleware-catalog (curated skill-packs.json registry) and skill-update-check (version drift of installed skills).
var: ""
tags: [dev, community]
---

> **${var}** — Optional. `dry-run` skips notify (state still updates and article still writes). Empty = normal run.

Today is ${today}. The `install-from-atrium` script (merged in PR #335, the third skill install path after `add-skill` and `install-skill-pack`) fetches skills from the Atrium onchain marketplace at `https://atriumhermes.tech/.well-known/skills/index.json`. The endpoint is the live source of truth for everything publishable through `./install-from-atrium <name>`, but the operator has no signal when new skills appear in it. A skill that ships on Atrium is discoverable today only by running `./install-from-atrium --list` by hand. By the time `install-from-atrium` is used reactively (after someone mentions a skill), the skill may already have been live for days.

This skill closes that gap. It is a weekly Friday watcher of the Atrium catalog — what was added, what was removed, what was renamed or had its description changed, all reported as a structured digest. Pairs with `sparkleware-catalog` (Tuesday 09:00 — curated `skill-packs.json` registry) as the supply-side equivalent for the *discovered* Atrium marketplace, and with `skill-update-check` (Sunday 19:00 — version drift on already-installed skills) as the **upstream-arrivals** signal that precedes any install decision.

Read `memory/MEMORY.md` for context.
Read the last 8 days of `memory/logs/` for prior-run context.
Read `soul/SOUL.md` + `soul/STYLE.md` if populated to match voice in the notification and article.

## Why a separate skill from sparkleware-catalog and skill-update-check

| Skill | Source | Question answered | Cadence |
|-------|--------|-------------------|---------|
| `sparkleware-catalog` | `skill-packs.json` (curated registry, Aeon repo) | "What's in the curated pack registry and is it healthy?" | Tuesday 09:00 UTC |
| `skill-update-check` | `skills.lock` × upstream SHAs | "Did any of my already-installed skills change upstream?" | Sunday 19:00 UTC |
| **`atrium-catalog-watcher`** | **`atriumhermes.tech/.well-known/skills/index.json` (Atrium marketplace)** | **"What new skills are publishable on Atrium this week?"** | **Friday 12:00 UTC** |

The three signals compose without overlap. `sparkleware-catalog` watches the **curated** registry that ships in the repo; `skill-update-check` watches **installed** skills against their upstream sources; `atrium-catalog-watcher` watches the **public marketplace** for new arrivals before any install decision. A skill that lands in the Atrium catalog and is also added to `skill-packs.json` will appear in both Tuesday and Friday digests — that's expected and not duplication (the two skills answer different questions: "curated and trusted?" vs. "publishable on the chain?").

Building this into `install-from-atrium` itself would have entangled the install path with surveillance: today the script is a thin fetcher (curl → scan → copy), and adding a state file + diff logic to a single-use install command would conflate one-shot install with weekly polling. Keeping them separate keeps each surface structurally simple.

## Inputs

| Source | Purpose | Auth |
|--------|---------|------|
| `https://atriumhermes.tech/.well-known/skills/index.json` | Live Atrium marketplace catalog — array of `{name, description, files, skill_id}` entries | None (public) |
| `memory/topics/atrium-catalog-state.json` | Prior-run snapshot of the catalog, keyed by `skill_id` | Local file |

No new secrets. The Atrium endpoint is public — no auth header, no env-var expansion. `ATRIUM_HOST` (default `https://atriumhermes.tech`) is honored as an override so a self-hosted Atrium can be pointed at without editing the skill, mirroring the existing `install-from-atrium` convention.

Writes:
- `memory/topics/atrium-catalog-state.json` — current parsed catalog (keyed by `skill_id`) + `last_run` timestamp + `last_status`
- `articles/atrium-catalog-watcher-${today}.md` — digest on every non-error run (including QUIET; the article is the durable record even when the notification is suppressed)
- `memory/logs/${today}.md` — one log block per run
- Notification via `./notify` — only when ≥1 added or removed entry since the last run (see step 6)

## Catalog schema

The Atrium endpoint returns a JSON object with one top-level key `skills`, an array of skill objects:

```json
{
  "skills": [
    {
      "name": "string",
      "description": "string",
      "files": ["SKILL.md"],
      "skill_id": "0x<64-hex>"
    }
  ]
}
```

`skill_id` is the **canonical key** for an entry — it is the onchain identifier and is collision-free by design (it is the same id `install-from-atrium 0x...` accepts). A skill whose `name` is renamed but keeps the same `skill_id` is reported as `updated`, not as an add+remove pair. A skill that publishes a new version under a new `skill_id` is treated as a fresh entrant — that matches the operator's mental model (a new id is a new installable artefact).

The endpoint may evolve to include a `cid` or `version` field per skill (the `install-from-atrium` script already reads a `cid` from the per-skill SKILL.md frontmatter for `skills.lock` provenance). The parser tolerates extra fields and ignores anything not in the four documented keys above — additions don't break the diff.

## State schema

`memory/topics/atrium-catalog-state.json`:

```json
{
  "last_run": "2026-06-05",
  "last_status": "ATRIUM_CATALOG_WATCHER_OK",
  "atrium_host": "https://atriumhermes.tech",
  "skills": {
    "0xabc...": {
      "name": "example-skill",
      "description": "string",
      "files": ["SKILL.md"],
      "first_seen": "2026-04-20",
      "last_seen": "2026-06-05"
    }
  }
}
```

`first_seen` is the date this `skill_id` first appeared in any run — never overwritten. `last_seen` is the most recent run where the id was present — overwritten every run that sees it. An entry whose `last_seen` is more than 56 days old is **pruned** from the state file (longer than `ecosystem-entrants`' 28-day window because the Atrium marketplace is smaller and a re-publish of the same `skill_id` after two months is still naturally a "this is back" signal worth a `recovered` mention; pruning at 56d keeps the state file from growing unbounded if the catalog churns). Pruning is silent (no notify).

`atrium_host` is recorded so that a switch to `ATRIUM_HOST=...` (e.g. to a self-hosted endpoint) re-baselines automatically — switching hosts is a deliberate operator action and the diff against the prior host's snapshot would be misleading.

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles
[ -f memory/topics/atrium-catalog-state.json ] || cat > memory/topics/atrium-catalog-state.json <<'EOF'
{"last_run":null,"last_status":null,"atrium_host":null,"skills":{}}
EOF
```

If `jq empty` fails on the state file (corrupt JSON from an aborted write), back it up to `.bak`, reset to the empty template, and tag the run `STATE_CORRUPT`. Continue — a fresh state file means re-notifying every currently-listed skill as a baseline on this one run, which is the safer post-corruption outcome than silently swallowing a real new arrival.

### 1. Parse var

- Lowercase, trim. If the resulting string equals `dry-run`, set `MODE=dry-run`. Empty → `MODE=execute`.
- Any other non-empty value → log `ATRIUM_CATALOG_WATCHER_BAD_VAR: ${var}` and exit (no writes, no notify).

### 2. Fetch the Atrium catalog

```bash
ATRIUM_HOST="${ATRIUM_HOST:-https://atriumhermes.tech}"
ENDPOINT="${ATRIUM_HOST}/.well-known/skills/index.json"
curl -fsS --max-time 30 "${ENDPOINT}" > /tmp/atrium-catalog.json
```

If `curl` fails for any reason (network, sandbox block, 5xx, non-2xx) → use **WebFetch** for the same URL as a fallback, asking for the raw JSON verbatim. The Atrium endpoint is public and the sandbox blocks outbound HTTPS intermittently — WebFetch bypasses the sandbox (CLAUDE.md sandbox pattern 1).

If WebFetch also fails to return parseable JSON → log `ATRIUM_CATALOG_WATCHER_FETCH_FAIL`, write a one-line failure notification (`atrium-catalog-watcher: could not reach ${ENDPOINT}`), exit. The endpoint is the floor — if it's unreachable, the skill has no signal to compute on. State is **not** advanced on fetch failure (the next run still has the previous snapshot to diff against).

Validate the response shape: `jq '.skills | type == "array"'` must be `true`. If the top-level `skills` key is missing or not an array → log `ATRIUM_CATALOG_WATCHER_BAD_SHAPE`, write a one-line failure notification, exit. State not advanced. The endpoint shape changed in a way the skill doesn't understand — fail loudly rather than guess.

### 3. Host-switch detection

If `state.atrium_host` is non-null and differs from the resolved `ATRIUM_HOST`, treat the run as a **baseline** (state.skills will be re-seeded from the new endpoint, the diff is against the empty set, no flood of "added" notifications). Log `ATRIUM_CATALOG_WATCHER_HOST_SWITCH: ${old_host} -> ${new_host}` for the operator's audit trail. The one-liner baseline notification (step 7) explicitly names the host switch so the operator knows why the diff went quiet.

### 4. Parse and diff against prior state

Parse `/tmp/atrium-catalog.json`:

- Build `current` = `{skill_id: {name, description, files}}` map from `.skills[]`.
- Reject any entry whose `skill_id` is missing, empty, or doesn't match `^0x[0-9a-fA-F]{64}$` — those are catalog rows the skill can't key on (the same regex `install-from-atrium` enforces). Log `ATRIUM_CATALOG_WATCHER_INVALID_ID_SKIPPED: ${entry_name}` for each. Continue with the rest.
- Let `previous` = the keys of `state.skills` (or empty on baseline / host-switch).

- `added` = `current - previous` (skill_ids present this run, absent last run)
- `removed` = `previous - current` (skill_ids present last run, absent this run)
- `updated` = skill_ids in both sets but where `name`, `description`, or `files` differ from the stored snapshot

If `state.last_run` is null (first run) → `added` is the full `current` set; do **not** report this as N entrants in the notification body — instead notify a single one-liner "baseline run: indexed N skills in the Atrium catalog, will diff from next Friday onward." The full list goes to the article. Reporting a flood of "new!" entries on the first run would be misleading; the entries already existed, this skill just hadn't been measuring them yet. Identical behavior for host-switch runs.

### 5. Write the article

Overwrite `articles/atrium-catalog-watcher-${today}.md`:

```markdown
# Atrium Catalog Watcher — ${today}

*Atrium marketplace ({ATRIUM_HOST}): N total skills. Added since last run: A. Removed: R. Updated: U.*

## Added ({A})

| Skill | skill_id | Description | Install command |
|-------|----------|-------------|-----------------|
| {name} | `0xabc…` (full id in the row) | {description, truncated to 200 chars} | `./install-from-atrium {name}` |

## Removed ({R})

| Skill | skill_id | Last seen | First seen |
|-------|----------|-----------|------------|
| {name} | `0xabc…` | {last_seen date} | {first_seen date} |

## Updated ({U})

| Skill | skill_id | Field changed | Before | After |
|-------|----------|---------------|--------|-------|

## Full catalog ({N})

*Snapshot of the current Atrium endpoint — for one-click install, copy any of the commands below.*

| Skill | skill_id | Description |
|-------|----------|-------------|
```

Always write the article on a non-error run, even when added/removed/updated are all zero — the snapshot section is the durable record. On a baseline / host-switch run, omit the `Added` / `Removed` / `Updated` tables entirely (they would echo the full catalog under "Added") and lead with a `Baseline established for {ATRIUM_HOST}` note.

The article footer cites the source endpoint and the resolved `ATRIUM_HOST`:

```markdown
---
*Source: `${ATRIUM_HOST}/.well-known/skills/index.json`. Each skill is installable via `./install-from-atrium <name>` or `./install-from-atrium <skill_id>` (canonical, collision-free). Generated by `atrium-catalog-watcher`.*
```

### 6. Decide whether to notify (gated)

Skip notify entirely on `BAD_VAR`, `BAD_SHAPE`, `FETCH_FAIL`, `DRY_RUN`, `STATE_CORRUPT`.

Otherwise notify only if any of:

1. **First (baseline) run** — `state.skills` was empty before this run. One-liner per step 3.
2. **Host switch** — `ATRIUM_HOST` changed since the last run. One-liner per step 3, naming both hosts.
3. **≥1 added entry** since the last run.
4. **≥1 removed entry** since the last run.

`updated` entries are reported in the article only — not the notification. A description tweak is editorial polish, and surfacing it as a notification would re-create the dependabot-noise pattern other skills work to suppress. A name rename also lands in `updated` only — the skill_id is the canonical id, and a name swap on a stable id is not a fresh-arrival signal.

### 7. Notification format

Baseline (first) run:

```
*Atrium Catalog Watcher — baseline — ${today}*

atrium-catalog-watcher is now tracking N skills publishable at ${ATRIUM_HOST}.
Next Friday will report the diff. Full snapshot in
articles/atrium-catalog-watcher-${today}.md.
```

Host-switch run:

```
*Atrium Catalog Watcher — host switch — ${today}*

ATRIUM_HOST changed: {old_host} → {new_host}.
Re-baselined to N skills at the new host. Full snapshot in
articles/atrium-catalog-watcher-${today}.md.
```

Normal run with added/removed entries:

```
*Atrium Catalog Watcher — ${today}*

Atrium marketplace: N skills · {A} added · {R} removed since last Friday

Added:
- {name} — `./install-from-atrium {name}`
- ...

{If R > 0:}
Removed:
- {name} (was first seen YYYY-MM-DD)

Full digest: articles/atrium-catalog-watcher-${today}.md
```

Keep under 900 chars. If `added` has more than 8 entries, list the first 8 and append "+M more (see article)" — preserves the dashboard render and the article carries the full list. Each `added` line includes the operator's `install-from-atrium <name>` install command so the notification is one-click actionable (no need to copy a skill_id or click through to the article for the common case).

Send via `./notify "$MSG"` (single positional argument).

### 8. Persist state

Atomically overwrite `memory/topics/atrium-catalog-state.json` with the post-run snapshot:

- For every entry in `current`: set `last_seen=${today}`; preserve `first_seen` if it exists, otherwise set it to `${today}`; update `name`/`description`/`files` fields to the latest parsed values.
- Drop entries whose `last_seen` is older than 56 days from `${today}` (silent pruning per the state schema rule above).
- Set `last_run=${today}`, `last_status` to the exit-taxonomy code from below, and `atrium_host` to the resolved `ATRIUM_HOST`.

Write to `memory/topics/atrium-catalog-state.json.tmp` first, then `mv` over the live path so a mid-write crash never leaves a half-formed JSON.

### 9. Log

Append to `memory/logs/${today}.md`:

```markdown
## atrium-catalog-watcher
- **Atrium host**: ${ATRIUM_HOST}
- **Catalog skills**: N
- **Added**: A · **Removed**: R · **Updated**: U
- **Baseline run**: yes/no
- **Host switch**: yes (from {old}) / no
- **Invalid IDs skipped**: K (catalog rows with malformed skill_id)
- **Article**: articles/atrium-catalog-watcher-${today}.md
- **Notification**: sent / skipped (gated)
- **Status**: ATRIUM_CATALOG_WATCHER_OK
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `ATRIUM_CATALOG_WATCHER_OK` | Diff written; at least one added or removed entry, or a baseline / host-switch run | Yes |
| `ATRIUM_CATALOG_WATCHER_QUIET` | Diff written; no added/removed entries since last run | No (article + state still write) |
| `ATRIUM_CATALOG_WATCHER_FETCH_FAIL` | Both `curl` and `WebFetch` failed to reach the endpoint | Yes (one-line failure notify) |
| `ATRIUM_CATALOG_WATCHER_BAD_SHAPE` | Endpoint reachable but response shape unrecognized | Yes (one-line failure notify) |
| `ATRIUM_CATALOG_WATCHER_DRY_RUN` | `MODE=dry-run`; article + state wrote, notify skipped | No |
| `ATRIUM_CATALOG_WATCHER_STATE_CORRUPT` | State JSON unreadable, recreated; silent recovery this run | No |
| `ATRIUM_CATALOG_WATCHER_BAD_VAR` | `${var}` parse failed | No |

`OK` and `QUIET` are the two success states. The split lets the dashboard show "ran clean, nothing changed" without overloading the OK row — the same pattern `ecosystem-entrants`, `competitor-launch-radar`, and `sparkleware-catalog` use.

## Design notes (do not edit without reading)

- **Updates are article-only, never notified.** A description tweak or a name rename on a stable `skill_id` is cosmetic; surfacing it as a Friday notification would dilute the "new arrival" signal. The article carries the full update log for archaeology.
- **Baseline and host-switch runs do not fire N notifications.** On the first run (or after `ATRIUM_HOST` changes), every currently-listed skill is technically "new to the skill", but reporting a flood would be misleading — the entries already existed. A single one-liner notification establishes the watermark; the next week's run reports the actual diff.
- **State entries prune after 56 days of absence.** A skill removed from the Atrium catalog is reported as `removed` the week of removal, then forgotten 56 days later. A re-publish of the same `skill_id` after the prune window is treated as a fresh entrant — that's the operator's actual question on re-publish ("what is this skill?") rather than a stale "it returned" footnote. The 56-day window is twice `ecosystem-entrants`' window because the Atrium catalog is smaller (currently ~18 entries) and a longer memory keeps `recovered` semantics meaningful at that scale.
- **`skill_id` is the canonical key.** A name rename or description change does NOT trigger an add+remove pair — those would noisily fire two notifications for one editorial change. The diff is entirely keyed on the onchain `skill_id`, which is the same id `install-from-atrium 0x...` accepts and the same id Atrium guarantees collision-free.
- **Read-only against the Atrium endpoint.** This skill never publishes, modifies, or removes catalog entries — Atrium publishing is an onchain action the operator takes deliberately (or another agent does on their behalf). The skill only *observes* the catalog and reports diffs.
- **No multi-host comparison.** A switch of `ATRIUM_HOST` re-baselines from scratch. Comparing snapshots across hosts would be meaningless because the underlying registries are independent.
- **PR / commit enrichment deliberately not added.** Unlike `ecosystem-entrants` (which can map a row to a merged PR on `aaronjmars/aeon`), Atrium catalog entries are not tied to a single GitHub repo or PR — they are onchain artefacts. Surfacing a "publisher" attribution would require resolving each `skill_id` to its publishing wallet via Atrium SDK + chain calls, which is out of scope for a read-only weekly watcher. The article does, however, surface the **install command** (`./install-from-atrium <name>`) on every added row, which is the operator's actual next-step.
- **Notify gating mirrors `ecosystem-entrants` and `sparkleware-catalog`.** The three Monday/Tuesday/Friday weekly digests use the same baseline+composition+removal trigger pattern so the operator's mental model is consistent across all three.
- **`install-from-atrium --list` is the manual sibling.** Anyone can run `./install-from-atrium --list` on demand for an ad-hoc browse. This skill exists because **nobody runs `--list` weekly by hand**; the cron makes the discovery automatic.

## Sandbox Note

The Atrium endpoint is public — no auth header, no env-var-in-headers, so `curl` works directly when the sandbox allows outbound HTTPS. When `curl` is blocked (intermittent GitHub Actions sandbox behaviour per CLAUDE.md pattern 1), the skill falls back to **WebFetch** for the exact same URL. WebFetch bypasses the sandbox and returns the JSON as text; the skill re-parses it with `jq`. If both `curl` and `WebFetch` fail, the run exits `FETCH_FAIL` with a one-line failure notification (so a long unreachable run isn't silent), and state is **not** advanced — the next run still has the prior snapshot to diff against.

No pre-fetch / post-process script needed. `./notify` is the only other outbound call and is already sandbox-safe.

## Required Env Vars

- None required. `ATRIUM_HOST` (default `https://atriumhermes.tech`) is honored as an optional override, mirroring the existing `install-from-atrium` convention. No API keys, no on-chain reads, no GitHub auth.

## Why Friday 12:00 UTC

The Monday intelligence stack is already busy (`fleet-state` 08:00, `competitor-launch-radar` 10:00, `ecosystem-pulse` 11:00, `ecosystem-entrants` 11:45, `wallet-risk-weekly` 11:15, `capabilities-map` 11:30). Tuesday 09:00 holds `sparkleware-catalog` (the curated-registry equivalent). Friday afternoon is the first quiet weekly slot, mid-day enough that a fresh-arrivals digest makes it into the operator's late-week skim rather than landing in the weekend lull. Weekly, not daily: the Atrium catalog grows on a publish-event cadence (days to weeks), and a daily crawl would surface nothing the weekly run misses while adding ~7× the noise floor.
