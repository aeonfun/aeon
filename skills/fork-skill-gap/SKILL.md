---
name: fork-skill-gap
description: Weekly cross-fork skill adoption digest — per-fork table of upstream skills the fork hasn't enabled, top forks by gap size called out, silent on small-gap weeks
var: ""
tags: [meta, community]
---
> **${var}** — Optional. Pass `dry-run` to skip notify (state and article still write). Pass `owner/repo` to override the parent repo. Combine with a space (`dry-run owner/repo`) for both.

Today is ${today}. Three fork-intelligence skills already exist: `fork-cohort` answers *is the fork alive?* (workflow runs in 7d), `fork-release-tracker` answers *has any fork shipped a versioned artifact?*, `contributor-spotlight` answers *who's pushing the most code?* None of them answer the obvious operator question: **"what's in upstream that I haven't adopted yet?"** This skill closes that layer.

## Why this exists

A fork that activates the agent on day one and never re-syncs accumulates an invisible drift — upstream keeps shipping skills, the fork stays at its activation-day skill count, and the operator has no surface that flags the gap. Skill drift is silent. The first sign is usually a fork operator noticing six months later that everyone else's agent is doing something theirs isn't.

The gap also tells upstream something: which new skills are getting picked up by the fleet, and which are launching into silence. A skill that ships and is never adopted by any fork in 8 weeks is a skill worth re-examining.

## Scope and inputs

Reads from two places, with graceful degradation if either is missing:

