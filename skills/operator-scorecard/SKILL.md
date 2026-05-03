---
name: operator-scorecard
description: Weekly plain-language synthesis of agent health + community growth + economic activity — answers "was this week worth it?" in one notification
var: ""
tags: [meta, productivity]
---

> **${var}** — Optional. Pass `dry-run` to skip the notification (article + JSON spec still write). Pass an integer N to override the window (default 7 days = 168h). Empty = run normally on the 7-day window.

Today is ${today}. Synthesize the last 7 days of agent activity into a single plain-language scorecard the operator can read in 30 seconds. Three paragraphs (agent health / community growth / economic activity) plus a one-line verdict (OK / WATCH / DEGRADED). The point of this skill is to answer the question every operator quietly asks after a week of autonomous runs: **was this week worth it?**

## Why this exists

Every signal needed to answer that question already lives in the repo — `skill-analytics` ranks pass rates, `heartbeat` issues per-run verdicts, `tweet-allocator` totals weekly $AEON spend, `token-report` tracks 7d price delta, `repo-pulse` records star/fork deltas. But each lives in its own article, on its own cadence, in its own format. A new operator (or a returning one) opens five files to assemble the weekly picture. This skill assembles it once on Monday morning and pushes it to the notification channel so the picture is delivered, not fetched.

It is deliberately a synthesis skill, not a measurement skill — every number it prints is sourced from a file another skill already wrote. It introduces zero new APIs, zero new secrets, zero new cron-state. If an upstream skill didn't run, the matching paragraph degrades gracefully ("no data this week") rather than fabricating numbers.

## Config

No new config. No new secrets. Reads:

- `articles/skill-analytics-*.md` — most recent file in window for fleet pass rate + anomaly count
- `articles/heartbeat-*.md` (or `memory/logs/*.md` heartbeat sections) — P0–P3 verdict tally
- `articles/tweet-allocator-*.md` — weekly distributed totals + recipient counts
- `articles/token-report-*.md` — most recent for price + 7d delta
- `articles/repo-pulse-*.md` — daily star/fork delta entries summed across the window
- `memory/MEMORY.md` — last consolidation date + "Skills Built" recent rows for the activity-pulse line
- `memory/issues/INDEX.md` (optional) — open issue count if present

No outbound HTTP. No `gh api` calls. Pure file scanning + arithmetic.

## Steps

### 1. Parse var and resolve window

- If `${var}` matches `^dry-run` → `MODE=dry-run`. Strip the prefix; remainder treated as window override.
- Otherwise `MODE=execute`.
- If the remaining var parses as a positive integer N → `WINDOW_HOURS=N` and `WINDOW_DAYS=$((N / 24))` (round down). Cap at 720h (30 days).
- Otherwise `WINDOW_HOURS=168`, `WINDOW_DAYS=7`.
- Compute `WINDOW_START_DATE` = today minus `WINDOW_DAYS` days (UTC, ISO date).

### 2. Collect agent-health signals

a. **Latest skill-analytics article.** `LATEST_ANALYTICS=$(ls -1t articles/skill-analytics-*.md 2>/dev/null | head -1)`. If found AND its date suffix is within the window → parse the metadata line `*Window: ... · N runs across M skills · X% success · Y anomalies*` for `total_runs`, `distinct_skills`, `success_pct`, `anomaly_count`. If not found (skill-analytics didn't run this window): set all four to `null` and mark `agent_health_source=missing`.

b. **Heartbeat verdicts.** For every heartbeat run logged in the window, scan `memory/logs/YYYY-MM-DD.md` between `WINDOW_START_DATE` and today for `## Heartbeat` sections. Count occurrences of: `P0` / `P1` / `P2` / `P3` / `OK` markers. The simplest first-match wins per heartbeat block: an `OK` block (no P-flags) increments `heartbeat_ok`; any P-flag increments the matching `heartbeat_pX` counter and skips the OK count. If no heartbeat sections found, set counts to zero and mark `agent_health_source=partial`.

c. **Open issues.** If `memory/issues/INDEX.md` exists and contains an `## Open` section with table rows, count rows. Otherwise `open_issues=0` and `issues_source=absent`.

d. **Compute health verdict (paragraph 1):**
- `OK` if `success_pct >= 90` AND `anomaly_count <= 1` AND `heartbeat_p0 == 0` AND `heartbeat_p1 == 0`
- `WATCH` if `success_pct >= 75` AND `heartbeat_p0 == 0` AND (`anomaly_count <= 3` OR `heartbeat_p1 <= 2`)
- `DEGRADED` otherwise
- If `agent_health_source=missing`: emit `INSUFFICIENT_DATA` for this paragraph's verdict (don't pretend OK)

