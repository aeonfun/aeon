---
name: fetch-tweets
description: Search and curate X/Twitter behind one selector - keyword, topic roundup, a single or tracked-account digest, an X list, or the AI-agent buzz preset - clustered into signal-scored sub-narratives.
metadata:
  title: Fetch Tweets
  category: basics
  var: ""
  tags:
    - social
  requires:
    - TWITTER_API_KEY
    - XAI_API_KEY?
---
<!-- autoresearch: variation B — sharper output via clustering + signal scoring + insight extraction. Merged HUB: absorbs tweet-digest, tweet-roundup, list-digest, refresh-x, agent-buzz behind a `source:` selector. -->
> **${var}** — `<source>:<arg>` where `<source>` ∈ `keyword | topic | account | list | agent-buzz`. The `<arg>` is source-specific (a query, a topic, a handle, comma-separated list IDs, or an optional focus). If no `source:` prefix is given, the source is inferred from the shape of `<arg>` (see **Source selector**). **Required** for `keyword` and `list`; optional for `topic`, `account`, and `agent-buzz`.

Today is ${today}. This skill fetches X/Twitter content along one of five **source axes** and produces a *curated* digest — clustered by sub-narrative, ranked by signal, one insight per item — never a flat chronological dump.

## Source selector

Parse `${var}` into `SOURCE` and `ARG` before doing anything else.

**Explicit form (recommended):** `<source>:<arg>`
- `keyword:$SOL OR solana OR "solana network"` - raw X search query, passed to the search **verbatim** (OR/AND honored; twitterapi advanced_search primary, Grok x_search fallback).
- `topic:brain-computer interfaces` — a single topic roundup. `topic:` (empty arg) → resolve a topic **list** from MEMORY.md, then built-in defaults.
- `account:vitalikbuterin` — one account's recent tweets. `account:` (empty arg) → digest **every** handle in `memory/topics/tracked-accounts.yml`.
- `list:1953536336675365173,1937207796270829766` — one or more numeric X list IDs. Append `|<topic>` for a topic booster: `list:195...,193...|AI agents`.
- `agent-buzz` — the curated AI-agent-ecosystem preset. `agent-buzz:MCP protocol` prioritizes a project/topic within the preset.

**Implicit form (back-compat with migrated bare-var configs):** when `${var}` has **no** recognized `source:` prefix, infer `SOURCE` in this order:
1. `${var}` is empty → `topic` (default multi-topic roundup).
2. `${var}` is all-digits, or comma-separated all-digits (optionally with a `|<topic>` suffix) → `list`.
3. `${var}` is `@handle` or matches `^[A-Za-z0-9_]{1,15}$` (a bare handle) → `account`.
4. Anything else → `keyword`.

Note: `agent-buzz` has **no** distinct implicit shape (its arg looks like a keyword/topic), so it is **only** selectable via the explicit `agent-buzz` / `agent-buzz:...` prefix.

Once `SOURCE` and `ARG` are set, jump to the matching branch below. Only one branch runs per invocation.

## Shared preamble (all branches)

1. Read `memory/MEMORY.md` for context and the recent `memory/logs/` (each branch specifies its lookback window — 2 or 3 days) to dedup already-reported tweets.
2. **Load the dedup set `SEEN_TWEETS`** by unioning two sources:
   - The branch's **persistent seen-file** (per-mode path below), if it exists — read all URLs.
   - The branch's **log lookback window** — grep each `memory/logs/*.md` file in range for lines matching `https://x.com/`.

   Per-mode seen-files (kept at their legacy paths so dedup history survives the merge):
   | mode | seen-file | log lookback |
   |---|---|---|
   | keyword | `memory/fetch-tweets-seen.txt` | 3 days |
   | topic | `memory/tweet-roundup-seen.txt` | 3 days |
   | account | *(logs only — see branch)* | 2 days |
   | list | `memory/list-digest-seen.txt` | 2 days |
   | agent-buzz | *(logs only — 3-day `status/<id>` set)* | 3 days |
3. Formatting invariants shared by **every** branch's notification:
   - Use `x.com/handle` (**never** `@handle`) so Telegram doesn't ping/tag users. *(Exception: the account-digest and agent-buzz formats below historically use `@handle` in-body; keep their documented format but prefer `x.com/handle` when practical.)*
   - Every surviving tweet gets a tappable Markdown link — `[View](url)` / `[View tweet](url)`. If a URL is unavailable, drop the link and say "(link unavailable)".
   - Never fabricate engagement counts. Missing → `0`, not a guess.
   - **Notify only on signal.** A legitimately empty or all-duplicate run logs its status and sends **nothing**.

## Voice

Used by the `account` and `agent-buzz` branches for one-line takes/insights. If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice. If they are empty templates or absent, write in a clear, direct, neutral tone — state what the tweet says, no hedging or editorializing beyond the tweet itself.

---

## Branch: keyword (`source:keyword`)

Search X for tweets matching `ARG` and produce a curated digest grouped by sub-narrative.

**Seen set:** `memory/fetch-tweets-seen.txt` + last 3 days of logs (loaded in preamble).

