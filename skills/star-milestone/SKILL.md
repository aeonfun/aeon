---
type: Skill
name: star-milestone
category: dev
description: Two complementary star-growth jobs for watched repos in one pass. (1) CROSSING — announces when a repo crosses a star-count milestone (25, 50, 100, 150, 175, 200, 250, 500, 1000, ...) with a velocity-shaped narrative (time-to-milestone, growth shape, projection, tight highlight reel) and optionally auto-dispatches downstream skills (e.g. the `product-hunt` Show HN post via `product-hunt:showhn` at 500⭐) per the rule map in `memory/topics/milestone-dispatch.json`. (2) MOMENTUM — projects the date the next un-crossed milestone will be hit from the 7-day star growth-rate and fires a Show HN launch-timing alert only when that date lands in the dispatch window (7-14 days out, landing Tue/Wed/Thu). A default run reports crossings + momentum + next-milestone projection together.
var: ""
tags: [dev, meta, growth]
---
<!-- merged: star-milestone (post-crossing celebration) + star-momentum (pre-crossing growth-rate projection & Show HN launch-window timing). Crossing lineage: autoresearch variation B — velocity shape, time-to-milestone framing, stale-suppression, fake-star defer. Momentum lineage: linear extrapolation over repo-pulse log series with a launch-window gate. -->

> **${var}** — Selector (whitespace-separated tokens, any order). Empty = audit **all** watched repos and run both phases (crossings + momentum). `owner/repo` = scope both phases to one repo. `dry-run` = run fully but suppress **all** notifications and all state mutations (the momentum article + the log still write). A bare positive integer (e.g. `500`) = override the momentum projection target milestone.

Today is ${today}. This skill does two complementary things in a single pass over the watched repos, and neither replaces the other:

- **Phase A (crossing)** celebrates a milestone **after** the star count crosses it — with a velocity-shaped narrative so the reader learns *how fast* it arrived, whether the trajectory is organic or a spike, and what's next. A bare "we crossed 200" without that context is just a vanity metric.
- **Phase B (momentum)** answers a question the crossing phase cannot: *when* will the next milestone arrive, and does that date fall in the Show HN launch window? It converts the last 14 days of star-count history into a projected crossing date and surfaces a single decision-ready alert — "the next milestone is on a Wednesday 9 days from now; that's the launch slot" — so the operator can dispatch the `product-hunt` Show HN post in time instead of watching the moment slip past reactively.

Both phases are silent unless there is signal: no crossing and no in-window projection ⇒ no notification.

## Thresholds — shared milestone ladder

Both phases use one ladder so they always agree on which numbers count as round-number moments:

```
25, 50, 100, 150, 175, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 25000, 50000, 100000
```

## Preamble — shared setup (run once)

1. Read `memory/MEMORY.md` for high-level context and scan the last ~3 days of `memory/logs/` so you don't re-report a signal already reported.
2. **Parse `${var}`** into a selector. Tokenize on whitespace; each token is classified independently:
   - token `dry-run` → `DRY_RUN=true` (suppress notifications, auto-dispatch, and all state writes; the article + log still write).
   - a token containing `/` → `REPO_SCOPE=<token>` (both phases operate on this repo only).
   - a bare positive integer → `OVERRIDE_MILESTONE=<int>` (Phase B target override; Phase A ignores it — crossings are count-driven).
   - any other non-empty token → log `STAR_MOMENTUM_BAD_VAR: ${var}` and exit (no notify, no article, no state write).
   - empty `${var}` → `DRY_RUN=false`, `REPO_SCOPE=` (all repos), `OVERRIDE_MILESTONE=auto`.