1. **`memory/topics/fork-cohort-state.json`** (optional accelerator) — gives the POWER + ACTIVE fork list, classification, and `enabled_count`. When present, this skill targets only POWER + ACTIVE forks (the audience that actually cares about gaps — STALE/COLD forks aren't running anything anyway).
2. **`gh api repos/{parent}/forks`** (always called as fallback / first run) — when fork-cohort state is absent, missing the forks list, or older than 8 days, this skill builds its own POWER + ACTIVE list from scratch using the same activation rule (≥1 workflow run in last 7d).

The intent is: when fork-cohort is enabled and runs Sunday 19:00, fork-skill-gap at 21:00 reuses its work. When fork-cohort hasn't been enabled yet, fork-skill-gap still works, it's just slower.

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles
[ -f memory/topics/fork-skill-gap-state.json ] || cat > memory/topics/fork-skill-gap-state.json <<'EOF'
{"parent":null,"last_run":null,"last_status":null,"upstream_skill_count":null,"forks":{}}
EOF
```

`forks` is a map keyed by `owner/repo`. Each entry holds `{missing_count, missing_slugs (cap 50), top_missing_categories, last_seen, classification_source}`. Old entries (fork no longer in POWER+ACTIVE) are evicted on each run.

### 1. Parse var

- Split `${var}` on whitespace. Tokens: `dry-run`, anything matching `^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$` (treated as `PARENT_OVERRIDE`), anything else.
- If any unknown token is present → log `FORK_SKILL_GAP_BAD_VAR: ${var}` and exit (no notify).
- `MODE=dry-run` if `dry-run` token present, else `execute`.

### 2. Resolve parent repo

```bash
if [ -n "$PARENT_OVERRIDE" ]; then
  PARENT_REPO="$PARENT_OVERRIDE"
else
  PARENT_REPO=$(gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)" --jq '.parent.full_name // .full_name')
fi
PARENT_OWNER="${PARENT_REPO%%/*}"
```

If `state.parent` is set and differs from the resolved `PARENT_REPO` → log `FORK_SKILL_GAP_PARENT_CHANGED`, reset `forks` to `{}`, update `state.parent`.

### 3. Read upstream skills.json (parent baseline)

```bash
gh api "repos/${PARENT_REPO}/contents/skills.json" \
  --jq '.content' 2>/dev/null | base64 -d > /tmp/fsg-upstream.json
UPSTREAM_SLUGS=$(jq -r '.skills[].slug' /tmp/fsg-upstream.json | sort -u)
UPSTREAM_COUNT=$(echo "$UPSTREAM_SLUGS" | wc -l | tr -d ' ')
```

Also pull a slug→category map for the missing-categories rollup:

```bash
jq -r '.skills[] | "\(.slug)\t\(.category // "other")"' /tmp/fsg-upstream.json > /tmp/fsg-categories.tsv
```

If skills.json is missing from upstream (vanishingly unlikely on an Aeon-shaped parent) → log `FORK_SKILL_GAP_NO_UPSTREAM_MANIFEST`, exit (no notify).

### 4. Build the POWER + ACTIVE fork list

Try the cached path first:

```bash
COHORT_STATE=memory/topics/fork-cohort-state.json
COHORT_FRESH=false
if [ -f "$COHORT_STATE" ]; then
  COHORT_DATE=$(jq -r '.last_run // empty' "$COHORT_STATE")
  if [ -n "$COHORT_DATE" ]; then
    # within 8 days = fresh enough (handles weekly Sunday cadence + 1d grace)
    AGE_DAYS=$(( ($(date -u +%s) - $(date -u -d "$COHORT_DATE" +%s)) / 86400 ))
    [ "$AGE_DAYS" -le 8 ] && COHORT_FRESH=true
  fi
fi
```

- If `COHORT_FRESH=true`: read POWER + ACTIVE forks from `state.forks` (`jq -r '.forks | to_entries[] | select(.value.bucket == "POWER" or .value.bucket == "ACTIVE") | .key'`). Set `classification_source=cohort`.
- If `COHORT_FRESH=false`: fall back to live API. For each fork in `gh api "repos/${PARENT_REPO}/forks" --paginate`, check `gh api "repos/${FORK}/actions/runs?per_page=1" --jq '.workflow_runs[0].updated_at // empty'`. Include forks with a run in the last 7 days. Set `classification_source=live`. Apply retry-once-then-skip on 403/5xx, same policy as `fork-cohort`.

Cap at 80 forks per run. If exceeded, sort by stargazers desc and trim (log `truncated_at=80`).

If the resulting list is empty:
- If `classification_source=cohort` and the cohort state has zero POWER+ACTIVE forks → exit `FORK_SKILL_GAP_NO_ACTIVE` (no notify, log only).
- If `classification_source=live` and the live check found zero active forks → exit `FORK_SKILL_GAP_NO_ACTIVE` (no notify).
- If the forks listing itself failed → exit `FORK_SKILL_GAP_API_FAIL` (single-line error notify).

### 5. Per-fork: read fork's skills.json

For each fork in the active list:

```bash
gh api "repos/${FORK_FULL_NAME}/contents/skills.json?ref=${FORK_DEFAULT_BRANCH:-main}" \
  --jq '.content' 2>/dev/null | base64 -d > /tmp/fsg-fork.json
```

If the call returns 404 or the file is missing/empty/invalid JSON: the fork has stripped `skills.json` or is on a non-default branch we couldn't infer. Mark `unreadable=true` for that fork. **Do not** assume zero skills — that would inflate the gap on every fork that simply renamed the manifest.

Compute:

```bash
FORK_SLUGS=$(jq -r '.skills[].slug' /tmp/fsg-fork.json 2>/dev/null | sort -u)
MISSING_SLUGS=$(comm -23 <(echo "$UPSTREAM_SLUGS") <(echo "$FORK_SLUGS"))
MISSING_COUNT=$(echo "$MISSING_SLUGS" | grep -c .)
```

For each missing slug, look up its category from `/tmp/fsg-categories.tsv`. Roll up: top 3 categories by missing-slug count.

Error handling per fork:
- 404 on contents endpoint → `unreadable` (fork has no skills.json at default branch).
- 403 → retry once after 60s, then `unreadable`.
- 5xx → retry once after 10s, then `unreadable`.

### 6. Compute fleet-level rollup

```
MISSING_PER_FORK = sorted (desc) list of (fork, missing_count)
READABLE_FORKS   = forks where unreadable=false
GAP_DISTRIBUTION = histogram of missing_count across readable forks
TOP_MISSING_SLUGS = slugs missing on the most readable forks (slug → fork-count)
                    capped at top 10
```

Quiet-week gate (skip notify; still write article + state):

- All readable forks have `missing_count ≤ 5` AND
- There is a prior state record AND
- The previous run was also `FORK_SKILL_GAP_QUIET` or `FORK_SKILL_GAP_OK` with no new top-missing slugs

Otherwise, gate is open and notify fires.

### 7. Pick the verdict (one-line lede)

Priority order:
1. `WIDE_GAP: {N} forks each missing {M}+ upstream skills` — when ≥3 forks have `missing_count ≥ 20` (signals fleet-wide drift).
2. `BIG_FORK_GAP: @{owner} missing {N} skills` — when the top fork by missing_count is missing ≥15 skills (single-fork laggard worth a direct check-in).
3. `NEW_UPSTREAM_UNCLAIMED: {N} fresh skills with zero fleet adoption` — when ≥1 upstream skill shipped in the last 14 days has 0 fork adoption (read `updated` field from `skills.json`).
4. `STEADY: fleet within {N} skills of upstream` — typical week, max-gap-fork is within tolerance.
5. `COLD START: first scan — {N} active forks, median gap {M}` — first ever run, no prior state.

### 8. Write the article

Path: `articles/fork-skill-gap-${today}.md`

```markdown
# Fork Skill Gap — ${today}

**Verdict:** {one-line verdict from step 7}

**Parent:** {PARENT_REPO} · **Upstream skills:** {UPSTREAM_COUNT}
**Active forks audited:** {N_AUDITED} (POWER + ACTIVE) · **Readable manifests:** {N_READABLE}/{N_AUDITED}
**Median gap:** {M_MEDIAN} · **Max gap:** {M_MAX} · **Min gap:** {M_MIN}

---

## Forks by gap size

(Cap table at 20 rows by missing_count desc. Footer "... and N more" if truncated.)

| Fork | Owner | Source | Total upstream | Missing | Top missing categories |
|------|-------|--------|----------------|---------|------------------------|
| {full_name} | @{owner} | cohort\|live | {UPSTREAM_COUNT} | {missing_count} | {cat1} ({n}), {cat2} ({n}), {cat3} ({n}) |

---

## Top 10 unadopted upstream skills

(Slugs missing on the most forks — the inverse view. Helps upstream see which new skills aren't catching on.)

| Slug | Category | Shipped | Forks missing it |
|------|----------|---------|------------------|
| {slug} | {category} | {updated} | {fork_count} / {N_READABLE} |

---

## Unreadable forks

(Only render if any. Forks where skills.json was 404 / parse-failed / rate-limited.)

| Fork | Owner | Reason |
|------|-------|--------|

---

## Source status

`active_list_source={cohort|live} · forks_audited=N · skills_json_lookup=N/M · unreadable=N · truncated=true|false · cohort_state_age_days=N`
```

Cap article at ~400 lines. Sort forks descending by `missing_count`; ties broken by stargazers desc, then alphabetical.

### 9. Update state

Write `memory/topics/fork-skill-gap-state.json`:

```json
{
  "parent": "{PARENT_REPO}",
  "last_run": "${today}",
  "last_status": "FORK_SKILL_GAP_OK|FORK_SKILL_GAP_QUIET|...",
  "upstream_skill_count": N,
  "top_missing_slugs": [
    {"slug": "name", "fork_count": N, "category": "..."}
  ],
  "forks": {
    "owner/repo": {
      "missing_count": N,
      "missing_slugs": ["..."],          // cap 50
      "top_missing_categories": [["dev", 8], ["social", 3]],
      "unreadable": false,
      "last_seen": "${today}",
      "classification_source": "cohort|live"
    }
  }
}
```

Evict entries whose `last_seen` is more than 35 days old (covers ~5 missed weekly runs before purge).

### 10. Append to memory log

```
## fork-skill-gap
- Status: FORK_SKILL_GAP_OK | FORK_SKILL_GAP_QUIET | FORK_SKILL_GAP_NO_ACTIVE | FORK_SKILL_GAP_API_FAIL | FORK_SKILL_GAP_BAD_VAR | FORK_SKILL_GAP_PARENT_CHANGED | FORK_SKILL_GAP_DRY_RUN
- Verdict: {one-line verdict}
- Active forks audited: {N_AUDITED} (readable: {N_READABLE})
- Median gap: M_MEDIAN · Max gap: M_MAX
- Article: articles/fork-skill-gap-${today}.md
- Source status: active_list_source={cohort|live} · skills_json_lookup=N/M · unreadable=N
```

### 11. Notify — gated

**Skip notify entirely** when:
- `MODE=dry-run`, OR
- Status is `FORK_SKILL_GAP_NO_ACTIVE`, `FORK_SKILL_GAP_QUIET`, or `FORK_SKILL_GAP_BAD_VAR`, OR
- Quiet-week gate from step 6 is closed.

Otherwise send via `./notify` (keep ≤900 chars total — Telegram/Discord/Slack render):

```
*Fork Skill Gap — ${today} — {PARENT_REPO}*
{verdict line}

{N_READABLE} of {N_AUDITED} active forks audited. Upstream ships {UPSTREAM_COUNT} skills; the median fork is missing {M_MEDIAN}.

Top 3 forks by gap:
- @{owner1} — {short_name1} missing {N1} ({top_cat1})
- @{owner2} — {short_name2} missing {N2} ({top_cat2})
- @{owner3} — {short_name3} missing {N3} ({top_cat3})

{If TOP_MISSING_SLUGS has any with fork_count == N_READABLE — i.e. nobody has it:}
Universally unadopted upstream skills: {slug1}, {slug2}, {slug3}

Full report: articles/fork-skill-gap-${today}.md
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `FORK_SKILL_GAP_OK` | Run succeeded; verdict triggered notify gate | Yes |
| `FORK_SKILL_GAP_QUIET` | All forks within 5 skills of upstream + prior state existed + no new top-missing | No (log only) |
| `FORK_SKILL_GAP_DRY_RUN` | `MODE=dry-run`; state + article wrote, notify skipped | No |
| `FORK_SKILL_GAP_NO_ACTIVE` | Zero POWER+ACTIVE forks found | No (log only) |
| `FORK_SKILL_GAP_NO_UPSTREAM_MANIFEST` | Parent has no skills.json | No (log only) |
| `FORK_SKILL_GAP_PARENT_CHANGED` | Resolved parent differs from stored — fork-history reset | No (log only) |
| `FORK_SKILL_GAP_API_FAIL` | Forks listing failed after retry | Yes (single-line error notify) |
| `FORK_SKILL_GAP_BAD_VAR` | `${var}` parse failed | No |

## Constraints

- **Read-only across the fleet.** This skill never writes to fork repos, never opens issues on forks, never PRs against forks. The original idea suggested "shout-out" notifications; that's an upstream-channel announcement, not a fork-side write.
- **Never treat missing skills.json as zero skills.** Manifest absence → `unreadable=true`. A fork that renamed `skills.json` to `manifest.json` should not be reported as missing 118 skills.
- **Compare on slug, not on enabled state.** `enabled: true` vs `enabled: false` is `fork-skill-digest`'s job — this skill only answers "is the skill *present in the fork's skills.json* at all?" An enabled-but-stale skill is still a present skill here.
- **Bot owner allowlist:** `dependabot[bot]`, `github-actions[bot]`, `aeonframework[bot]` — skip from cohort rendering and from totals (they're never running the agent themselves; counting them inflates "active fork" numbers).
- **Cap fork processing at 80 per run.** At current ~50-fork scale this is a guard for viral days.
- **`MISSING_SLUGS` is recorded but bounded.** Per-fork state stores up to 50 missing slugs verbatim — past that, only the count and category rollup persist (state file size guard).

## Sandbox note

Uses `gh api` for everything — no `curl`, no env-var-in-headers. Authenticates via `GITHUB_TOKEN` automatically. The contents endpoint returns base64-encoded payloads; the `--jq '.content' | base64 -d` chain works in the sandbox because `gh api` handles auth internally and `base64 -d` is pure local.

Persistent 403 on a fork's contents endpoint marks it `unreadable` — the skill never lies about coverage. Persistent 403 on the forks listing → `FORK_SKILL_GAP_API_FAIL` with one error notify, then exit.

## Security

- The fork's `skills.json` is parsed as JSON only — never executed, never interpolated into shell commands. Slug values pass through `jq -r` extraction directly to `comm` for diffing. A malicious fork that ships `{"slug": "$(rm -rf /)"}` in their manifest produces a benign weird-looking row in the gap table.
- Skill descriptions and category strings from fork manifests are **not** rendered in the notification or article — only slugs (verified against the upstream manifest as the canonical source) and the upstream category mapping. This means a fork can't smuggle an attacker-controlled description into the operator's Telegram feed.
- The 200-char body truncation pattern from `fork-release-tracker` does not apply here — we don't read release bodies, only slug lists.
