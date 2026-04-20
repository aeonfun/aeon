---
name: star-milestone
description: Announces when a watched repo crosses a star-count milestone (100, 150, 200, 250, 500, 1000, ...) with a velocity-shaped narrative — time-to-milestone, growth shape, projection, and a tight highlight reel
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output via velocity shape, time-to-milestone framing, projected next milestone, stale-suppression, and fake-star defer -->

> **${var}** — Repo (`owner/repo`) to check. If empty, checks all watched repos.

Today is ${today}. Detect milestone star-count crossings on watched repos and celebrate them with a velocity-shaped narrative. A milestone notification is only valuable if the reader learns something they couldn't infer from the number alone — *how fast* it arrived, whether the trajectory is organic or a spike, and what's next. A bare "we crossed 200" without that context is just a vanity metric. This skill earns its slot by being the daily growth-pulse readout *gated* on a meaningful threshold crossing.

## Thresholds

```
25, 50, 100, 150, 175, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 25000, 50000, 100000
```

## Steps

### 1. Load the repo list

If `${var}` is set, treat it as the single repo. Otherwise read `memory/watched-repos.md`. Skip any repo whose name ends with `-aeon` or contains `aeon-agent` (agent repos, not project repos). If the list is empty, log `STAR_MILESTONE_NO_REPOS` and exit cleanly without notifying.

### 2. Load milestone state

Read `memory/topics/milestones.md` if present. If absent, treat state as empty. The file has a section per repo, one milestone per line:

```markdown
# Star Milestones

## aaronjmars/aeon
- 150 stars — 2026-04-01 (bootstrap)
- 175 stars — 2026-04-15
- 200 stars — 2026-04-19
```

Suffix tokens you may write later: `(bootstrap)`, `(skipped)`, `(stale)`, `(deferred)`.

### 3. Per repo — fetch count and stargazer timestamps

```bash
STARS=$(gh api repos/$REPO --jq '.stargazers_count')
```

For velocity, fetch the most recent stargazer timestamps. The `star+json` accept header returns `starred_at`:

```bash
# Last page first (most recent stargazers). Page count = ceil(STARS/100).
LAST_PAGE=$(( (STARS + 99) / 100 ))
gh api -H "Accept: application/vnd.github.star+json" \
  "repos/$REPO/stargazers?per_page=100&page=$LAST_PAGE" \
  > .star-cache/$REPO.last.json 2>/dev/null

# If STARS > 100, also fetch the page before for a 30d baseline.
if [ "$LAST_PAGE" -gt 1 ]; then
  gh api -H "Accept: application/vnd.github.star+json" \
    "repos/$REPO/stargazers?per_page=100&page=$((LAST_PAGE - 1))" \
    > .star-cache/$REPO.prev.json 2>/dev/null
fi
```

Compute from these timestamps:
- **`v7`** — stars added in the last 7 days (count `starred_at` within 7d of today)
- **`v30`** — stars added in the last 30 days
- **`baseline`** — median daily rate across the last 30 days (`v30 / 30`)
- **`days_since_last_star`** — `today - max(starred_at)`

If `gh api` fails for the stargazer pages, set velocity fields to `null` and continue — the milestone check still runs without them, and the notification adapts (see step 7).

### 4. Find the highest threshold crossed

Find the highest threshold `M` where `M <= STARS`. If none (e.g. 3 stars), log `STAR_MILESTONE_QUIET: below first threshold for $REPO` and skip this repo.

### 5. Decide whether to announce

Apply these gates in order:

a. **Already recorded** — if `milestones.md` lists `M` for this repo → no action.
b. **Bootstrap** — if the repo has *no* prior entries → record `M (bootstrap)` silently. No notification.
c. **Stale-recovery** — if `M` is the lowest unrecorded threshold above the *previous* recorded one, but `days_since_last_star >= 7` (i.e. count crawled across the line and then stalled) → record `M (stale)` silently. No notification. The milestone is meaningless without momentum.
d. **Suspected fake-star burst** — if `v7 >= 50` AND the most recent 30 stargazers show ≥40% accounts created within the last 30 days with 0 public events (sample via `gh api users/$LOGIN --jq '.created_at, .public_repos'`), record `M (deferred)` and log `SUSPECTED_FAKE_STARS for $REPO — manual review`. No notification. Skip the per-user lookup if `v7 < 50` (cheap-path: organic-rate milestones don't need this check).
e. **Multiple thresholds crossed in one run** — record intermediate ones silently as `(skipped)`, announce only the highest.
f. Otherwise → proceed to step 6.

### 6. Determine the **shape**

Pick one label from the time-to-milestone evidence. `Δprior` = days between this milestone and the previously-recorded non-bootstrap, non-stale milestone (use `Δprior = null` if there isn't one).

| Shape | When |
|-------|------|
| **SPIKE** | `v7 >= 3 × baseline` and `v7 >= 20`, OR `Δprior` < 25% of the prior gap. Clearly above trend. |
| **ORGANIC** | `v7` within 0.5×–2× baseline. Steady-state growth. |
| **MIGRATED** | First non-bootstrap milestone with `STARS >= 2 × M_bootstrap`. The repo arrived loud (e.g. cross-post from elsewhere). |
| **RECOVERY** | Prior `(stale)` entry within last 30 days, now `v7 >= 5`. Growth resumed. |
| **TRICKLE** | `v7 < 0.5 × baseline` but milestone still crossed. Trajectory is decelerating; flag honestly. |

If velocity data is unavailable (step 3 failed for this repo), use shape `UNKNOWN` and omit the velocity line in step 7.

### 7. Send the notification

Use this exact structure via `./notify` — do not compress; the message goes to a Telegram group and must stand on its own:

```
*Milestone — ${M} stars · ${SHAPE}*
${owner/repo}

[owner/repo] crossed ${M} stars (now ${STARS}).
Time to ${M}: ${Δprior_days} days from ${prev_M} (${shape_one_liner}).
Pace: ${v7}/wk · baseline ${baseline_per_day}/day · projected ${next_M} by ~${eta_date}.

Highlights since ${prev_milestone_date}:
- [verb + concrete noun + delta — e.g. "Shipped 4 autoresearch evolutions (PRs #12, #18, #25, #45)"]
- [highlight 2]
- [highlight 3]

Repo: https://github.com/${owner/repo}
${status_footer}
```

Field rules:
- `${shape_one_liner}` — one short clause naming the trajectory in plain English. Examples by shape: *"3.2× the previous gap — clear acceleration"* (SPIKE) / *"on-trend with the last two milestones"* (ORGANIC) / *"first real milestone post-launch"* (MIGRATED) / *"resumed after 12 quiet days"* (RECOVERY) / *"crossed on residual momentum, current pace would take 60 days for the next"* (TRICKLE).
- `${eta_date}` — `today + (next_M - STARS) / max(v7/7, 0.5)` rounded to a date. If TRICKLE or pace < 0.5/day, write *"no projection — pace too slow"* instead of an inflated date.
- **Highlights**: cap at 3. Source from `memory/logs/YYYY-MM-DD.md` last 14 days, sections like `## Push Recap`, `## Feature Built`, `## Repo Article`, `## Repo Actions`, `## Changelog`. Each highlight must include a verb, a concrete noun, and a delta or specificity (count, PR/issue number, name). Reject vague items like "improved docs" — rewrite as "Added 3 sections to README (PR #N)" or drop. If logs are empty, fall back to `gh api repos/$REPO/commits?since=<14d-ago> --jq '.[].commit.message'` and pick 3 commit subjects that ship value (skip chore/typo).
- If velocity is `UNKNOWN`, replace the `Time to` and `Pace` lines with a single line: *"Velocity data unavailable this run — milestone confirmed by repo count."*
- **`${status_footer}`** — single line, only printed in the log entry (step 9), NOT in the user-facing notification body. Format: `_status: shape=$SHAPE, v7=$N, fake_check=$ok|skip|defer, log_window=$days_d_`

### 8. Update `memory/topics/milestones.md`

Append the new entry under the repo's section. Create the file with `# Star Milestones` header if absent. Keep entries in ascending threshold order per repo. Format:

```
- ${M} stars — ${today} (${shape_lowercase})
```

For silent records (bootstrap/stale/deferred/skipped), use the corresponding suffix instead of the shape.

### 9. Log to `memory/logs/${today}.md`

```
## Star Milestone
- **owner/repo**: stargazers_count=N, milestone=M, shape=$SHAPE
- **Velocity**: v7=$N, v30=$N, baseline=$N/day, days_since_last_star=$N
- **Δprior**: $N days from ${prev_M} (prior gap was $N days)
- **Highlights used**: $N (source: logs|commits)
- **Notification sent**: yes / no — ${reason}
- **Status**: STAR_MILESTONE_OK | STAR_MILESTONE_QUIET | STAR_MILESTONE_DEFERRED | STAR_MILESTONE_DEGRADED
```

`STAR_MILESTONE_DEGRADED` means the repo count succeeded but velocity data didn't — distinguishes a partial run from a clean miss.

## Edge cases

- **Multiple milestones crossed in one run** — see step 5e. Highest only; intermediates `(skipped)`.
- **Unstars dropping count below a recorded milestone** — never un-record. Once written, milestones stay forever.
- **Repo deleted / 404** — log the error for that repo and continue with the rest of the list. Do not fail the whole run; emit `STAR_MILESTONE_DEGRADED` for that repo.
- **Brand-new repo with `STARS == M_first` (e.g. 25)** — bootstrap rule (5b) handles it: silent record, no notification on first run.
- **Empty highlight reel after both log and commit fallback** — drop the highlights block entirely. Send the notification without it rather than padding with filler.

## Sandbox note

`gh api` handles auth via the workflow's `GITHUB_TOKEN`, so no env-var curl workaround is needed. The stargazer pagination call is the only network-heavy step; if it fails, fall through to `UNKNOWN` shape rather than aborting. `./notify` fans out to every configured channel.

## Constraints

- **Never spam.** A milestone announced without velocity context is worse than no announcement — it trains readers to mute the channel. Honor the stale-suppression and fake-star-defer gates strictly.
- **Never inflate.** If `v7` is below baseline, label the shape **TRICKLE** honestly rather than wording around it. Credibility compounds.
- **Preserve milestones.md format.** Other skills (e.g. weekly-review) may parse this file — append, don't restructure.
