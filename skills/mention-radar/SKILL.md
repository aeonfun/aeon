---
name: mention-radar
description: Monitor external web and social mentions of the operator's active projects - surface what people are discovering, where they're confused, and where to engage
metadata:
  title: Mention Radar
  category: productivity
  commits: false
  var: ""
  tags:
    - social
    - dev
  requires:
    - TWITTER_API_KEY
    - XAI_API_KEY?
---
> **${var}** — Comma-separated project names to track (e.g. "MyApp, my-lib"). If empty, derives targets from MEMORY.md and memory/topics/projects.md.

Read memory/MEMORY.md for current project status.
Read the last 3 days of memory/logs/ to avoid re-surfacing already-noted mentions.

## Steps

1. **Define the targets.**
   - If `${var}` is set: parse it as a comma-separated list of project names.
   - Otherwise: scan `memory/MEMORY.md` (goals, active topics) and `memory/topics/projects.md` (if it exists) for the operator's active projects. A target needs at least a name; collect a site/domain and a GitHub `owner/repo` too when known.
   - Cap at 6 targets — prefer the most active ones.
   - If zero targets can be derived: log `MENTION_RADAR_SKIP: no projects configured — set var or add projects to memory/topics/projects.md` and stop. No notification.

   For each target, build search terms:
   - The exact project name in quotes (e.g. `"MyApp" site:x.com OR site:reddit.com OR site:news.ycombinator.com`)
   - The domain if known (e.g. `"myapp.xyz"`)
   - The repo if known (e.g. `site:github.com owner/myapp`)

2. **Search for external mentions.** X/Twitter is fetched via **twitterapi.io** (**primary**); xAI Grok `x_search` is the fallback; the rest of the public web (Reddit, Farcaster, blogs, newsletters, GitHub Discussions, HN, Product Hunt) goes through WebSearch, which is also the **last-resort fallback** for X itself. Derive the operator's handle from `soul/SOUL.md` if present (call it `$OPERATOR`) so you can exclude their own posts.

   **Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`FROM_DATE=$(date ...)`, `Q="..."`, `HTTP=$(./secretcurl ...)`), uses `if` / `for` / `while` or `[ -n ... ] &&` tests, or joins commands with `;`, `&&` or `||`, and each refusal costs a model turn. So get a date with a bare `date` call and write the printed value into later commands; write each target's name, domain, repo, the operator handle and the dates into each command literally (the `<NAME>`, `<FROM_DATE>` style placeholders in the snippets), jq filters included (a jq `$name` variable from `--arg` is refused, and so is a `>` redirect into a file, so the xAI body is piped straight into `./secretcurl ... --data-binary @-`); loop over targets by making one call per target; run one `jq` per call.

   Get the window dates first, each `date` as its own Bash call:
   ```bash
   date -u -d '7 days ago' +%Y-%m-%d
   ```
   ```bash
   date -u +%Y-%m-%d
   ```
   The first prints FROM_DATE, the second TO_DATE.

   **Path A - twitterapi.io (primary, X/Twitter mentions).** For each target, structured search for other people mentioning the project. See the **Fetching** contract below. Use a unique tmp filename per target if you loop (e.g. `/tmp/tw-mr-<SLUG>.json`). `<NAME>`/`<DOMAIN>`/`<REPO>` come from the target built in step 1, written in literally. Put the date window inside the query with `since:`/`until:`; exclude the operator with `-from:`. `<QUERY>` is `"<NAME>" -from:<OPERATOR> since:<FROM_DATE> until:<TO_DATE>`, then ` OR "<DOMAIN>"` added when the target has a domain and ` OR "<REPO>"` added when it has a repo (leave each out when empty), all written in literally. One call per target:
   ```bash
   ./secretcurl -s -o /tmp/tw-mr.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/tweet/advanced_search" \
     --data-urlencode 'query=<QUERY>' --data-urlencode "queryType=Latest" \
     -H "X-API-Key: {TWITTER_API_KEY}"
   ```
   On `HTTP=200` with a non-empty `.tweets[]`, parse and mark `X_SOURCE=twitterapi`. Drop posts by `$OPERATOR` and the project's own accounts if any slipped through:
   ```bash
   jq -r '.tweets[] | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-mr.json
   ```
   Engagement counts are exact; permalinks are `.url`. `createdAt` is Twitter-native (`Wed Sep 09 20:21:43 +0000 2026`); normalize with `strptime("%a %b %d %H:%M:%S %z %Y")` before any date compare. advanced_search does **not** return `author.followers` - omit follower counts on this path (Path B can supply them).

   **Path B - xAI Grok `x_search` (fallback).** Only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` is unset. See the **Fetching** contract - set the Bash tool `timeout` to ≥180000, and capture the HTTP status. Use a unique tmp filename per target if you loop (e.g. `/tmp/xai-mr-<SLUG>.json`). Build the body with the prompt inline and every value written into the jq filter literally (a `"` inside a value becomes `\"`, and reword any `'`), and pipe it straight into the send:
   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for posts by OTHER people mentioning the project \"<NAME>\" (also its site <DOMAIN> and repo <REPO> when given), posted between <FROM_DATE> and <TO_DATE>. Exclude posts by the operator @<OPERATOR> and by the accounts of the project itself. For each mention return: @handle, the full post text, date, exact engagement counts (likes, retweets, replies; 0 if unknown), the approximate follower count of the poster if visible, and the direct link https://x.com/handle/status/ID. Prioritize people discovering it for the first time, asking confused questions, hitting friction (setup/docs/missing feature), comparing it to a competitor, or requesting a feature. Return a numbered list; if nobody is talking about it, say so explicitly."}], tools:[{type:"x_search",from_date:"<FROM_DATE>",to_date:"<TO_DATE>"}]}' \
     | ./secretcurl -s -o /tmp/xai-mr.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {XAI_API_KEY}" \
     --data-binary @-
   ```
   On `HTTP=200` with a non-empty body, parse `/tmp/xai-mr.json` with `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'` and feed the X mentions into categorization (step 4). Record `X_SOURCE=api`.

   **Path C - WebSearch (broader web + X last resort).** Always use WebSearch for the non-X surfaces - Reddit, Farcaster, personal blogs, newsletters, GitHub Discussions, HN, Product Hunt:
   - Try both brand name and URL variants
   - Time-box to last 7 days where the search engine supports it
   - Skip results from the operator's own accounts and the project's own repos

   WebSearch is **also** the last-resort fallback for X/Twitter, but only when Paths A and B both truly failed (`key-unset`, `http-<code>`, `empty`, or `timeout` - record the real reason per the **Fetching** contract, never "XAI_API_KEY unavailable" / "TWITTER_API_KEY unavailable" when a key was set). On the X fallback query `site:x.com "<project name>" after:${FROM_DATE}`; note in the log that X results came from WebSearch (lower quality) and set `X_SOURCE=websearch`.

