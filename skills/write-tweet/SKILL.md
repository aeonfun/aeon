---
name: write-tweet
description: Multi-format tweet studio - standalone drafts (10 across 5 size tiers), a 5-10 tweet thread, or 10 remixes of past tweets, selected via ${var}
metadata:
  title: Write Tweet
  category: basics
  var: ""
  tags:
    - social
    - content
  requires:
    - TWITTER_API_KEY
    - XAI_API_KEY?
---
> **${var}** — `[format] [argument]`. Pick one of three formats, then pass its argument. Empty ⇒ **drafts** (standalone tweet drafts). `thread …` ⇒ a multi-tweet **thread**. `remix …` ⇒ **remix** of your past tweets. `revise:<instruction>` ⇒ **revise** the last saved draft (the Telegram force-reply shape, e.g. `revise:make it punchier`). See Selector below.

Read `memory/MEMORY.md` for context on recent articles, digests, topics being tracked, and the operator's tracked handles/token. Each branch then reads its own `memory/logs/` window (drafts: 3 days, thread: 7 days, remix: 14 days) — see the branch.

## Selector

**Revise intercept first (Telegram force-reply).** If `${var}` starts with `revise:` → jump straight to **Branch: REVISE** (below) and stop; do **not** token-parse. This is the shape `scripts/telegram-route.sh` sends when the operator replies to a "refine this draft?" prompt — the `revise:` prefix would otherwise fall through to the drafts branch.

Otherwise, parse `${var}` once, before doing anything else:

1. Trim whitespace. Take the **first token** (everything up to the first space **or** the first `:`), lowercased.
2. If that token is one of `drafts`, `thread`, `remix` → that's the **format**. The **argument** is the remainder of `${var}` after stripping the keyword and one optional following `:` and surrounding whitespace.
3. Otherwise → format is **drafts** and the argument is the **entire** `${var}` (backward-compatible with the legacy `var = topic/URL` behaviour).

| `${var}` | Format | Argument | Behaviour |
|---|---|---|---|
| `` (empty) | drafts | — | Auto-select the most tweetable insight from today's logs |
| `prediction markets are broken` | drafts | `prediction markets are broken` | Drafts on that topic |
| `https://arxiv.org/abs/2401.00001` | drafts | that URL | Drafts about the linked source |
| `drafts: thread models are underrated` | drafts | `thread models are underrated` | Escape hatch: force drafts on a topic that starts with a reserved word |
| `thread` | thread | — | Auto-pick the day's highest-signal event and thread it |
| `thread oracle incentives are broken` | thread | `oracle incentives are broken` | Thread on that topic |
| `remix` | remix | — | Remix past tweets, default 180d window |
| `remix 1y` | remix | `1y` | Remix, 1-year window |
| `remix 2025-01-01:2025-03-01` | remix | `2025-01-01:2025-03-01` | Remix, explicit date range |

Then dispatch to the matching branch below. Only run the selected branch.

---

# Branch: REVISE (`revise:…` — Telegram force-reply)

The operator tapped the "refine this draft?" prompt and sent a free-text revision instruction. Handle it before any normal generation:

1. **Strip the prefix.** The instruction is `${var#revise:}` (the remainder may itself contain colons — keep them). Trim surrounding whitespace. Example values: `make it punchier`, `drop the emoji`, `lead with the number`.
2. **Load the last draft.** Read `memory/drafts/write-tweet-latest.md` — the stable path every normal run saves to (see **Save draft + offer revision**). If it's missing or empty, there's nothing to refine yet: send `./notify "Nothing to revise yet — run a tweet draft first, then reply here to refine it."` and **end the run**.
3. **Apply the instruction.** Re-read `soul/` (`SOUL.md`, `STYLE.md`, examples) for voice, then regenerate the saved draft applying the operator's instruction. Keep the **same format** (drafts / thread / remix) and structure as the saved draft — you're refining it, not starting over — and respect the same character limits and anti-patterns as the originating branch (no hashtags, no emojis unless the draft had them, per-tier/thread length caps).
4. **Re-save.** Overwrite `memory/drafts/write-tweet-latest.md` with the revised draft, so a further `revise:` refines the newest version.
5. **Re-send** via `./notify` in the same shape the originating branch uses for its draft, with a first line that flags it as a revision, e.g. `revised (${var#revise:}):` followed by the refreshed draft body. (For multi-line output use `./notify -f <file>`.)
6. **Re-offer** a further revision (the operator is actively iterating, so this is expected, not a nag — skip the daily dedup guard here):
   ```bash
   ./notify "Want another pass? Reply with a change and I'll revise again." \
     --force-reply --placeholder "e.g. cut the last line" \
     --context "write-tweet::revise"
   ```
7. **Log** under `### write-tweet` with `- **Format:** revise` and the instruction (see **Log**), then **end the run** — do NOT run drafts / thread / remix.

---

