---
name: [REPLACE: SKILL_NAME]
description: Mention/keyword sweep on social platforms for [REPLACE: KEYWORDS] — trends, sentiment, top posts
metadata:
  category: productivity
  var: ""
  tags:
    - social
  requires:
    - XAI_API_KEY?
---

> **${var}** — Optional. Pass alternative keywords (comma-separated) to override the default. If empty, monitors `[REPLACE: KEYWORDS]`.

Today is ${today}. Monitor social mentions of **[REPLACE: KEYWORDS]** and produce a summary.

## Steps

1. **Resolve keywords** - use `${var}` if set, else `[REPLACE: KEYWORDS]`. Split on commas, trim each, lower-case. Each token becomes its own search query, written into its own calls literally (the `<KEYWORD>` below; `<N>` is its position in the list).

2. **Search X** — for each keyword, use the X / xAI search path (project's standard pattern):

   Key check: read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn). With `XAI_API_KEY` on that line, build the body with a literal `jq -n` filter and pipe it straight into `./secretcurl` (set the Bash tool `timeout` to at least 180000; the live X search takes 30-120s):

   ```bash
   jq -n '{model:"grok-4.7", input:[{role:"user",content:"Search X for posts from the last 24 hours about: <KEYWORD>. Language: [REPLACE: LANGUAGE]. For each post include @handle, the full text, date posted, exact like, repost and reply counts, and the direct link (https://x.com/handle/status/ID). Return as a numbered list."}], tools:[{type:"x_search"}]}' \
     | ./secretcurl -s -o /tmp/social-x-<N>.json -w 'xai http=%{http_code}\n' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {XAI_API_KEY}" \
     --data-binary @-
   ```

   On `http=200`, read the text with `jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' /tmp/social-x-<N>.json`. Without the key, or on a non-2xx code, an empty reply or a timeout, fall back to WebFetch (or a Nitter mirror) and log the true reason.

   Restrict to language `[REPLACE: LANGUAGE]` (e.g. `en`, `fr`, `any`). Drop posts with fewer than `[REPLACE: MIN_LIKES]` likes — that filter is what protects the channel from low-signal noise.

3. **Search Reddit** — for each keyword:

   ```bash
   curl -s -o /tmp/social-reddit-<N>.json -w 'reddit http=%{http_code}\n' -H "User-Agent: aeon/1.0" -G "https://www.reddit.com/search.json" --data-urlencode "q=<KEYWORD>" -d t=day -d restrict_sr=0
   ```

   Reddit's JSON endpoint is keyless. On a non-2xx code (often 429), make a second call with WebFetch on `https://www.reddit.com/search.json?q=<KEYWORD>&t=day`.

4. **Score and pick top 5 per platform** — score on engagement (likes, comments, score) × recency (last 24h gets full marks). Drop reposts and obvious bot accounts (handles like `*_bot`, account age < 7 days with > 100 posts).

5. **Tag sentiment** — for the top 10 posts overall, label each `positive` / `neutral` / `negative` based on tone of the post text. Keep this lightweight — one-token classification, no nested reasoning.

6. **Write `output/articles/[REPLACE: SKILL_NAME]-${today}.md`**:
   ```markdown
   # [REPLACE: KEYWORDS] — ${today}

   ## Volume
   - X: N posts (vs 7d avg M)
   - Reddit: N posts (vs 7d avg M)

   ## Sentiment
   positive: X · neutral: Y · negative: Z

   ## Top posts
   1. [Author · platform · timestamp]
      "Excerpt or paraphrase."
      → URL

   2. ...
   ```

7. **Notify** via `./notify` with a 2-3 line summary: `*[REPLACE: KEYWORDS] — ${today}* · N posts · sentiment skews positive/negative · top: <one-line title>. Full digest: <url>`. Silent on quiet days (volume < 25% of 7d average AND no negative-sentiment spike).

8. **Log** to `memory/logs/${today}.md`:
   ```
   ## [REPLACE: SKILL_NAME]
   - **Volume**: x_posts=N, reddit_posts=N, vs_7d_avg=Δ%
   - **Sentiment**: pos=X, neu=Y, neg=Z
   - **Status**: SOCIAL_OK | SOCIAL_QUIET | SOCIAL_SPIKE (vol > 2x avg) | SOCIAL_DEGRADED
   ```

## Network note

X / xAI requires `XAI_API_KEY`; a bare `$XAI_API_KEY` on a `curl` line is refused by the Bash analyzer, so call `./secretcurl` with the `{XAI_API_KEY}` placeholder (the key is injected via `requires:`). Reddit's JSON endpoint is keyless but rate-limited per IP — `WebFetch` is the fallback when `curl` returns 429.

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`KEYWORDS=...`), uses `if` / `for`, tests a key, joins commands with `;`, `&&` or `||`, redirects into a file (`> .reddit-cache.json`), or puts a shell variable on a `./secretcurl` line (`-d "$PAYLOAD"`, `$KEYWORD`), and each refusal costs a model turn. So make one call per keyword with the keyword written in literally, pipe each request body into `./secretcurl ... --data-binary @-`, save replies with `-o /tmp/<file>`, and write the article and the log with Write/Edit.

## Constraints

- **Bot filter** is critical. New accounts with high posting velocity dominate any keyword and are almost always inauthentic. Strict drop.
- **Volume is more honest than sentiment**. A `SPIKE` (volume > 2x 7d avg) is a real signal; sentiment shifts within normal volume often aren't.
- **Engagement filters scale**. `MIN_LIKES = [REPLACE: MIN_LIKES]` is a starting threshold — raise it as the topic gains attention so noise stays out.