3. **Also check GitHub network signals** for each target with a known repo:
   ```bash
   gh api repos/OWNER/REPO --jq '{stars: .stargazers_count, forks: .forks_count, watchers: .watchers_count}'
   ```
   Skip any repo that 404s (private or not yet public). Compare to the last log entry to compute deltas. If no prior data, record as baseline.

4. **Categorize each mention** found:
   - **Discovery** — person found the project for the first time, sharing it, impressed ("this is cool", star notification, share)
   - **Confusion** — person unclear on what it does, asking questions, mischaracterizing it
   - **Friction** — person ran into a problem (setup, docs, missing feature)
   - **Competitor comparison** — mentioned alongside or against a competing project
   - **Feature request / wish** — explicit ask for something missing
   - **Press / newsletter** — cited in a publication or digest

5. **Identify engagement opportunities.** Flag any mention where:
   - The person is confused and a 1-tweet clarification would help
   - A feature request aligns with what's being built
   - A competitor comparison is wrong or incomplete
   - A high-follower account discovered the project (high-leverage reply opportunity)

6. **Format the output** (under 4000 chars):
   ```
   *Mention Radar - ${today}*

   {PROJECT NAME, uppercased}
   - [source] - [what they said] - [category]
   ...
   (one section per target)

   ENGAGEMENT OPPORTUNITIES
   - [handle/source]: [why worth replying]

   QUIET: [project] - no external mentions found
   ```
   Use `QUIET: [project]` for any project with zero external mentions this cycle.
   Skip GitHub-only star delta if it's less than 5 — only mention notable jumps.

7. **Only notify if there's signal.** Skip notification if ALL projects are quiet and no GitHub deltas > 5 stars. Log `MENTION_RADAR_QUIET` instead.

8. **Send via `./notify`** if there's anything worth surfacing.

