---
name: Vuln Tracker
description: Daily status check on every PR / advisory / queued draft produced by vuln-scanner — surfaces merges, stale opens, maintainer responses needing reply, and queued-too-long carve-outs
var: ""
tags: [meta, security, github]
depends_on: [vuln-scanner]
---

Today is ${today}. Audit the lifecycle status of every disclosure `vuln-scanner` has produced. Read `memory/MEMORY.md` for context.

## Why this skill exists

`vuln-scanner` opens a PR (or queues a draft) and moves on. Without a follow-up loop, three things rot silently:

- **Merged-but-uncelebrated wins** — landed fixes never make it into self-review / weekly-review without manual aggregation.
- **Maintainer questions on open PRs** — a maintainer comments asking for a clarification; if the bot doesn't see it, the PR ages out.
- **Queued drafts past their disclosure window** — entries with `channel: "skipped"` (no-safe-channel) vanish into `vuln-scanned.json` with no recurring re-probe.

This skill is the daily sweep. It cross-references `memory/vuln-scanned.json` against live GitHub state and surfaces anything the operator should look at.

## Sandbox Note

All data via `gh api` / `gh search` / `gh pr view`. No env-var-authenticated curl, no outbound HTTP from bash. `gh` handles auth internally via `GH_TOKEN`. No prefetch / postprocess scripts needed.

## Steps

### 1. Load the canonical scan history

```bash
jq -c '.scans[]' memory/vuln-scanned.json 2>/dev/null
```

If `memory/vuln-scanned.json` doesn't exist or has no `scans` array, log `VULN_TRACKER_SKIP: no scan history` and exit cleanly (no notification — first runs of `vuln-scanner` haven't happened yet).

Each scan entry has at minimum: `repo`, `scanned_at`, `findings`, `channel`, `severity`. Public-PR entries also have `pr` (URL). Pending-disclosure entries have `draft_at` and `patch_branch`. Skipped entries have `reason`.

**Retro-active coverage:** if the JSON was written after vuln-scanner started running, some PRs won't be in the JSON. Pull all bot-authored security PRs from GitHub directly (next step) to fill the gap.

### 2. Pull all bot-authored security PRs from GitHub

`vuln-scanner` opens PRs with **title prefix `fix(security):`** and **branch prefix `security/`**. Title prefix is the more reliable signal across full history.

`gh search prs --json` does **not** expose `headRefName` — that field is only available via GraphQL. Use title-prefix as primary, GraphQL as optional belt-and-suspenders.

The bot author is whoever the workflow uses (typically `github-actions[bot]` or a dedicated account configured in the workflow). Determine the author from `aeon.yml` or the workflow file; default to whatever account opened the most recent `fix(security):` PR you can find.

**Primary (title prefix, works everywhere):**

```bash
BOT_AUTHOR="<resolved bot author>"
gh search prs --author "$BOT_AUTHOR" --json number,title,url,state,createdAt,closedAt,repository --limit 200 \
  | jq '[.[] | select(.title | startswith("fix(security):"))]'
```

**Optional (GraphQL, picks up branch-prefix-only PRs without `fix(security):` title):**

```bash
gh api graphql -f query='
{
  search(query: "author:'"$BOT_AUTHOR"' is:pr sort:created-desc", type: ISSUE, first: 100) {
    nodes { ... on PullRequest {
      number title url state createdAt closedAt mergedAt
      repository { nameWithOwner }
      headRefName
    }}
  }
}' | jq '[.data.search.nodes[]
    | select((.headRefName // "") | startswith("security/"))]'
```

Union the two result sets, dedup by URL.

Cross-reference with `vuln-scanned.json`:
- PR present in JSON → use JSON's `severity` / `cwe` / `note` for the row.
- PR not in JSON → mark as `pre-history`; fill severity from the PR title if obvious.
- JSON entry with `channel != "public-pr"` → no PR to fetch; goes in the "queued" / "skipped" sections.

### 3. Fetch live state for each open PR

For each open PR (state from step 2):

```bash
gh pr view "$REPO/$NUM" --json state,merged,closedAt,createdAt,reviews,comments,reviewDecision,author
```