### 3. Collect community-growth signals

a. **Stars + forks delta.** Sum every `articles/repo-pulse-*.md` file with date suffix in window. From each, extract the `New stars (24h)` count and `New forks (24h)` count for each watched repo. Aggregate per-repo totals across the window. The `aaronjmars/aeon` row is the headline; other repos go on a continuation line.

If the file format doesn't contain the canonical fields, fall back to scanning `memory/logs/*.md` for `## Repo Pulse` blocks (older format). If both fail for a given repo: `stars_added=null`, mark `growth_source=partial`.

b. **New contributors.** Parse the most recent `articles/fork-contributor-leaderboard-*.md` if it falls in the window. Extract the count of rows in the `## Top Contributors` table whose `Change` column shows `NEW` or `↑NEW` (first-time appearance this week). If no leaderboard in window: `new_contributors=null`.

c. **Notable mentions.** Scan `articles/repo-article-*.md` and `articles/project-lens-*.md` filenames in window for any title containing milestones-language (regex `(milestone|launch|hit \d+|featured|HN|Show HN|Hacker News)`). If found, capture up to 2 titles for the `Notable` line. Otherwise omit.

d. **Compute growth verdict (paragraph 2):**
- `OK` if `total_stars_added >= 20` OR `new_contributors >= 1` (a real signal of community pull)
- `WATCH` if `total_stars_added >= 5`
- `DEGRADED` if `total_stars_added < 5` AND `new_contributors == 0` AND no notable mentions

### 4. Collect economic-activity signals

a. **$AEON distributed.** Sum every `articles/tweet-allocator-*.md` in the window: extract the `Total distributed: $X.XX in $AEON` line. Track the count of `Paid tweets:` recipients across the window (deduped by handle).

If `articles/distribute-tokens-*.md` exists in the window, also tally any explicit on-chain payouts there. Report both as `$AEON distributed: $X.XX (Y recipients via tweet-allocator + Z via distribute-tokens)`.

b. **Token 7d performance.** Parse the most recent `articles/token-report-*.md`. Extract `Price`, `7d` delta, `30d` delta, `Verdict` (e.g. CONSOLIDATING, BREAKING_OUT, FADING). The skill quotes the `7d` number directly — no math.

If no token-report in window: `economic_source=partial`, omit token line and report only $AEON distributed.

c. **Compute economic verdict (paragraph 3):**
- `OK` if `total_distributed > 0` AND `token_7d_pct >= -10`
- `WATCH` if `total_distributed > 0` AND `token_7d_pct >= -25`
- `DEGRADED` if `total_distributed == 0` (week with $0 spend on community = silent loop) OR `token_7d_pct < -25`

### 5. Roll up to the overall verdict

- Take the worst of the three paragraph verdicts. `DEGRADED` > `WATCH` > `OK`.
- `INSUFFICIENT_DATA` paragraphs do **not** force the overall verdict to DEGRADED — they degrade to `WATCH` (so a partial-data week still flags as worth checking, not ignored).
- The verdict line uses the same vocabulary as `heartbeat`'s P-flags for visual continuity: `🟢 OK` / `🟡 WATCH` / `🔴 DEGRADED`.

### 6. Build the article

Path: `articles/operator-scorecard-${today}.md`. Overwrite if exists (idempotent same-day reruns).