9. **Log to memory/logs/${today}.md**:
   ```
   ### mention-radar
   - **{project}:** [N mentions / QUIET]
   (one line per target)
   - **Top find:** [best mention in one line, or "none"]
   - **Engagement opps:** [N flagged, or 0]
   - **Notification sent:** yes/no
   ```

## Guidelines

- This is signal filtering, not a metrics report. One real conversation > ten impressions.
- Prioritize quality of mention over quantity. A thoughtful Reddit post or HN comment matters more than a retweet.
- Don't manufacture urgency. If there's nothing worth acting on, say so.
- Be specific — link the source, quote the key line, name the person if identifiable.
- The point is engagement opportunity and awareness, not vanity numbers.

## Fetching

`TWITTER_API_KEY` is **injected into your environment** for this skill (declared in `requires:`). **The primary fetch path for X/Twitter mentions is a direct `curl` to `https://api.twitterapi.io/twitter/tweet/advanced_search` with header `X-API-Key: {TWITTER_API_KEY}`** (step 2, Path A). Grok `x_search` (`XAI_API_KEY`) is the fallback. There is no network sandbox blocking this. Just make the call.

**You MUST attempt twitterapi.io before any X fallback.** The rules:

1. **Check, don't assume.** Read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn): `TWITTER_API_KEY` on that line = `KEY_PRESENT`, not on it = `KEY_UNSET`. If `KEY_PRESENT`, you are required to try Path A.
2. **Capture the HTTP status** so the fallback decision is based on fact. Print `http=<code>` before parsing. `HTTP=200` with a non-empty `.tweets[]` → use it (`X_SOURCE=twitterapi`). Put date windows **inside** the query with `since:YYYY-MM-DD until:YYYY-MM-DD`. `createdAt` is Twitter-native (`Wed Sep 09 20:21:43 +0000 2026`), not ISO - normalize with `strptime("%a %b %d %H:%M:%S %z %Y")` before any date compare.
3. **Path B - xAI Grok `x_search` (fallback).** Only when Path A fails (non-2xx / empty / timeout) or `TWITTER_API_KEY` is unset. Direct `curl` to `https://api.x.ai/v1/responses` with `Authorization: Bearer {XAI_API_KEY}`. The `x_search` call typically takes 30-120s - **set the Bash tool `timeout` to at least 180000 (180s)** and keep **`--max-time 150`** on the curl. A slow curl is **not** a missing key. Build the payload with the `jq -n` filter shown in step 2 Path B (values written in literally) and pipe it straight into the send - a `>` redirect into a file is refused, and the `./secretcurl` command must stay 100% literal (no `$VAR`):
   ```bash
   jq -n '{...}' | ./secretcurl -s -o /tmp/xai-mr.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" -H "Authorization: Bearer {XAI_API_KEY}" --data-binary @-
   ```
   It prints the status code (`HTTP`); `./secretcurl` also prints an `http=... bytes=...` line on stderr. Then parse `/tmp/xai-mr.json` with the standard `jq` extractor. `HTTP=200` with a non-empty body → use it (`X_SOURCE=api`).
4. **Fall back only on a real failure**, and **record the true reason** - never write "XAI_API_KEY unavailable" / "TWITTER_API_KEY unavailable" when a key was set. Use one of: `key-unset` (only if step 1 said `KEY_UNSET`), `http-<code>` (non-2xx), `empty` (200 but no mentions parsed), `timeout` (curl exceeded `--max-time`).

**WebSearch / WebFetch are last-resort fallbacks only** for X - lower quality (WebSearch favours old high-engagement tweets). They remain the primary tool for the non-X web surfaces (Reddit, HN, blogs, etc.). Never reach for the X WebSearch fallback while a key works.

## Environment Variables

- `TWITTER_API_KEY` - twitterapi.io API key (sent as the `X-API-Key` header). Declared in `requires:`, so it is **injected into this skill's environment** and is the **primary** path for X/Twitter mentions.
- `XAI_API_KEY` - X.AI API key for Grok's `x_search` tool. Declared in `requires:` (optional `?`). The **fallback** path when `TWITTER_API_KEY` is unset or twitterapi returns non-2xx / empty / timeout. If both keys are unset, X mentions degrade to the WebSearch fallback at lower quality; the broader-web search is unaffected.
- `gh` CLI — pre-authenticated in GitHub Actions; used for the GitHub network-signal check (step 3). Not an env var you set here.