Per-PR signals:
- **Maintainer-needs-answer**: any comment whose `author.login != $BOT_AUTHOR` posted **after** the most recent comment by `$BOT_AUTHOR` (or after PR creation if the bot hasn't commented). Also `reviewDecision == "CHANGES_REQUESTED"` always counts.
- **Stale-no-review**: `state == "OPEN"` AND no review AND no maintainer comment AND `createdAt` > 7d ago.
- **Aging-with-engagement**: `state == "OPEN"` AND any maintainer activity AND open > 14d.

If a scan entry has `advisory_ids` (one or more GHSA IDs), check each one's published state:

```bash
gh api "repos/$ORIGIN_REPO/security-advisories/$GHSA_ID" --jq '.state // "not found"'
```

`state == "published"` → public advisory visible. 404 → osv-scanner referenced it but the upstream repo never published its own advisory.

### 4. Fetch star counts for every secured repo

For every unique `repo` across the union from step 2 (JSON history + bot-authored security PRs):

```bash
gh api "repos/$REPO" --jq '{stars: .stargazers_count, archived: .archived}' 2>/dev/null
```

**Refetch every run.** Do NOT carry star counts forward from the previous `memory/topics/vuln-followup.md` — per-repo counts drift between runs and the secured-stars headline is the operator's load-bearing metric. Cache only within a single run, keyed by `nameWithOwner`, so a repo with multiple PRs is fetched once.

Repo-state handling:
- **200 with stars**: use `.stargazers_count` (raw integer).
- **200 with `archived: true`**: still use the star count, but suffix the repo cell with ` (archived)` so the operator knows the maintainer isn't responsive.
- **404 / 403**: repo was deleted, renamed, or made private. Record `null` and render as `repo-deleted`. Exclude from `total_stars_*` aggregates entirely so dead repos don't quietly zero out the totals.
- **Other non-2xx**: record `null` and render `★?`. Flag in the run log for operator follow-up.

These per-repo counts power both the **Stars Secured** aggregate (step 5) and the `Stars` column on every per-repo table in step 6.

### 5. Re-probe `channel: "skipped"` and `channel: "pending-disclosure"` repos

For each historical entry where the disclosure couldn't ship, re-check whether the situation changed:

- **`channel: "skipped"`** with `reason` containing "no PVR":
  ```bash
  PVR_NOW=$(gh api "repos/$REPO/private-vulnerability-reporting" --jq .enabled 2>/dev/null || echo "false")
  ```
  If `PVR_NOW=true` and the original was `false`, surface as **newly-actionable**.
- **`channel: "skipped"`** with `reason` containing "no SECURITY.md" — re-check `gh api repos/$REPO/contents/SECURITY.md` and `.github/SECURITY.md`. If now present, surface as **newly-actionable**.
- **`channel: "pending-disclosure"`** — cross-reference with `memory/pending-disclosures/` to see if the draft is still on disk. If the file is gone but the JSON entry says `pending-disclosure`, mark as `lost-draft` so it stops being escalated forever.

### 6. Categorize every entry

| Status | Meaning |
|---|---|
| `merged` | PR merged. One-time celebration — drop from notifications after 30d. |
| `open-clean` | PR open, no maintainer activity yet, < 7d old. Wait. |
| `needs-answer` | Maintainer commented or requested changes. **Operator action.** |
| `stale-no-review` | Open > 7d, zero maintainer activity. Consider polite ping or close. |
| `aging-engaged` | Open > 14d with engagement. Operator should triage. |
| `closed-no-merge` | PR closed without merging. Capture the reason for review. |
| `queued` | `pending-disclosure` draft on disk, not yet shipped. |
| `skipped-rechecked` | Channel was "skipped" originally; re-probe still shows no channel. |
| `newly-actionable` | Skipped originally; PVR or SECURITY.md now present. **Operator action.** |
| `lost-draft` | JSON says pending-disclosure but draft file is gone. Display once, then suppress. |
| `pre-history` | PR found via search but predates `vuln-scanned.json`. Fill what we can. |

### 7. Update `memory/topics/vuln-followup.md`

Rewrite (don't append — this file is a living dashboard, not a log).

The **Stars Secured** block goes at the top so the operator sees aggregate impact before drilling into rows. `total_stars_secured` = sum of stargazers across every unique repo where vuln-scanner has landed at least one merged PR. `total_stars_in_flight` = sum across repos with an open PR. `total_stars_tracked` = sum across the full union. Track all three because celebration uses `secured`, prioritization uses `in_flight`, and historical review uses `tracked`.

Round star counts to abbreviated form for the headline (12.4k, 1.8k, 940). Keep raw integers in the per-repo tables so sort/diff stays exact.

```markdown
# Vuln Tracker Status

*Last updated: ${today}*

## Stars Secured

- **Merged-PR repos (secured):** ★ <total_stars_secured> across <secured_repo_count> repos
- **Open-PR repos (in flight):** ★ <total_stars_in_flight> across <in_flight_repo_count> repos
- **All tracked repos:** ★ <total_stars_tracked> across <total_repo_count> repos

### Secured leaderboard — every merged PR ranked by repo stars
| Rank | Repo | Stars | PR | Merged | Severity | Title |
|------|------|-------|----|--------|----------|-------|

### Per-repo breakdown — secured (sorted by stars desc)
| Repo | Stars | Merged PRs | First merge | Latest merge | Severities landed |
|------|-------|------------|-------------|--------------|-------------------|

### Per-repo breakdown — in flight (sorted by stars desc)
| Repo | Stars | Open PRs | Oldest open | Severities open |
|------|-------|----------|-------------|-----------------|

### Per-repo breakdown — queued / skipped / closed (sorted by stars desc)
| Repo | Stars | Status | Severity | Note |
|------|-------|--------|----------|------|

## Operator-action queue

### Needs answer (<count>)
| Repo | Stars | PR | Title | Last activity | Latest commenter |
|------|-------|----|----|--------------|------------------|

### Newly actionable — channel opened up since the original scan (<count>)
| Repo | Stars | Original date | Original blocker | Now |
|------|-------|---------------|------------------|-----|

### Stale or aging
| Repo | Stars | PR | Age | Status | Suggested action |
|------|-------|----|----|-----|------------------|

## Recently merged (last 30d, <count>)
| Date merged | Repo | Stars | PR | Severity | Title |
|-------------|------|-------|----|----------|-------|

## Open / clean (no operator action — wait, < 7d) (<count>)
| Repo | Stars | PR | Severity | Opened | Age |
|------|-------|----|----------|--------|-----|

## Closed without merge (last 30d, <count>)
| Date | Repo | Stars | PR | Severity | Title | Likely reason |
|------|------|-------|----|----------|-------|---------------|

## Queued (no PR yet) (<count>)
| Severity | Repo | Stars | Original channel | Original blocker | Days queued |
|----------|------|-------|------------------|------------------|-------------|

## Lost-draft ghosts (suppressed from notifications)
| Date | Repo | Stars | Severity |
```

### 8. Decide whether to notify

**Skip notification** if all are true:
- Zero `needs-answer`
- Zero `newly-actionable`
- Zero items moved to `merged` since the last run
- Zero items moved to `closed-no-merge` since the last run
- Zero items aged into `stale-no-review` or `aging-engaged` since the last run

To detect "since last run," diff today's categorization against the previous `memory/topics/vuln-followup.md`. If the file doesn't exist (first run), treat all entries as new and notify the full backlog.

### 9. Format notification (when sending)

Write to `.pending-notify-temp/vuln-tracker-${today}.md`, then `./notify -f`:

```
*Vuln Tracker — ${today}*

★ secured: <total_stars_secured> across <secured_repo_count> repos  (in flight: <total_stars_in_flight> / <in_flight_repo_count>)

needs answer: <N>
<repo> (★<stars>) #<num> — <latest_commenter>: "<comment_excerpt_first_120_chars>"

newly actionable: <N>
<repo> (★<stars>, queued <days>d) — <what_changed>

merged this week: <N>  <list_with_stars>
opened, waiting: <N>
stale: <N>
queued: <N> (<critical>C / <high>H / <other>M+L)

leaderboard top-3 (PRs by ★): #1 <repo1> ★<s1> (PR #<pr1>) — #2 <repo2> ★<s2> (PR #<pr2>) — #3 <repo3> ★<s3> (PR #<pr3>)

dashboard: memory/topics/vuln-followup.md (full leaderboard inside)
```

Keep under 4000 chars. If it doesn't fit, drop the merged/opened/stale section bodies and keep counts only.

### 10. Log the run

Append to `memory/logs/${today}.md`:

```
## Vuln Tracker
- Scan history: <total_in_json> JSON entries + <pre_history_prs> pre-history PRs = <total> tracked items
- States: <merged> merged / <open_clean> open-clean / <needs_answer> needs-answer / <stale> stale / <aging> aging / <closed> closed / <queued> queued / <skipped> skipped-rechecked / <newly_actionable> newly-actionable
- Stars: ★<total_stars_secured> secured (<secured_repo_count> repos) / ★<total_stars_in_flight> in flight (<in_flight_repo_count> repos) / ★<total_stars_tracked> tracked (<total_repo_count> repos)
- Operator queue this run: <needs_answer + newly_actionable>
- Notification: <sent | skipped (no movement)>
- VULN_TRACKER_OK
```

## Required Env Vars

- `GH_TOKEN` / `GITHUB_TOKEN` — required. `repo` scope is enough for PR/comment reads and the PVR-state endpoint.

## Notes & related

- **`vuln-scanned.json` schema is loose** — `cwe` may be a string or an array; `advisory_ids` may be present or absent. Handle both.
- **Sibling skill:** `vuln-scanner` produces the records this skill audits. If a parallel `disclosure-tracker` or `pr-tracker` exists in the operator's setup, coordinate via shared `memory/topics/vuln-followup.md` to avoid duplicate escalation.
