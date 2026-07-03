---
type: Skill
name: Fetch Tweets
category: research
description: Search and curate X/Twitter behind one selector — by keyword/query, topic roundup, a single account or a tracked-account digest, an X list, or the AI-agent "buzz" preset — clustered into sub-narratives with signal-scored, insight-per-item output.
var: ""
tags: [social]
requires: [XAI_API_KEY?]
---
<!-- autoresearch: variation B — sharper output via clustering + signal scoring + insight extraction. Merged HUB: absorbs tweet-digest, tweet-roundup, list-digest, refresh-x, agent-buzz behind a `source:` selector. -->
> **${var}** — `<source>:<arg>` where `<source>` ∈ `keyword | topic | account | list | agent-buzz`. The `<arg>` is source-specific (a query, a topic, a handle, comma-separated list IDs, or an optional focus). If no `source:` prefix is given, the source is inferred from the shape of `<arg>` (see **Source selector**). **Required** for `keyword` and `list`; optional for `topic`, `account`, and `agent-buzz`.

Today is ${today}. This skill fetches X/Twitter content along one of five **source axes** and produces a *curated* digest — clustered by sub-narrative, ranked by signal, one insight per item — never a flat chronological dump.

## Source selector

Parse `${var}` into `SOURCE` and `ARG` before doing anything else.

**Explicit form (recommended):** `<source>:<arg>`
- `keyword:$SOL OR solana OR "solana network"` — raw X search query, passed to Grok **verbatim** (OR/AND honored).
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
   - Every surviving tweet gets a tappable link — Telegram Markdown `[View](url)` / `[View tweet](url)`. If a URL is unavailable, drop the link and say "(link unavailable)".
   - Never fabricate engagement counts. Missing → `0`, not a guess.
   - **Notify only on signal.** A legitimately empty or all-duplicate run logs its status and sends **nothing**.

## Voice

Used by the `account` and `agent-buzz` branches for one-line takes/insights. If `soul/SOUL.md` and `soul/STYLE.md` are populated, read both and match the operator's voice. If they are empty templates or absent, write in a clear, direct, neutral tone — state what the tweet says, no hedging or editorializing beyond the tweet itself.

---

## Branch: keyword (`source:keyword`)

Search X for tweets matching `ARG` and produce a curated digest grouped by sub-narrative.

**Seen set:** `memory/fetch-tweets-seen.txt` + last 3 days of logs (loaded in preamble).

