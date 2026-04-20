---
name: skill-leaderboard
description: Weekly ranking of which skills are most popular across CONFIGURED Aeon forks (excludes untouched templates)
var: ""
tags: [meta]
---
> **${var}** — Target repo to scan forks of (e.g. "owner/aeon"). If empty, reads `memory/watched-repos.md` and uses the first entry.

<!-- autoresearch: variation B — sharper output via configured-fork denominator + tiered fleet + promote/match/sunset insights -->

Today is ${today}. Generate a weekly leaderboard of which Aeon skills the **configured fleet** is actually running — and what upstream should do about it.

## Why this version

Upstream `aeon.yml` ships with effectively only `heartbeat: enabled: true`. Every fresh fork inherits that default. If we score "skills enabled" across **all active forks**, the leaderboard is a tautology (heartbeat always wins, everything else hovers near 0) and operator learns nothing. The lever is to score against **configured forks only** — forks whose `aeon.yml` diverges from upstream defaults — and to convert the result into three actionable recommendations: which skills to promote, which fleet patterns to copy upstream, which skills to sunset.

## Steps

### 1. Determine the target repo

If `${var}` is set, use that as `TARGET_REPO`. Otherwise read `memory/watched-repos.md` and use the first non-comment, non-empty line. If neither yields a value, log `SKILL_LEADERBOARD_NO_TARGET` to `memory/logs/${today}.md` and stop (no notification).

### 2. Snapshot upstream defaults

Read this running instance's local `aeon.yml` once. Build `UPSTREAM_DEFAULTS`: a dict `{skill_name -> {enabled, model_or_null, var_or_empty, schedule_or_null}}` covering every skill entry under the `skills:` block. Also build `UPSTREAM_SKILLS`: the set of skill directory names from `skills/` (use `ls skills/`). These are the comparison baselines.

### 3. Fetch active forks

```bash
CUTOFF=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)
gh api "repos/${TARGET_REPO}/forks?per_page=100" --paginate \
  --jq "[.[] | select(.pushed_at > \"$CUTOFF\") | {owner: .owner.login, full_name: .full_name, pushed_at, stargazers_count, created_at}]"
```

If zero active forks: log `SKILL_LEADERBOARD_NO_FORKS` and stop (no notification).

### 4. Per-fork single-call enumeration

For each active fork, run **one** recursive git-tree call to enumerate files (cheaper than per-path contents):

```bash
gh api "repos/${FORK_FULL}/git/trees/HEAD?recursive=1" --jq '[.tree[] | select(.type == "blob") | .path]'
```

Handle errors:
- 404 / 409 (empty repo): mark `status: "no_tree"`, skip aeon.yml and skills/ extraction, continue.
- 403 with `X-RateLimit-Remaining: 0`: sleep 60s, retry once. If still failing, mark `status: "rate_limited"` and continue with partial fleet.

Then fetch the fork's `aeon.yml` only if the tree contains it:

```bash
gh api "repos/${FORK_FULL}/contents/aeon.yml" --jq '.content' | base64 -d
```

If the path is in the tree but the contents call 404s, mark `status: "yml_unreadable"` and continue.

Extract from each readable `aeon.yml`:
- For every skill entry under `skills:` — `enabled`, `model` (if set), `var` (if set), `schedule` (if differs from any upstream default for that skill).
- Detect "fork-only skills": directory names under `skills/` in the fork's tree that are NOT in `UPSTREAM_SKILLS`.

### 5. Classify each fork

For each fork, compute a divergence signal vector vs `UPSTREAM_DEFAULTS`:
- **enabled_diff**: count of skills where the fork's `enabled` value differs from upstream default
- **var_set**: count of skills with `var:` set to a non-empty value where upstream's was empty
- **model_override**: count of skills with a `model:` value differing from upstream
- **schedule_override**: count of skills with a `schedule:` value differing from upstream
- **fork_only_skills**: count from step 4

Tier the fork:
- **CONFIGURED**: any of the above is ≥1. (i.e., the fork actively diverged from defaults)
- **TEMPLATE**: aeon.yml is readable but every diff signal is 0. Untouched template — exclude from leaderboard math.
- **UNREADABLE**: no_tree / no aeon.yml / yml_unreadable / rate_limited. Tracked in the source-status footer.

### 6. Aggregate against the CONFIGURED denominator

Let `N_CONFIGURED` = count of forks tiered CONFIGURED. If `N_CONFIGURED < 2`: log `SKILL_LEADERBOARD_TEMPLATE_FLEET` with the active/template/unreadable counts, write a stub article noting the conversion rate, and **skip the notification** (no signal worth pushing). Stop.

