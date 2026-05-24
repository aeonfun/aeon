---
name: builder-map
description: Weekly map of who's building on top of watched repos — forks, third-party ecosystem repos, builder announcements. Answers the "who's building on top" question.
schedule: "0 10 * * 2"
commits: false
permissions: []
tags: [dev, social, ecosystem]
---

Today is ${today}. Read `memory/MEMORY.md` before starting. If `soul/SOUL.md` + `soul/STYLE.md` exist and are populated, read them to match the operator's voice; otherwise use a clear, direct, neutral tone.

## Why this skill exists

When a repo, framework, or stack attracts builders — forks, third-party apps, integrations, research uses — that signal compounds quietly across GitHub and social. Without a regular sweep, the picture stays fragmented. This skill is a weekly cross-project builder discovery run: who's building on top of the watched repos, which categories are emerging, where the ecosystem is thickening.

## Config

This skill reads watched repos from `memory/topics/watched-repos.md`. Each row should declare a primary repo and optional search keywords. Example format:

```markdown
# Watched Repos

| Repo | Keywords | Notes |
|------|----------|-------|
| acme/coreframework | coreframework, acmesdk | flagship stack |
| acme/dataengine | dataengine, acmedata | trading / quant ecosystem |
```

If `memory/topics/watched-repos.md` doesn't exist, fall back to `memory/watched-repos.md` (legacy single-line OWNER format). If neither exists, log `BUILDER_MAP_SKIP: no watched repos configured` and stop — there's nothing to map.

## Steps

### 1. Load ecosystem baseline

Read `memory/topics/ecosystem.md`. If it doesn't exist, create it with this seed and continue:

```markdown
# Builder Ecosystem

*Last run: never*

## Known Builders
- (populate as discoveries land)

## Fork Counts (baseline)
- (per-repo counts populated by the first run)

## Builder Categories
- quant/finance:
- research/scientific:
- agentic-apps:
- enterprise/adoption:
- misc:

## Signal Log
- (append per-run summaries here)
```

Extract:
- `known_builders` — list of already-tracked builders (avoid re-announcing them unless they ship something new)
- `forks_last` — last recorded fork count per watched repo (or "unknown")

### 2. Scan forks for each watched repo

For each repo from `memory/topics/watched-repos.md`:

```bash
gh api "repos/${OWNER}/${REPO}/forks" --paginate \
  --jq '[.[] | select(.archived == false) | {full_name, owner: .owner.login, pushed_at, stars: .stargazers_count, description, default_branch}]'
```

If that fails (404 or permission), try:
```bash
gh api "repos/${OWNER}/${REPO}" --jq '{forks_count, stargazers_count}'
```
and note that fork enumeration was unavailable for that repo this run.

Classify each fork:
- **Active** = `pushed_at` within last 30 days
- **Stale** = 30–90 days
- **Dormant** = >90 days

Record total, active count, and any active forks with ≥1 star or a non-empty description.

### 3. Search GitHub for third-party ecosystem repos

These are repos that MENTION or USE the watched stack but aren't forks. For each set of `Keywords` in the config:

```bash
gh search repos "${KEYWORD}" --sort=updated --limit=15 --json=fullName,description,stargazersCount,updatedAt,owner
```

If `gh search repos` is unavailable:
```bash
gh api "search/repositories?q=${KEYWORD}+in:readme+in:description&sort=updated&per_page=15" \
  --jq '[.items[] | {full_name, description, stargazers_count, updated_at, owner: .owner.login}]'
```

Filter:
- Exclude the owners listed in `memory/topics/watched-repos.md` (their own repos)
- Exclude repos that are clearly forks already captured in step 2
- Focus on repos updated in last 30 days

These are the highest-signal ecosystem builders — they chose to use the stack without forking.

### 4. WebSearch for builder announcements

For each watched repo and its keywords, run two searches capped to last 7 days where possible:

1. `"${KEYWORD}" built OR using OR integrating ${year}`
2. `site:x.com "${KEYWORD}" "built" OR "using" OR "shipped"`

From results, extract:
- Builders sharing demos, screenshots, or results built with the stack
- Projects that cite the watched repos as a component
- Any notable company or researcher using it