3. **Load the repo list.** If `REPO_SCOPE` is set, that is the single repo. Otherwise read `memory/watched-repos.md`:
   ```bash
   mkdir -p memory/topics output/articles
   [ -f memory/topics/star-momentum-state.json ] || echo '{"last_run_at":null,"alerts":{}}' > memory/topics/star-momentum-state.json
   REPOS=$(grep -oE '^- [a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+' memory/watched-repos.md \
     | sed 's/^- //' \
     | grep -vE '(aeon-agent|-aeon$)' || true)
   ```
   Skip any repo whose name ends with `-aeon` or contains `aeon-agent` (agent/infra mirrors, not project repos with growth narratives). If the resulting list is empty, log `STAR_MILESTONE_NO_REPOS` (both phases have nothing to do) and exit cleanly without notifying.

For each repo in the list, run **Phase A** then **Phase B**. Aggregate notifications, persist state, then write one consolidated log block.

---

## Phase A — Milestone crossing (celebrate after the line is crossed)

### A1. Load milestone state

Read `memory/topics/milestones.md` if present. If absent, treat state as empty. The file has a section per repo, one milestone per line:

```markdown
# Star Milestones

## aaronjmars/aeon
- 150 stars — 2026-04-01 (bootstrap)
- 175 stars — 2026-04-15
- 200 stars — 2026-04-19
```

Suffix tokens you may write later: `(bootstrap)`, `(skipped)`, `(stale)`, `(deferred)`.

### A2. Per repo — fetch count and stargazer timestamps

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

Compute from these timestamps (these are the **stargazer-timestamp** velocity fields; Phase B computes a separate log-series velocity — keep them distinct):
- **`v7`** — stars added in the last 7 days (count `starred_at` within 7d of today). Units: stars/week.
- **`v30`** — stars added in the last 30 days.
- **`baseline`** — median daily rate across the last 30 days (`v30 / 30`). Units: stars/day.
- **`days_since_last_star`** — `today - max(starred_at)`.

If `gh api` fails for the stargazer pages, set velocity fields to `null` and continue — the milestone check still runs without them, and the notification adapts (see A6/A7).

### A3. Find the highest threshold crossed

Find the highest ladder threshold `M` where `M <= STARS`. If none (e.g. 3 stars), log `STAR_MILESTONE_QUIET: below first threshold for $REPO` and skip this repo's Phase A.

### A4. Decide whether to announce

Apply these gates in order:

a. **Already recorded** — if `milestones.md` lists `M` for this repo → no action.
b. **Bootstrap** — if the repo has *no* prior entries → record `M (bootstrap)` silently. No notification.
c. **Stale-recovery** — if `M` is the lowest unrecorded threshold above the *previous* recorded one, but `days_since_last_star >= 7` (i.e. count crawled across the line and then stalled) → record `M (stale)` silently. No notification. The milestone is meaningless without momentum.
d. **Suspected fake-star burst** — if `v7 >= 50` AND the most recent 30 stargazers show ≥40% accounts created within the last 30 days with 0 public events (sample via `gh api users/$LOGIN --jq '.created_at, .public_repos'`), record `M (deferred)` and log `SUSPECTED_FAKE_STARS for $REPO — manual review`. No notification. Skip the per-user lookup if `v7 < 50` (cheap-path: organic-rate milestones don't need this check).
e. **Multiple thresholds crossed in one run** — record intermediate ones silently as `(skipped)`, announce only the highest.
f. Otherwise → proceed to A5.

> **Under `DRY_RUN`:** compute the gate outcome and shape for the log, but write **nothing** to `milestones.md`, send **no** notification, and run **no** auto-dispatch. Report in the log what *would* have happened.

### A5. Determine the **shape**

Pick one label from the time-to-milestone evidence. `Δprior` = days between this milestone and the previously-recorded non-bootstrap, non-stale milestone (use `Δprior = null` if there isn't one).

| Shape | When |
|-------|------|
| **SPIKE** | `v7 >= 3 × baseline` and `v7 >= 20`, OR `Δprior` < 25% of the prior gap. Clearly above trend. |
| **ORGANIC** | `v7` within 0.5×–2× baseline. Steady-state growth. |
| **MIGRATED** | First non-bootstrap milestone with `STARS >= 2 × M_bootstrap`. The repo arrived loud (e.g. cross-post from elsewhere). |
| **RECOVERY** | Prior `(stale)` entry within last 30 days, now `v7 >= 5`. Growth resumed. |
| **TRICKLE** | `v7 < 0.5 × baseline` but milestone still crossed. Trajectory is decelerating; flag honestly. |

If velocity data is unavailable (A2 failed for this repo), use shape `UNKNOWN` and omit the velocity line in A6.

### A6. Send the crossing notification

Only when A4 gate **f** passed (and not `DRY_RUN`). Use this exact structure via `./notify` — do not compress; the message goes to a Telegram group and must stand on its own:

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
- `${eta_date}` — `today + (next_M - STARS) / max(v7/7, 0.5)` rounded to a date. If TRICKLE or pace < 0.5/day, write *"no projection — pace too slow"* instead of an inflated date. (This is the quick, stargazer-velocity footer projection; Phase B produces the detailed, launch-window-gated projection.)
- **Highlights**: cap at 3. Source from `memory/logs/YYYY-MM-DD.md` last 14 days, sections like `## Push Recap`, `## Feature Built`, `## Repo Article`, `## Repo Actions`, `## Changelog`. Each highlight must include a verb, a concrete noun, and a delta or specificity (count, PR/issue number, name). Reject vague items like "improved docs" — rewrite as "Added 3 sections to README (PR #N)" or drop. If logs are empty, fall back to `gh api repos/$REPO/commits?since=<14d-ago> --jq '.[].commit.message'` and pick 3 commit subjects that ship value (skip chore/typo).
- If velocity is `UNKNOWN`, replace the `Time to` and `Pace` lines with a single line: *"Velocity data unavailable this run — milestone confirmed by repo count."*
- **`${status_footer}`** — single line, only printed in the log entry (Log section), NOT in the user-facing notification body. Format: `_status: shape=$SHAPE, v7=$N, fake_check=$ok|skip|defer, log_window=$days_d_`

### A7. Auto-dispatch downstream skills

Only reached when A4 gate **f** passed (i.e. the milestone is being announced, not silently recorded as bootstrap/stale/deferred/skipped) and not `DRY_RUN`. A milestone crossed on dead momentum or a suspected fake-star burst is the wrong signal to fire a launch draft on — the silent-record path bypasses dispatch entirely.

Read `memory/topics/milestone-dispatch.json`. If absent, write the seed `{"rules": {}, "dispatched": {}}` atomically (`.tmp` + `mv`) and skip — no dispatch happens until `rules` is populated. Format:

```json
{
  "rules": {
    "aaronjmars/aeon": {
      "500": "product-hunt:showhn"
    }
  },
  "dispatched": {
    "aaronjmars/aeon:500:product-hunt": "2026-06-11T08:15:00Z"
  }
}
```

Each rule value is `skill` or `skill:var` — the optional `:var` is passed through as the dispatched skill's `${var}` (e.g. `product-hunt:showhn` fires the `product-hunt` skill in its Show HN channel, the former standalone `product-hunt:showhn`). For the current repo + announced milestone `M`:

a. Look up `rules["${REPO}"]["${M}"]` (key is the threshold integer as a string). If absent → skip (most milestones have no downstream skill). Split the value on the first `:` → `SKILL` (before) + `DISPATCH_VAR` (after, empty if no colon).
b. Check `dispatched["${REPO}:${M}:${SKILL}"]`. If present → already fired previously; do nothing. **Re-runs at higher star counts must NOT re-dispatch.** (Gate A4a already prevents re-entry once `M` is recorded in `milestones.md`, but this is a second guard — milestones.md is hand-editable and git-revertable.)
c. Otherwise fire-and-forget:
   ```bash
   gh workflow run aeon.yml -f skill="${SKILL}" -f var="${DISPATCH_VAR}"
   ```
   On success, set `dispatched["${REPO}:${M}:${SKILL}"]` to the current UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) and write the file atomically (`.tmp` + `mv`) so a mid-write crash can't corrupt prior records. Do not wait or poll — the dispatched skill's own `./notify` delivers its outcome separately.
d. On dispatch failure (gh non-zero, rate limit, permission denied), DO NOT write the dispatched flag. Send a single follow-up notification:
   ```
   star-milestone: ${REPO} crossed ${M} but auto-dispatch of ${SKILL} failed.
   Run manually: gh workflow run aeon.yml -f skill=${SKILL}
   ```
   One attempt, one notification on failure. Gate A4a will prevent auto-retry on the next run — operator dispatches manually if they want it.

**Constraints:**
- **Idempotent.** The `dispatched` map plus gate A4a make this safe to re-run — a second pass at 502⭐ never fires `product-hunt:showhn` a second time.
- **Operator-editable.** Rules are added/removed by hand; the skill only writes to `dispatched`. Adding `"aaronjmars/foo": {"1000": "celebrate"}` is a one-line edit.
- **Silent on empty rules.** A repo with no rule for any threshold dispatches nothing — behaviour identical to the pre-feature skill.

### A8. Update `memory/topics/milestones.md`

Skip under `DRY_RUN`. Otherwise append the new entry under the repo's section. Create the file with `# Star Milestones` header if absent. Keep entries in ascending threshold order per repo. Format:

```
- ${M} stars — ${today} (${shape_lowercase})
```

For silent records (bootstrap/stale/deferred/skipped), use the corresponding suffix instead of the shape.

---

## Phase B — Momentum projection (time the next crossing for Show HN)

Pure local file I/O — no `gh api`, no curl. Reads the star-count history that `repo-pulse` (and this skill's own crossing-log line) leave in `memory/logs/`, projects the next crossing, and — only inside the launch window — tells the operator when to dispatch `product-hunt:showhn`.

**Data sources (reads):**
- `memory/logs/YYYY-MM-DD.md` for the last 14 days — extract every `- **owner/repo**: stargazers_count=N` line. `repo-pulse` writes these under its `## Repo Pulse` blocks (`stargazers_count=N, forks_count=M`); this skill's own Phase A log line (`- **owner/repo**: stargazers_count=N, milestone=M, shape=$SHAPE`) matches the same pattern, so on days repo-pulse didn't run, the crossing phase still self-feeds a data point into this series.
- Optional fallback: `output/articles/repo-pulse-*.md` if any fork writes them — same regex applies. Logs are the source of truth on the canonical instance.
- `memory/topics/star-momentum-state.json` — prior-run dedup state (created in the preamble if absent).

**Writes:**
- `output/articles/star-momentum-${today}.md` — the per-repo projection report (always written, even when no alert fires; also written under `DRY_RUN`).
- `memory/topics/star-momentum-state.json` — last-alert timestamp per `(repo, target_milestone)` pair (skipped under `DRY_RUN`).
- the consolidated log block (Log section).

### B1. Build the 14-day stargazer series

For each repo in the shared list:

```bash
SERIES=""
for D in $(seq 13 -1 0); do
  DATE=$(date -u -d "${today} - ${D} days" +%Y-%m-%d 2>/dev/null \
      || date -u -j -v-${D}d -f %Y-%m-%d "${today}" +%Y-%m-%d)
  LOG=memory/logs/${DATE}.md
  [ -f "$LOG" ] || continue
  # Extract: - **owner/repo**: stargazers_count=N (repo-pulse or this skill's crossing line)
  STARS=$(grep -oE "\\*\\*${REPO}\\*\\*: stargazers_count=[0-9]+" "$LOG" \
    | grep -oE '[0-9]+$' | head -1)
  [ -z "$STARS" ] && continue
  SERIES="${SERIES}${DATE} ${STARS}\n"
done
```

The result is a `(date, stars)` series sorted ascending, one row per day where a star-count was logged. Days with no entry are simply absent — gaps in the series are fine and do not require interpolation.

If the series has fewer than 4 data points: record this repo's verdict as `INSUFFICIENT_DATA`, write its section in the article anyway, and skip projection.

### B2. Compute deltas and rolling averages

For consecutive `(date_i, stars_i), (date_{i+1}, stars_{i+1})` pairs:
- `delta_i = stars_{i+1} - stars_i`
- Normalize per day: if two log entries are >1 day apart, divide by the gap so a 2-day gap doesn't double-count. (`repo-pulse` runs daily, so most deltas are one-day deltas.)

Compute:
- `current_stars = SERIES[-1].stars`
- `v3 = mean of the last 3 normalized deltas` (or fewer if <3 available). Units: stars/day.
- `v7 = mean of the last 7 normalized deltas` (or fewer if <7 available). Units: stars/day. *(This log-series `v7` is per-day and is distinct from Phase A's stargazer-timestamp `v7`, which is per-week — do not conflate them.)*

If `v7 <= 0` (zero or net-negative growth across the 7-day window): record verdict `STALLED`. Article still writes; no projection, no alert.

### B3. Pick the target milestone

If `OVERRIDE_MILESTONE` is set:
- If `OVERRIDE_MILESTONE <= current_stars` → record verdict `BAD_TARGET`, log `STAR_MOMENTUM_BAD_TARGET: ${REPO} override=${OVERRIDE_MILESTONE} current=${current_stars}`, skip projection.
- Otherwise `target = OVERRIDE_MILESTONE`.

Otherwise: `target = smallest milestone in the shared ladder where milestone > current_stars`.

`gap = target - current_stars`.

### B4. Project the crossing date

```
days_remaining_v7 = ceil(gap / v7)
days_remaining_v3 = ceil(gap / max(v3, 0.5))
projected_date_v7 = today + days_remaining_v7
projected_date_v3 = today + days_remaining_v3
day_of_week_v7   = weekday name of projected_date_v7
day_of_week_v3   = weekday name of projected_date_v3
```

`v7` is the headline projection; `v3` is a faster-bound sanity check. Both go in the article.

### B5. Decide whether to alert

Apply gates in this order. The first gate to fail records the verdict and skips the momentum notify for that repo.

a. **STALLED / INSUFFICIENT_DATA / BAD_TARGET** (from B2 / B1 / B3) → no alert.
b. **Out of window** — if `days_remaining_v7 < 7` OR `days_remaining_v7 > 14` → record `OUT_OF_WINDOW`, no alert. (Under 7d is too late to dispatch `product-hunt:showhn` thoughtfully; over 14d is too far out and trades on noisy projection data.)
c. **Wrong day** — `projected_date_v7` weekday must be Tue, Wed, or Thu. Otherwise record `OFF_DAY`, no alert.
d. **Already alerted** — if `state.alerts.${repo}.${target}.alerted_at` exists AND was set within the last 7 days → record `ALREADY_ALERTED`, no alert.

If all gates pass: verdict `ALERT`. Promote this repo into the momentum notify list.

### B6. Build the article (always — even when zero alerts fire)

Path: `output/articles/star-momentum-${today}.md`. Overwrite if exists.

```markdown
# Star Momentum — ${today}

**Verdict:** ${one of: ALERT — N repo(s) in launch window | NO_ALERTS — 0 repos in launch window today | INSUFFICIENT_DATA across the board}

*Audited ${repo_count} repos · ${alert_count} alerts · projection method: linear extrapolation from 7-day rolling average*

---

## ${repo} — ${current_stars}⭐ → ${target}⭐ in ~${days_remaining_v7}d

| Metric | Value |
|--------|-------|
| Current stars | ${current_stars} |
| Target milestone | ${target} |
| Gap | ${gap} |
| 3-day avg / day | ${v3} |
| 7-day avg / day | ${v7} |
| Days remaining (v7) | ${days_remaining_v7} |
| Projected date (v7) | ${projected_date_v7} (${day_of_week_v7}) |
| Days remaining (v3) | ${days_remaining_v3} |
| Projected date (v3) | ${projected_date_v3} (${day_of_week_v3}) |
| In Show HN window | ${YES — Tue/Wed/Thu inside 7-14d | NO — out of window | NO — off day} |
| Verdict | ${ALERT | OUT_OF_WINDOW | OFF_DAY | ALREADY_ALERTED | STALLED | INSUFFICIENT_DATA | BAD_TARGET} |

### Source data — ${repo}

| Date | Stars | Δ |
|------|-------|---|
| ${date_1} | ${s_1} | — |
| ${date_2} | ${s_2} | ${d_1} |
| ... | | |

(One section per repo. Repos with `INSUFFICIENT_DATA` show the partial series under the metrics table with a one-line note.)

---

## What this means

For each repo with verdict `ALERT`, one short paragraph:

> **${repo}** — ${current_stars}⭐ projected to cross ${target}⭐ on ${projected_date_v7} (${day_of_week_v7}), ${days_remaining_v7} days from today. Pace: ${v7}/day across the last 7 days, ${v3}/day across the last 3. ${day_of_week_v7} is inside the Show HN dispatch window (Tue/Wed/Thu morning). Suggested action: dispatch `product-hunt:showhn` 24-48 hours before ${projected_date_v7} so the post is ready when the milestone lands.

For each repo with verdict `OUT_OF_WINDOW`, one line:

> ${repo}: ${target}⭐ in ~${days_remaining_v7}d — outside the 7-14d launch window. No action.

For `OFF_DAY` / `STALLED` / `INSUFFICIENT_DATA` / `BAD_TARGET`: one line each, same format.

---
*Reads `memory/logs/YYYY-MM-DD.md` repo-pulse (and star-milestone crossing) blocks. Pure local file I/O. Companion to Phase A (post-crossing celebration) and `product-hunt:showhn` (the launch artifact this signal times).*
```

### B7. Momentum notify (only on ALERT)

If `DRY_RUN`: skip notify, log `STAR_MOMENTUM_DRY_RUN`, do not persist state.

If `alert_count == 0`: log `STAR_MOMENTUM_NO_ALERTS`, **do not notify** (no signal = silence).

If `alert_count >= 1`: send one notification per alerting repo (this is distinct from any Phase A crossing notification — Phase A celebrates the milestone just passed; this times the *next* one):

```
*Star Momentum — ${today} — ${repo}*

${current_stars}⭐ projected to cross ${target}⭐ on ${projected_date_v7} (${day_of_week_v7}) — ${days_remaining_v7} days from today.

Pace:
- 7-day avg: ${v7}/day
- 3-day avg: ${v3}/day
- Gap: ${gap} stars

${projected_date_v7} is a ${day_of_week_v7} — inside the Show HN dispatch window (Tue/Wed/Thu morning).

Suggested action: dispatch \`product-hunt:showhn\` 24-48 hours before ${projected_date_v7} so the post is ready when the milestone lands.

Article: output/articles/star-momentum-${today}.md
```

Cap each message at ~2500 chars. Notifications fan out via `./notify` (Telegram/Discord/Slack — whichever are configured).

### B8. Persist state

Skip under `DRY_RUN`. Otherwise write `memory/topics/star-momentum-state.json`:

```json
{
  "last_run_at": "${ISO timestamp}",
  "alerts": {
    "${repo}": {
      "${target_milestone}": {
        "first_seen_in_window_at": "${ISO}",
        "alerted_at": "${ISO or null}",
        "projected_date_v7": "${YYYY-MM-DD}",
        "v7_at_alert": ${v7}
      }
    }
  }
}
```

State invariants:
- `first_seen_in_window_at` is set the first run a `(repo, milestone)` pair enters the 7-14d window. Persists across runs while the pair stays in-window.
- `alerted_at` is set the run the notification fires. Stays set for 7 days; subsequent runs see `ALREADY_ALERTED` and skip notify.
- After 7 days `alerted_at` ages out — if the milestone still hasn't been crossed and the projection still lands in-window on a Tue/Wed/Thu, the alert re-fires as a periodic reminder.
- When `current_stars >= target` (milestone crossed), drop that entry from `alerts.${repo}` next run — Phase A will emit the celebratory crossing notification, and this phase's job for that target is done.

Cap to last 20 milestone entries per repo to bound the file.

---

## Log — consolidate under one heading

Append **one** block per run to `memory/logs/${today}.md` under a single `### star-milestone` heading (the health loop parses this shape). Lead with a discriminator line naming what ran, then the Phase A and Phase B details. **Always emit the `- **owner/repo**: stargazers_count=N` line for each audited repo** — Phase B's series parser reads it on future runs.

```
### star-milestone
- **Mode**: crossing+momentum | dry-run | repo-scoped=owner/repo | override=N
- **Repos audited**: ${repo_count}

Phase A — crossing:
- **owner/repo**: stargazers_count=N, milestone=M, shape=$SHAPE
- **Velocity (stargazer)**: v7=$N/wk, v30=$N, baseline=$N/day, days_since_last_star=$N
- **Δprior**: $N days from ${prev_M} (prior gap was $N days)
- **Highlights used**: $N (source: logs|commits)
- **Crossing notification sent**: yes / no — ${reason}
- **Dispatched**: ${SKILL} | none | FAILED — ${reason}
- **Status**: STAR_MILESTONE_OK | STAR_MILESTONE_QUIET | STAR_MILESTONE_DEFERRED | STAR_MILESTONE_DEGRADED

Phase B — momentum:
- **owner/repo**: ${verdict} — ${current_stars}⭐ → ${target}⭐ in ~${eta}d (${projected_date_v7}, ${day_of_week_v7})
- **Velocity (log-series)**: v7=$N/day, v3=$N/day, gap=$N
- **Alerts sent**: ${alert_count}
- **Article**: output/articles/star-momentum-${today}.md
- **Momentum notification sent**: yes — N alerts | no — STAR_MOMENTUM_NO_ALERTS | no — dry-run
- **Status**: STAR_MOMENTUM_OK | STAR_MOMENTUM_NO_ALERTS | STAR_MOMENTUM_DRY_RUN | STAR_MOMENTUM_NO_REPOS | STAR_MOMENTUM_BAD_VAR | STAR_MOMENTUM_BAD_TARGET
```

`STAR_MILESTONE_DEGRADED` means the repo count succeeded but stargazer-velocity data didn't — distinguishes a partial run from a clean miss. Include a repo's `stargazers_count` line even when Phase A only bootstraps/records silently.

## Exit taxonomy

| Status | Phase | Meaning | Notify? |
|--------|-------|---------|---------|
| `STAR_MILESTONE_OK` | A | A milestone was announced this run | Yes (crossing message) |
| `STAR_MILESTONE_QUIET` | A | Below the first threshold, or no new crossing to announce | No |
| `STAR_MILESTONE_DEFERRED` | A | Crossing recorded `(deferred)` on a suspected fake-star burst | No |
| `STAR_MILESTONE_DEGRADED` | A | Repo count succeeded but stargazer-velocity fetch failed (shape UNKNOWN) | Only if a crossing still qualifies |
| `STAR_MILESTONE_NO_REPOS` | shared | Watched-repos list empty after filtering agent repos | No |
| `STAR_MOMENTUM_OK` | B | At least one repo passed every launch-window gate | Yes (one message per alerting repo) |
| `STAR_MOMENTUM_NO_ALERTS` | B | Article wrote, but no repo cleared all gates | No |
| `STAR_MOMENTUM_DRY_RUN` | B | `var=dry-run` mode | No (article still writes; no state mutation) |
| `STAR_MOMENTUM_BAD_VAR` | shared | `${var}` had a non-empty, unparseable token | No (exits before work) |
| `STAR_MOMENTUM_BAD_TARGET` | B | Integer override ≤ current stars for a repo | No |

## Edge cases

- **Multiple milestones crossed in one run** — see A4e. Highest only; intermediates `(skipped)`.
- **Unstars dropping count below a recorded milestone** — never un-record. Once written, milestones stay forever.
- **Repo deleted / 404** — log the error for that repo and continue with the rest of the list. Do not fail the whole run; emit `STAR_MILESTONE_DEGRADED` for that repo.
- **Brand-new repo with `STARS == M_first` (e.g. 25)** — bootstrap rule (A4b) handles it: silent record, no notification on first run.
- **Empty highlight reel after both log and commit fallback** — drop the highlights block entirely. Send the crossing notification without it rather than padding with filler.
- **Fewer than 4 log data points for a repo** — Phase B verdict `INSUFFICIENT_DATA`; article still writes its section. Phase A is unaffected (it uses the live count, not the log series).
- **Both phases fire for the same repo in one run** — expected and intended: Phase A celebrates the milestone just crossed; Phase B times the next un-crossed one. They target different milestones, so they don't duplicate.

## Sandbox note

- **Phase A** uses `gh api` and `gh workflow run`, which handle auth via the workflow's `GITHUB_TOKEN` — no env-var curl workaround needed. The stargazer pagination call is the only network-heavy step; if it fails, fall through to `UNKNOWN` shape rather than aborting. Auto-dispatch (A7) uses the gh CLI's internal auth — no separate token plumbing.
- **Phase B** is pure local file I/O — no curl, no `gh api`, no env-var-in-headers, no prefetch script. Every read is a directory listing, file-existence check, or grep over `memory/logs/`. Every write goes to `output/articles/`, `memory/topics/`, or `memory/logs/`. Works in the GitHub Actions sandbox without any network workarounds.
- `./notify` fans out to every configured channel and is already sandbox-safe — it stages to `.pending-notify/` and the workflow re-delivers any that failed in-sandbox after the run.

## Constraints

- **Never spam.** A milestone announced without velocity context is worse than no announcement — it trains readers to mute the channel. Honor the stale-suppression and fake-star-defer gates strictly. A momentum alert only fires inside the launch window (both the 7-14 day projection AND the Tue/Wed/Thu landing gate must pass).
- **Never inflate.** If Phase A `v7` is below baseline, label the shape **TRICKLE** honestly rather than wording around it. Credibility compounds.
- **Per-milestone dedup (momentum).** Once an alert fires for `(repo, target_milestone)` it stays silent for 7 days. Even if pace shifts, the operator already has the signal — re-pinging adds noise without information.
- **Linear extrapolation only (momentum).** No regression, no exponential model, no S-curve fitting. The goal is to convert today's pace into a date, not to forecast trajectory-shape changes. If pace shifts, the alert simply fires (or doesn't) on a different day.
- **Ignores agent repos.** `aeon-agent` and `*-aeon` repos are filtered upfront in both phases — infrastructure mirrors, not project repos with growth narratives worth anchoring a launch around.
- **Read-only across past `memory/logs/`.** Phase B never edits past log files; it parses them. Today's log is the only target it appends to.
- **Article writes regardless.** Even on `NO_ALERTS` (or `DRY_RUN`) the momentum article still writes — operators or other skills may read it for projection context without a notification firing.
- **Idempotent.** Same-day reruns overwrite the article and the state's `last_run_at`; per-`(repo, milestone)` `alerted_at` timestamps and the `dispatched` map persist so re-runs never double-fire a notification or a dispatch.
- **Preserve milestones.md format.** Other skills (e.g. reflect's retro) may parse this file — append, don't restructure.
