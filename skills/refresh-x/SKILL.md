---
name: Refresh X
description: Fetch a tracked X/Twitter account's latest tweets, cluster them, and save a decision-ready gist to memory
var: ""
tags: [social]
---
<!-- autoresearch: variation B — sharper output via verdict + clustering + thread detection + insight lines + signal-score gating -->

> **${var}** — The @handle to check (e.g. "@elonmusk", "vitalikbuterin", "https://x.com/pmarca"). **Required** — set this in aeon.yml or pass when triggering.

If `${var}` is empty or only whitespace after normalization, send `./notify "refresh-x: REFRESH_X_NO_VAR — set var to an X handle"` and exit 0.

Read `memory/MEMORY.md` for context. Read the last 2 days of `memory/logs/` — extract every `https://x.com/` URL under a prior `## Refresh X` section for the same handle into a `SEEN_URLS` set (used for dedup in step 4).

## Steps

### 1. Normalize var

Strip leading `@`, `https://x.com/`, `https://twitter.com/`, `https://nitter.net/`, and any trailing slash or `/status/...`. Lowercase. Reject if the remainder is empty, contains whitespace, or is longer than 15 chars (X handle limit). On reject → `REFRESH_X_NO_VAR` and exit.

Store the cleaned handle as `ACCOUNT`.

### 2. Load tweets

**Path A — prefetched cache (preferred)**: read `.xai-cache/refresh-x.json`. If present and non-empty, parse with:
```bash
jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' .xai-cache/refresh-x.json
```
Record `source=xai-cache`.

**Path B — WebFetch fallback**: if the cache is missing, empty, or the parsed text contains zero x.com status URLs, use WebFetch against `https://x.com/${ACCOUNT}` with the prompt: *"List every tweet, reply, and quote tweet visible on this profile with its full text, timestamp, engagement counts (likes/retweets/replies) if shown, and the permalink in the form https://x.com/handle/status/ID. Return a chronological list."* Record `source=webfetch`.

**Path C — degraded**: if both paths fail or `XAI_API_KEY` is unset and WebFetch returns nothing parseable, skip to step 8 with status `REFRESH_X_NO_API_KEY` (if key missing) or `REFRESH_X_ERROR` (if key set but both paths failed).

### 3. Parse into structured tweets

For each tweet extract: `url`, `text`, `timestamp`, `type` (original / reply / quote), `reply_to` (handle, if reply), `quoted_text` (if quote), `likes`, `retweets`, `replies`. Drop retweets of others (not originals from this account). If engagement counts are missing, treat them as 0 — do not fabricate.

Compute `signal_score = likes + 2*retweets + replies − (3 if type=reply else 0)`.

### 4. Dedup and gate

Drop any tweet whose `url` is in `SEEN_URLS` — count these as `deduped_count`.

If fewer than 3 tweets survive dedup AND no thread is detectable (see step 5), skip to step 8 with status `REFRESH_X_NO_NEW` (if everything was deduped) or `REFRESH_X_EMPTY` (if the account simply posted nothing).

### 5. Detect threads

A thread = 2+ tweets by `ACCOUNT`, posted within 30 minutes of each other, where later tweets reply to earlier ones OR share ≥2 meaningful keywords with the opener. Thread tweets are preserved as atomic units regardless of individual signal score. Record each thread as `{opener_url, tweet_count, combined_signal}`.

### 6. Cluster and extract insights

Group surviving tweets (threads count as one unit) into **2–4 sub-narratives** by topic overlap — named entities, project names, recurring keywords. If fewer than 2 narratives emerge, use a single cluster.

For each cluster write:
- **Title** — a 3-8 word topic label.
- **Top tweet(s)** — 1-3 excerpts (≤200 chars each) with permalink and engagement.
- **Insight** — one sentence: what this cluster reveals about the author's stance, claim, or shift today. Not a paraphrase — a claim about what they seem to be arguing or announcing. If you can't write an insight beyond paraphrase, drop the cluster.

