---
name: star-momentum-alert
description: Project the date a watched repo crosses its next star milestone — alert only when projected date lands inside the Show HN dispatch window (7-14 days out, Tue/Wed/Thu)
var: ""
tags: [meta, growth]
---
> **${var}** — Optional. Pass `dry-run` to skip the notification (article still writes, log still appends). Pass a positive integer to override the auto-picked milestone (e.g. `var=500`). Empty = audit every watched repo and auto-pick the next un-crossed ladder rung.

Today is ${today}. Convert the last 14 days of `repo-pulse` star-count data into a projected date for the next milestone crossing, and surface a single decision-ready alert: when should the operator dispatch `show-hn-draft` so the launch lands at the milestone moment?

The skill answers a question `star-milestone` and `repo-pulse` cannot. `star-milestone` celebrates a crossing **after** it happens. `repo-pulse` reports today's deltas. Neither tells the operator "the next milestone is on a Wednesday 9 days from now — that's the launch slot." Without that lead-time signal, the milestone passes reactively, and a dispatch-ready Show HN draft sits unused while the moment slips by.

## Why this exists

`show-hn-draft` shipped May 1 (PR #151) as a `workflow_dispatch` skill. Its launch checklist requires Tue–Thu morning timing. Today there is no signal that tells the operator "the milestone you wanted to anchor the launch around is 9 days out, on a Wednesday — dispatch now so the post is ready Tuesday." This skill provides that signal — and only that signal. It is silent on every other day. The dispatch decision still belongs to the operator; this skill just makes the timing legible.

## Config

No new secrets. No new env vars. No new state file beyond `memory/topics/star-momentum-state.json` for prior-run dedup. No outbound HTTP — pure local file I/O over `memory/logs/` and `memory/topics/`.

Reads:
- `memory/watched-repos.md` — repos to track. Skip lines containing `aeon-agent` or ending in `-aeon` (agent repos, not project repos).
- `memory/logs/YYYY-MM-DD.md` for the last 14 days — extract the `**owner/repo**: stargazers_count=N, forks_count=M` lines that `repo-pulse` writes under its `## Repo Pulse` blocks.
- Optional fallback: `articles/repo-pulse-*.md` if any fork writes them — same regex applies. Logs are the source of truth on the canonical instance.
- `memory/topics/star-momentum-state.json` — prior-run dedup state.

Writes:
- `articles/star-momentum-${today}.md` — the per-repo projection report (always written, even when no alert fires).
- `memory/topics/star-momentum-state.json` — last-alert timestamp per `(repo, target_milestone)` pair.
- `memory/logs/${today}.md` — log block.

## Milestone ladder

```
50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 25000, 50000, 100000
```

Same ladder as `star-milestone` so the two skills agree on which numbers count as round-number moments worth marking.

## Steps

### 1. Parse var

- If `${var}` matches `^dry-run` → `MODE=dry-run`. Strip the prefix; remainder is treated as a milestone override.
- Otherwise `MODE=execute`.
- If the remaining var is a positive integer → `OVERRIDE_MILESTONE=$var`. Otherwise `OVERRIDE_MILESTONE=auto`.
- If the remaining var is non-empty and non-numeric → log `STAR_MOMENTUM_BAD_VAR: ${var}` and exit (no notify, no article).

### 2. Load repos

```bash
mkdir -p memory/topics articles
[ -f memory/topics/star-momentum-state.json ] || echo '{"last_run_at":null,"alerts":{}}' > memory/topics/star-momentum-state.json

REPOS=$(grep -oE '^- [a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+' memory/watched-repos.md \
  | sed 's/^- //' \
  | grep -vE '(aeon-agent|-aeon$)' || true)
```

If `REPOS` is empty, log `STAR_MOMENTUM_NO_REPOS` and exit cleanly without notifying.

### 3. Per-repo: build the 14-day stargazer series

For each repo in `REPOS`:

```bash
SERIES=""
for D in $(seq 13 -1 0); do
  DATE=$(date -u -d "${today} - ${D} days" +%Y-%m-%d 2>/dev/null \
      || date -u -j -v-${D}d -f %Y-%m-%d "${today}" +%Y-%m-%d)
  LOG=memory/logs/${DATE}.md
  [ -f "$LOG" ] || continue
  # Extract: - **owner/repo**: stargazers_count=N, forks_count=M
  STARS=$(grep -oE "\\*\\*${REPO}\\*\\*: stargazers_count=[0-9]+" "$LOG" \
    | grep -oE '[0-9]+$' | head -1)
  [ -z "$STARS" ] && continue
  SERIES="${SERIES}${DATE} ${STARS}\n"
done
```

The result is a `(date, stars)` series sorted ascending, one row per day where `repo-pulse` ran. Days with no log entry are simply absent — gaps in the series are fine and do not require interpolation.

If the series has fewer than 4 data points: record this repo's verdict as `INSUFFICIENT_DATA`, write its section in the article anyway, and skip projection.

### 4. Compute deltas and rolling averages

For consecutive `(date_i, stars_i), (date_{i+1}, stars_{i+1})` pairs:
- `delta_i = stars_{i+1} - stars_i`
- (No per-day normalization — `repo-pulse` runs daily, so each delta is a one-day delta. If two log entries are >1 day apart, divide by the gap so a 2-day gap doesn't double-count.)

Compute:
- `current_stars = SERIES[-1].stars`
- `v3 = mean of the last 3 normalized deltas` (or fewer if <3 are available)
- `v7 = mean of the last 7 normalized deltas` (or fewer if <7 are available)

If `v7 <= 0` (zero or net-negative growth across the 7-day window): record verdict `STALLED`. Article still writes; no projection, no alert.

### 5. Pick the target milestone

If `OVERRIDE_MILESTONE` is set:
- If `OVERRIDE_MILESTONE <= current_stars` → record verdict `BAD_TARGET`, log `STAR_MOMENTUM_BAD_TARGET: ${REPO} override=${OVERRIDE_MILESTONE} current=${current_stars}`, skip projection.
- Otherwise `target = OVERRIDE_MILESTONE`.

Otherwise: `target = smallest milestone in the ladder where milestone > current_stars`.

`gap = target - current_stars`.

### 6. Project the crossing date

```
days_remaining_v7 = ceil(gap / v7)
days_remaining_v3 = ceil(gap / max(v3, 0.5))
projected_date_v7 = today + days_remaining_v7
projected_date_v3 = today + days_remaining_v3
day_of_week_v7   = weekday name of projected_date_v7
day_of_week_v3   = weekday name of projected_date_v3
```

`v7` is the headline projection; `v3` is a faster-bound sanity check. Both go in the article.

### 7. Decide whether to alert

Apply gates in this order. The first gate to fail records the verdict and skips notify for that repo.

a. **STALLED / INSUFFICIENT_DATA / BAD_TARGET** (from steps 4 / 3 / 5) → no alert.
b. **Out of window** — if `days_remaining_v7 < 7` OR `days_remaining_v7 > 14` → record `OUT_OF_WINDOW`, no alert. (Under 7d is too late to dispatch `show-hn-draft` thoughtfully; over 14d is too far out and trades on noisy projection data.)
c. **Wrong day** — `projected_date_v7` weekday must be Tue, Wed, or Thu. Otherwise record `OFF_DAY`, no alert.
d. **Already alerted** — if `state.alerts.${repo}.${target}.alerted_at` exists AND was set within the last 7 days → record `ALREADY_ALERTED`, no alert.

If all gates pass: verdict `ALERT`. Promote this repo into the notify list.

### 8. Build the article (always — even when zero alerts fire)

Path: `articles/star-momentum-${today}.md`. Overwrite if exists.

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

> **${repo}** — ${current_stars}⭐ projected to cross ${target}⭐ on ${projected_date_v7} (${day_of_week_v7}), ${days_remaining_v7} days from today. Pace: ${v7}/day across the last 7 days, ${v3}/day across the last 3. ${day_of_week_v7} is inside the Show HN dispatch window (Tue/Wed/Thu morning). Suggested action: dispatch `show-hn-draft` 24-48 hours before ${projected_date_v7} so the post is ready when the milestone lands.

For each repo with verdict `OUT_OF_WINDOW`, one line:

> ${repo}: ${target}⭐ in ~${days_remaining_v7}d — outside the 7-14d launch window. No action.

For `OFF_DAY` / `STALLED` / `INSUFFICIENT_DATA` / `BAD_TARGET`: one line each, same format.

---
*Reads `memory/logs/YYYY-MM-DD.md` repo-pulse blocks. Pure local file I/O. Companion to `star-milestone` (post-crossing celebration) and `show-hn-draft` (the launch artifact this signal times).*
```

### 9. Notify (only on ALERT)

If `MODE == dry-run`: skip notify, log `STAR_MOMENTUM_DRY_RUN`, exit.

If `alert_count == 0`: log `STAR_MOMENTUM_NO_ALERTS`, **do not notify** (no signal = silence).

If `alert_count >= 1`: send one notification per alerting repo.

```
*Star Momentum — ${today} — ${repo}*

${current_stars}⭐ projected to cross ${target}⭐ on ${projected_date_v7} (${day_of_week_v7}) — ${days_remaining_v7} days from today.

Pace:
- 7-day avg: ${v7}/day
- 3-day avg: ${v3}/day
- Gap: ${gap} stars

${projected_date_v7} is a ${day_of_week_v7} — inside the Show HN dispatch window (Tue/Wed/Thu morning).

Suggested action: dispatch \`show-hn-draft\` 24-48 hours before ${projected_date_v7} so the post is ready when the milestone lands.

Article: articles/star-momentum-${today}.md
```

Cap each message at ~2500 chars. Notifications fan out via `./notify` (Telegram/Discord/Slack — whichever are configured).

### 10. Persist state

Write `memory/topics/star-momentum-state.json`:

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
- When `current_stars >= target` (milestone crossed), drop that entry from `alerts.${repo}` next run — `star-milestone` will emit the celebratory crossing notification, and this skill's job for that target is done.

Cap to last 20 milestone entries per repo to bound the file.

### 11. Log to `memory/logs/${today}.md`

```
## Star Momentum
- **Skill**: star-momentum-alert
- **Repos audited**: ${repo_count}
- **Per-repo verdicts**:
  - ${repo}: ${verdict} — ${current_stars}⭐ → ${target}⭐ in ~${eta}d (${projected_date_v7}, ${day_of_week_v7})
- **Alerts sent**: ${alert_count}
- **Article**: articles/star-momentum-${today}.md
- **Notification sent**: ${yes — N alerts | no — STAR_MOMENTUM_NO_ALERTS | no — dry-run}
- **Status**: ${STAR_MOMENTUM_OK | STAR_MOMENTUM_NO_ALERTS | STAR_MOMENTUM_DRY_RUN | STAR_MOMENTUM_NO_REPOS | STAR_MOMENTUM_BAD_VAR}
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `STAR_MOMENTUM_OK` | At least one repo passed every gate | Yes (one message per alerting repo) |
| `STAR_MOMENTUM_NO_ALERTS` | Article wrote, but no repo cleared all gates | No |
| `STAR_MOMENTUM_DRY_RUN` | `var=dry-run` mode | No (article still writes) |
| `STAR_MOMENTUM_NO_REPOS` | Watched-repos list empty after filtering agent repos | No |
| `STAR_MOMENTUM_BAD_VAR` | `${var}` was non-empty, non-numeric, non-`dry-run` | No |

## Sandbox note

Pure local file I/O — no curl, no `gh api`, no env-var-in-headers, no prefetch script. Every read is a directory listing, file existence check, or grep over `memory/logs/`. Every write goes to `articles/`, `memory/topics/`, or `memory/logs/`. Works in the GitHub Actions sandbox without any of the network workarounds other skills need. The only outbound call is `./notify` itself, which is already sandbox-safe (postprocess-notify pattern).

## Constraints

- **Only fires inside the launch window.** Both gates (7-14 day projection AND Tue/Wed/Thu landing) must pass. A 5-day projection is too late to dispatch `show-hn-draft` thoughtfully; a 21-day projection is too far out and trades on noisy projection data.
- **Per-milestone dedup.** Once an alert fires for `(repo, target_milestone)` it stays silent for 7 days. Even if pace shifts, the operator already has the signal — re-pinging adds noise without adding information.
- **Linear extrapolation only.** No regression, no exponential model, no S-curve fitting. The goal is to convert today's pace into a date, not to forecast trajectory shape changes. If pace shifts, the alert simply fires (or doesn't) on a different day.
- **Ignores agent repos.** `aeon-agent` and `*-aeon` repos are filtered upfront; they are infrastructure mirrors, not project repos with growth narratives worth anchoring a launch around.
- **Read-only across `memory/logs/`.** This skill never edits past log files; it parses them. Today's log is the only target it appends to.
- **Article writes regardless.** Even on `NO_ALERTS` the article still writes — operators or other skills may read it for projection context without needing a notification to fire.
- **Idempotent.** Same-day reruns overwrite the article and the state's `last_run_at`; per-`(repo, milestone)` `alerted_at` timestamps persist so re-runs don't double-fire.