For each skill name (union of upstream skills and fork-only skills) compute:
- `forks_enabled`: number of CONFIGURED forks where it's `enabled: true`
- `pct_of_configured`: `forks_enabled / N_CONFIGURED`
- `with_var`: count of CONFIGURED forks that override `var:`
- `with_model`: count that override `model:`
- `with_schedule`: count that override `schedule:`
- `customization_depth` per-fork-instance: enabled (1) + var (1) + model (1) + schedule (1) → sum across forks; this becomes the tiebreaker
- `is_fork_only`: true if the skill name is in some fork's tree but not in `UPSTREAM_SKILLS`

Rank by (`forks_enabled` desc, `customization_depth` desc, name asc).

### 7. Load prior snapshot (week-over-week)

Read `memory/topics/skill-leaderboard-state.json` if it exists. Schema:

```json
{
  "last_run": "YYYY-MM-DD",
  "n_active_forks": N,
  "n_configured": N,
  "ranking": [{"skill": "name", "forks_enabled": N, "rank": N}, ...]
}
```

If the file exists and `last_run` is within the last 14 days, compute:
- **Rising**: skills that moved up ≥3 ranks
- **Falling**: skills that moved down ≥3 ranks
- **New entries**: skills now ranked that weren't last run
- **Dropouts**: skills last run that aren't ranked now (forks_enabled went to 0)

If the file is missing or stale (>14 days), set deltas to "first ranked snapshot — no comparison".

### 8. Compute the three actionable categories

> Every tier below is a **heuristic — operator overrides take precedence**. Thresholds are starting points, not hard rules; the operator's call always wins. **When in doubt, classify as Match** rather than forcing Promote or Sunset.

