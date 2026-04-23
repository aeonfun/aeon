---
name: fork-skill-digest
description: Weekly cross-fork customization digest — surfaces where the fleet's enable/disable/var/model decisions diverge from upstream defaults
var: ""
tags: [meta]
---
> **${var}** — Target repo to scan forks of (e.g. "owner/aeon"). If empty, reads `memory/watched-repos.md` and uses the first entry.

Today is ${today}. Generate the weekly **divergence digest** — where the configured fork fleet systematically disagrees with upstream defaults on `enabled`, `var`, `model`, or `schedule`, and a per-fork customization fingerprint for the heaviest customizers.

## Why this exists

`skill-leaderboard` ranks **what's popular** (top 15 by enabled count). `fork-fleet` surfaces **per-fork unique work** (commits, new skills). Neither answers: **where do operators consistently disagree with upstream defaults?** That's the peer-learning signal — if 6 out of 8 configured forks enable a skill upstream defaults off, upstream is shipping the wrong default. If 5 out of 8 disable a skill upstream defaults on, that skill is noise. This skill surfaces those signals weekly so the operator can flip defaults that the fleet has already voted on.

## Steps

### 1. Determine the target repo

If `${var}` is set, use that as `TARGET_REPO`. Otherwise read `memory/watched-repos.md` and use the first non-comment, non-empty line. If neither yields a value, log `FORK_SKILL_DIGEST_NO_TARGET` to `memory/logs/${today}.md` and stop (no notification).

### 2. Snapshot upstream defaults

Read this running instance's local `aeon.yml` once. Build:

- `UPSTREAM_DEFAULTS`: dict `{skill_name -> {enabled: bool, model: str|null, var: str, schedule: str|null}}` for every skill entry under `skills:`.
- `UPSTREAM_SKILLS`: set of skill directory names from `skills/` (use `ls skills/`).
- `UPSTREAM_TAGS`: dict `{skill_name -> [tags]}` parsed from each `skills/<name>/SKILL.md` frontmatter (best-effort; missing frontmatter → `[]`).

These are the comparison baselines — never mutated.

### 3. Fetch active forks

```bash
CUTOFF=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%SZ)
gh api "repos/${TARGET_REPO}/forks?per_page=100" --paginate \
  --jq "[.[] | select(.pushed_at > \"$CUTOFF\") | select(.archived == false) | select(.disabled == false) | {owner: .owner.login, full_name: .full_name, pushed_at, stargazers_count, default_branch}]"
```

If zero active forks: log `FORK_SKILL_DIGEST_NO_FORKS` and stop (no notification).

### 4. Per-fork enumeration (one tree call + one yml fetch each)

For each active fork, run **one** recursive git-tree call to enumerate files (cheaper than per-path contents):

```bash
gh api "repos/${FORK_FULL}/git/trees/HEAD?recursive=1" --jq '[.tree[] | select(.type == "blob") | .path]'
```

Then fetch the fork's `aeon.yml` only if the tree contains it:

```bash
gh api "repos/${FORK_FULL}/contents/aeon.yml?ref=${FORK_DEFAULT_BRANCH}" --jq '.content' | base64 -d
```

Error handling:
- 404 / 409 (empty repo): mark `status: "no_tree"`, skip aeon.yml extraction, continue.
- 403 with `X-RateLimit-Remaining: 0`: sleep 60s, retry once. If still failing, mark `status: "rate_limited"` and continue.
- Tree contains aeon.yml but contents call 404s: mark `status: "yml_unreadable"`, continue.
- aeon.yml present but YAML parse fails: mark `status: "yml_invalid"`, continue.

For each readable `aeon.yml`, extract per-skill `{enabled, model, var, schedule}`. Treat missing keys as inheriting the upstream default (do NOT count those as overrides).

Detect **fork-only skills**: directory names matching `skills/<name>/SKILL.md` in the fork's tree where `<name>` is NOT in `UPSTREAM_SKILLS`. Record `{fork_full_name, skill_name, path}` for each.

### 5. Tier each fork