For each detected thread, write a 1–2 sentence summary of where the thread lands, plus the opener URL.

### 7. Write the verdict

Pick exactly one verdict based on the clusters:

| Verdict | When |
|---------|------|
| `ANNOUNCEMENT` | Cluster contains a launch, hire, policy, or product drop |
| `ARGUMENT` | Majority of signal comes from contrarian takes or fights |
| `BUILDING` | Ships/code/tech-progress clusters dominate |
| `SHITPOST` | Jokes, memes, low-stakes banter dominate |
| `CONTEXT` | Mostly reacting to a news cycle, not driving one |
| `QUIET` | <3 originals and no thread |

Pair it with a ≤20-word lede describing the day's shape.

### 8. Save gist to memory/logs/${today}.md

Append:

```
## Refresh X — @ACCOUNT
**Verdict:** VERDICT — [lede]
**Counts:** N tweets (X original / Y reply / Z quote), T threads, deduped K

### Clusters
1. **[title]** — signal S
   > "[excerpt]" ([likes]❤ [rt]🔁) [permalink]
   **Insight:** [one-sentence claim]
2. ...

### Threads
- **[topic]** (N tweets, combined signal S): [1-2 sentence landing] — [opener permalink]

### Vibe
[2-3 sentence tone read — not a stat restatement. What's the day *feel* like from this account?]

**Status:** STATUS | source=[xai-cache|webfetch] | count=N | deduped=K
```

If status is `REFRESH_X_EMPTY`, `REFRESH_X_NO_NEW`, `REFRESH_X_NO_API_KEY`, `REFRESH_X_ERROR`, or `REFRESH_X_NO_VAR` — write only the `## Refresh X — @ACCOUNT` header and the `**Status:**` footer, skip the cluster sections.

### 9. Update MEMORY.md (conditional)

Only if a cluster carries an announcement, a specific claim, a named project, or a stance shift the operator will want to reference later: add a one-line bullet under a `## Tracked X Accounts` section (create the section if missing). Format: `- @ACCOUNT YYYY-MM-DD: [one-sentence claim] — [permalink]`.

Do **not** append paraphrases, memes, or generic opinions to MEMORY.md.

### 10. Notify via `./notify`

On `REFRESH_X_OK`:
```
x refresh — @ACCOUNT ([VERDICT])
[lede]
top cluster: [title] — "[≤80 char excerpt]" ([likes]❤)
[N tweets, T threads, K deduped]
```

On `REFRESH_X_EMPTY` / `REFRESH_X_NO_NEW`: **skip notify** — no signal is no signal. Still write the log entry so skill-health can observe the run.

On `REFRESH_X_NO_API_KEY`, `REFRESH_X_ERROR`, `REFRESH_X_NO_VAR`: notify with the status code and a one-line hint (e.g. `"refresh-x: REFRESH_X_NO_API_KEY — set XAI_API_KEY in workflow secrets"`).

## Sandbox note

The sandbox blocks direct curl to api.x.ai because the auth header can't expand `$XAI_API_KEY`. Primary path is the **prefetch cache** (`scripts/prefetch-xai.sh` runs before Claude starts and writes `.xai-cache/refresh-x.json`). Fallback is **WebFetch** against `https://x.com/${ACCOUNT}` — public profile page, no auth needed, bypasses the sandbox. Never curl api.x.ai from the skill body.

## Environment Variables Required

- `XAI_API_KEY` — drives the prefetch cache (primary path). If unset, WebFetch fallback still works for public accounts but returns less structured data.

## Constraints

- Never fabricate engagement counts. Missing → 0, not a guess.
- Never include a tweet URL already in `SEEN_URLS` in the output.
- An insight line that only paraphrases the tweet is not an insight — drop the cluster.
- Keep MEMORY.md updates to one line per noteworthy item. No paragraphs.