```markdown
# Operator Scorecard — ${today}

**Verdict:** ${verdict_emoji} ${verdict_label} — ${one_line_summary}

*Window: last ${WINDOW_DAYS}d (${WINDOW_START_DATE} → ${today})*

## Agent health

The fleet ran ${total_runs} times across ${distinct_skills} skills with a ${success_pct}% success rate. ${anomaly_count} anomaly flag(s) raised this week. Heartbeat issued ${heartbeat_ok} clean reports and ${heartbeat_p0+p1+p2+p3} flagged reports (P0=${heartbeat_p0} P1=${heartbeat_p1} P2=${heartbeat_p2} P3=${heartbeat_p3}). ${open_issues} open issue(s) in the tracker.

**Verdict:** ${health_verdict}

## Community growth

${watched_repo_1} added ${stars_1} stars and ${forks_1} forks. ${watched_repo_2} added ${stars_2} stars and ${forks_2} forks. ${total_stars_added} stars across the fleet — averaging ${stars_per_day} per day. ${new_contributors} new contributor(s) appeared on the leaderboard. ${notable_line_or_omit}

**Verdict:** ${growth_verdict}

## Economic activity

$AEON distributed: $${total_distributed} across ${recipient_count} recipient(s) via tweet-allocator${distribute_tokens_addendum_or_omit}. Token closed at ${token_price} (${token_7d_pct}% 7d, ${token_30d_pct}% 30d). Verdict on the chart this week: ${token_verdict}.

**Verdict:** ${economic_verdict}

## What was notable

${bullet list of up to 3 entries from MEMORY.md "Skills Built" rows where date is in window — keeps the week's autonomous accomplishments visible}

## Source status

- skill-analytics: ${article_path or "missing this window"}
- heartbeat: ${N runs found in memory/logs}
- repo-pulse: ${N daily articles in window}
- tweet-allocator: ${N daily articles in window} · total: $${total_distributed}
- token-report: ${article_path or "missing this window"}
- fork-contributor-leaderboard: ${article_path or "no leaderboard run in window"}

---
*Companion to skill-analytics (per-skill ranking) and heartbeat (per-run pulse). This skill answers the operator-level question those two don't: "given everything that happened, was this week worth it?" Methodology: every number is sourced from another skill's article — this skill measures nothing itself.*
```

The "What was notable" section reads `memory/MEMORY.md` for rows in the `## Skills Built` table where the `Date` column falls in the window. List up to 3, formatted as `- {Skill} — {one-line summary truncated to ~120 chars}`. If zero new skills built this week, write `- No new skills built this week — agent ran on the existing fleet.`

### 7. Write the dashboard JSON spec

Path: `dashboard/outputs/operator-scorecard.json`. Use the catalog components.

```json
{
  "version": "1",
  "generated_at": "${ISO timestamp}",
  "skill": "operator-scorecard",
  "title": "Operator Scorecard — ${today}",
  "spec": {
    "type": "Stack",
    "props": {"direction": "vertical", "gap": "md"},
    "children": [
      {"type": "Heading", "props": {"level": 2, "children": "Operator Scorecard — ${today}"}},
      {"type": "Alert", "props": {"variant": "${alert_variant}", "children": "${verdict_label} — ${one_line_summary}"}},
      {"type": "Grid", "props": {"columns": 3, "gap": "sm"}, "children": [
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "Agent health"}},
          {"type": "Heading", "props": {"level": 3, "children": "${success_pct}%"}},
          {"type": "Text", "props": {"children": "${total_runs} runs · ${anomaly_count} anomalies"}}
        ]}},
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "Stars added"}},
          {"type": "Heading", "props": {"level": 3, "children": "+${total_stars_added}"}},
          {"type": "Text", "props": {"children": "${total_forks_added} forks · ${new_contributors} new contributors"}}
        ]}},
        {"type": "Card", "props": {"children": [
          {"type": "Text", "props": {"variant": "muted", "children": "$AEON distributed"}},
          {"type": "Heading", "props": {"level": 3, "children": "$${total_distributed}"}},
          {"type": "Text", "props": {"children": "${recipient_count} recipients · token ${token_7d_pct}% 7d"}}
        ]}}
      ]},
      {"type": "Heading", "props": {"level": 3, "children": "Verdicts by lane"}},
      {"type": "Table", "props": {
        "columns": [
          {"key": "lane", "header": "Lane"},
          {"key": "verdict", "header": "Verdict"},
          {"key": "headline", "header": "Headline"}
        ],
        "rows": [
          {"lane": "Agent health", "verdict": "${health_verdict}", "headline": "${health_headline}"},
          {"lane": "Community growth", "verdict": "${growth_verdict}", "headline": "${growth_headline}"},
          {"lane": "Economic activity", "verdict": "${economic_verdict}", "headline": "${economic_headline}"}
        ]
      }}
    ]
  }
}
```

