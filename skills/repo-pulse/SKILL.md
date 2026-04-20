---
name: repo-pulse
description: Daily report on new stars, forks, and releases for watched repos — with notable-stargazer enrichment and a one-line growth verdict
var: ""
tags: [dev]
---
<!-- autoresearch: variation B — sharper output: /events primary input + notable-stargazer enrichment + QUIET/STEADY/ACTIVE/SURGE verdict -->
> **${var}** — Repo (`owner/repo`) to check. If empty, checks all watched repos.

## Config

Reads repos from `memory/watched-repos.md`. Skip any repo whose name ends with `-aeon` or contains `aeon-agent` — those are agent repos, not project repos.

If `${var}` is set and matches `owner/repo`, check only that repo.

## Context

Read `memory/MEMORY.md` and the last **7 days** of `memory/logs/` for previous `stargazers_count` / `forks_count` per repo. Parse lines matching `**owner/repo**: stargazers_count=N, forks_count=M` to reconstruct a per-day series — you'll need it for the rolling-average baseline used in step 5.

## Steps

### 1. Compute the 24h cutoff FIRST

```bash
CUTOFF=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)
export CUTOFF
```
All time filtering uses exactly this timestamp — never "today's date" or "since midnight".

### 2. Fetch current counts (1 call per repo)

```bash
gh api repos/owner/repo --jq '{stargazers_count, forks_count, subscribers_count}'
```
If this call returns non-2xx (404, 403, rate limit), record `source=fail` with the reason and continue to the next repo. Do **not** abort the batch.

### 3. Fetch recent events — primary input

One call per repo covers stargazers, forks, **and releases** for the last ~90 days, newest-first:

```bash
gh api "repos/owner/repo/events?per_page=100" \
  --jq '[.[] | select(.created_at >= env.CUTOFF) | {type, actor: .actor.login, created_at, tag: (.payload.release.tag_name // null), action: (.payload.action // null)}]'
```

Parse the filtered events:
- `WatchEvent` → new stargazer (`actor`). Deduplicate by actor (GitHub only fires one per user).
- `ForkEvent` → new fork. Fork URL = `github.com/{actor}/{repo}`.
- `ReleaseEvent` with `action == "published"` → new release (`tag`).

Record `source=events` for this repo.

**Why `/events` over paginated stargazers?** One call instead of two, and it captures forks + releases in the same response. Events API returns 300 events over 10 pages for up to 90 days — more than enough for a 24h window on typical repos.

### 4. Fallback (rate limit or error)

If step 3 returns non-2xx, fall back to the stargazers two-last-pages technique (events emptiness is NOT a fallback trigger — empty genuinely means no activity):

```bash
STARS=$(gh api repos/owner/repo --jq '.stargazers_count')
LAST_PAGE=$(( (STARS + 99) / 100 ))
PREV_PAGE=$(( LAST_PAGE > 1 ? LAST_PAGE - 1 : 1 ))
gh api "repos/owner/repo/stargazers?per_page=100&page=$PREV_PAGE" \
  -H "Accept: application/vnd.github.star+json" \
  --jq '.[] | select(.starred_at >= env.CUTOFF) | {user: .user.login, starred_at}'
gh api "repos/owner/repo/stargazers?per_page=100&page=$LAST_PAGE" \
  -H "Accept: application/vnd.github.star+json" \
  --jq '.[] | select(.starred_at >= env.CUTOFF) | {user: .user.login, starred_at}'
```
Deduplicate by user. Forks in the fallback path come from:
```bash
gh api "repos/owner/repo/forks?sort=newest&per_page=10" \
  --jq '.[] | select(.created_at >= env.CUTOFF) | {owner: .owner.login, full_name, created_at}'
```
Record `source=stargazers-fallback` for this repo. Releases are skipped in fallback (not critical).

### 5. Enrich stargazers and compute the verdict

**Notable-stargazer lookup** — for each new stargazer in the 24h window, cap **10** lookups per repo to respect rate limits:
```bash
gh api users/{login} --jq '{login, followers, public_repos, bio}'
```
Mark as **notable** if `followers >= 100` OR `public_repos >= 20`. Logins ending in `[bot]` or `-bot` are never notable and are excluded from the handle list entirely.

**Growth verdict** — reconstruct the last 7 days of `stargazers_count` from logs and compute per-day deltas. Let `avg7` = mean of the available daily deltas (use `avg7 = 1` if fewer than 3 days are logged). Let `today_stars` = new stargazers in the last 24h.

| Verdict | Rule (first matching row wins) |
|---------|--------------------------------|
| `SURGE` | `today_stars >= 10` OR `today_stars > 3 * avg7` |
| `ACTIVE` | `today_stars > 1.5 * avg7` |
| `STEADY` | `today_stars >= 1` OR any new fork OR any new release |
| `QUIET` | zero stars, zero forks, zero releases in 24h |

Record the rule that fired so it shows up in the log.

### 6. Decide whether to notify

Send a notification if ANY of:
- ≥1 new stargazer in the last 24h (unstars do not cancel this)
- ≥1 new fork
- ≥1 new release
- First run for this repo (no previous count in logs)

Otherwise print `REPO_PULSE_QUIET` and skip `./notify`.

### 7. Notification — via `./notify`

Format (omit any empty section entirely):
```
*Repo Pulse — ${today}* — [VERDICT]
[owner/repo] — stars X (+N) · forks Y (+M) · releases +R

Notable new stargazers:
github.com/user1 (1.2k followers) | github.com/user2 (450 followers)

Other new stargazers:
github.com/user3 | github.com/user4

New forks:
github.com/user5/repo | github.com/user6/repo

New releases:
v1.2.3 | v1.2.4

Source: events
```

Rules:
- `[VERDICT]` is uppercased, in square brackets, on the header line.
- Handles joined by ` | ` on **one line** — never one per line.
- Round follower counts: `<1000` → raw number, `1000+` → `1.2k` form.
- Omit `Notable new stargazers`, `Other new stargazers`, `New forks`, `New releases`, or `Source` lines if they would be empty.
- **Never include traffic, watchers, or open issues** — they don't belong in a pulse.
- One message per repo if multiple repos have activity. Batch into a single message only when combined length stays under 1500 chars.

### 8. Log to `memory/logs/${today}.md`

Always include the exact current counts so tomorrow's run can compute deltas:
```
## Repo Pulse
- **owner/repo**: stargazers_count=X, forks_count=Y, source=events
- **New stars (24h):** N (verdict=ACTIVE, avg7=1.4)
- **New forks (24h):** M
- **New releases (24h):** R
- **Notable stargazers:** user1(1200), user2(450)
- **Notification sent:** yes
```
If the repo lookup failed, log:
```
- **owner/repo:** FAILED (<reason>) — counts unchanged
```

## Sandbox note

- `gh api` handles auth internally; prefer it over curl.
- `/repos/{owner}/{repo}/traffic/*` endpoints require **admin** permission and return 403 for the default workflow `GITHUB_TOKEN`. Do **not** attempt them from this skill.
- If `gh api` fails on one repo, log the failure and continue — never abort the whole batch.

## Constraints

- A day with zero stars, zero forks, zero releases is `QUIET` — print `REPO_PULSE_QUIET` and do not notify.
- Never promote a bot account to "notable", even if it clears the follower threshold.
- Keep the verdict vocabulary fixed to `QUIET / STEADY / ACTIVE / SURGE` so downstream skills can grep for it.