For each fork compute a divergence signal vector vs `UPSTREAM_DEFAULTS`:
- `enabled_diff`: count of skills where the fork's `enabled` differs from upstream
- `var_overrides`: count of skills with non-empty `var:` where upstream's was empty (or different non-empty value)
- `model_overrides`: count of skills with `model:` differing from upstream
- `schedule_overrides`: count of skills with `schedule:` differing from upstream
- `fork_only_skill_count`: count from step 4

Tier the fork:
- **CONFIGURED**: any signal ≥1 (the fork actively diverged)
- **TEMPLATE**: aeon.yml readable but every signal is 0 — exclude from divergence math
- **UNREADABLE**: no_tree / no aeon.yml / yml_unreadable / yml_invalid / rate_limited — tracked in source-status footer

### 6. Aggregate divergence (the core analysis)

Let `N_CONFIGURED` = count of forks tiered CONFIGURED. If `N_CONFIGURED < 2`: log `FORK_SKILL_DIGEST_TEMPLATE_FLEET` with active/template/unreadable counts, write a stub article noting the conversion rate, and **skip notification**. Stop.

For each skill name in `UPSTREAM_SKILLS`, compute four divergence dimensions:

**Enable divergence:**
- `forks_enabled_count`: number of CONFIGURED forks with `enabled: true` for this skill
- `forks_disabled_count`: number of CONFIGURED forks with `enabled: false` for this skill (explicitly set, not inherited)
- `upstream_enabled`: bool from UPSTREAM_DEFAULTS
- `divergence_pct`:
  - If upstream `enabled: false`: `forks_enabled_count / N_CONFIGURED` (how many forks disagree by enabling)
  - If upstream `enabled: true`: `forks_disabled_count / N_CONFIGURED` (how many forks disagree by disabling)
- `direction`: `"ENABLE_UPWARD"` (upstream off, forks turn on) or `"DISABLE_DOWNWARD"` (upstream on, forks turn off)

**Var divergence:**
- `var_override_count`: number of CONFIGURED forks where `var:` differs from upstream
- `top_var_value`: most common non-empty fork value (with count) — only if ≥2 forks share it

**Model divergence:**
- `model_override_count`: number of forks with non-null model differing from upstream
- `top_model_value`: most common fork model (with count) — only if ≥2 forks share it (signals fleet consensus on a cheaper/different model)

**Schedule divergence:**
- `schedule_override_count`: number of forks with schedule differing from upstream
- `top_schedule_value`: most common fork schedule (with count) — only if ≥2 forks share it

### 7. Categorize divergent skills

For each skill, classify into at most one bucket (priority order):

- **DEFAULT_FLIP_ENABLE**: `direction == "ENABLE_UPWARD"` AND `divergence_pct >= 0.50` AND skill is not `workflow_dispatch` AND skill not tagged `meta`/`dev`. Recommend: flip upstream default to `enabled: true`.
- **DEFAULT_FLIP_DISABLE**: `direction == "DISABLE_DOWNWARD"` AND `divergence_pct >= 0.50`. Recommend: flip upstream default to `enabled: false` (the fleet is voting it as noise).
- **MODEL_CONSENSUS**: `top_model_value` non-null AND its count `>= max(2, ceil(N_CONFIGURED * 0.40))`. Recommend: match fleet's model in upstream.
- **VAR_HOTSPOT**: `var_override_count >= max(2, ceil(N_CONFIGURED * 0.30))` AND `top_var_value` non-null. Recommend: surface the common var value in upstream docs or as the default.
- **EMERGING**: `direction == "ENABLE_UPWARD"` AND `0.25 <= divergence_pct < 0.50` AND not already in a flip bucket. Surface as a watchlist — fleet sentiment building but not yet majority.
- (otherwise: not categorized; appears only in the appendix divergence table if any signal is non-zero)

A skill can appear in **only one bucket** — first match wins in the order above. Skills with all-zero divergence are omitted.

### 8. Per-fork customization fingerprint