- **Consensus skills**: `pct_of_configured > 0.50` (heuristic — operator overrides take precedence). The fleet has converged on these — upstream should treat them as canonical examples and ensure they're well-documented.
- **Promote candidates**: `pct_of_configured ≥ 0.25` AND upstream default is `enabled: false` AND the skill is not a `workflow_dispatch`-only skill (heuristic — operator overrides take precedence). The fleet found these worth running; upstream may want to flip the default or feature them more prominently.
- **Match candidates**: skills where ≥2 CONFIGURED forks override `model:` to the same value (e.g., both pick `claude-sonnet-4-6`) (heuristic — operator overrides take precedence). The fleet has independently found a cheaper model sufficient — upstream should consider matching the override.
- **Sunset candidates**: skills present in `UPSTREAM_SKILLS` with `forks_enabled == 0` AND `with_var == 0` AND not a meta/dev skill (heuristic — operator overrides take precedence; skip skills tagged `meta` or `dev` — those are operator-tools, fork adoption isn't the point). Review for removal or better discoverability.
- **Fleet-only skills**: any `is_fork_only: true` skill enabled in ≥1 fork. Surface for review — the fleet built something upstream doesn't have.

### 9. Write the article

To `articles/skill-leaderboard-${today}.md`:

```markdown
# Skill Leaderboard — ${today}

**Verdict:** ${one-line verdict — see step 10 format below}

*Scanned ${N_ACTIVE} active forks of ${TARGET_REPO} (pushed in last 30 days). ${N_CONFIGURED} are configured (aeon.yml diverges from upstream defaults). Leaderboard scored against the configured ${N_CONFIGURED}.*

## Top Skills (configured fleet)

| Rank | Skill | Forks | % Configured | var | model | sched | Δ vs last week |
|------|-------|-------|--------------|-----|-------|-------|----------------|
| 1 | name | N | XX% | N | N | N | — / ↑N / ↓N / NEW |
| ... |

(Top 15. If <15 ranked, list all.)

## What the fleet is telling us

### Promote
${list of Promote candidates with one-line "why" each, OR "none this week"}

### Match
${list of Match candidates: "skill X — N forks override model to claude-sonnet-4-6", OR "none this week"}

### Sunset (review for removal or better docs)
${list of Sunset candidates, capped at 5, OR "none — every shipped skill has at least one configured-fork enable"}

### Fleet-only skills
${list of fork-only skill names with the fork that built each, OR "none this week"}

## Week-over-week

${"First ranked snapshot — no comparison" OR list of Rising / Falling / New / Dropouts}

## Fleet composition

| Tier | Count | % |
|------|-------|---|
| Configured | N_CONFIGURED | XX% |
| Template (untouched aeon.yml) | N_TEMPLATE | XX% |
| Unreadable (no tree / no yml / rate-limited) | N_UNREADABLE | XX% |
| **Total active forks** | N_ACTIVE | 100% |

## Source status

- Trees fetched: N_TREES_OK / N_ACTIVE
- aeon.yml readable: (N_CONFIGURED + N_TEMPLATE) / N_ACTIVE
- Rate-limited: N_RATE_LIMITED
- Fork-only skill files inspected: N_FORK_ONLY_FILES

---
*Source: GitHub API — forks of ${TARGET_REPO}. Methodology: a fork counts as "configured" if its `aeon.yml` differs from upstream defaults on `enabled`, `model`, `var`, or `schedule` for any skill. Untouched templates are excluded from leaderboard math.*
```

### 10. Build the verdict line

Pick the strongest single claim, in this priority:
1. If a Promote candidate exists with `pct_of_configured ≥ 0.40`: `"${N_CONFIGURED} configured forks; ${skill} hit ${pct}% — promote candidate"`
2. Else if any Rising skill moved ≥5 ranks: `"${skill} jumped from rank ${old} to rank ${new} this week"`
3. Else if a Fleet-only skill exists: `"${fork_owner}/aeon shipped ${skill} — not in upstream"`
4. Else if any Match candidate exists: `"${N} forks independently override ${skill} to ${model} — consider matching"`
5. Else: `"Configured-fleet conversion rate: ${N_CONFIGURED}/${N_ACTIVE} (${pct}%); top: ${skill} (${N} forks)"`

### 11. Send notification

Via `./notify`:

```
*Skill Leaderboard — ${today}*
${verdict_line}

Top 5 across ${N_CONFIGURED} configured forks (of ${N_ACTIVE} active):
1. ${skill} — N forks (XX%) ${rising_arrow_or_blank}
2. ${skill} — N forks (XX%) ${rising_arrow_or_blank}
3. ${skill} — N forks (XX%) ${rising_arrow_or_blank}
4. ${skill} — N forks (XX%) ${rising_arrow_or_blank}
5. ${skill} — N forks (XX%) ${rising_arrow_or_blank}

${one of: "Promote: ${skill} (XX% adoption)" | "Match: ${N} forks override ${skill} → ${model}" | "Fleet-only: ${owner}/${skill}" | omit if none of the above}

Full report: https://github.com/${GITHUB_REPOSITORY}/blob/main/articles/skill-leaderboard-${today}.md
```

Use the `$GITHUB_REPOSITORY` env var (GitHub Actions sets it to `owner/repo`) to build the URL — NOT the watched repo. The article lives in this running instance's repo.

Notification is sent only when `N_CONFIGURED >= 2` (gated in step 6). Otherwise the run is silent.

### 12. Persist the snapshot

Write `memory/topics/skill-leaderboard-state.json`:

```json
{
  "last_run": "${today}",
  "target_repo": "${TARGET_REPO}",
  "n_active_forks": N_ACTIVE,
  "n_configured": N_CONFIGURED,
  "n_template": N_TEMPLATE,
  "n_unreadable": N_UNREADABLE,
  "ranking": [
    {"skill": "name", "forks_enabled": N, "pct_of_configured": 0.NN, "rank": N, "customization_depth": N, "is_fork_only": false}
  ]
}
```

Overwrite each run. This is the source for next week's deltas — do not depend on parsing the prior article (format may shift, the JSON is the contract).

### 13. Log

Append to `memory/logs/${today}.md`:

```
## Skill Leaderboard
- **Active forks scanned:** N (of M total)
- **Configured forks:** N (XX% conversion rate)
- **Template forks:** N
- **Unreadable forks:** N
- **Top skill:** ${skill} (N forks, XX%)
- **Verdict:** ${verdict_line}
- **Promote/Match/Sunset/Fleet-only:** counts
- **Notification sent:** yes/no
- **Status:** SKILL_LEADERBOARD_OK | SKILL_LEADERBOARD_TEMPLATE_FLEET | SKILL_LEADERBOARD_NO_FORKS | SKILL_LEADERBOARD_NO_TARGET
```

## Sandbox note

All GitHub API calls use `gh api` which handles auth internally — no env-var expansion in headers needed. If `gh api` returns 403 with `X-RateLimit-Remaining: 0`, back off 60s and retry once; on continued failure, record `status: "rate_limited"` for that fork and proceed with partial fleet (the verdict and source-status footer surface the gap). No new env vars or secrets required beyond the default `GITHUB_TOKEN`.

## Constraints

- Never send the notification if `N_CONFIGURED < 2` — the leaderboard is meaningless without a configured denominator and trains the operator to ignore.
- Never count `heartbeat` enabled-counts as signal in the verdict (every CONFIGURED fork inherits it from upstream default; it's a tautology). It can still appear in the table.
- Do not parse last week's article for week-over-week — use `memory/topics/skill-leaderboard-state.json` only.
- Skills tagged `meta` or `dev` are excluded from the Sunset list (operator-tools, fork adoption is not the success metric).
- Skills with `schedule: "workflow_dispatch"` are excluded from Promote (on-demand by design — adoption % is misleading).