Flag results from new builders NOT in `known_builders`. Skip already-known builders unless they shipped something new.

### 5. Classify and score builders

Combine all findings. For each builder (fork, ecosystem repo, or announcement):

| Signal | Points |
|--------|--------|
| Active fork (pushed ≤30d) | +3 |
| Third-party repo (not a fork) using the stack | +5 |
| Stars on fork/repo | +1 per star (cap 10) |
| New builder not in known_builders baseline | +4 |
| Builder announcement / demo shared publicly | +3 |
| Non-obvious vertical (research, enterprise, consumer) | +2 |

Sort by score descending. Assign category:
- **quant/finance** — trading bots, market simulation, portfolio analysis
- **research/scientific** — academic, biology, social science
- **agentic-apps** — autonomous agent products, tools, frameworks built on the stack
- **social-sim** — political/social simulation, opinion modeling
- **enterprise/adoption** — companies using it in products
- **misc** — doesn't cleanly fit

### 6. Compute ecosystem momentum

| Signal | Level |
|--------|-------|
| ≥3 new builders not in baseline | breakout |
| 1–2 new builders + active forks growing | accelerating |
| Same builders, forks growing | building |
| No new builders, stable fork count | holding |
| Forks declining or no activity | cooling |

Track fork count deltas per repo vs baseline:
- `delta = current active forks − forks_last`

### 7. Update memory/topics/ecosystem.md

Rewrite:
- `*Last run: ${today}*`
- Update `Known Builders` (append new ones; update if existing shipped something new)
- Update `Fork Counts` with current totals and active counts per watched repo
- Update `Builder Categories` map
- Append entry to `Signal Log`

Keep the file under ~150 lines. Archive oldest signal log entries if needed.

### 8. Send notification

Write to `.pending-notify-temp/builder-map-${today}.md`, then:
```bash
mkdir -p .pending-notify-temp
./notify -f .pending-notify-temp/builder-map-${today}.md
```

**Format — match the operator's voice if soul files are populated, otherwise direct and neutral:**

```
builder map — ${today}

{momentum level}: {one-line framing}

{forEach watched repo}
{repo}: {N_ACTIVE} active forks (delta {+N} vs last run)
{end}

{IF new_builders}
new builders ({count}):
{forEach new_builder, top 3}
- {owner/project}: {one-line on what they built} ({category})
{end}
{end}

{IF notable_third_party}
ecosystem repos using the stack:
{forEach, top 2}
- {repo}: {description} ({stars}★)
{end}
{end}

{IF quiet}
no new builders this week. stack's compounding.
{end}
```

Keep under 900 chars. Do NOT use `./notify "$(cat ...)"` — write the file first, pass the path.

**Skip notification entirely** if:
- Momentum is "holding" AND no new builders AND fork deltas are 0 or negative
- Log `BUILDER_MAP_QUIET` instead

### 9. Log to memory/logs/${today}.md

Append:

```markdown
## builder-map
- **Watched repos scanned:** {N}
- **Total active forks:** {sum across repos}
- **Third-party repos:** {count} found using the stack
- **New builders:** {count} ({names})
- **Momentum:** {level}
- **Notification:** sent / skipped (quiet)
- BUILDER_MAP_OK
```

## Required Env Vars

None. Uses `gh` CLI (GITHUB_TOKEN via workflow), WebSearch, WebFetch.

## Sandbox Note

- `gh search repos` and `gh api` use the gh CLI — handles auth internally.
- WebSearch: built-in tool, always available.
- If `gh api` for forks returns 404 (private or renamed repo): skip fork scan for that repo, log `${REPO}_forks=unavailable`, continue with the rest.

## Relationship to Other Skills

- **fork-fleet** / **fork-cohort**: Deep per-fork analysis. This skill stays surface-level (count, who, active/stale) to avoid duplication and covers third-party ecosystem repos as well.
- **github-trending**: Broad trending sweep. This skill is targeted at the operator's watched repos.

## What to Watch For

- Non-obvious verticals adopting the stack (signals a real product–market fit beyond the original niche)
- Academic or research institutions using the stack
- Forks shipping novel features that didn't come from upstream
- Third-party products charging for features built on the stack (token-gating, paid endpoints)