For each CONFIGURED fork, compute a fingerprint:
- `total_overrides`: sum of `enabled_diff + var_overrides + model_overrides + schedule_overrides + fork_only_skill_count`
- `category_lean`: dict `{tag -> count_of_enabled_skills_with_that_tag}` (using UPSTREAM_TAGS for upstream skills the fork enables; fork-only skills counted under tag `"fork-only"`)
- `dominant_category`: tag with max count, or `"mixed"` if no tag has >40% of total enabled count

Rank forks by `total_overrides` desc. Top 5 = "heaviest customizers" — surface in the article with their dominant category and a one-line synthesis (e.g., `"owner/aeon — content-heavy: 14 article/digest skills enabled, 3 model overrides to claude-sonnet-4-6"`).

### 9. Load prior snapshot (week-over-week)

Read `memory/topics/fork-skill-digest-state.json` if it exists. Schema:

```json
{
  "last_run": "YYYY-MM-DD",
  "n_active": N,
  "n_configured": N,
  "buckets": {
    "DEFAULT_FLIP_ENABLE": ["skill_a", "skill_b"],
    "DEFAULT_FLIP_DISABLE": [],
    "MODEL_CONSENSUS": [{"skill": "name", "model": "claude-sonnet-4-6"}],
    "VAR_HOTSPOT": [{"skill": "name", "var": "value"}],
    "EMERGING": ["skill_c"]
  },
  "fork_only_skills": [{"fork": "owner/repo", "skill": "name"}],
  "fingerprints": [{"fork": "owner/repo", "total_overrides": N, "dominant_category": "tag"}]
}
```

If file exists and `last_run` is within last 14 days, compute deltas:
- **NEW_FLIP**: skills now in DEFAULT_FLIP_* that weren't last run
- **STRENGTHENED**: skills that moved from EMERGING → DEFAULT_FLIP_ENABLE
- **FADED**: skills that left a flip bucket since last run
- **NEW_FORK_ONLY**: fork-only skills not present last run
- **NEW_HEAVY_CUSTOMIZER**: forks now in top 5 fingerprint that weren't before

If file missing or stale (>14 days), set deltas to `"first divergence snapshot"`.

### 10. Build the verdict line

Pick the strongest single claim, in priority:
1. If any `DEFAULT_FLIP_ENABLE` exists: `"${N} forks enable ${skill} (upstream defaults off) — flip the default"`
2. Else if any `DEFAULT_FLIP_DISABLE` exists: `"${N} forks disable ${skill} (upstream defaults on) — fleet is voting it as noise"`
3. Else if any `MODEL_CONSENSUS` exists: `"${N} forks override ${skill} → ${model} — match upstream"`
4. Else if any `NEW_FORK_ONLY` from delta: `"${fork_owner} shipped ${skill} — not in upstream"`
5. Else if any `EMERGING` exists: `"${skill} adoption building (${pct}% of configured) — watchlist"`
6. Else: `"${N_CONFIGURED} configured forks; no divergence pattern crossed flip threshold"`

### 11. Write the article

To `articles/fork-skill-digest-${today}.md`:

```markdown
# Fork Skill Digest — ${today}

**Verdict:** ${verdict_line}

*Scanned ${N_ACTIVE} active forks of ${TARGET_REPO} (pushed in last 30 days). ${N_CONFIGURED} are configured (aeon.yml diverges from upstream defaults). Divergence scored against the configured ${N_CONFIGURED}.*

## Default-flip candidates

### Enable upward (upstream off → fleet enables)
| Skill | Forks enabled | % of configured | Δ vs last week |
|-------|---------------|-----------------|----------------|
| name  | N             | XX%             | NEW / STRENGTHENED / — |

(Only DEFAULT_FLIP_ENABLE bucket. If empty: "No skills crossed the 50% enable-upward threshold this week.")

### Disable downward (upstream on → fleet disables)
| Skill | Forks disabled | % of configured | Δ vs last week |
|-------|----------------|-----------------|----------------|
| name  | N              | XX%             | NEW / — |

(Only DEFAULT_FLIP_DISABLE bucket. If empty: "No skills crossed the 50% disable-downward threshold.")

## Fleet consensus on alternative settings

### Model overrides
${list of MODEL_CONSENSUS entries: "skill X — N forks → claude-sonnet-4-6 (40% of configured)" OR "none this week"}

### Var hotspots
${list of VAR_HOTSPOT entries: "skill X — N forks set var to '${value}'" OR "none this week"}

### Schedule overrides
${list of skills where ≥2 forks share an alternative schedule, with the schedule string OR "none this week"}

## Watchlist (emerging — 25–49% adoption)
${list of EMERGING skills with adoption % OR "none this week"}

## Heaviest customizers (top 5)

| Fork | Total overrides | Dominant category | Notes |
|------|-----------------|-------------------|-------|
| owner/repo | N | content / dev / meta / fork-only / mixed | one-line synthesis |

## Fork-only skills

${list of {fork, skill_name} pairs OR "none this week"}

(These skills exist as `skills/<name>/SKILL.md` in a fork but not in upstream. Surfaces fork experiments worth reviewing for upstreaming.)

## Week-over-week

${"First divergence snapshot — no comparison" OR list of NEW_FLIP / STRENGTHENED / FADED / NEW_FORK_ONLY / NEW_HEAVY_CUSTOMIZER}

## Fleet composition

| Tier | Count | % |
|------|-------|---|
| Configured | N_CONFIGURED | XX% |
| Template (untouched aeon.yml) | N_TEMPLATE | XX% |
| Unreadable | N_UNREADABLE | XX% |
| **Total active** | N_ACTIVE | 100% |

## Source status

- Trees fetched: N_TREES_OK / N_ACTIVE
- aeon.yml readable: (N_CONFIGURED + N_TEMPLATE) / N_ACTIVE
- YAML parse failures: N_YML_INVALID
- Rate-limited: N_RATE_LIMITED
- Fork-only skills inspected: N_FORK_ONLY_FILES

## Appendix — full divergence table

(Every skill with at least one non-zero divergence signal, sorted by total override count desc. Columns: skill, enable_diff, var_overrides, model_overrides, schedule_overrides. Cap at 30 rows; if more, append "+ N more skills with low-signal divergence" line.)

---
*Source: GitHub API — forks of ${TARGET_REPO}. Methodology: a fork is "configured" if its aeon.yml diverges from upstream defaults on enabled, model, var, or schedule for any skill. Untouched templates are excluded from divergence math. Companion to skill-leaderboard (popularity) and fork-fleet (per-fork work).*
```

### 12. Send notification

Via `./notify`:

```
*Fork Skill Digest — ${today}*
${verdict_line}

Scanned ${N_ACTIVE} active forks; ${N_CONFIGURED} are configured.

${If DEFAULT_FLIP_ENABLE non-empty (top 3):}
Flip enable (upstream off → fleet on):
- ${skill} — ${N} forks (${pct}%)

${If DEFAULT_FLIP_DISABLE non-empty (top 3):}
Flip disable (upstream on → fleet off):
- ${skill} — ${N} forks (${pct}%)

${If MODEL_CONSENSUS non-empty (top 2):}
Model consensus:
- ${skill} → ${model} (${N} forks)

${If NEW_FORK_ONLY from delta non-empty:}
New fork-only skills: ${comma-separated owner/skill list, capped at 3}

Heaviest customizer: ${top fork} (${N} overrides, ${dominant_category})

Full report: https://github.com/${GITHUB_REPOSITORY}/blob/main/articles/fork-skill-digest-${today}.md
```