# Branch: DRAFTS (default / empty ${var})

Generate 10 standalone tweet drafts across 5 size tiers (2 variations each). The **argument** is the topic or URL; empty ⇒ auto-select.

Read the last **3 days** of `memory/logs/` to understand what's been covered and avoid repeating takes.

## Topic Selection (drafts)

If the argument is set, use it as the topic (it may be a keyword, a thesis, or a URL).

Otherwise, read today's `memory/logs/${today}.md` and pick the **single most tweetable insight**. Prioritize:
1. A take from today's article (already researched and opinionated)
2. A surprising connection between two of today's findings
3. A reaction to something from a tweet roundup or digest

If the topic needs fresher context, use WebSearch to verify or expand.

If `TWITTER_API_KEY` is set, search X for what people are already saying about the topic. **twitterapi.io is the primary** path for this X read (see **Fetching**, including its **Shell shape** note). Get the window start first, as its own Bash call:
```bash
date -u -d yesterday +%Y-%m-%d
```
It prints FROM_DATE. Then one call, with the topic and FROM_DATE written in literally:
```bash
./secretcurl -s -o /tmp/tw-wt.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/tweet/advanced_search" \
  --data-urlencode "query=<TOPIC> since:<FROM_DATE>" --data-urlencode "queryType=Latest" \
  -H "X-API-Key: {TWITTER_API_KEY}"
```
On `HTTP=200` with a non-empty `.tweets[]`, parse and use the 5 most notable:
```bash
jq -r '.tweets[] | [.author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-wt.json
```
This helps understand the existing conversation so you can add signal, not noise. **Path B - xAI Grok `x_search` (fallback)** (only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` is unset; see **Fetching**; set the Bash tool `timeout` ≥180000):
```bash
jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for what people are saying about <TOPIC> in the last 24 hours. Return the 5 most notable tweets with @handle and summary."}], tools:[{type:"x_search"}]}' \
  | ./secretcurl -s -o /tmp/xai-wt.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {XAI_API_KEY}" \
  --data-binary @-
```
It prints the HTTP status (secretcurl also prints an `http=... bytes=...` line on stderr).
On `HTTP=200` with a non-empty body, parse `/tmp/xai-wt.json` with `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'`. Skip the X search only if both keys are `KEY_UNSET`; if a key is set but that path truly fails (non-2xx / empty / timeout - record the real reason, never "unavailable" when the key was set), fall back to WebSearch (`site:x.com "<topic>"`, lower quality) as a last resort.

## Voice (drafts)

If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`, `soul/examples/`), read them and match the owner's voice exactly.

If no soul files exist, write in a clear, direct, opinionated style:
- Short sentences. No hedging. No corporate voice.
- State the opinion first, reasoning after (if any).
- Reference specifics — names, projects, numbers — not vague hand-waving.
- No hashtags. No emojis. No "RT if you agree." No self-referential meta.

## Writing (drafts)

Generate **10 drafts** — 5 size tiers with **2 variations each**. The two variations within a tier should take genuinely different angles (different framing, emphasis, mood) — not minor rewrites.

### Size tiers

**Tier 1 — One-liner** (~50–100 chars)
Single punchy sentence. Maximum compression — every word load-bearing.

**Tier 2 — Two-punch** (~100–180 chars)
Two sentences. First sets up, second lands the hit. Claim then evidence, or observation then implication.

**Tier 3 — Paragraph** (~180–280 chars)
A full thought in one tweet. Three to four sentences. Context, position, kicker.

**Tier 4 — Long tweet** (~280–600 chars)
Uses X's extended tweet length. A mini-essay with setup, turn, and conclusion. Grounded with a specific example or data point.

**Tier 5 — Thread opener** (first tweet under 280 chars + thread sketch)
First tweet hooks — sets up a thesis. Below the tweet, include a `---` separator and a 3–5 bullet sketch of where the thread goes (key beats, not full text).

### Approach styles (mix these across variations)
- **Hot take** — opinionated position stated directly
- **Observation** — pattern-match most people aren't seeing
- **Sardonic/ironic** — dry humor
- **Reframe** — question the premise of the mainstream take
- **Data drop** — lead with a specific number or fact, then the take
- **Narrative** — tiny story or anecdote that makes the point
- **Question** — a genuine question that reframes thinking

Each tier's two variations should use **different** approach styles.

### Constraints (drafts)
- Tier 1–3: hard 280-character limit per tweet.
- Tier 4: up to 600 characters (X long tweet).
- Tier 5: first tweet under 280, thread sketch is bullet points only.
- No hashtags. No emojis. No "RT if you agree."
- No self-referential meta ("hot take:" or "unpopular opinion:").
- Count characters carefully.

## Output Format (drafts)

```
## Tweet Drafts: [topic]

### Tier 1 - One-liner
**1a. [style]**
> [tweet text]

**1b. [style]**
> [tweet text]

### Tier 2 - Two-punch
**2a. [style]**
> [tweet text]

**2b. [style]**
> [tweet text]

### Tier 3 - Paragraph
**3a. [style]**
> [tweet text]

**3b. [style]**
> [tweet text]

### Tier 4 - Long tweet
**4a. [style]**
> [tweet text]

**4b. [style]**
> [tweet text]

### Tier 5 - Thread opener
**5a. [style]**
> [tweet text]
---
- [beat 1]
- [beat 2]
- [beat 3]

**5b. [style]**
> [tweet text]
---
- [beat 1]
- [beat 2]
- [beat 3]
```

After all 10, add a one-line pick for **best overall** and **best per tier**.

## Notify (drafts)

Send the drafts via `./notify` — write the body to `/tmp/wt-drafts.md` first with the Write tool (a shell redirect is refused), then `./notify -f /tmp/wt-drafts.md` (keeps the long body off argv and out of the repo root):
```
tweet drafts: [topic]

- one-liner -
1a. [tweet text]
1b. [tweet text]

- two-punch -
2a. [tweet text]
2b. [tweet text]

- paragraph -
3a. [tweet text]
3b. [tweet text]

- long tweet -
4a. [tweet text]
4b. [tweet text]

- thread opener -
5a. [tweet text]
5b. [tweet text]

best: #[n] - [reason]
```

Then **save the draft and offer a revision** (see *Save draft + offer revision*), and log (see **Log**, format `drafts`).

---

# Branch: THREAD (`thread …`)

Write a tweetstorm/thread (5–10 tweets) in the operator's voice. The **argument** is the topic, thesis, or URL; empty ⇒ auto-pick the day's highest-signal event.

Read `memory/MEMORY.md` and the last **7 days** of `memory/logs/` for context. Use recent signals — notable market moves, paper picks, tweet roundup discourse — as raw material if no topic is set.

## Voice (thread)

If `soul/` files exist, read them in order before writing:
1. `soul/SOUL.md` — identity, worldview, opinions
2. `soul/STYLE.md` — writing style, sentence structure, anti-patterns
3. `soul/examples/tweets.md` — rhythm and tone calibration. Match this exactly.
4. `soul/examples/bad-outputs.md` — what NOT to do

If soul is absent, use a clear, direct, plain-spoken tone — but the anti-patterns under Writing Rules still apply.

## Topic Selection (thread)

**If the argument is set**, use it as the topic (keyword, thesis, or URL). Skip scoring and go straight to research and drafting. Pick the sharpest angle from:
- Today's `memory/logs/${today}.md` — article thesis, paper finding, market signal
- `memory/MEMORY.md` notable signals — anything with reflexivity, contradiction, or structural insight
- A connection between two recent findings that most people aren't seeing

**If the argument is empty**, auto-pick the day's highest-signal event. Every run produces something worth amplifying — a feature shipped, a price move, a milestone crossed, a notable tweet — and most of it dies unposted. Read `memory/logs/${today}.md` end-to-end, score the events that actually happened, and thread the single highest-scoring one.

### Auto-pick scoring (empty-argument mode)

Walk today's log section by section. Per section, extract at most one candidate event (first-match-wins) and score it:

| Signal | Score | Detection cue |
|---|---:|---|
| New feature / skill shipped — PR opened on a watched repo | +6 | log sections named `feature`, `external-feature`, `create-skill`, `tool-builder`; a bullet mentioning `PR:` or a PR number on a watched repo |
| Star milestone crossed (any multiple of 50 — 50, 100, 150, …) | +5 | repo-pulse `stargazers_count=N` where `N % 50 == 0`, or a star-milestone skill ran today |
| Token price move ≥ 15% (absolute, 24h) | +5 | token-report `24h` / `Price:` line in that range |
| Token price move 10–14.99% (absolute, 24h) | +3 | same line, 10–14.99% range |
| Skill built / shipped today | +4 | a `## <skill-name>` section whose body says "shipped"/"merged" or links a PR on the watched repo |
| New high-engagement tweet (≥ 20 likes OR ≥ 5 RTs) on the operator's tracked handle/token | +3 | fetch-tweets log lines with `Likes:` ≥ 20 or `RTs:` ≥ 5, filtered to the operator's configured handles/token |
| New fork by a recognizable contributor (not the agent / operator) | +2 | repo-pulse `New forks (24h):` ≥ 1, fork owner not the operator |
| Notable PR merged on a watched repo (not authored by the agent / operator) | +3 | operator-scorecard (push) log mentioning a PR whose author isn't the operator |
| New leaderboard / fork-fleet anomaly worth narrating | +2 | skill-health (analytics view) or fork-health (cohort lens) log with a non-empty anomaly section |

If one event hits multiple signals (e.g. star milestone + price move on the same day), score each separately and take the **highest single-event score** — never sum across unrelated events to clear a threshold.

Tiebreakers (highest score wins, then): newest event (latest log section) → event with a concrete URL attached (PR, tweet, article) → alphabetical by section name.

If the top candidate scores **< 3**, there's no thread worth forcing on a quiet day — note it in the log and exit without notifying or drafting. If today's log is missing or empty, do the same.

The configured handles, tracked token, and watched repos come from `soul/` and `memory/` (the operator's tracked-handle/token notes) — never hardcode them.

Good thread topics:
- A structural critique of something (oracle incentives, prediction market design, DeFi primitives)
- A thesis with data: lead with numbers, build the argument
- A contrarian take on a mainstream narrative
- A builder's breakdown of how something actually works vs. how people think it works

Avoid topics already covered in the last 48h (check logs).

If the topic needs fresh context, use WebSearch to get current data.

## Thread Structure

A thread is **5–10 tweets**. Not a listicle. Not a lecture. A narrative arc.

**Tweet 1 — Hook**
The opening hit. States the thesis or drops the most surprising fact. Must make someone stop scrolling. No setup — land in the middle of the action.

**Tweets 2–(n-1) — Development**
Each tweet is self-contained but pulls forward. Build the argument:
- Add evidence, data, or a specific example
- Introduce a complication or nuance
- Flip the framing once mid-thread
- Each tweet must earn its place — cut any that are just filler

**Tweet n — Landing**
The payoff. The implication, the action, or the reframe. Should feel like the point was building to this. Not a summary — a conclusion.

### Thread formats (pick one per run)

**Data-driven**: Lead with a striking number. Each subsequent tweet unpacks what it means.

**Structural critique**: Identify a broken mechanic. Walk through why it's broken. Show the second-order effects.

**Builder's breakdown**: How X actually works under the hood, for people who only see the surface.

**Narrative**: A sequence of events that reveals something. Ends with "here's what this tells us."

**Thesis-first**: State the position boldly in tweet 1. Spend the rest proving it.

## Writing Rules (thread)

- Write as the operator, first person.
- Match soul/STYLE.md conventions for capitalization, punctuation, and rhythm. If soul is absent: short sentences, plain language, em dashes over commas.
- State the opinion first, reasoning after.
- No hedging: kill "some might argue", "to be fair", "it remains to be seen."
- No corporate voice: kill "leverage", "ecosystem play", "exciting", "importantly."
- No filler transitions: kill "now,", "so,", "basically,", "essentially."
- Reference specific projects, people, mechanisms — not vague hand-waving.
- No hashtags. No emojis. No "RT if you agree." No "thread 🧵".
- Number tweets as 1/ 2/ 3/ etc. at the end of each tweet.
- Each tweet must pass the test: would the operator actually post this?

### Character limits (thread)
- Tweets 1 through (n-1): hard 280-character limit each.
- Final tweet: up to 280 characters.
- Count carefully. If a draft is over 280, cut it.

## Output Format (thread)

```
## Thread: [topic - 3-5 words]

**Format:** [data-driven / structural critique / builder's breakdown / narrative / thesis-first]
**Length:** [n] tweets

---

**1/**
[tweet text - 280 chars max]

**2/**
[tweet text - 280 chars max]

...

**n/**
[tweet text - 280 chars max]

---

**Why this thread:** [1-2 sentences on why this topic, why now, why the thread format (vs. single tweet)]
```

## Notify (thread)

Send via `./notify` — write the thread body to `/tmp/wt-thread.md` first with the Write tool (a shell redirect is refused), then `./notify -f /tmp/wt-thread.md` (keeps the long body off argv and out of the repo root):
```
thread: [topic - 3-5 words]

1/ [tweet 1]

2/ [tweet 2]

...

n/ [tweet n]
```

Then **save the draft and offer a revision** (see *Save draft + offer revision*), and log (see **Log**, format `thread`). On a quiet day (top candidate < 3, or empty log), send nothing — no draft, no save, no offer — just log the no-op.

---

# Branch: REMIX (`remix …`)

Fetch ~30 older tweets, pre-filter for remixability, then produce 10 new rephrased versions across diverse strategies with post-write quality gates. The **argument** overrides the time window — accepts `30d`, `180d`, `1y`, or a date range `YYYY-MM-DD:YYYY-MM-DD`. Defaults to `180d` (30–180 days ago window, see step 1).

<!-- autoresearch: variation B — sharper output via remixability pre-filter, strategy-rotation, skip-gate for un-remixable originals, post-write self-edit; folded in A's multi-angle queries + engagement counts and C's source-status footer + OK/EMPTY/ERROR branching -->

This branch **requires `TWITTER_API_KEY` or `XAI_API_KEY`**. If both are unset, emit `REMIX_TWEETS_ERROR - no TWITTER_API_KEY or XAI_API_KEY configured`, notify the cause, and stop.

Read `memory/MEMORY.md` for context on current topics and recent thinking.
Scan the last **14 days** of `memory/logs/` for any `### write-tweet` entries with `**Format:** remix` (and legacy `## Remix Tweets` entries) and collect every tweet URL ever remixed — that's the persistent dedup set.

## Voice (remix)

If a `soul/` directory exists and is populated, read for voice calibration:
1. `soul/SOUL.md` — identity, worldview, opinions
2. `soul/STYLE.md` — writing style, sentence structure, anti-patterns
3. `soul/examples/tweets.md` — rhythm and tone calibration (if present)

Otherwise, match the tone of the originals fetched in step 1.

## Steps (remix)

### 1. Fetch ~30 older tweets (over-fetch for filtering)

We over-fetch so the remixability pre-filter (step 2) has room to drop un-remixable candidates without reducing the output count below 10.

**Path A - twitterapi.io (primary).** Pull this handle's timeline, then filter to the remix window client-side (`/user/last_tweets` has no server-side date filter). Paginate with `&cursor=<next_cursor>` while `.has_next_page` until you have ~30 in-window originals or pages run out. `createdAt` is Twitter-native; normalize with `strptime` before the window compare. See **Fetching**.

Resolve the time window (from the branch argument) in your head, not in a shell script (see **Shell shape** in **Fetching**). `TIME_WINDOW` = the remix argument parsed from `${var}`, default `180d`:
- It contains `:` (for example `2025-01-01:2025-06-30`): FROM_DATE = the part before the `:`, TO_DATE = the part after it. No `date` call needed.
- Otherwise: DAYS = its digits, UNIT = the rest. When UNIT is `y`, DAYS = DAYS x 365 (work the number out yourself). Then two `date` calls, each its own Bash call, with DAYS written in literally:
  ```bash
  date -u -d '<DAYS> days ago' +%Y-%m-%d
  ```
  ```bash
  date -u -d '30 days ago' +%Y-%m-%d
  ```
  The first prints FROM_DATE, the second TO_DATE.

Resolve the X handle. Look up in this order: (a) `$X_HANDLE` env var, (b) handle mentioned in `soul/SOUL.md` under "Identity", (c) abort with `REMIX_TWEETS_ERROR - no handle configured`.

One call, with the handle written in literally:
```bash
./secretcurl -s -o /tmp/tw-wt-remix.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/user/last_tweets" \
  --data-urlencode "userName=<HANDLE>" -H "X-API-Key: {TWITTER_API_KEY}"
```
On `HTTP=200` with a non-empty `.data.tweets[]`, parse originals in the window (drop `.isReply`, text starting `RT @`) and mark `twitterapi=ok`. One `jq` per call, FROM_DATE and TO_DATE written in literally:
```bash
jq -r '.data.tweets[] | .day = (try (.createdAt | strptime("%a %b %d %H:%M:%S %z %Y") | strftime("%Y-%m-%d")) catch "0000-00-00") | select((.isReply | not) and (.day >= "<FROM_DATE>") and (.day <= "<TO_DATE>")) | [.id, .text, .url, .day, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-wt-remix.json
```

**Path B - xAI Grok `x_search` (fallback).** Only if Path A returned non-2xx / empty / timeout, or `TWITTER_API_KEY` is unset (see **Fetching**; set the Bash tool `timeout` ≥180000). Run **two angled x_search queries** so the pre-filter has a diverse pool - don't rely on one query shape:

- **Query 1 — opinion posts** (most remixable): original tweets that state a take, opinion, or principle (not news-tied, not announcements).
- **Query 2 — standout posts** (high engagement = proven): top-engagement original tweets in the window.

Each query must request for every tweet: full text, date posted, engagement stats (likes, retweets, replies), and the direct `https://x.com/HANDLE/status/ID` link. Ask explicitly for **original posts only** (not replies, not retweets, not quote tweets). Aim for ~15-20 tweets per query.

Build the body with the resolved handle, FROM_DATE and TO_DATE written into the jq filter literally (prompt inline, no shell variables, no jq `$name` variables) and pipe it straight into the send (set the Bash tool timeout ≥180000, see Fetching):
```bash
jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for original tweets (exclude replies, retweets, quote tweets) posted by @<HANDLE> from <FROM_DATE> to <TO_DATE>. I want OPINION/TAKE posts - tweets that state a view, principle, or observation (not news announcements, not project updates, not single-link posts). Return up to 15. For each: full tweet text, date (YYYY-MM-DD), likes, retweets, replies, direct link https://x.com/<HANDLE>/status/ID. Format as numbered list."}], tools:[{type:"x_search", allowed_x_handles:["<HANDLE>"], from_date:"<FROM_DATE>", to_date:"<TO_DATE>"}]}' \
  | ./secretcurl -s -o /tmp/xai-wt-q1.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {XAI_API_KEY}" \
  --data-binary @-
```
On `HTTP=200` with a non-empty body, parse `/tmp/xai-wt-q1.json` with the standard extractor `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'`.

Then repeat with a second body `Q2` (the same one call, response to `/tmp/xai-wt-q2.json`) varying the prompt to "top-engagement original tweets (highest likes+retweets) in the same window. Return up to 15."

Deduplicate by tweet ID across both queries. Log `xai=ok` / `xai=partial` / `xai=fail` based on how many queries returned data.

**Path C - WebFetch (last resort only).** Only if Paths A and B both genuinely fail (non-2xx / empty / timeout - record the true reason, never "unavailable" when a key was set) retry via the built-in WebFetch tool against the public `https://x.com/HANDLE` profile.

### 2. Remixability pre-filter (drop before remixing)

Drop any candidate that matches any of these — these rarely yield a remix worth posting:

- **Persistent dedup**: tweet URL appears anywhere in `memory/logs/*.md` under a `### write-tweet` remix entry (or legacy `## Remix Tweets`) → drop.
- **Reply/RT/quote leakage**: text starts with `@handle`, has `RT @`, or is clearly a reply/quote snippet.
- **Link-only / media-only**: text is just a URL, or <20 chars of prose around a URL.
- **News-tied / dated**: references a specific event by name, a dated product launch, or named individuals in a way that wouldn't land today (e.g., "thoughts on OpenAI's Dev Day"). Exception: if the insight is clearly evergreen and the name is incidental, keep.
- **Thread fragment**: ends with `👇`, `(1/n)`, `continued...`, or begins with a number like `2.` / `3/` — remixing a fragment strips context.
- **Meta-tweet**: "new follower milestone", "follow me for…", tweet about the account itself.
- **Non-insight humor**: jokes that depend on specific current context a reader today wouldn't have.

After filtering, you should have ≥10 candidates. If <10, fall back to **relaxing only the news-tied rule** for the least-dated candidates. If still <10, emit `REMIX_TWEETS_DEGRADED` (see step 6) and produce however many pass.

From survivors, select **exactly 10** prioritizing: (a) topical diversity (no two on the same narrow subject), (b) broader appeal (engagement as a tiebreaker, not primary filter — we care about remixability, not popularity).

### 3. Assign strategies (rotation enforced)

Before writing any remix, assign each of the 10 selected originals a **remix strategy**. The 10 assignments must span **at least 6 distinct strategies** from the list below (prevents all-sharpen laziness). No strategy may be used more than 3 times.

- **Sharpen** — wordy original compressed into a one-liner.
- **Flip the frame** — same insight from the opposite direction.
- **Update** — take still holds, ground in today's context.
- **Escalate** — mild original made spicier.
- **Soften** — hot take restated as an observation that leads the reader there.
- **Concretize** — abstract original with a specific example or data point.
- **Abstract** — specific original zoomed to the general principle.

Match strategy to original — don't force Escalate on an already-spicy take.

### 4. Write remixes

For each of the 10, draft a **new tweet** (not a paraphrase) that:
- Captures the core idea of the original.
- Uses **substantially different words and framing** (target ≥60% new vocabulary vs. the original).
- Stands alone — nothing in it should read as "this is a rewrite".
- Stays ≤280 characters.
- Matches voice (soul files or the originals' tone).

**Voice rules:**
- First person.
- Short sentences. Em dashes over commas. No semicolons.
- State the opinion first, reasoning after (if any).
- No hedging. No corporate voice. No hashtags. No emojis.

### 5. Post-write quality gate (self-edit pass)

For each remix, run this checklist. **Rewrite if any item fails.** If rewrite still fails after one attempt, **drop the tweet and replace it** with a different un-remixed survivor from step 2 (assign a fresh strategy).

1. **Specificity** — does it say something (not vague platitude)? The claim/take must be pin-pointable in one sentence.
2. **Novelty** — ≥60% of content words differ from the original. If <60%, it's a paraphrase, not a remix.
3. **Length** — ≤280 chars including spaces.
4. **No banned phrases** — remove any of: "at the end of the day", "let's be real", "hot take", "unpopular opinion", "in today's world", "as we all know", "just my two cents", "food for thought", "thread 🧵".
5. **Standalone** — reads naturally without knowing the original existed.
6. **Would-I-post-this test** — self-score 1-5. If <4, rewrite once; if rewrite is still <4, drop and replace.

Track drops in the log (step 7). If you drop more than 3, emit `REMIX_TWEETS_DEGRADED`.

### 6. Output & Notify

Lead with a one-line **batch verdict** summarizing strategy spread (e.g., "3 sharpens, 2 flips, 2 updates, 2 concretizes, 1 escalate"). Keep the whole message ≤4000 chars. No leading indentation.

Send via `./notify` — write the message body to `/tmp/wt-remix.md` first with the Write tool (a shell redirect is refused), then `./notify -f /tmp/wt-remix.md` (keeps the long body off argv and out of the repo root):
```
*Remix Tweets - ${today}*
Batch: [one-line strategy spread]. Drops: N.

1. *[strategy]*
[original excerpt ≤80 chars] → [remix]

2. *[strategy]*
[original excerpt ≤80 chars] → [remix]

... (all 10, or fewer if DEGRADED)

source: twitterapi=ok|fail|skip, xai=ok|partial|fail|skip, fetched=N, kept=N, drops=N
```

**Status branching** (prepend to the notify body as the first line instead of `Batch:`):
- `REMIX_TWEETS_OK` — 10 remixes produced, ≤3 drops.
- `REMIX_TWEETS_DEGRADED` — <10 produced OR >3 drops. Include cause.
- `REMIX_TWEETS_EMPTY` - no usable tweets in the window from twitterapi or xAI. Notify once with cause and stop.
- `REMIX_TWEETS_ERROR` - no handle configured, neither `TWITTER_API_KEY` nor `XAI_API_KEY`, OR all fetch paths failed. Notify cause and stop.

On a successful (`OK`/`DEGRADED`) run, after notifying, **save the draft and offer a revision** (see *Save draft + offer revision*) — persist the remix batch to `memory/drafts/write-tweet-latest.md`. Skip the save+offer on `EMPTY`/`ERROR` (nothing was produced).

### 7. Log (remix)

Append to `memory/logs/${today}.md` under the shared `### write-tweet` heading (see **Log**, format `remix`).

The URL list logged there is the canonical dedup source — every subsequent run reads these URLs back and drops any re-appearance (persistent dedup).

Save the fetched originals (even the filtered-out ones) to `memory/topics/tweet-archive.md` (append, deduplicated by URL) so other skills (article, drafts branch) can reference them as source material.

## Constraints (remix)

- Never post remixes directly — this branch only drafts. Operator reviews via notification.
- Never remix a URL already in persistent dedup.
- Never output fewer than 10 without emitting `REMIX_TWEETS_DEGRADED` with a cause.

## Environment Variables (remix)
- `TWITTER_API_KEY` - twitterapi.io API key. **Primary** for this branch.
- `XAI_API_KEY` - X.AI API key for Grok x_search. **Fallback** when twitterapi fails or is unset.
- `X_HANDLE` (optional) — X handle to search. Falls back to `soul/SOUL.md` Identity section if unset.

---

## Save draft + offer revision (all branches)

After a normal run (drafts / thread / remix) has produced and notified a draft, do two things so the operator can refine it from Telegram. **Skip both on a no-op** (e.g. a quiet-day thread that produced nothing) — there's nothing to save or offer.

1. **Persist the draft** to a stable path a later `revise:` run can reload:
   ```bash
   mkdir -p memory/drafts
   ```
   Write the full draft you just sent — the same content as the notification body (all tiers / the whole thread / all remixes) — to `memory/drafts/write-tweet-latest.md`, overwriting any previous file. Only the newest draft is revisable.
2. **Offer a revision.** Because `force_reply` and inline buttons can't share one Telegram message, send this as a **separate** `./notify` after the draft:
   ```bash
   ./notify "Want to refine this draft? Reply with a change and I'll revise it." \
     --force-reply --placeholder "e.g. make it punchier" \
     --context "write-tweet::revise"
   ```
   The reply routes back as `var="revise:<instruction>"` and re-dispatches this skill into **Branch: REVISE**.

   **Dedup — once per produced draft.** Before offering, scan the last ~2 days of `memory/logs/` for a `FORCE_REPLY_OFFERED: revise` line dated `${today}`; if present, skip the offer. When you send it, append the marker under the run's `### write-tweet` entry:
   ```
   - FORCE_REPLY_OFFERED: revise
   ```

## Log

Append **one** entry to `memory/logs/${today}.md` under a single `### write-tweet` heading. The first bullet is always the `**Format:**` discriminator naming the branch that ran; the rest are that branch's fields.

**Format `drafts`:**
```
### write-tweet
- **Format:** drafts
- **Topic:** [topic]
- **Drafts:** 10 generated (5 tiers x 2 variations)
- **Best overall:** #[n] - [style] / [tier]
- **Notification sent:** yes
```

**Format `thread`:**
```
### write-tweet
- **Format:** thread
- **Topic:** [topic]   (or: SKIPPED - quiet day, top candidate < 3)
- **Thread format:** [data-driven / structural critique / builder's breakdown / narrative / thesis-first]
- **Length:** [n] tweets
- **Hook:** [first 60 chars of tweet 1]
- **Notification sent:** yes | no (quiet day)
```

**Format `revise`:**
```
### write-tweet
- **Format:** revise
- **Instruction:** [the operator's revision instruction]
- **Base draft:** memory/drafts/write-tweet-latest.md (reloaded + re-saved)  (or: none - nothing to revise)
- **Notification sent:** yes
```

**Format `remix`:**
```
### write-tweet
- **Format:** remix
- **Status:** OK | DEGRADED | EMPTY | ERROR
- **Source window:** FROM_DATE to TO_DATE
- **Fetched:** N (xai=ok|partial|fail)
- **Kept after pre-filter:** N
- **Remixes produced:** N (drops: N)
- **Strategy spread:** e.g. Sharpen ×3, Flip ×2, Update ×2, Concretize ×2, Escalate ×1
- **Original tweets used:**
  1. "tweet text excerpt" - @HANDLE, DATE (URL) [strategy]
  2. ...
```

## Fetching

`TWITTER_API_KEY` is **injected into this skill's environment** (declared in `requires:`). **The primary way to fetch X/Twitter context - the DRAFTS "what people are saying" search and the REMIX tweet pull - is a direct `curl` to `https://api.twitterapi.io/twitter/...` with header `X-API-Key: {TWITTER_API_KEY}`.** Drafts uses `/tweet/advanced_search?queryType=Latest` with `since:` inside the query. Remix uses `/user/last_tweets?userName=` (filter the window client-side on `.createdAt`; `createdAt` is Twitter-native, normalize with `strptime("%a %b %d %H:%M:%S %z %Y")` before date compares). Grok `x_search` (`XAI_API_KEY`) is the fallback. There is no network sandbox blocking this. Just make the call.

**You MUST attempt twitterapi.io before any fallback.** The rules:

1. **Check, don't assume.** Read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn): `TWITTER_API_KEY` on that line = `TW_PRESENT`, else `TW_UNSET`; `XAI_API_KEY` on it = `XAI_PRESENT`, else `XAI_UNSET`. If `TW_PRESENT`, Path A is required. (Drafts treats the X search as optional enrichment - skip it entirely only when **both** keys are unset, never because you assume curl won't work. Remix requires at least one key.)
2. **Capture the HTTP status** so the fallback decision is based on fact. Print `http=<code>` before parsing. `HTTP=200` with a non-empty tweet array → use it.
3. **Path B - xAI Grok `x_search` (fallback).** Only when Path A fails (non-2xx / empty / timeout) or `TWITTER_API_KEY` is unset. Direct `curl` to `https://api.x.ai/v1/responses` with `Authorization: Bearer {XAI_API_KEY}`, model `grok-4.7`, and `"tools":[{"type":"x_search"}]`. The `x_search` call typically takes 30-120s - **set the Bash tool `timeout` to at least 180000 (180s)**, and add **`--max-time 150`** to the curl. A slow curl is **not** a missing key. Build the JSON body with `jq -n` (every value written into the filter literally) and pipe it straight into the send - a `>` redirect into a file is refused, and the `./secretcurl` command must be 100% literal (no `$VAR`):
   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"<PROMPT>"}], tools:[{type:"x_search"}]}' \
     | ./secretcurl -s -o /tmp/xai-wt.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" -H "Authorization: Bearer {XAI_API_KEY}" --data-binary @-
   ```
   Keep `-w '%{http_code}'` exactly: secretcurl's retry reads the status from the end of stdout, and it prints its own `http=... bytes=...` line on stderr.
   When a branch loops (remix Path B runs two queries), write each call to a unique file - `/tmp/xai-wt-q1.json`, `/tmp/xai-wt-q2.json`. Parse with the standard extractor `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text'`. `HTTP=200` with a non-empty body → use it.