1. **Build the search prompt.** Pass `ARG` to Grok **verbatim** as the query — do NOT narrow it to a single angle; broad coverage is the goal. Ask for **at least 15–20 candidate tweets** (you'll cull to ~7–10). Always require explicit engagement counts (likes, retweets, replies) so ranking is data-driven.

2. **Fetch tweets.** Use whichever path is available; record `SOURCE_PATH=cache|api|websearch` for the log.

   **Path A — pre-fetched cache** (preferred): read the canonical file, fall back to the legacy name.
   ```bash
   cat .xai-cache/fetch-tweets.json 2>/dev/null \
     | jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'
   ```

   **Path B — X.AI API** (fallback, when `XAI_API_KEY` is set and cache is empty):
   ```bash
   FROM_DATE=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
   TO_DATE=$(date -u +%Y-%m-%d)
   curl -s -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $XAI_API_KEY" \
     -d '{
       "model": "grok-4-1-fast",
       "input": [{"role": "user", "content": "Search X for tweets about: '"$ARG"'. Date range: '"$FROM_DATE"' to '"$TO_DATE"'. Return at least 15-20 candidate tweets — mix of high-engagement posts and smaller accounts that add a distinct angle. For each tweet include: @handle, the full text, date posted, exact engagement counts (likes, retweets, replies — never N/A; if unknown, say 0), and the direct link (https://x.com/handle/status/ID). Return as a numbered list."}],
       "tools": [{"type": "x_search"}]
     }'
   ```
   Parse with: `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'`

   **Path C — WebSearch fallback** (both cache and `XAI_API_KEY` unavailable): use the built-in WebSearch tool with `site:x.com "<query terms>" after:${FROM_DATE}`. Note at the top of the log: "XAI_API_KEY not available; results compiled via WebSearch — quality lower than usual". WebSearch favours high-engagement older tweets — **prioritise results dated within the last 48 hours**.

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
   *Top Tweets — ${ARG} (${today})*
   _${signal_one_liner}_

   *${cluster_1_name}*
   1. x.com/handle — [insight summary]
   Likes: X | RTs: Y | Replies: Z
   [View tweet](https://x.com/handle/status/ID)

   2. x.com/handle — [insight summary]
   Likes: X | RTs: Y | Replies: Z
   [View tweet](https://x.com/handle/status/ID)

   *${cluster_2_name}*
   3. x.com/handle — [insight summary]
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

2. **Fetch per topic** — track `SOURCE ∈ {cache, websearch, failed}` per topic.

   **Path A — pre-fetched cache** (preferred):
   - Single-topic mode: read `.xai-cache/fetch-tweets-topic.json` (legacy fallback: `.xai-cache/roundup-var.json`).
   - Default/multi-topic mode: read any `.xai-cache/fetch-tweets-topic-*.json` (legacy fallback: `.xai-cache/roundup-*.json`), matching by slugified topic name if present.
   ```bash
   jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' \
     .xai-cache/fetch-tweets-topic*.json 2>/dev/null
   ```
   If parsing yields text, `SOURCE=cache`. Extract each tweet's `@handle`, text, engagement counts (if present), and permalink.

   **Path B — direct X.AI curl:** **Skipped.** The sandbox blocks env-var-authenticated curl; do not attempt it in topic mode.

   **Path C — WebSearch fallback** (cache missing/empty): `site:x.com "<topic keywords>" after:<YESTERDAY>`. Always include the word "today" and `${today}` to force fresh results. Discard any result whose visible date is older than 48h. Collect up to 5 candidates per topic. Mark `SOURCE=websearch`. If both A and C return nothing, mark `SOURCE=failed`.

3. **Score and filter.** Require: a known `@handle`; a `https://x.com/<handle>/status/<id>` URL (if missing, keep but mark "link unavailable"); posted within 48h; URL **not** in `SEEN_TWEETS`. Compute `signal_score = likes + 2×retweets + replies` (on WebSearch path with no counts, use result rank as a weak proxy). **Demote −50%**: replies to a parent tweet; near-duplicates of a higher-scoring tweet (>70% text overlap or same linked URL).

4. **Curate per topic:**
   - **0 survivors** → drop the topic. Do NOT pad.
   - **1–3 survivors** → list ranked by `signal_score`, highest first.
   - **4+ survivors** → group into 2–3 sub-narratives (shared keywords/entity/claim); label each, surface the top-1 tweet per narrative as exemplar.
   Write an **insight** per reported tweet (what it asserts/reveals, not a headline paraphrase). Write a one-line **conversation shape** per topic ("bullish momentum, dissenters quiet", "split opinion on X's launch", "single story dominating — Y").

5. **Notify.** If every topic dropped: log `TWEET_ROUNDUP_EMPTY` and **stop — no notify**. Otherwise send via `./notify` (≤4000 chars):
   ```
   *Tweet Roundup — ${today}*
   _Source: cache:X websearch:Y failed:Z_

   *[Topic 1]* — _conversation shape_
   - x.com/handle — insight (signal: 12.3k) [View](https://x.com/handle/status/ID)
   - x.com/handle — insight (signal: 4.1k) [View](https://x.com/handle/status/ID)

   *[Topic 2]* — _conversation shape_
   - x.com/handle — insight (signal: 8k) [View](https://x.com/handle/status/ID)
   ```
   Show `signal: <score>` only when engagement counts were available (cache path); omit silently on WebSearch.

6. **Persist + log** (see Log). Append each reported URL (one per line) to `memory/tweet-roundup-seen.txt` (create if missing).

**Constraints:** never notify an empty roundup (silence beats filler); never `@handle` anyone; never report a URL already in `SEEN_TWEETS`. **Status codes:** `TWEET_ROUNDUP_OK` | `TWEET_ROUNDUP_EMPTY`.

---

## Branch: account (`source:account`)

Two sub-modes: **single handle** (decision-ready gist of one account) vs. **all tracked accounts** (theme-grouped digest of a watchlist). Choose by `ARG`.

**Seen set:** last 2 days of logs — extract every `https://x.com/` URL under a prior `### fetch-tweets` account entry into `SEEN_URLS`.

### account — single handle (`ARG` is one @handle)

1. **Normalize `ARG`.** Strip leading `@`, `https://x.com/`, `https://twitter.com/`, `https://nitter.net/`, trailing slash / `/status/...`. Lowercase. Reject if empty, contains whitespace, or >15 chars. On reject → `REFRESH_X_NO_VAR`: send `./notify "fetch-tweets: REFRESH_X_NO_VAR — set an X handle"` and exit 0. Store the cleaned handle as `ACCOUNT`.

2. **Load tweets:**
   - **Path A — prefetched cache** (preferred): read `.xai-cache/fetch-tweets-account.json` (legacy fallback: `.xai-cache/refresh-x.json`).
     ```bash
     jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' \
       .xai-cache/fetch-tweets-account.json 2>/dev/null
     ```
     Record `source=xai-cache`.
   - **Path B — WebFetch fallback** (cache missing/empty, or parsed text has zero x.com status URLs): WebFetch `https://x.com/${ACCOUNT}` with prompt: *"List every tweet, reply, and quote tweet visible on this profile with its full text, timestamp, engagement counts (likes/retweets/replies) if shown, and the permalink https://x.com/handle/status/ID. Return a chronological list."* Record `source=webfetch`.
   - **Path C — degraded**: if both fail or `XAI_API_KEY` unset and WebFetch returns nothing → skip to step 8 with status `REFRESH_X_NO_API_KEY` (key missing) or `REFRESH_X_ERROR` (key set but both paths failed).

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
    x refresh — @ACCOUNT ([VERDICT])
    [lede]
    top cluster: [title] — "[≤80 char excerpt]" ([likes]❤)
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
   - **Path A — cache** (preferred): read `.xai-cache/fetch-tweets-account-<handle>.json` (legacy fallback: `.xai-cache/tweet-digest-<handle>.json`), parsed with the standard `jq` extractor.
   - **Path B — live curl** (only outside the sandbox, when cache absent and `XAI_API_KEY` set):
     ```bash
     curl -m 30 -s -X POST "https://api.x.ai/v1/responses" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer $XAI_API_KEY" \
       -d '{
         "model": "grok-4-1-fast",
         "input": [{"role": "user", "content": "Search X for the latest tweets from:'"$HANDLE"' in the last 3 days. Return the 5 most interesting or substantive tweets. For each: full text, date, direct link (https://x.com/'"$HANDLE"'/status/ID). Skip retweets of others."}],
         "tools": [{"type": "x_search"}]
       }'
     ```
   If `XAI_API_KEY` is unset and no cache exists, log `TWEET_DIGEST_NO_KEY: skill requires XAI_API_KEY` and exit (no notification).
   **Dedup:** drop any candidate URL already in `SEEN_URLS` (last 2 days of logs).

3. **Group by theme, not by account.** Walk the full candidate set; identify 2–4 themes (e.g. "L2 design decisions", "macro / rates", "AI model releases", "regulation"). Each tweet maps to one theme; a `why:` label can seed theme naming for single-topic feeds.

4. **Write a one-sentence take per notable tweet** — what the tweet says, not your opinion of it. Voice per the **Voice** section.

5. **Notify** via `./notify` (<4000 chars):
   ```
   *Tweet Digest — ${today}*

   *Theme: <theme>*
   @handle: <one-sentence summary> — [link](url)
   @handle: <one-sentence summary> — [link](url)

   *Theme: <theme>*
   ...
   ```
   If no notable tweets across all accounts: log `TWEET_DIGEST_OK` and end (no notification).

**Status codes:** `TWEET_DIGEST_OK` (notified or clean) | `TWEET_DIGEST_NO_CONFIG` | `TWEET_DIGEST_NO_KEY`.

---

## Branch: list (`source:list`)

Cross-list narrative resonance + signal-scored top tweets from tracked X lists in the past 24h. Lists are *curator signal* — the value is cross-list resonance + insight + a verdict, not a flat top-N-per-list dump.

**Seen set:** `memory/list-digest-seen.txt` + last 2 days of logs.

1. **Parse and validate `ARG`.**
   ```bash
   if [ -z "$ARG" ]; then
     echo "LIST_DIGEST_NO_CONFIG: var must contain at least one X list ID" \
       >> "memory/logs/$(date -u +%Y-%m-%d).md"
     exit 0
   fi
   IDS_PART="${ARG%%|*}"
   TOPIC_FILTER=""
   [ "$ARG" != "$IDS_PART" ] && TOPIC_FILTER="${ARG#*|}"
   for LIST_ID in $(echo "$IDS_PART" | tr ',' ' '); do
     if ! [[ "$LIST_ID" =~ ^[0-9]+$ ]]; then
       echo "LIST_DIGEST_NO_CONFIG: invalid list ID '$LIST_ID' (must be numeric)" \
         >> "memory/logs/$(date -u +%Y-%m-%d).md"
       exit 0
     fi
   done
   ```
   If `XAI_API_KEY` is unset and no cache exists, fall back to Path C. If no path returns data, log `LIST_DIGEST_NO_CONFIG: XAI_API_KEY required` and stop without notifying.

2. **Fetch each list's top tweets (past 24h)** — prefer cache → API → WebSearch.
   **Path A — cache** (preferred): read `.xai-cache/fetch-tweets-list-${LIST_ID}.json` (legacy fallback: `.xai-cache/list-digest-${LIST_ID}.json`).
   ```bash
   cat ".xai-cache/fetch-tweets-list-${LIST_ID}.json" 2>/dev/null \
     | jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'
   ```
   **Path B — X.AI Responses API:**
   ```bash
   FROM_DATE=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
   TO_DATE=$(date -u +%Y-%m-%d)
   curl -s --max-time 180 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $XAI_API_KEY" \
     -d '{
       "model": "grok-4-1-fast",
       "input": [{"role": "user", "content": "Look at X list https://x.com/i/lists/'"$LIST_ID"'. Step 1: report the list name and a one-line description. Step 2: identify the most engaging tweets posted by members of this list between '"$FROM_DATE"' and '"$TO_DATE"' UTC. Return the top 12 tweets ranked by engagement (likes, retweets, replies). For EACH tweet you MUST return: (a) @handle, (b) the full tweet text (not a paraphrase), (c) explicit engagement counts as separate fields — likes:N, retweets:N, replies:N, views:N if available, (d) the direct permalink in the form https://x.com/<handle>/status/<id>, (e) media type (image|video|none), (f) one-line context if it'\''s a reply or quote tweet (who/what). Skip retweets of accounts NOT on this list. If a tweet has an image and you can analyze it, include a one-line image description."}],
       "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'", "enable_image_understanding": true}]
     }'
   ```
   Parse with the standard `jq` extractor.
   **Path C — WebSearch fallback** (both cache and key unavailable, OR Grok returns nothing): `site:x.com "i/lists/${LIST_ID}" OR list:${LIST_ID} after:${FROM_DATE}`. Lower quality; mark this list's source as `websearch`.
   **Per-list outcome:** `ok` (≥3 tweets) | `quiet` (1–2) | `empty` (0, list found but no posts) | `error` (API/cache/access failure — note reason).

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

7. **Send the notification** via `./notify` (<4000 chars), verbatim format (`x.com/handle`, Telegram `[label](url)`):
   ```
   *List Digest — ${today}*

   [VERDICT LINE — one line, ≤140 chars, plain text]

   🔗 *Cross-list narratives*
   1. *[narrative title]* — appeared on [List A] + [List B]
      x.com/handle: [insight, not paraphrase] (♥ likes, ↻ rt) — [View](url)
      x.com/handle2: [insight] (♥ likes, ↻ rt) — [View](url)

   2. *[narrative title]* — appeared on [List A] + [List C]
      ...

   *[List Name 1]*
   - x.com/handle — [insight] (♥ likes, ↻ rt) — [View](url)
   - x.com/handle — [insight] (♥ likes, ↻ rt) — [View](url)

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
   ```bash
   FROM_DATE=$(date -u -d "1 day ago" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)
   TO_DATE=$(date -u +%Y-%m-%d)
   ```
   **Path A — cache** (preferred): read `.xai-cache/fetch-tweets-agent-buzz.json` with the standard `jq` extractor. Record `source=xai-cache`.
   **Fallback chain** (fire in order, stop at first success; record which source won for the footer):
   1. curl to X.AI (the response for each tweet **must** include explicit engagement counts + follower count, or step 3 scoring can't run):
      ```bash
      curl -s -X POST "https://api.x.ai/v1/responses" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $XAI_API_KEY" \
        -d '{
          "model": "grok-4-1-fast",
          "input": [{"role": "user", "content": "Search X from '"$FROM_DATE"' to '"$TO_DATE"' for tweets in the AI-agents conversation: autonomous agents, agent frameworks, MCP / agent protocols, agent products, agent benchmarks, agent research papers. Return up to 40 candidates. For EACH candidate you MUST return: @handle, follower_count (integer or null), role_guess (builder|founder|researcher|investor|commentator|anon), one-line claim (what they actually said — not a paraphrase, the thesis), likes (int), retweets (int), replies (int), posted_at (ISO), direct_link (https://x.com/username/status/ID). Prefer builders/founders/researchers. Skip obvious engagement-farming threads (\"RT if you agree\", reply-guy pileons, giveaways)."}],
          "tools": [{"type": "x_search", "from_date": "'"$FROM_DATE"'", "to_date": "'"$TO_DATE"'"}]
        }'
      ```
   2. WebFetch the same X.AI endpoint (bypasses sandbox env-var blocking for some requests).
   3. WebSearch with a forced-fresh query: `"AI agents twitter today ${today}"` — discard anything >48h old, expect degraded metadata.

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

7. **Notify** via `./notify` (<4000 chars):
   ```
   *Agent Buzz — ${today}*
   _<conversation-shape one-liner>_

   **<Cluster 1 name>**
   • @handle — <insight>
     <link>
   • @handle — <insight>
     <link>

   **<Cluster 2 name>**
   • @handle — <insight>
     <link>

   <!-- _src: xai|webfetch|websearch · candidates: N → kept: M_ -->
   ```
   Keep the footer — it's how future self-audits debug empty days. Never pad to hit 10. 6 good > 10 mid.

**Status codes:** `AGENT_BUZZ_OK` (≥1 cluster notified) | `AGENT_BUZZ_EMPTY` (fetch succeeded, nothing survived — send `Agent Buzz — ${today}: quiet day, no survivors.`) | `AGENT_BUZZ_ERROR` (all three sources failed — notify `Agent Buzz — ${today}: all sources failed (${error summary}).` and log the per-source failure).

---

## Log (all branches)

Append ONE entry per run to `memory/logs/${today}.md` under a single `### fetch-tweets` heading (the health loop parses this shape). The first bullet is the **discriminator** naming the branch/mode that ran; the rest are branch-specific bullets. Always include the reported tweet URLs as bullets (for next-run dedup).

```
### fetch-tweets
- mode: <keyword|topic|account|list|agent-buzz>
- status: <STATUS_CODE for the branch that ran>
- source: <SOURCE_PATH / per-source counts / per-list outcome, as applicable>
- <branch-specific bullets — carry over each branch's fields:>
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

## Sandbox note

The sandbox blocks outbound curl that carries `$XAI_API_KEY` in a header. Every branch is cache-first — `scripts/prefetch-xai.sh` runs **before** Claude starts (with full env access) and writes `.xai-cache/*.json`; the skill reads those. Fallbacks that bypass the sandbox: **WebSearch** (keyword/topic/list/agent-buzz) and **WebFetch** (account single-handle against the public `x.com/${ACCOUNT}` profile; agent-buzz against the X.AI endpoint). Never rely on a live curl to `api.x.ai` succeeding inside the sandbox.

**Cache filenames the prefetch must produce, per mode** (canonical first; legacy fallback the skill also reads):

| mode | X-search window | canonical cache | legacy fallback |
|---|---|---|---|
| keyword | yesterday→today | `.xai-cache/fetch-tweets.json` | *(same)* |
| topic (single) | yesterday→today | `.xai-cache/fetch-tweets-topic.json` | `.xai-cache/roundup-var.json` |
| topic (multi) | yesterday→today | `.xai-cache/fetch-tweets-topic-<slug>.json` | `.xai-cache/roundup-*.json` |
| account (single) | yesterday→today | `.xai-cache/fetch-tweets-account.json` | `.xai-cache/refresh-x.json` |
| account (all) | last 3 days | `.xai-cache/fetch-tweets-account-<handle>.json` | `.xai-cache/tweet-digest-<handle>.json` |
| list | yesterday→today (+`enable_image_understanding`) | `.xai-cache/fetch-tweets-list-<LIST_ID>.json` | `.xai-cache/list-digest-<LIST_ID>.json` |
| agent-buzz | 1 day ago→today | `.xai-cache/fetch-tweets-agent-buzz.json` | *(none — legacy did live curl)* |

The exact per-mode prompt each cache should hold is the Path B / fallback-chain curl body in that mode's branch above. A single `fetch-tweets)` case in `scripts/prefetch-xai.sh` can produce all of these by parsing `${var}` into `SOURCE`/`ARG` the same way this skill does.

## Environment Variables

- `XAI_API_KEY` — X.AI API key for Grok's `x_search` tool. **Optional** — every branch degrades to WebSearch/WebFetch when it's unset, at lower quality. The `account (all)` sub-mode is the only path that hard-exits without it *and* without a cache (`TWEET_DIGEST_NO_KEY`); all other modes still produce output via the sandbox-safe fallbacks.
