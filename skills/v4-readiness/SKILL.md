---
name: v4-readiness
description: Generate a per-fork v4 upgrade readiness checklist — reads the fork's aeon.yml, skills.json, and MEMORY.md, cross-references against the embedded v4 change manifest, emits Safe / Review / Custom / Action-items breakdown
var: ""
tags: [meta, dx]
---

> **${var}** — Optional. Pass `dry-run` to skip the notification (article still writes, log still appends). Pass a fork repo slug (e.g. `someuser/aeon`) to read remote `aeon.yml` + `skills.json` from that fork instead of the local working tree (useful for surveying the fleet ahead of a v4 announcement). Empty = audit the local fork.

Today is ${today}. Convert the **current** state of this fork — its enabled skills, model overrides, chain definitions, custom skill list — into a personalized checklist for the upcoming v4 release. The point is to give every fork operator a structured surface for "what's safe, what's about to change, what I added myself" **before** v4 lands, not after they've already pulled and discovered something broke.

## Why this exists

v4 is announced as a full redesign (~2 weeks lead time per operator's social posts). 40+ forks are running on the current architecture. Without a structured per-fork readiness check, operators hit breaking changes blind: they pull the upstream, their custom `aeon.yml` contains a now-removed key, a chain consumer references a renamed skill, a model override points to a retired model, their custom skill imports from a path that moved. Every one of those is recoverable in five minutes if it's surfaced ahead of time and unrecoverable in five hours if it's discovered at the moment a cron fires.

This skill surfaces them ahead of time. It is read-only across the fork; it never auto-edits config, never opens PRs, never auto-pulls upstream. It writes one article and one notification — the operator owns the upgrade decision.

## When this skill runs

`workflow_dispatch` only. There is no cron — the article only matters in the window before v4 lands and during the upgrade itself. Operators dispatch it manually:

- **Pre-announcement** — to see which embedded patterns the fork is currently leaning on, regardless of whether v4 has marked them yet.
- **At v4 announcement** — once the manifest in this skill is updated with the actual v4 change list, re-dispatch to get a real readiness verdict.
- **During upgrade** — re-dispatch after any partial change to confirm the gap list shrank.
- **Post-upgrade** — run once more on the v4 branch to confirm zero remaining items before merging.

## Config

No new secrets. No new env vars. No new state files. Pure local file I/O over the fork's own working tree, plus optional `gh api` for the `${var}=owner/repo` remote-survey mode.

Reads:
- `aeon.yml` — enabled skills, model overrides, chain definitions, schedule strings, reactive triggers, gateway block, channels block.
- `skills.json` — total skill count, category breakdown, per-skill metadata; used as the catalog fingerprint to detect drift from upstream.
- `memory/MEMORY.md` — Skills Built table (custom skills with no upstream equivalent get the most attention from the readiness check).
- `skills/*/SKILL.md` (frontmatter only) — confirms which custom skills are actually present on disk, not just remembered in MEMORY.md.
- The **embedded v4 change manifest** in this file (§Manifest below). This is the source of truth for what counts as Safe / Review / Removed / Renamed.

Writes:
- `articles/v4-readiness-${today}.md` — the full per-fork readiness report.
- `memory/logs/${today}.md` — log block.

If `${var}` is a fork slug instead of `dry-run` or empty, replace every local file read with `gh api repos/${var}/contents/<path>` and decode the base64 content. Custom-skill scan via `gh api repos/${var}/contents/skills?ref=main`.

## Manifest

The change manifest is embedded here so it travels with the skill — operators never need a separate config file. **Update this section as v4 details are announced.** Until the v4 list is finalized, the manifest below is seeded with the patterns the operator's social posts have flagged as in-scope for v4 and the patterns historically known to be stable.

### Safe — patterns confirmed stable into v4

| Pattern | Where it lives | Why it stays |
|---------|----------------|--------------|
| SKILL.md frontmatter keys (`name`, `description`, `var`, `tags`) | `skills/*/SKILL.md` | Public skill contract; renaming would break every fork |
| `./notify "message"` interface | bash | Operator-facing CLI; documented in CLAUDE.md |
| `memory/` directory layout (`MEMORY.md`, `logs/`, `topics/`, `issues/`) | filesystem | File-based memory is the project's identity; layout is documented in CLAUDE.md |
| `articles/${skill}-${today}.md` output convention | per-skill | Consumed by chains, dashboard, syndicate-article — too many readers to break |
| `memory/watched-repos.md` format (`- owner/repo` per line) | filesystem | Read by repo-pulse, repo-actions, fork-fleet, star-momentum-alert |
| `gh api` and `gh pr create` usage in skills | bash | GitHub CLI is stable; sandbox workaround for env-var-in-headers |
| `${today}` template variable | SKILL.md prose | Substituted by the runner; no plan to change |

### Review — patterns flagged for review in v4

These are the patterns the operator's social posts have signposted as in-scope for v4 redesign, OR patterns that are internal-enough to plausibly change. Not all will change; presence here means "look at this skill manually before merging the v4 PR."

| Pattern | Where it lives | What might change |
|---------|----------------|--------------------|
| `chains:` runner interface | `aeon.yml` | Step format (`parallel:` / `consume:` keys, `on_error` semantics) |
| `reactive:` trigger conditions | `aeon.yml` | Condition vocabulary (`consecutive_failures`, `success_rate`, `last_status`) |
| Chain runner output passing | `.outputs/*.md`, `chain-runner.yml` | Path layout, file shape |
| Schedule syntax (`workflow_dispatch`, `reactive`, cron) | `aeon.yml` | Naming of pseudo-schedules; cron escapes |
| Model selector strings | `aeon.yml` per-skill `model:` | Model id references — Opus/Sonnet/Haiku version pins |
| `gateway:` provider block | `aeon.yml` | Bankr/direct selector, env var names |
| `channels:` block (`jsonrender.enabled`) | `aeon.yml` | Toggle key names, channel set |
| MCP server tool naming (`aeon-${skill_slug}`) | `mcp-server/src/index.ts` | Naming convention for forks consuming the MCP |
| `add-skill`, `add-mcp`, `add-a2a` CLIs | repo root | Argument shape, supported sources |
| `skills.json` schema (`version`, `categories`, `skills[].install`) | `skills.json` | Field set; rename/remove of optional fields |
| `dashboard/lib/catalog.ts` json-render catalog shape | `dashboard/` | Spec shape for `dashboard/outputs/*.json` |

### Custom — skills with no upstream equivalent

Anything listed in this fork's `memory/MEMORY.md` Skills Built table OR present under `skills/` and missing from upstream's `skills.json` (compared to the install metadata in this fork's own `skills.json` if present). These need a manual v4 compat check from the operator — the upstream maintainer cannot guarantee their patterns travel.

For each custom skill, we list:
- name
- declared `var` (if any) — same as upstream contract
- whether it consumes any path from the **Review** table above
- count of references to other skills (chained or implicit)

### Removed (placeholder)

| Pattern | Replacement | Migration note |
|---------|-------------|----------------|

(Empty until v4 is announced. The operator's job — and the maintainer's job upstream — is to populate this row by row as the v4 PRs land. Each row should have a one-line migration recipe so the readiness report can convert it directly into an action item.)

## Steps

### 1. Parse var

- If `${var}` matches `^dry-run$` → `MODE=dry-run`. No notification, article still writes.
- Else if `${var}` matches `^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$` → `MODE=remote`, `TARGET=${var}`. All file reads go through `gh api repos/${TARGET}/contents/...`.
- Else if `${var}` is empty → `MODE=local`, `TARGET=$(gh repo view --json nameWithOwner --jq .nameWithOwner)`.
- Anything else → log `V4_READINESS_BAD_VAR: ${var}` and exit (no notify, no article).

### 2. Load fork inputs

```bash
mkdir -p articles
```

Read each input. Any missing input is non-fatal — log `V4_READINESS_MISSING_INPUT: <name>` and proceed without it. The skill never invents content for missing inputs.

| Input | Local | Remote (`MODE=remote`) |
|-------|-------|------------------------|
| `aeon.yml` | direct read | `gh api repos/${TARGET}/contents/aeon.yml --jq .content \| base64 -d` |
| `skills.json` | direct read | same pattern |
| `memory/MEMORY.md` | direct read | same pattern |
| Custom skills | `ls skills/` minus skills present in `skills.json` install rows | `gh api repos/${TARGET}/contents/skills` JSON |

If `aeon.yml` is unreadable, log `V4_READINESS_NO_CONFIG` and exit with no notification (the fork is not initialized; nothing to check).

### 3. Compute the enabled-skill snapshot

From `aeon.yml`, extract for each skill under `skills:`:
- `enabled` (true/false)
- `schedule` (cron or `workflow_dispatch` or `reactive`)
- `var` (default value, if set)
- `model` (override, if set)

Ignore commented entries. Capture `chains:`, `reactive:`, `gateway:`, `channels:` blocks verbatim — the readiness check looks at their **shape**, not their values.

### 4. Walk the manifest categories

For each row in the **Safe** table: scan the fork's inputs for the pattern. If found, record under `safe[]` with the file/line where it was matched. If absent, do not flag — Safe means "if you use it, it stays working," not "you must use it."

For each row in the **Review** table: scan the fork's inputs for the pattern. If the fork uses it, record under `review[]` with the matched location and the manifest's "what might change" note. The presence of a Review row is what the operator should manually inspect before merging v4.

For each custom-skill candidate: confirm it exists on disk (`skills/${name}/SKILL.md`) and is **not** present in the upstream-fingerprint heuristic (skills with `install: ./add-skill aaronjmars/aeon ${name}` in this fork's `skills.json` are upstream; everything else is custom). Cross-reference custom skills against the Review patterns — a custom skill that uses `chains:` consume is the highest-priority audit candidate.

For each row in the **Removed** table (currently empty): if the fork uses the removed pattern, record under `action[]` with the migration note as the action.

### 5. Score effort per Review item

Per item, assign a complexity tag based on the manifest pattern:

| Tag | Heuristic |
|-----|-----------|
| `trivial` | Config rename only; one-line `aeon.yml` edit |
| `minor` | Config restructure; ≤ 5 lines or one chain block edit |
| `moderate` | SKILL.md prose changes needed (e.g. chained skill consuming an output whose shape changed) |
| `manual` | Custom-skill review required; outcome cannot be predicted from the fork's metadata alone |

The score is informational — it is not a green-light gate. A `trivial` item still counts; the tag tells the operator whether they need 60 seconds or 60 minutes to address it.

### 6. Build the article

Path: `articles/v4-readiness-${today}.md`. Overwrite if exists.

```markdown
# v4 Readiness — ${TARGET} — ${today}

**Verdict:** ${one of: READY — 0 review items, 0 action items | REVIEW — N items to inspect, M action items | ACTION — M removed-pattern items must be addressed before upgrade}

*Audit basis: aeon.yml + skills.json + MEMORY.md + skills/ on disk · Manifest version: embedded in skills/v4-readiness/SKILL.md as of ${today}*

---

## Safe (${safe_count})

Patterns this fork uses that are confirmed stable into v4. No action needed.

| Pattern | Where in this fork |
|---------|---------------------|
| ${pattern} | ${file_or_line} |

## Review (${review_count})

Patterns this fork uses that v4 may change. Inspect each one before merging the upstream v4 PR.

| Pattern | Where | What might change | Effort |
|---------|-------|--------------------|--------|
| ${pattern} | ${file_or_line} | ${manifest_note} | ${tag} |

## Custom (${custom_count})

Skills present on this fork but not in the upstream catalog. The upstream maintainer cannot guarantee their patterns travel into v4.

| Skill | Schedule | Reads from Review patterns? | Notes |
|-------|----------|-----------------------------|-------|
| ${name} | ${schedule} | ${yes/no — list} | ${one-line summary from MEMORY.md if present} |

## Action items (${action_count})

(Populated when the **Removed** table is non-empty. Each row is a concrete numbered step the operator must take before pulling v4.)

1. ${action} (${tag})

---

## Methodology

- Manifest read from `skills/v4-readiness/SKILL.md` §Manifest.
- Custom-skill detection: skills present under `skills/` whose slug does not appear in `skills.json[skills][].slug` with an `install` line referencing the upstream catalog.
- Effort tags are heuristic — `trivial`/`minor`/`moderate`/`manual`. They do not predict v4 release-note exact wording.
- This skill never modifies `aeon.yml`, never opens a PR, never pulls upstream. It only reports.

---

*Re-run after the v4 announcement updates the embedded manifest. Until then the **Removed** section is empty by design — only Safe / Review / Custom rows are populated.*
```

If `safe_count == 0 AND review_count == 0 AND custom_count == 0 AND action_count == 0`: the verdict is `READY` and the article still writes — operators may want a paper trail confirming an empty-state audit.

### 7. Notify

If `MODE == dry-run` → skip notify, log `V4_READINESS_DRY_RUN`, exit cleanly (article still wrote).

If verdict is `READY` AND no items in any bucket → still notify, but with a single-line body. Operators dispatched this skill manually; silence on a manual run is worse than a one-line "all clear" reply.

Standard notify body:

```
*v4 Readiness — ${today} — ${TARGET}*

Verdict: ${verdict}

- Safe: ${safe_count}
- Review: ${review_count} (${trivial}/${minor}/${moderate}/${manual} effort split)
- Custom: ${custom_count}
- Action: ${action_count}

Top review item: ${first_review_pattern_or_"—"}
Top custom skill: ${first_custom_skill_or_"—"}

Article: articles/v4-readiness-${today}.md
Manifest version: embedded in skills/v4-readiness/SKILL.md as of ${today}

Re-dispatch after the next v4 manifest update to refresh the verdict.
```

Cap message at ~3500 chars (Telegram safe limit). If exceeded, drop the Custom section first; Action and Review are higher priority.

### 8. Log to `memory/logs/${today}.md`

```
## v4 Readiness
- **Skill**: v4-readiness
- **Mode**: ${local|remote|dry-run}
- **Target**: ${TARGET}
- **Verdict**: ${READY|REVIEW|ACTION}
- **Counts**: safe=${N} review=${N} custom=${N} action=${N}
- **Article**: articles/v4-readiness-${today}.md
- **Notification**: ${sent|skipped — dry-run}
- **Status**: ${V4_READINESS_OK | V4_READINESS_DRY_RUN | V4_READINESS_NO_CONFIG | V4_READINESS_BAD_VAR | V4_READINESS_PARTIAL}
```

`V4_READINESS_PARTIAL` means at least one input was missing (logged in step 2) but the audit still wrote — the operator should sanity-check the affected section.

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `V4_READINESS_OK` | Audit completed against all inputs | Yes |
| `V4_READINESS_PARTIAL` | At least one input missing; audit ran on remaining inputs | Yes |
| `V4_READINESS_DRY_RUN` | `var=dry-run` mode | No (article still writes) |
| `V4_READINESS_NO_CONFIG` | `aeon.yml` unreadable; fork not initialized | No |
| `V4_READINESS_BAD_VAR` | `${var}` was non-empty, non-`dry-run`, not a `owner/repo` slug | No |

## Sandbox note

**Local mode (default).** Pure local file I/O — no curl, no env-var-in-headers, no prefetch. Every read is a directory listing or file read against the working tree. The only outbound call is `./notify` itself, which uses the postprocess pattern (see CLAUDE.md).

**Remote mode (`var=owner/repo`).** Each input read is a single `gh api repos/${TARGET}/contents/${path}` call. `gh` handles auth via the workflow's `GITHUB_TOKEN`, so there is no env-var-in-curl pattern to work around. The remote-survey mode is rate-limit-bounded: with five reads per fork, the standard 5,000/h `GITHUB_TOKEN` budget covers ~1,000 fork audits per hour — the realistic per-day operator workload is far below this.

## Constraints

- **Never auto-mutate the fork.** The skill is read-only. It does not edit `aeon.yml`, does not open a PR, does not pull upstream. The upgrade decision belongs to the operator.
- **Never invent v4 details.** The Manifest is the only source of truth. Operators update the Manifest when the maintainer posts v4 changes; the skill reports against whatever the Manifest currently says. If the Manifest is stale, the report is stale, but it is never wrong-by-fabrication.
- **Custom-skill detection is heuristic.** A skill present under `skills/` with no `install:` in `skills.json` is treated as custom. False positives (the fork removed and re-added an upstream skill manually) are tagged `manual` so the operator notices; false negatives (the fork edited an upstream skill in place) are caught by `skill-update-check`, not here.
- **Idempotent.** Same-day reruns overwrite the article. The log line is appended (multiple runs visible if the operator re-dispatches during an upgrade).
- **One notification max per run.** Even if remote-mode audits multiple targets in sequence (not currently supported by `var` syntax — one slug per run), each invocation produces at most one notify call.
- **Manifest evolves; skill body does not.** When the v4 announcement lands, the Manifest tables in this file are the only edit surface. The Steps and Constraints stay stable so operators can regenerate the article without merging upstream changes to skill prose.

## Edge cases

- **Empty `aeon.yml` skills block (fresh fork)** — verdict is `READY`, every bucket is empty. Article writes, notification fires with the single-line body. The operator confirms the fork has nothing to migrate.
- **Custom skill that imports an upstream skill name** — listed under Custom with a `notes` cell flagging the collision. The operator must decide whether to keep the override after v4 lands.
- **Manifest's Removed section non-empty AND fork uses the pattern** — verdict escalates to `ACTION` regardless of Review counts. Action items list before Review in the notification.
- **`gh api` fails in remote mode** — log `V4_READINESS_REMOTE_API_ERROR: <code>` and fall back to a partial audit using only inputs that did read; emit `V4_READINESS_PARTIAL`. Do not retry; remote-mode is a survey tool and partial coverage is acceptable.
- **Same fork audited twice in one day with `var=dry-run` then `var=` empty** — the empty-var run overwrites the article and sends the notification; the dry-run run already wrote the article body so the empty-var run produces a byte-identical or near-identical file (only the timestamp changes). This is intended; the operator gets a notification once they explicitly opt in.