1. **Build the search prompt.** Pass `ARG` to Grok **verbatim** as the query — do NOT narrow it to a single angle; broad coverage is the goal. Ask for **at least 15–20 candidate tweets** (you'll cull to ~7–10). Always require explicit engagement counts (likes, retweets, replies) so ranking is data-driven.

2. **Fetch tweets.** Record `SOURCE_PATH=twitterapi|api|websearch` for the log.

   Get the window dates first, each `date` as its own Bash call (see **Shell shape** below):
   ```bash
   date -u -d yesterday +%Y-%m-%d
   ```
   ```bash
   date -u +%Y-%m-%d
   ```
   The first prints FROM_DATE, the second TO_DATE.

   **Path A - twitterapi.io (primary; see the **Fetching (all branches)** contract):** structured X search, no prompt. Put the date window inside the query with `since:`. Pass `ARG` as the query **verbatim** (OR/AND honored) plus `since:<FROM_DATE>`, both written in literally:
   ```bash
   ./secretcurl -s -o /tmp/tw-keyword.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/tweet/advanced_search" \
     --data-urlencode "query=<ARG> since:<FROM_DATE>" --data-urlencode "queryType=Latest" \
     -H "X-API-Key: {TWITTER_API_KEY}"
   ```
   On `HTTP=200` with a non-empty `.tweets[]`, parse and mark `SOURCE_PATH=twitterapi`:
   ```bash
   jq -r '.tweets[] | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-keyword.json
   ```
   Paginate with `&cursor=<next_cursor>` (from `.next_cursor` while `.has_next_page`) only if you need more than the first page to reach ~15-20 candidates. Engagement counts are exact ground-truth; permalinks are the real `.url`.

   **Path B - xAI Grok x_search (fallback)** (only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` is unset; see the contract - set the Bash tool `timeout` >=180000, capture the HTTP status):
   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for tweets about: <ARG>. Date range: <FROM_DATE> to <TO_DATE>. Return at least 15-20 candidate tweets - mix of high-engagement posts and smaller accounts that add a distinct angle. For each tweet include: @handle, the full text, date posted, exact engagement counts (likes, retweets, replies - never N/A; if unknown, say 0), and the direct link (https://x.com/handle/status/ID). Return as a numbered list."}], tools:[{type:"x_search"}]}' \
     | ./secretcurl -s -o /tmp/xai.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {XAI_API_KEY}" \
     --data-binary @-
   ```
   On `HTTP=200`, parse `/tmp/xai.json` with: `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'` and mark `SOURCE_PATH=api`.

   **Path C - WebSearch (last resort)** (only if Paths A and B both gave a non-2xx / empty / timeout, or no key is set): use the built-in WebSearch tool with `site:x.com "<query terms>" after:${FROM_DATE}`. Note at the top of the log the **true reason** (`http-<code>` / `timeout` / `empty`, never "unavailable" when a key was set) and "results compiled via WebSearch - quality lower than usual". WebSearch favours high-engagement older tweets - **prioritise results dated within the last 48 hours**. Mark `SOURCE_PATH=websearch`.

3. **Empty vs. error handling** (distinguish):
   - **Legitimate empty** (0 tweets): log `FETCH_TWEETS_EMPTY (source=${SOURCE_PATH})` and **stop — no notification**.
   - **API/cache error** (HTTP error, malformed JSON, all paths failed): log `FETCH_TWEETS_ERROR (last_path=${SOURCE_PATH}, reason=...)` and **stop — no notification**.

4. **Deduplicate** each candidate URL against `SEEN_TWEETS`. If ALL are dupes: log `FETCH_TWEETS_NO_NEW: all results already reported` and **stop — no notification**.

5. **Curate** (the core step):
   a. **Cluster** survivors into 2–4 sub-narratives by what they're claiming/discussing (e.g. for a token: "price action", "team announcement", "criticism/FUD", "ecosystem integration"). Name the *angle*, not the topic.
   b. **Rank within each cluster by signal** (not raw engagement): `signal = likes + 2×retweets + replies`, but **demote** pure replies, generic shilling, and near-duplicate paraphrases. Drop tweets with <5 total engagement unless they add a unique angle.
   c. **Cap each cluster at 2–3 tweets, total 7–10.** Quality over quantity — if only 5 pass, send 5. Don't pad.
   d. **Extract the claim/signal** per tweet — *what's new or interesting*, not a literal paraphrase. Bad: "User says token is going up." Good: "Calls out the team's silence on the postponed unlock — first major holder to do so publicly."
   e. **Compute a one-line signal** for the top of the notification — one observation about the *shape* of the conversation (e.g. "Sentiment split — 4 bullish on the launch, 3 critical of the unlock terms.").

6. **Save + update seen-file** (see Log). Append each kept tweet URL (one per line) to `memory/fetch-tweets-seen.txt` (create if missing).

7. **Notify via `./notify`** with the clustered output:
   ```
   *Top Tweets - ${ARG} (${today})*
   _${signal_one_liner}_

   *${cluster_1_name}*
   1. x.com/handle - [insight summary]
   Likes: X | RTs: Y | Replies: Z
   [View tweet](https://x.com/handle/status/ID)

   2. x.com/handle - [insight summary]
   Likes: X | RTs: Y | Replies: Z
   [View tweet](https://x.com/handle/status/ID)

   *${cluster_2_name}*
   3. x.com/handle - [insight summary]
   ...
   ```
   The signal one-liner is italic (`_..._`) directly under the title; cluster headers are `*bold*`.

**Status codes:** `FETCH_TWEETS_OK` (notified) | `FETCH_TWEETS_EMPTY` | `FETCH_TWEETS_ERROR` | `FETCH_TWEETS_NO_NEW`.

---

## Branch: topic (`source:topic`)

Gist of the latest X chatter on one or more configurable topics.

**Seen set:** `memory/tweet-roundup-seen.txt` + last 3 days of logs.

1. **Resolve the topic list** (priority order):
   1. `ARG` set → `TOPICS=("$ARG")` (single-topic mode).
   2. Else if MEMORY.md has a `## Tweet Roundup Topics` section → use its bulleted lines, one query per line.
   3. Else built-in defaults:
      - `artificial intelligence OR AI agents OR LLM`
      - `crypto OR bitcoin OR DeFi`
      - `technology OR startups OR open source`

2. **Fetch per topic** - track `SOURCE ∈ {twitterapi, api, websearch, failed}` per topic.

   Get the window dates first, each `date` as its own Bash call (see **Shell shape** below):
   ```bash
   date -u -d yesterday +%Y-%m-%d
   ```
   ```bash
   date -u +%Y-%m-%d
   ```
   The first prints FROM_DATE, the second TO_DATE.

   **Path A - twitterapi.io (primary):** for each topic, one call with the topic as the query and the window inside it via `since:`, both written in literally:
   ```bash
   ./secretcurl -s -o /tmp/tw-topic.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/tweet/advanced_search" \
     --data-urlencode "query=<TOPIC> since:<FROM_DATE>" --data-urlencode "queryType=Latest" \
     -H "X-API-Key: {TWITTER_API_KEY}"
   ```
   On `HTTP=200` with a non-empty `.tweets[]`, parse and mark `SOURCE=twitterapi`. Extract each tweet's handle (`.author.userName`), text, engagement counts (`.likeCount`/`.retweetCount`/`.replyCount`), and permalink (`.url`); take up to the first 8 substantive tweets:
   ```bash
   jq -r '.tweets[] | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-topic.json
   ```

   **Path B - xAI Grok x_search (fallback)** (only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` unset): for each topic, call Grok's `x_search`.
   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for recent tweets about: <TOPIC>. Date range: <FROM_DATE> to <TO_DATE>. Return up to 8 substantive tweets. For each: @handle, full text, date, exact engagement counts (likes, retweets, replies; 0 if unknown), and the direct link https://x.com/handle/status/ID."}], tools:[{type:"x_search"}]}' \
     | ./secretcurl -s -o /tmp/xai-topic-out.json -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {XAI_API_KEY}" \
     --data-binary @-
   ```
   Parse with the standard `jq` extractor. If it yields text, `SOURCE=api`. Extract each tweet's `@handle`, text, engagement counts, and permalink.

   **Path C - WebSearch (last resort)** (only if Paths A and B both error/empty, or no key set): `site:x.com "<topic keywords>" after:<YESTERDAY>`. Always include the word "today" and `${today}` to force fresh results. Discard any result whose visible date is older than 48h. Collect up to 5 candidates per topic. Mark `SOURCE=websearch`. If all paths return nothing, mark `SOURCE=failed`.

3. **Score and filter.** Require: a known `@handle`; a `https://x.com/<handle>/status/<id>` URL (if missing, keep but mark "link unavailable"); posted within 48h; URL **not** in `SEEN_TWEETS`. Compute `signal_score = likes + 2×retweets + replies` (on WebSearch path with no counts, use result rank as a weak proxy). **Demote −50%**: replies to a parent tweet; near-duplicates of a higher-scoring tweet (>70% text overlap or same linked URL).

4. **Curate per topic:**
   - **0 survivors** → drop the topic. Do NOT pad.
   - **1–3 survivors** → list ranked by `signal_score`, highest first.
   - **4+ survivors** → group into 2–3 sub-narratives (shared keywords/entity/claim); label each, surface the top-1 tweet per narrative as exemplar.
   Write an **insight** per reported tweet (what it asserts/reveals, not a headline paraphrase). Write a one-line **conversation shape** per topic ("bullish momentum, dissenters quiet", "split opinion on X's launch", "single story dominating — Y").

5. **Notify.** If every topic dropped: log `TWEET_ROUNDUP_EMPTY` and **stop — no notify**. Otherwise send via `./notify` (≤4000 chars):
   ```
   *Tweet Roundup - ${today}*
   _Source: api:X websearch:Y failed:Z_

   *[Topic 1]* - _conversation shape_
   - x.com/handle - insight (signal: 12.3k) [View](https://x.com/handle/status/ID)
   - x.com/handle - insight (signal: 4.1k) [View](https://x.com/handle/status/ID)

   *[Topic 2]* - _conversation shape_
   - x.com/handle - insight (signal: 8k) [View](https://x.com/handle/status/ID)
   ```
   Show `signal: <score>` only when engagement counts were available (api path); omit silently on WebSearch.

6. **Persist + log** (see Log). Append each reported URL (one per line) to `memory/tweet-roundup-seen.txt` (create if missing).

**Constraints:** never notify an empty roundup (silence beats filler); never `@handle` anyone; never report a URL already in `SEEN_TWEETS`. **Status codes:** `TWEET_ROUNDUP_OK` | `TWEET_ROUNDUP_EMPTY`.

---

## Branch: account (`source:account`)

Two sub-modes: **single handle** (decision-ready gist of one account) vs. **all tracked accounts** (theme-grouped digest of a watchlist). Choose by `ARG`.

**Seen set:** last 2 days of logs — extract every `https://x.com/` URL under a prior `### fetch-tweets` account entry into `SEEN_URLS`.

### account — single handle (`ARG` is one @handle)

1. **Normalize `ARG`.** Strip leading `@`, `https://x.com/`, `https://twitter.com/`, `https://nitter.net/`, trailing slash / `/status/...`. Lowercase. Reject if empty, contains whitespace, or >15 chars. On reject → `REFRESH_X_NO_VAR`: send `./notify "fetch-tweets: REFRESH_X_NO_VAR — set an X handle"` and exit 0. Store the cleaned handle as `ACCOUNT`.

2. **Load tweets:**
   - **Path A - twitterapi.io (primary):** pull this account's recent timeline directly, then filter to the last 2 days client-side (no server-side date filter on this endpoint):
     First `date -u -d '2 days ago' +%Y-%m-%d` as its own call (prints FROM_2D), then one call with the handle written in literally:
     ```bash
     ./secretcurl -s -o /tmp/tw-account.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/user/last_tweets" \
       --data-urlencode "userName=<ACCOUNT>" -H "X-API-Key: {TWITTER_API_KEY}"
     ```
     On `HTTP=200` with a non-empty `.data.tweets[]`, parse and mark `source=twitterapi`. Filter on `.createdAt` (drop tweets older than the window) and use `.isReply` to tag reply vs original (this endpoint has no quote flag - treat non-reply as original; if you need reliable quote detection fall back to Path B). One `jq` per call, FROM_2D written in literally:
     ```bash
     jq -r '.data.tweets[] | select((try (.createdAt | strptime("%a %b %d %H:%M:%S %z %Y") | strftime("%Y-%m-%d")) catch "0000-00-00") >= "<FROM_2D>") | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount, .isReply] | @tsv' /tmp/tw-account.json
     ```
   - **Path B - xAI Grok x_search (fallback)** (only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` unset): search this account's recent tweets via Grok's `x_search`.
     ```bash
     jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for the latest tweets, replies, and quote tweets from @<ACCOUNT> in the last 2 days. Return each with full text, timestamp, type (original|reply|quote), what it replies to/quotes if any, exact engagement counts (likes, retweets, replies; 0 if unknown), and the permalink https://x.com/<ACCOUNT>/status/ID. Skip retweets of others. Return chronological."}], tools:[{type:"x_search"}]}' \
       | ./secretcurl -m 30 -s -o /tmp/xai-account-out.json -X POST "https://api.x.ai/v1/responses" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer {XAI_API_KEY}" \
       --data-binary @-
     ```
     Parse with the standard `jq` extractor. Record `source=api`.
   - **Path C - WebFetch (last resort)** (only if Paths A and B both failed / returned nothing): WebFetch `https://x.com/${ACCOUNT}` with prompt: *"List every tweet, reply, and quote tweet visible on this profile with its full text, timestamp, engagement counts (likes/retweets/replies) if shown, and the permalink https://x.com/handle/status/ID. Return a chronological list."* Record `source=webfetch`.
   - **Degraded**: if no key is set and WebFetch returns nothing → skip to step 8 with status `REFRESH_X_NO_API_KEY` (no key present) or `REFRESH_X_ERROR` (a key was set but all paths failed).

3. **Parse into structured tweets:** `url`, `text`, `timestamp`, `type` (original/reply/quote), `reply_to`, `quoted_text`, `likes`, `retweets`, `replies`. Drop retweets of others. Missing counts → 0. Compute `signal_score = likes + 2*retweets + replies − (3 if type=reply else 0)`.

4. **Dedup and gate:** drop any tweet whose `url` is in `SEEN_URLS` (`deduped_count`). If fewer than 3 tweets survive AND no thread is detectable (step 5) → skip to step 8 with `REFRESH_X_NO_NEW` (everything deduped) or `REFRESH_X_EMPTY` (account posted nothing).

5. **Detect threads:** a thread = 2+ tweets by `ACCOUNT` within 30 minutes where later tweets reply to earlier ones OR share ≥2 meaningful keywords with the opener. Thread tweets are atomic units regardless of individual score. Record `{opener_url, tweet_count, combined_signal}`.

6. **Cluster and extract insights:** group survivors (threads = one unit) into **2–4 sub-narratives** by topic overlap; if <2 emerge, use one cluster. Per cluster: **Title** (3–8 words), **Top tweet(s)** (1–3 excerpts ≤200 chars each, with permalink + engagement), **Insight** (one sentence — what the cluster reveals about the author's stance/claim/shift; not a paraphrase — if you can't beat paraphrase, drop the cluster). Per thread: a 1–2 sentence landing summary + opener URL.

7. **Write the verdict** (pick exactly one) + a ≤20-word lede:
   | Verdict | When |
   |---|---|
   | `ANNOUNCEMENT` | launch, hire, policy, or product drop |
   | `ARGUMENT` | majority signal from contrarian takes or fights |
   | `BUILDING` | ships/code/tech-progress clusters dominate |
   | `SHITPOST` | jokes, memes, low-stakes banter dominate |
   | `CONTEXT` | mostly reacting to a news cycle, not driving one |
   | `QUIET` | <3 originals and no thread |

8. **Save gist** (see Log). On empty/no-new/error/no-var statuses, write only the account header + status footer, skip cluster sections.

9. **Update MEMORY.md (conditional):** only if a cluster carries an announcement, specific claim, named project, or stance shift — add one bullet under a `## Tracked X Accounts` section (create if missing): `- @ACCOUNT YYYY-MM-DD: [one-sentence claim] — [permalink]`. No paraphrases/memes/generic opinions.

10. **Notify via `./notify`.** On `REFRESH_X_OK`:
    ```
    x refresh - @ACCOUNT ([VERDICT])
    [lede]
    top cluster: [title] - "[≤80 char excerpt]" ([likes]❤)
    [N tweets, T threads, K deduped]
    ```
    On `REFRESH_X_EMPTY` / `REFRESH_X_NO_NEW`: **skip notify** (write the log entry only). On `REFRESH_X_NO_API_KEY` / `REFRESH_X_ERROR` / `REFRESH_X_NO_VAR`: notify with the status code + a one-line hint (e.g. `"fetch-tweets: REFRESH_X_NO_API_KEY — set XAI_API_KEY in workflow secrets"`).

**Constraints:** never fabricate engagement; never include a `SEEN_URLS` URL; an insight that only paraphrases is not an insight (drop the cluster); MEMORY.md updates are one line each. **Status codes:** `REFRESH_X_OK` | `REFRESH_X_EMPTY` | `REFRESH_X_NO_NEW` | `REFRESH_X_NO_API_KEY` | `REFRESH_X_ERROR` | `REFRESH_X_NO_VAR`.

### account — all tracked accounts (`ARG` empty)

Use this to answer "what did *these specific people* post" across a watchlist.

1. **Read config** `memory/topics/tracked-accounts.yml`. If missing or `accounts: []` → log `TWEET_DIGEST_NO_CONFIG` and exit (no notification). Schema:
   ```yaml
   accounts:
     - handle: vitalikbuterin
       why: ethereum core thinking      # optional — grouping/context label
     - handle: balajis
       why: macro + tech narratives
   ```

2. **Fetch recent tweets per account.** For each `handle`:
   - **Path A - twitterapi.io (primary):** pull the handle's recent timeline, filter to the last 3 days client-side, take the 5 most substantive; drop retweets of others:
     Run `date -u -d '3 days ago' +%Y-%m-%d` once, as its own call (prints FROM_3D). Then per handle, one call with the handle written in literally:
     ```bash
     ./secretcurl -s -o /tmp/tw-acct1.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/user/last_tweets" \
       --data-urlencode "userName=<HANDLE>" -H "X-API-Key: {TWITTER_API_KEY}"
     ```
     On `HTTP=200` with a non-empty `.data.tweets[]`, parse and mark `source=twitterapi`. One `jq` per call, FROM_3D written in literally; if you also want a count, `jq '.data.tweets | length' /tmp/tw-acct1.json` is its own call, never joined with `;`:
     ```bash
     jq -r '.data.tweets[] | select((try (.createdAt | strptime("%a %b %d %H:%M:%S %z %Y") | strftime("%Y-%m-%d")) catch "0000-00-00") >= "<FROM_3D>") | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-acct1.json
     ```
   - **Path B - xAI Grok x_search (fallback)** (only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` unset):
     ```bash
     jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for the latest tweets from:<HANDLE> in the last 3 days. Return the 5 most interesting or substantive tweets. For each: full text, date, direct link (https://x.com/<HANDLE>/status/ID). Skip retweets of others."}], tools:[{type:"x_search"}]}' \
       | ./secretcurl -m 30 -s -o /tmp/xai-acct1-out.json -X POST "https://api.x.ai/v1/responses" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer {XAI_API_KEY}" \
       --data-binary @-
     ```
     Parse with the standard `jq` extractor.
   If neither `TWITTER_API_KEY` nor `XAI_API_KEY` is set, log `TWEET_DIGEST_NO_KEY: skill requires TWITTER_API_KEY (or XAI_API_KEY)` and exit (no notification).
   **Dedup:** drop any candidate URL already in `SEEN_URLS` (last 2 days of logs).

3. **Group by theme, not by account.** Walk the full candidate set; identify 2–4 themes (e.g. "L2 design decisions", "macro / rates", "AI model releases", "regulation"). Each tweet maps to one theme; a `why:` label can seed theme naming for single-topic feeds.

4. **Write a one-sentence take per notable tweet** — what the tweet says, not your opinion of it. Voice per the **Voice** section.

5. **Notify** via `./notify`:
   ```
   *Tweet Digest - ${today}*

   *Theme: <theme>*
   @handle: <one-sentence summary> - [link](url)
   @handle: <one-sentence summary> - [link](url)

   *Theme: <theme>*
   ...
   ```
   If no notable tweets across all accounts: log `TWEET_DIGEST_OK` and end (no notification).

**Status codes:** `TWEET_DIGEST_OK` (notified or clean) | `TWEET_DIGEST_NO_CONFIG` | `TWEET_DIGEST_NO_KEY`.

---

## Branch: list (`source:list`)

Cross-list narrative resonance + signal-scored top tweets from tracked X lists in the past 24h. Lists are *curator signal* — the value is cross-list resonance + insight + a verdict, not a flat top-N-per-list dump.

**Seen set:** `memory/list-digest-seen.txt` + last 2 days of logs.

1. **Parse and validate `ARG`** in your head, not in a shell script (an `if`/`for` block is refused):
   - `ARG` empty: log `LIST_DIGEST_NO_CONFIG: var must contain at least one X list ID` to today's `memory/logs/<date>.md` and stop.
   - `IDS_PART` = the text before the first `|`; `TOPIC_FILTER` = the text after it (empty when there is no `|`).
   - Split `IDS_PART` on commas into `LIST_ID`s. Any ID that is not all digits: log `LIST_DIGEST_NO_CONFIG: invalid list ID '<id>' (must be numeric)` and stop.

   If `XAI_API_KEY` is unset, fall back to Path B. If no path returns data, log `LIST_DIGEST_NO_CONFIG: XAI_API_KEY required` and stop without notifying.

2. **Fetch each list's top tweets (past 24h)** - xAI primary, WebSearch fallback.
   > Note: twitterapi.io has **no `list:` operator** (its advanced_search supports `from:` `to:` `url:` `lang:` `#tag` `@mention` `since:` `until:` only), so this branch keeps the xAI Grok `x_search` path as primary - it is the only path that can read an X list by ID. `TWITTER_API_KEY` does not apply to the `list` source.
   **Path A - X.AI Responses API** (primary). Get the window dates first, each `date` as its own Bash call: `date -u -d yesterday +%Y-%m-%d` (FROM_DATE) and `date -u +%Y-%m-%d` (TO_DATE). Then build the body and send it in one call (jq piped straight into `./secretcurl`), with the list ID and both dates written in literally:
   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"Look at X list https://x.com/i/lists/<LIST_ID>. Step 1: report the list name and a one-line description. Step 2: identify the most engaging tweets posted by members of this list between <FROM_DATE> and <TO_DATE> UTC. Return the top 12 tweets ranked by engagement (likes, retweets, replies). For EACH tweet you MUST return: (a) @handle, (b) the full tweet text (not a paraphrase), (c) explicit engagement counts as separate fields - likes:N, retweets:N, replies:N, views:N if available, (d) the direct permalink in the form https://x.com/<handle>/status/<id>, (e) media type (image|video|none), (f) one-line context if it is a reply or quote tweet (who/what). Skip retweets of accounts NOT on this list. If a tweet has an image and you can analyze it, include a one-line image description."}], tools:[{type:"x_search", from_date:"<FROM_DATE>", to_date:"<TO_DATE>", enable_image_understanding:true}]}' \
     | ./secretcurl -s -o /tmp/xai-list-out.json --max-time 180 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {XAI_API_KEY}" \
     --data-binary @-
   ```
   Parse with the standard `jq` extractor.
   **Path B — WebSearch fallback** (only if `XAI_API_KEY` unset, OR Path A errors / returns nothing): `site:x.com "i/lists/${LIST_ID}" OR list:${LIST_ID} after:${FROM_DATE}`. Lower quality; mark this list's source as `websearch`.
   **Per-list outcome:** `ok` (≥3 tweets) | `quiet` (1–2) | `empty` (0, list found but no posts) | `error` (API/access failure — note reason).

3. **Build the candidate pool.** Record per tweet `{handle, text, likes, retweets, replies, views, url, list_ids_seen_on:[], list_names_seen_on:[], media, is_reply, is_quote}`. **Dedup by URL across lists** — same tweet on multiple lists → merge records, keep both `list_ids_seen_on` and `list_names_seen_on` (cross-list appearance is a signal). **Dedup against history** — drop URLs in `memory/list-digest-seen.txt` or the last 2 days of logs.

4. **Score every candidate** (natural-log engagement to stop one viral tweet dominating):
   ```
   base = ln(1+likes) + 2.0*ln(1+retweets) + 1.5*ln(1+replies)
   bonuses:
     +2.0  appeared on ≥2 distinct lists (cross-list resonance)
     +1.5  appeared on ≥3 distinct lists
     +1.0  topic_filter set AND tweet text/context matches (case-insensitive substring or obvious semantic match)
     +0.5  small-account-signal (≤25k followers per Grok's note OR no follower data + technical/insider content)
     +0.3  media is image OR video
   penalties:
     -1.0  is_reply AND replied-to NOT on any tracked list
     -0.5  pure link share with <10 words of original commentary
   score = base + sum(bonuses) - sum(penalties)
   ```

5. **Cluster into cross-list narratives** when ALL hold: ≥2 tweets from ≥2 distinct lists; shared ≥2 substantive keywords/entities (proper nouns, project names, tickers, technical terms — ignore stop words); posted within the same 24h window. `narrative score = sum of constituent tweet scores`; **narrative title** ≤80 chars capturing what the cluster collectively says. Pick an **anchor tweet** (highest individual score) + up to 2 supporting. **Cluster-count cap:** if clustering yields <2 or >4 clusters, fall back to a flat ranked list with inline `[cluster-name]` labels (no "🔗 Cross-list narratives" section).

6. **Compose the digest** (cap 4000 chars): up to **3 narratives** at top (by narrative score); then up to **5 standalone tweets per list** (highest individual score, not already in a narrative); hard total cap **12 items** — cut from the bottom of standalones. **Insight discipline:** every item needs a one-line **so-what** (implication, contrarian angle, missing number, deal-flow signal); a paraphrase must be rewritten. **Quiet-list rule:** if a list's top surviving tweet scores <2.0 (≈<8 likes raw), write a one-line "quiet day" for that list. **Topic filter** is a scoring booster (step 4), NOT a hard filter. **Verdict line:** one line at the very top capturing what today's lists collectively say.

7. **Send the notification** via `./notify`, verbatim format (`x.com/handle`, `[label](url)`):
   ```
   *List Digest - ${today}*

   [VERDICT LINE - one line, ≤140 chars, plain text]

   🔗 *Cross-list narratives*
   1. *[narrative title]* - appeared on [List A] + [List B]
      x.com/handle: [insight, not paraphrase] (♥ likes, ↻ rt) - [View](url)
      x.com/handle2: [insight] (♥ likes, ↻ rt) - [View](url)

   2. *[narrative title]* - appeared on [List A] + [List C]
      ...

   *[List Name 1]*
   - x.com/handle - [insight] (♥ likes, ↻ rt) - [View](url)
   - x.com/handle - [insight] (♥ likes, ↻ rt) - [View](url)

   *[List Name 2]*
   - quiet day

   ---
   sources: list1=ok | list2=quiet | list3=error(no-access)
   status: LIST_DIGEST_OK
   ```
   If cross-list narratives is empty, drop that whole section. If every list is `quiet`/`empty`, send a single-line "*List Digest — ${today}* — quiet across all tracked lists" instead of padding.

8. **Log and persist** (see Log). Append every reported URL (one per line) to `memory/list-digest-seen.txt` (create if missing).

**Exit taxonomy:** `LIST_DIGEST_NO_CONFIG` (var empty/invalid OR no fetch path — log only) | `LIST_DIGEST_EMPTY` (every list 0 tweets OR all candidates already seen — log only) | `LIST_DIGEST_PARTIAL` (some lists succeeded/some failed — notify survivors, surface failures) | `LIST_DIGEST_OK` (≥1 fresh tweet — notify).

---

## Branch: agent-buzz (`source:agent-buzz`)

A topic-filtered preset: a curated, narrative-aware read on what the AI-agent scene on X talked about in the last 24h. **Curation, not aggregation** — 6 high-signal tweets in 2 clusters beats 10 of mixed noise. `ARG` (optional) is a project/topic to prioritize.

**Seen set:** last 3 days of logs — extract every `https://x.com/.../status/<id>` already posted by this skill; treat those IDs as the dedup set.

1. **Fetch candidates:**
   Get the window dates first, each `date` as its own Bash call (see **Shell shape** below):
   ```bash
   date -u -d '1 day ago' +%Y-%m-%d
   ```
   ```bash
   date -u +%Y-%m-%d
   ```
   The first prints FROM_DATE, the second TO_DATE.

   **Path A - twitterapi.io (primary):** structured search over the AI-agents conversation, window inside the query via `since:`, FROM_DATE written in literally:
   ```bash
   ./secretcurl -s -o /tmp/tw-buzz.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/tweet/advanced_search" \
     --data-urlencode 'query=("AI agents" OR "autonomous agents" OR "agent framework" OR "agent frameworks" OR MCP OR "agent protocol" OR "agent benchmark") since:<FROM_DATE>' \
     --data-urlencode "queryType=Latest" -H "X-API-Key: {TWITTER_API_KEY}"
   ```
   On `HTTP=200` with a non-empty `.tweets[]`, parse and mark `source=twitterapi`. Collect up to ~40 candidates (paginate with `&cursor=<next_cursor>` while `.has_next_page` if the first page is thin):
   ```bash
   jq -r '.tweets[] | [.id, .author.userName, .author.isBlueVerified, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-buzz.json
   ```
   Note: advanced_search does **not** return `follower_count` or `role_guess`. On this path treat both as null (the step-3 role multiplier and the follower-ratio skip-gates simply don't fire); use `.author.isBlueVerified` as a weak credibility proxy and lean on raw engagement. If `ARG` is set, append its terms to the query (AND) or issue a second constrained search and merge.

   **Path B - xAI Grok x_search (fallback)** (only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` unset; the response for each tweet **must** include explicit engagement counts + follower count, or step 3 scoring can't run):
   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X from <FROM_DATE> to <TO_DATE> for tweets in the AI-agents conversation: autonomous agents, agent frameworks, MCP / agent protocols, agent products, agent benchmarks, agent research papers. Return up to 40 candidates. For EACH candidate you MUST return: @handle, follower_count (integer or null), role_guess (builder|founder|researcher|investor|commentator|anon), one-line claim (what they actually said - not a paraphrase, the thesis), likes (int), retweets (int), replies (int), posted_at (ISO), direct_link (https://x.com/username/status/ID). Prefer builders/founders/researchers. Skip obvious engagement-farming threads (\"RT if you agree\", reply-guy pileons, giveaways)."}], tools:[{type:"x_search", from_date:"<FROM_DATE>", to_date:"<TO_DATE>"}]}' \
     | ./secretcurl -s -o /tmp/xai-buzz-out.json -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {XAI_API_KEY}" \
     --data-binary @-
   ```
   Parse with the standard `jq` extractor. Record `source=xai`.
   **Path C - WebSearch (last resort)** (only if Paths A and B both error/empty, or no key set): forced-fresh query `"AI agents twitter today ${today}"` - discard anything >48h old, expect degraded metadata. Record `source=websearch`.

   If `ARG` is set, also issue a second call constrained to that topic with the same schema; merge results.

2. **Skip-gates** (before clustering) — drop any candidate matching ANY:
   - **Dup:** `status/<id>` already in the 3-day dedup set.
   - **Engagement-farming:** poll threads, "bookmark this", "drop a 🔥", reply-guy pileons with <follower_count/10 likes.
   - **Self-promo only:** pure product shill with no claim/benchmark/datapoint. Launch tweets OK IF they include a concrete capability claim or number.
   - **Staleness:** `posted_at` older than 30h.
   - **Anon + low engagement:** role_guess=anon AND (likes+retweets) < 200.

3. **Signal scoring:** `signal = likes + 2*retweets + replies`, then × 1.3 if role_guess ∈ {builder, founder, researcher}; × 0.7 if a pure hot-take with no concrete referent (no named project, number, paper, or bench); × 0.5 if near-duplicate of another survivor (keep the higher-scored one only).

4. **Narrative clustering:** group survivors into **2–4 narrative clusters** — a cluster is a shared *thesis*, not a keyword ("MCP vendor lock-in debate", not "MCP"). Name each ≤5 words. If one cluster holds >60% of tweets, split it. A tweet fitting no cluster is dropped unless its signal is top-3 overall. Target: **2–4 clusters, 2–3 tweets each, 6–9 total (strictly ≤10).**

5. **Insight extraction** — per tweet, a one-line **insight** (≤20 words): the actual claim/datapoint, not a paraphrase; if opinion, state *what they're arguing against*; if an announcement, state *what's new vs. prior art* (not "X launched"). **Anti-hype lint** — rewrite any insight containing: `game-changing`, `revolutionary`, `mind-blowing`, `wild`, `huge`, `massive`, `unreal`, `insane`, vague "AI agents are evolving", "the future of X".

6. **Conversation-shape lead** — one opening sentence (≤25 words) naming what the conversation was actually about ("Mostly protocol debate — MCP vs. A2A — with two concrete launches on the side."). If you can't characterize it honestly in one sentence, the clustering is wrong — redo step 4.

7. **Notify** via `./notify`:
   ```
   *Agent Buzz - ${today}*
   _<conversation-shape one-liner>_

   **<Cluster 1 name>**
   • @handle - <insight>
     <link>
   • @handle - <insight>
     <link>

   **<Cluster 2 name>**
   • @handle - <insight>
     <link>

   <!-- _src: xai|websearch · candidates: N → kept: M_ -->
   ```
   Keep the footer — it's how future self-audits debug empty days. Never pad to hit 10. 6 good > 10 mid.

**Status codes:** `AGENT_BUZZ_OK` (≥1 cluster notified) | `AGENT_BUZZ_EMPTY` (fetch succeeded, nothing survived — send `Agent Buzz — ${today}: quiet day, no survivors.`) | `AGENT_BUZZ_ERROR` (all sources failed — notify `Agent Buzz — ${today}: all sources failed (${error summary}).` and log the per-source failure).

---

## Log (all branches)

Append ONE entry per run to `memory/logs/${today}.md` under a single `### fetch-tweets` heading (the health loop parses this shape). The first bullet is the **discriminator** naming the branch/mode that ran; the rest are branch-specific bullets. Always include the reported tweet URLs as bullets (for next-run dedup).

```
### fetch-tweets
- mode: <keyword|topic|account|list|agent-buzz>
- status: <STATUS_CODE for the branch that ran>
- source: <SOURCE_PATH / per-source counts / per-list outcome, as applicable>
- <branch-specific bullets - carry over each branch's fields:>
    - keyword:     signal one-liner; per-cluster URLs with `likes:N rts:N replies:N` + insight
    - topic:       `topics: [t1: N tweets, t2: 0 (dropped)]`; `source: cache:X websearch:Y failed:Z`
    - account(1):  Verdict + lede; Counts (N tweets, X orig/Y reply/Z quote, T threads, deduped K); Clusters; Threads; Vibe
    - account(all):themes covered; per-account tweet counts
    - list:        Lists tracked; Per-list `list1=ok(N) | list2=quiet(N) | list3=error`; Verdict; Narratives count
    - agent-buzz:  source used; candidates N → kept M; cluster names
- urls:
    - https://x.com/handle1/status/...
    - https://x.com/handle2/status/...
```

On empty/no-new/error/no-config statuses, write the `### fetch-tweets` heading + `mode:` + `status:` bullets only (skip the detail sections) so skill-health still observes the run. After logging, update the branch's persistent seen-file where one exists (keyword / topic / list — see the seen-file table).

## Output shape note

No chain consumes this skill's output as of this commit (no `consume: [fetch-tweets]` references). If a downstream chain step starts consuming it, emit a flat list of URLs before the clustered/branch output so consumers aren't broken by cluster or narrative headers.

## Fetching (all branches)

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`FROM_DATE=$(date ...)`, `HTTP=$(./secretcurl ...)`), uses `if` / `for` / `while`, or joins commands with `;`, `&&` or `||`, and each refusal costs a model turn. So get a date with a bare `date` call and write the printed value into later commands; write `ARG`, handles, topics and dates into each command literally (the `<FROM_DATE>`, `<HANDLE>` style placeholders in the snippets); run one `jq` per call; loop over handles or topics by making one call per item. The run also refuses any redirect into a file (`> /tmp/x.json`, `cat > f`) and any `$name` in a jq filter (`--arg FROM ... '... $FROM'`), in both tiers: write each value into the jq filter as a JSON string (`>= "<FROM_2D>"`; a `"` inside a value becomes `\"`, and reword any `'`), and pipe a request body straight into `./secretcurl ... --data-binary @-`.

Every branch fetches X in a **three-tier cascade**. Attempt each tier in order; only drop to the next on a *real* failure (non-2xx, empty body, or timeout), and always record the true reason.

**Path A - twitterapi.io (primary).** `TWITTER_API_KEY` is **injected into your environment** for this skill (declared in `requires:`). The primary fetch path in every branch (except `list`, which has no twitterapi list operator) is a direct `curl` to `https://api.twitterapi.io/twitter/...` with the `X-API-Key: {TWITTER_API_KEY}` header. It is fast (~700ms), returns **structured ground-truth** JSON with **exact engagement counts** and **real permalinks** (`.url`) - so there is no fabrication risk and no prompt to coax. Two endpoints:
- **Search:** `GET /tweet/advanced_search?query=<q>&queryType=Latest` -> `{tweets:[...], has_next_page, next_cursor}`. Put date windows **inside** the query with X operators `since:YYYY-MM-DD until:YYYY-MM-DD`; other operators: `from:` `to:` `url:` `lang:` `#tag` `@mention`, plus OR/AND and quotes. Tweets are under `.tweets[]`. (There is **no** `list:` operator - see the `list` branch.)
- **Timeline:** `GET /user/last_tweets?userName=<handle>` -> `{status:"success", data:{tweets:[...]}, has_next_page, next_cursor}`. No server-side date filter - filter client-side on `.createdAt` or paginate with `&cursor=<next_cursor>`. Tweets are under `.data.tweets[]`.

Fields: `id, text, url, createdAt, likeCount, retweetCount, replyCount, quoteCount, viewCount, author.userName, author.name, author.isBlueVerified` (last_tweets also `isReply`, `author.followers`). Capture the status with `-w 'twitterapi http=%{http_code} bytes=%{size_download}\n'` (curl prints it, so no `HTTP=$(...)` wrapper) and **read the `http=<code>` line before deciding anything.** `HTTP=200` with a non-empty tweet array -> use it (`SOURCE_PATH=twitterapi`). No prefetch, no cache - just make the call.

**Path B - xAI Grok x_search (fallback).** Only when Path A fails (non-2xx / empty / timeout) or `TWITTER_API_KEY` is unset. Direct `curl` to `https://api.x.ai/v1/responses` with `Authorization: Bearer {XAI_API_KEY}` using Grok's `x_search` tool. The `x_search` call typically takes 30-120s (it searches X live), so **set the Bash tool `timeout` to at least 180000 (180s)** and add **`--max-time 150`** to the curl so it fails cleanly rather than hanging. A slow curl is **not** a missing key. Build the JSON body with `jq -n` (prompt and dates written into the filter literally) and pipe it straight into `./secretcurl` in the same call (its body flag reads stdin) - every `./secretcurl` command must be 100% literal (no shell variables, or the permission layer blocks it). Parse with the standard extractor:
   ```bash
   jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' /tmp/xai.json
   ```
`HTTP=200` with a non-empty body -> use it (`SOURCE_PATH=api`).

**Path C - WebSearch / WebFetch (last resort).** Only when both A and B fail (or no key is set at all). Lowest quality (WebSearch favours old high-engagement tweets; WebFetch reads a public profile page). Never reach for it while a key works.

**Reason codes** (record the true one on every fallback - never write "XAI_API_KEY unavailable" / "sandbox" / "expansion blocked" when a key was set): `key-unset` (the relevant key was actually empty), `http-<code>` (non-2xx), `empty` (200 but no tweets parsed), `timeout` (curl exceeded `--max-time`).

## Environment Variables

- `TWITTER_API_KEY` - twitterapi.io API key (sent as the `X-API-Key` header). Declared in `requires:`, so it is **injected into this skill's environment**; it is the **primary** fetch path for every branch except `list` (twitterapi has no list operator). Fast, structured ground-truth with exact engagement counts and real permalinks.
- `XAI_API_KEY` - X.AI API key for Grok's `x_search` tool (declared `XAI_API_KEY?`, optional). The **fallback** path when `TWITTER_API_KEY` is unset or twitterapi returns non-2xx / empty / timeout, and the **primary** path for the `list` branch. If both keys are unset, branches degrade to WebSearch/WebFetch at lower quality; the `account (all)` sub-mode instead hard-exits (`TWEET_DIGEST_NO_KEY`).