`alert_variant`: `default` for OK, `secondary` for WATCH, `destructive` for DEGRADED.

If the file write fails (filesystem read-only, missing directory), log a warning but do not abort — the article is the canonical artifact, the JSON spec is a dashboard convenience.

### 8. Send notification

If `MODE == dry-run`: skip notify, log `OPERATOR_SCORECARD_DRY_RUN`, exit.

Otherwise call `./notify`:

```
*Operator Scorecard — ${today}*
${verdict_emoji} ${verdict_label} — ${one_line_summary}

Agent health: ${success_pct}% across ${total_runs} runs (${anomaly_count} anomalies, ${heartbeat_ok} clean heartbeats)

Community growth: +${total_stars_added}⭐ +${total_forks_added} forks across ${repo_count} repos${new_contributor_addendum}

Economic activity: $${total_distributed} in $AEON to ${recipient_count} recipients · token ${token_7d_pct}% 7d (${token_verdict})

${notable_addendum_or_omit}

Window: last ${WINDOW_DAYS}d
Full: articles/operator-scorecard-${today}.md
```

`notable_addendum`: if any "What was notable" bullet exists, prefix with `Notable:` and inline the first one only (cap at ~120 chars). If none, omit the line.

Cap message at ~3500 chars (Telegram safe limit). The verdict + three lane lines are the priority — drop "Notable" first if exceeded.

### 9. Log to `memory/logs/${today}.md`

```
## Operator Scorecard
- **Skill**: operator-scorecard
- **Window**: last ${WINDOW_DAYS}d (${WINDOW_HOURS}h)
- **Verdict**: ${verdict_emoji} ${verdict_label}
- **Agent health**: ${success_pct}% success across ${total_runs} runs · ${anomaly_count} anomalies · ${heartbeat_p0+p1} flagged heartbeats · ${open_issues} open issues
- **Community growth**: +${total_stars_added}⭐ +${total_forks_added} forks · ${new_contributors} new contributors
- **Economic activity**: $${total_distributed} in $AEON to ${recipient_count} recipients · token ${token_7d_pct}% 7d (${token_verdict})
- **Article**: articles/operator-scorecard-${today}.md
- **Dashboard**: dashboard/outputs/operator-scorecard.json
- **Notification sent**: ${yes|no — dry-run|no — INSUFFICIENT_DATA}
- **Status**: OPERATOR_SCORECARD_OK | OPERATOR_SCORECARD_QUIET | OPERATOR_SCORECARD_NO_DATA
```

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `OPERATOR_SCORECARD_OK` | scorecard rendered, ≥1 lane has data | Yes |
| `OPERATOR_SCORECARD_QUIET` | dry-run mode | No (article + JSON written, log only) |
| `OPERATOR_SCORECARD_NO_DATA` | every lane returned `INSUFFICIENT_DATA` (fresh fork, never ran any upstream skill) | No (log only, no article overwrite) |

## Sandbox note

Pure local file I/O — no curl, no `gh api`, no env-var-in-headers, no prefetch script. Works in the GitHub Actions sandbox without any of the network workarounds other skills need. The only outbound call is `./notify` itself, which is already sandbox-safe (postprocess-notify pattern).

## Constraints

- **Synthesis-only.** Every number prints from a file another skill wrote. If a source file is missing, the matching lane reports `INSUFFICIENT_DATA` and the skill continues — never fabricate numbers to fill a gap.
- **Three-paragraph contract.** Agent health, community growth, economic activity. In that order. Adding a fourth lane is a separate skill, not a scope creep here.
- **No issue filing.** Anomalies surface in the verdict; persistence and resolution belong to `skill-health`. This skill is read-only across `memory/issues/`.
- **Worst-of-three rollup.** The overall verdict mirrors heartbeat's P-flag vocabulary so operators don't need to learn new terminology.
- **Idempotent.** Same-day reruns overwrite the article and JSON spec. The log entry appends (one block per run) so re-running shows drift.
- **Dry-run honored.** `var=dry-run` never sends a notification — but the article and JSON spec still write, because the dashboard widget refreshes regardless. The dry-run gate is for the operator's inbox, not the artifacts.
- **Window override is a power-user knob.** Default 7d is the contract; passing `var=336` for a 14d retrospective is supported but not advertised in headlines.