Use `$GITHUB_REPOSITORY` env var to build the URL (article lives in this running instance's repo, NOT the target repo).

Notification is sent only when `N_CONFIGURED >= 2` AND at least one of `{DEFAULT_FLIP_ENABLE, DEFAULT_FLIP_DISABLE, MODEL_CONSENSUS, NEW_FORK_ONLY (from delta)}` is non-empty. Otherwise: log only.

Cap at ~900 chars total to render cleanly across Telegram/Discord/Slack.

### 13. Persist the snapshot

Write `memory/topics/fork-skill-digest-state.json`:

```json
{
  "last_run": "${today}",
  "target_repo": "${TARGET_REPO}",
  "n_active": N_ACTIVE,
  "n_configured": N_CONFIGURED,
  "n_template": N_TEMPLATE,
  "n_unreadable": N_UNREADABLE,
  "buckets": {
    "DEFAULT_FLIP_ENABLE": [{"skill": "name", "forks": N, "pct": 0.NN}],
    "DEFAULT_FLIP_DISABLE": [{"skill": "name", "forks": N, "pct": 0.NN}],
    "MODEL_CONSENSUS": [{"skill": "name", "model": "value", "forks": N}],
    "VAR_HOTSPOT": [{"skill": "name", "var": "value", "forks": N}],
    "EMERGING": [{"skill": "name", "pct": 0.NN}]
  },
  "fork_only_skills": [{"fork": "owner/repo", "skill": "name"}],
  "fingerprints": [{"fork": "owner/repo", "total_overrides": N, "dominant_category": "tag"}]
}
```

Overwrite each run. Do not parse last week's article for deltas — the JSON is the contract.

### 14. Log

Append to `memory/logs/${today}.md`:

```
## Fork Skill Digest
- **Active forks scanned:** N (of M total)
- **Configured forks:** N (XX% conversion rate)
- **Template forks:** N
- **Unreadable forks:** N
- **Verdict:** ${verdict_line}
- **DEFAULT_FLIP_ENABLE:** N skills
- **DEFAULT_FLIP_DISABLE:** N skills
- **MODEL_CONSENSUS:** N skills
- **VAR_HOTSPOT:** N skills
- **EMERGING:** N skills
- **Fork-only skills:** N
- **Heaviest customizer:** ${fork} (${N} overrides)
- **Notification sent:** yes/no
- **Status:** FORK_SKILL_DIGEST_OK | FORK_SKILL_DIGEST_QUIET | FORK_SKILL_DIGEST_TEMPLATE_FLEET | FORK_SKILL_DIGEST_NO_FORKS | FORK_SKILL_DIGEST_NO_TARGET
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `FORK_SKILL_DIGEST_OK` | ≥2 configured forks AND ≥1 flip/consensus/new-fork-only signal | Yes |
| `FORK_SKILL_DIGEST_QUIET` | ≥2 configured forks but no signal crossed thresholds | No (log only) |
| `FORK_SKILL_DIGEST_TEMPLATE_FLEET` | <2 configured forks (mostly templates) | No (log only) |
| `FORK_SKILL_DIGEST_NO_FORKS` | Zero active forks | No (log only) |
| `FORK_SKILL_DIGEST_NO_TARGET` | No target repo resolved | No (log only) |

## Sandbox note

All GitHub API calls use `gh api` which authenticates via `GITHUB_TOKEN` automatically — no env-var expansion in headers needed. If `gh api` returns 403 with `X-RateLimit-Remaining: 0`, back off 60s and retry once; on continued failure, record `status: "rate_limited"` for that fork and proceed with partial fleet (the verdict and source-status footer surface the gap). No new env vars or secrets required beyond the default `GITHUB_TOKEN`.

## Constraints

- Never send the notification if `N_CONFIGURED < 2` — without a configured denominator the divergence math is meaningless.
- Never send the notification if all signal buckets are empty AND no NEW_FORK_ONLY in delta — silent runs are correct, not failures.
- Do not parse last week's article for week-over-week — use `memory/topics/fork-skill-digest-state.json` only.
- Skills tagged `meta` or `dev` are excluded from `DEFAULT_FLIP_ENABLE` (operator tools, fork adoption is not the success metric). They can still appear in MODEL_CONSENSUS, VAR_HOTSPOT, and the appendix.
- Skills with `schedule: "workflow_dispatch"` are excluded from both flip buckets (on-demand by design — adoption % is misleading).
- `heartbeat` is excluded from `DEFAULT_FLIP_DISABLE` (every fork inheriting upstream's `enabled: true` would game the disable count if any fork explicitly sets `enabled: false` to silence it).
- The per-fork fingerprint is descriptive only — never recommend changes to individual forks. Only aggregate signals drive recommendations.
- This skill is the COMPANION to `skill-leaderboard` (popularity) and `fork-fleet` (per-fork work). Avoid duplicating their headline metrics — focus on **divergence patterns** the others don't surface.