4. **Fall back only on a real failure**, and **record the true reason** - never write "XAI_API_KEY unavailable" / "TWITTER_API_KEY unavailable" when a key was set. Use one of: `key-unset` (only if step 1 said the relevant key was unset), `http-<code>` (non-2xx), `empty` (200 but nothing parsed), `timeout` (curl exceeded `--max-time`).

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`FROM_DATE=$(date ...)`, `HTTP=$(./secretcurl ...)`, `Q1_PROMPT="..."`), uses `if` / `[ ... ] &&` tests or `$(( ))` math, pipes into `cut` / `sed`, or joins commands with `;`, `&&` or `||`, and each refusal costs a model turn. So get each date with a bare `date` call, work out the remix window and day counts yourself, write the topic, handle and dates into each `./secretcurl` and `jq` call literally (the `<TOPIC>`, `<HANDLE>`, `<FROM_DATE>` placeholders), put the xAI prompt inline in the `jq -n` body call and pipe it straight into the `./secretcurl` send (a `>` redirect into a file and a jq `$name` variable such as `--arg FROM ... '$FROM'` are both refused; a `"` inside a value becomes `\"`, and reword any `'`), and let twitterapi.io calls print their own `twitterapi http=... bytes=...` line through `-w`.

**WebSearch / WebFetch are last-resort fallbacks only** - lower quality, never a primary or co-equal path. Reach for them only after a real Path A and Path B failure. The **thread** branch's WebSearch use is for general fresh context, not an X-tweet fetch, and is unaffected.
