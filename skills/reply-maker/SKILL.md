---
name: reply-maker
description: Draft copy-paste-ready X replies - two options per reply-worthy tweet from tracked accounts, topics, or lists (default), or ready-to-post responses to engagement opps in recent logs (from-logs)
metadata:
  title: Reply Maker
  category: productivity
  var: "empty = auto-discover reply-worthy tweets and draft two options each; @handle / numeric X list ID / topic = scope the drafting to that; from-logs (or --from-logs [@handle|project]) = turn flagged engagement opps from recent logs into ready-to-post replies"
  commits: false
  tags:
    - social
    - meta
  requires:
    - TWITTER_API_KEY
    - XAI_API_KEY?
---
<!-- autoresearch: variation B — sharper output via specificity gates, anti-sycophancy lint, post-write self-edit, and skip-gate for low-leverage tweets -->

> **${var}** — selects the mode and scope:
> - **empty** → **Mode A (Reply Drafting):** auto-discover reply-worthy tweets across your areas of interest (from recent logs + memory) and draft two reply options for each.
> - **`@handle` / numeric X list ID / topic** → **Mode A (Reply Drafting)** scoped to that handle, list, or topic.
> - **`from-logs`** (or **`--from-logs`**, optionally followed by an `@handle` or project name to narrow the scan) → **Mode B (From-Logs Engagement):** scan recent logs for flagged engagement opportunities and turn them into copy-paste-ready responses.
> - **`revise:<instruction>`** → **Revise branch:** reload the last drafted replies and refine them per the instruction (the Telegram force-reply shape, e.g. `revise:make them shorter`).

## Preamble (both modes)

Read `memory/MEMORY.md` for context on active projects and open engagement follow-ups.

Then read `memory/logs/` — the window depends on the mode:
- **Mode A:** the last 2 days of `memory/logs/` for recent `fetch-tweets`, `narrative-tracker`, and prior `reply-maker` outputs (used as a candidate pool and for reply de-duplication).
- **Mode B:** the last 7 days of `memory/logs/` for engagement opportunities flagged by other skills (`mention-radar`, `fetch-tweets`, `reply-maker`) or noted in MEMORY.md "Known Follow-ups".

**Parse `${var}` to pick the branch** (trim whitespace, compare case-insensitively):
- If `${var}` starts with `revise:` — run the **Revise branch** (below) and stop. This is the shape `scripts/telegram-route.sh` sends when the operator replies to a "refine these replies?" force-reply prompt; catch it before mode parsing.
- If `${var}` is `from-logs` or `--from-logs` — optionally followed by a whitespace-separated `@handle` or project name — run **Mode B (From-Logs Engagement)**. Treat any trailing token as an optional filter that narrows the opportunity scan to that handle/project.
- Otherwise run **Mode A (Reply Drafting)**, treating `${var}` as the scope: empty, `@handle`, numeric X list ID, or a topic string.

## Voice

If soul files exist (`soul/SOUL.md`, `soul/STYLE.md`, `soul/examples/`), read them and **mirror that voice in every reply**. Match sentence length, vocabulary choices, punctuation habits, and the kinds of things the operator would never say.

If no soul files exist (or the bodies are empty placeholders), write replies that are:
- Direct and substantive — no fluff, no sycophancy
- Under 280 characters each (X replies; DMs and GitHub comments may run longer — see Mode B)
- Opinionated but grounded in specifics
- The kind of reply that adds to the conversation, not noise

Either way, when responding to someone who cosigned/mentioned/attributed the operator (Mode B): **acknowledge without groveling** — no "thanks so much for the kind words!", just the actual response.

---

# Revise branch (`revise:…` — Telegram force-reply)

The operator tapped the "refine these replies?" prompt and sent a free-text revision instruction. Handle it before Mode A/B:

1. **Strip the prefix.** The instruction is `${var#revise:}` (keep any inner colons). Trim whitespace — e.g. `make them shorter`, `less formal`, `drop reply B on #2`.
2. **Load the last draft.** Read `memory/drafts/reply-maker-latest.md` — the stable path every normal run saves to (see the save steps in A4 / B6). If it's missing or empty, there's nothing to refine: send `./notify "Nothing to revise yet — run reply-maker first, then reply here to refine the drafts."` and **end the run**.
3. **Apply the instruction.** Read `soul/` for voice, then regenerate the saved replies applying the operator's instruction. Keep the same set of target tweets and the same **A/B two-option** structure (Mode A) or ready-to-post list (Mode B) — you're refining wording, not re-discovering candidates. Re-enforce the hard reply rules: ≤280 chars for X replies, no sycophancy (see **Banned sycophancy phrases**), specifics not gestures.
4. **Re-save** the revised drafts to `memory/drafts/reply-maker-latest.md` (overwrite), so a further `revise:` refines the newest version.
5. **Re-send** via `./notify` in the same format the originating mode uses, with a first line flagging it as a revision, e.g. `revised (${var#revise:}):`. Use `./notify -f <file>` for multi-line output.
6. **Re-offer** a further revision (the operator is actively iterating, so this is expected, not a nag — skip the daily dedup guard here):
   ```bash
   ./notify "Want another pass? Reply with a change and I'll revise again." \
     --force-reply --placeholder "e.g. make them shorter" \
     --context "reply-maker::revise"
   ```
7. **Log** under `### reply-maker` with `- **Mode:** revise` and the instruction (see **Log**), then **end the run** — do NOT run Mode A or B.

---

# Mode A — Reply Drafting

Generate **two reply options** for **5 reply-worthy tweets** from tracked X accounts, a list, or a topic.

### A1. Gather candidate tweets

Goal: assemble **10–15 candidates** posted in the **last 6 hours** (the high-leverage reply window — the algorithm rewards early replies, and the OP is still likely to engage back). **Recency fallback:** if the 6h window yields fewer than 3 candidates after the skip gate, widen to **12h** and retry before failing the run.

For every candidate, capture: `@handle`, full tweet text, tweet URL, `posted_at` (ISO), engagement counts (likes, replies, retweets if available), and a one-line **why-this-tweet** note.

**Path A - twitterapi.io (primary, except `list:`).** `TWITTER_API_KEY` is injected into this skill's environment (declared in `requires:`). Handle and topic scopes use structured twitterapi.io fetches (full contract in **Fetching**). twitterapi.io has **no `list:` operator**, so a numeric list ID stays on Path B (xAI) as its primary. Preflight the keys: read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn). `TWITTER_API_KEY` on that line = `TW_PRESENT`, else `TW_UNSET`; `XAI_API_KEY` on it = `XAI_PRESENT`, else `XAI_UNSET`.

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`FROM_DATE=$(date ...)`, `HTTP=$(./secretcurl ...)`, `HANDLE="${var#@}"`), uses `if` / `for` / `while`, or joins commands with `;`, `&&` or `||`, and each refusal costs a model turn. So get each date with a bare `date` call and write the printed value into later commands; write the handle, topic, list ID and dates into each command literally (the `<FROM_DAY>`, `<HANDLE>` style placeholders in the snippets), jq filters included (`>= "<FROM_DAY>"`, never `--arg` with a `$name`: refused); run one `jq` per call. A `>` redirect into a file is refused too, so the xAI body is piped straight into `./secretcurl ... --data-binary @-` and notify bodies are written with the Write tool.

Get the window dates, each `date` as its own Bash call:
```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```
```bash
date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%SZ
```
```bash
date -u -d '6 hours ago' +%Y-%m-%d
```
The first prints TO_DATE, the second FROM_DATE, the third FROM_DAY.

**If `${var}` looks like a `@handle`** - pull that account's recent timeline, then filter to the 6h window client-side (`/user/last_tweets` has no server-side date filter). `createdAt` is Twitter-native; normalize with `strptime` before the compare. `<HANDLE>` is `${var}` without the leading `@`, written in literally:
```bash
./secretcurl -s -o /tmp/tw-rm.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/user/last_tweets" \
  --data-urlencode "userName=<HANDLE>" -H "X-API-Key: {TWITTER_API_KEY}"
```
On `HTTP=200` with a non-empty `.data.tweets[]`, parse, drop replies/RTs (`.isReply`, or text starting `RT @`), keep originals inside the window, and mark `twitterapi=ok`. FROM_DAY is written in literally:
```bash
jq -r '.data.tweets[] | select((.isReply | not) and ((try (.createdAt | strptime("%a %b %d %H:%M:%S %z %Y") | strftime("%Y-%m-%d")) catch "0000-00-00") >= "<FROM_DAY>")) | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-rm.json
```

**If `${var}` is a topic** (or empty) - `advanced_search` with the topic (or the top 2-3 topics from `memory/MEMORY.md` when empty) and `since:<FROM_DAY>` inside the query, both written in literally. When empty, also pull tweet candidates surfaced in the last 2 days of `fetch-tweets` logs as a backup pool:
```bash
./secretcurl -s -o /tmp/tw-rm.json -w 'twitterapi http=%{http_code} bytes=%{size_download}\n' --max-time 60 -G "https://api.twitterapi.io/twitter/tweet/advanced_search" \
  --data-urlencode "query=<TOPIC> since:<FROM_DAY>" --data-urlencode "queryType=Latest" \
  -H "X-API-Key: {TWITTER_API_KEY}"
```
On `HTTP=200` with a non-empty `.tweets[]`, parse originals (skip replies) and mark `twitterapi=ok`:
```bash
jq -r '.tweets[] | [.id, .author.userName, .text, .url, .createdAt, .likeCount, .retweetCount, .replyCount] | @tsv' /tmp/tw-rm.json
```
Then keep only posts inside the 6h window (strptime-normalize `.createdAt`).

**If `${var}` looks like an X list ID** (numeric): skip Path A (no twitterapi `list:` operator) and go to Path B.

**Path B - xAI Grok `x_search` (fallback; primary for `list:`).** Only if Path A returned non-2xx / empty / timeout, `TWITTER_API_KEY` is unset, or `${var}` is a numeric list ID. Direct `curl` to `https://api.x.ai/v1/responses`. `x_search` searches X live and takes 30-120s - **set the Bash tool `timeout` to ≥180000 when you run this** (a slow curl is not a missing key). Build the payload per `${var}` (three shapes below) with `jq -n` and pipe it straight into the `./secretcurl` send, one call. It prints the HTTP status (secretcurl also prints an `http=... bytes=...` line on stderr).

On `HTTP=200` with a non-empty body, parse `/tmp/xai-rm.json` and mark `xai=ok`:
```bash
jq -r '.output[] | select(.type == "message") | .content[] | select(.type == "output_text") | .text' /tmp/xai-rm.json
```

**The payload depends on `${var}`.** Whichever branch matches, build it with `jq -n` (never a shell-interpolated string) and pipe it into `./secretcurl ... --data-binary @-` in the same call. Do not write it to a file first or pass values with `--arg`: a `>` redirect into a file and a jq `$name` variable are both refused in this run.

In each shape the list ID, handle or topic and both dates are written into the jq filter literally (`<LIST_ID>`, `<HANDLE>`, `<TOPIC>`, `<FROM_DATE>`, `<TO_DATE>`); a `"` inside a value becomes `\"`, and reword any `'`.

**If `${var}` looks like an X list ID** (numeric):
```bash
jq -n '{
  model: "grok-4.7",
  input: [{role: "user", content: "Look at X list https://x.com/i/lists/<LIST_ID>. Return the 12 most reply-worthy original posts (not retweets, not replies) by members of this list between <FROM_DATE> and <TO_DATE>. Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts."}],
  tools: [{type: "x_search", from_date: "<FROM_DATE>", to_date: "<TO_DATE>"}]
}' | ./secretcurl -s -o /tmp/xai-rm.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" -H "Authorization: Bearer {XAI_API_KEY}" --data-binary @-
```

**If `${var}` looks like a `@handle`** — same query intent, scoped to that handle's recent original posts:
Here `<HANDLE>` is `${var}` as given, with its `@`:
```bash
jq -n '{
  model: "grok-4.7",
  input: [{role: "user", content: "Look at recent original posts (not retweets, not replies) by <HANDLE> on X between <FROM_DATE> and <TO_DATE>. Return the 12 most reply-worthy. Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts."}],
  tools: [{type: "x_search", from_date: "<FROM_DATE>", to_date: "<TO_DATE>"}]
}' | ./secretcurl -s -o /tmp/xai-rm.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" -H "Authorization: Bearer {XAI_API_KEY}" --data-binary @-
```

**If `${var}` is a topic** (or empty) — same query intent with `${var}` (or the top 2–3 topics from `memory/MEMORY.md` when empty) as the search query. When empty, also pull tweet candidates surfaced in the last 2 days of `fetch-tweets` logs as a backup pool.
When `${var}` is empty, write the top 2-3 topics from memory/MEMORY.md in as `<TOPIC>`:
```bash
jq -n '{
  model: "grok-4.7",
  input: [{role: "user", content: "Search X for the 12 most reply-worthy original posts (not retweets, not replies) about <TOPIC> between <FROM_DATE> and <TO_DATE>. Reply-worthy = has a take, claim, question, or framing worth engaging — NOT pure self-promo, breaking news without analysis, or threads already past 500 replies. For each: @handle, full tweet text, tweet URL, posted_at ISO timestamp, like/reply/retweet counts."}],
  tools: [{type: "x_search", from_date: "<FROM_DATE>", to_date: "<TO_DATE>"}]
}' | ./secretcurl -s -o /tmp/xai-rm.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
  -H "Content-Type: application/json" -H "Authorization: Bearer {XAI_API_KEY}" --data-binary @-
```

**Path C - memory logs + WebSearch (last-resort fallback only).** Reach here **only** on a real failure of Paths A and B, and record the **true reason** - `key-unset` | `http-<code>` | `empty` | `timeout` - never "XAI_API_KEY unavailable" / "TWITTER_API_KEY unavailable" when a key was set. Use in order until you have ≥3 candidates:
1. Recent `fetch-tweets` outputs in `memory/logs/` — already have URLs and handles.
2. WebSearch for very recent posts on memory topics (filter: posted within last 6h, original post not reply). Lower quality — WebSearch favours older high-engagement tweets, so prioritise results dated within the last 6h.

### A2. Filter and select 5 tweets

Apply the **skip gate** first. **Discard** any candidate that is:
- Pure self-promo (launching a product, "buy my course", subscribe links)
- Breaking-news repost without an angle of its own
- A thread already past ~500 replies (your reply will not be seen)
- Older than 6 hours (reply window has closed; don't waste a reply slot)
- A handle/URL already replied to in the last 7 days of reply-maker logs (no duplicates)

From the survivors, **rank by leverage** = `recency × take-strength × room-to-add`:
- **Recency**: minutes-ago > hours-ago. Tweets <60min old are top priority.
- **Take-strength**: a clear claim/question/framing you can either reinforce with evidence or challenge with a flipped premise.
- **Room-to-add**: not already swarmed; thread isn't full of stronger replies; you have actual context to contribute.
- Bias toward authors whose audience overlaps your interests (from `memory/MEMORY.md`) — replies on those accounts get seen by people who care about the same things.

Pick the **top 5**. If fewer than 5 survive the gate, output what you have and add `REPLY_MAKER_DEGRADED` to the notification subject line.

### A3. Generate two replies per tweet

For each of the 5 selected tweets, draft **two reply options** with distinct angles:

**Option A — "Evidence add"**
- Builds on their point with a **specific** datum, named project, named person, concrete number, link, or counterexample they didn't include
- Tone: collaborative, substantive, calmly confident
- Must contain at least one named entity, number, or specific reference — vague "great insight, here's another angle" is banned

**Option B — "Frame challenge"**
- States the premise you're pushing back on **explicitly** (one short clause), then offers the contrarian angle, flipped framing, or sharper read
- Tone: direct, opinionated, not contrarian-for-its-own-sake
- Must contain the actual disagreement, not a hedge — vague "interesting, but have you considered..." is banned

#### Hard reply rules (apply to both A and B)

- **≤ 280 characters** including any handle prefix
- **No sycophancy** — see the `## Banned sycophancy phrases` section below. Any draft containing a banned phrase must be rewritten.
- **No hedging stacks** — "It could be argued that…", "Just my two cents but…", "Maybe I'm wrong but…" — pick a position
- **Specifics, not gestures** — names, projects, numbers, links. If you can't cite one, don't write the reply
- **Stand alone** — readers may not see the original tweet; reply must make sense on its own
- **Match soul voice** if soul files are populated

#### Self-edit pass (do this for every reply before finalizing)

For each draft reply, score 1–5 on each:
- **Specific**: cites a name/number/project/claim?
- **Standalone**: makes sense without reading the parent?
- **Non-sycophantic**: passes the banned-phrase list?
- **Voice-matched**: sounds like the soul files (or neutral-direct if no soul)?

If any score is < 4, **rewrite that reply once** before moving on. If the rewrite still scores < 4, drop that tweet from the list and pull the next-ranked candidate from step A2.

### A4. Notify

Send via `./notify` with this format (link first so the operator can open the source quickly):

```
*Reply Maker - ${today}*

*1.* https://x.com/handle/status/123  (@handle, 42m ago, 18💬)
> [first ~80 chars of tweet]…
why: [one-line reason this is reply-worthy]
A: [evidence-add reply]
B: [frame-challenge reply]

*2.* …
… (5 total, or fewer with REPLY_MAKER_DEGRADED if skip gate trimmed below 5)

source-status: twitterapi=ok|fail|skip, xai=ok|fail|skip, memory=N, websearch=ok|fail|skip
```

If zero candidates survive the skip gate from any source, send a single `REPLY_MAKER_EMPTY — [one-line reason]` notification and stop.

Otherwise, after notifying, **save the drafts and offer a revision** (see *Save drafts + offer revision*).

### A5. Log

Append to `memory/logs/${today}.md` under the shared `### reply-maker` heading (see **Log** below), using the **Mode A** template.

---

# Mode B — From-Logs Engagement

Turn flagged engagement opportunities from recent logs into ready-to-post replies — read the last 7 days of logs, draft specific responses, send as copy-paste-ready output. **This mode makes no outbound API calls** — no X.AI curl, no WebSearch — it works purely from local `memory/` files.

**Projects-of-interest list:** if `memory/topics/projects-of-interest.md` exists, treat the project names listed there as the things to watch for mentions, cosigns, attributions, and fork moments. If the file is missing or empty, fall back to any project names that appear in recent logs or in MEMORY.md. If a filter token was passed (`from-logs @handle` or `from-logs <project>`), narrow the scan to opportunities involving that handle/project.

### B1. Collect unactioned engagement opportunities

Read `memory/logs/` for the last 7 days. Look for:
- Log entries flagging engagement opps (e.g. "Engagement opps: N flagged" with N > 0) — extract the named handles/accounts
- Any person who cosigned, mentioned, or attributed one of the operator's projects-of-interest
- GitHub attribution or fork moments not yet acknowledged
- Entries in MEMORY.md "Known Follow-ups" explicitly flagging engagement opps
- Cosigns or mentions surfaced in `mention-radar`, `fetch-tweets`, or `reply-maker` runs

Build a list: `{ person/account, context, what_they_did, link_if_known, days_ago }`

### B2. Filter and prioritize

Apply these rules:
- Drop any opp older than 14 days — window is likely closed
- De-dupe: skip opps where recent logs already show "replied to @X" or "acknowledged" for that handle
- Rank by: recency (fresher first) × leverage (high-follower or influential account first)
- Cap at 5 opportunities

### B3. Draft ready-to-post responses

For each opportunity:
- **Type**: X reply / X DM / GitHub comment / X post
- **Target**: @handle or URL
- **Draft text**: exact text, ready to copy-paste
- Keep under 280 chars for X replies; longer is fine for DMs or GitHub comments
- Voice: if `soul/SOUL.md` and `soul/STYLE.md` are populated, match that voice; otherwise use a clear, direct, neutral tone. Either way: acknowledge without groveling, no "thanks so much for the kind words!" — just the actual response.

### B4. Check for staleness

If any opportunity is 5+ days old, prepend `aging` to that entry in the output.

### B5. Skip if empty

If after filtering there are zero unactioned opps, log `ENGAGEMENT_ACT_SKIP: no unactioned opps` (under the `### reply-maker` heading) and exit **without sending a notification**.

### B6. Write output to a temp file, then send via `./notify -f`

```
*Reply Maker (from-logs) - ${today}*

*1. @handle* (N days ago) - [one-line summary of what they did]
link: [URL or "no link found"]
type: [X reply / X post / DM / GitHub comment]
draft: "[ready-to-post text]"

*2. @handle* ...

[if any opps are 5+ days old:]
some opps aging - act or drop
```

Write this to `/tmp/reply-maker-from-logs.md` then run `./notify -f /tmp/reply-maker-from-logs.md`.

After notifying, **save the drafts and offer a revision** (see *Save drafts + offer revision*).

### B7. Log

Append to `memory/logs/${today}.md` under the shared `### reply-maker` heading (see **Log** below), using the **Mode B** template.

---

## Save drafts + offer revision (both modes)

After a normal run (Mode A or B) has drafted and notified replies, do two things so the operator can refine them from Telegram. **Skip both** when the run sent nothing (`REPLY_MAKER_EMPTY`, or Mode B's `ENGAGEMENT_ACT_SKIP`).

1. **Persist the drafts** to a stable path a later `revise:` run can reload:
   ```bash
   mkdir -p memory/drafts
   ```
   Write the full draft body you just sent — all selected tweets with their A/B options (Mode A), or the ready-to-post list (Mode B) — to `memory/drafts/reply-maker-latest.md`, overwriting any previous file. Only the newest draft is revisable.
2. **Offer a revision** — a **separate** `./notify` (force_reply can't share a message with inline buttons):
   ```bash
   ./notify "Want to refine these replies? Reply with a change and I'll revise them." \
     --force-reply --placeholder "e.g. make them shorter" \
     --context "reply-maker::revise"
   ```
   The reply routes back as `var="revise:<instruction>"` and re-dispatches this skill into the **Revise branch**.

   **Dedup — once per produced draft.** Before offering, scan the last ~2 days of `memory/logs/` for a `FORCE_REPLY_OFFERED: revise` line dated `${today}`; if present, skip the offer. When you send it, append the marker under the run's `### reply-maker` entry:
   ```
   - FORCE_REPLY_OFFERED: revise
   ```

## Banned sycophancy phrases

Edit this list as tastes change — any draft reply (either mode) containing one of these (openings or closings) must be rewritten:

- Openings: "Great point", "Love this", "100%", "This 👆", "Couldn't agree more", "So well said", "💯"
- Closings: "Curious to hear your thoughts!" (engagement-hook noise)

## Log

Append one entry to `memory/logs/${today}.md` under a single `### reply-maker` heading, with a `**Mode:**` discriminator line naming which branch ran.

**Mode A (reply drafting):**
```
### reply-maker
- **Mode:** A (reply drafting)
- **Var:** ${var:-<empty>}
- **Candidates collected:** N
- **Survived skip gate:** N
- **Replies generated:** N×2
- **Handles:** @h1, @h2, …
- **Source status:** xai=ok|fail|skip, memory=N, websearch=ok|fail|skip
- **Notification:** sent | degraded | empty
- **Tweet URLs:** [list, for future-day dedup]
```
The `Tweet URLs` line is what tomorrow's run reads to avoid duplicate replies — keep it consistent.

**Mode B (from-logs engagement):**
```
### reply-maker
- **Mode:** B (from-logs engagement)
- **Opps found:** N unactioned (scanned last 7 days of logs)
- **Drafted:** N responses
- **Handles:** @handle1, @handle2, …
- **Notification sent:** yes
- ENGAGEMENT_ACT_OK
```
If skipped: `ENGAGEMENT_ACT_SKIP: <reason>` (still under `### reply-maker`).

**Revise (Telegram force-reply):**
```
### reply-maker
- **Mode:** revise
- **Instruction:** [the operator's revision instruction]
- **Base draft:** memory/drafts/reply-maker-latest.md (reloaded + re-saved)  (or: none - nothing to revise)
- **Notification:** sent
```

## Fetching

`TWITTER_API_KEY` is **injected into this skill's environment** (declared in `requires:`). **Mode A's primary fetch path (handle and topic) is a direct `curl` to `https://api.twitterapi.io/twitter/...` with header `X-API-Key: {TWITTER_API_KEY}`.** Handle uses `/user/last_tweets?userName=` (filter the 6h window client-side on `.createdAt`; `createdAt` is Twitter-native, normalize with `strptime("%a %b %d %H:%M:%S %z %Y")`). Topic uses `/tweet/advanced_search?queryType=Latest` with `since:` inside the query. twitterapi.io has **no `list:` operator**, so a numeric list ID uses xAI `x_search` as its primary. Grok `x_search` (`XAI_API_KEY`) is the fallback for handle/topic. There is no network sandbox blocking this. Just make the call.

**You MUST attempt twitterapi.io before any handle/topic fallback.** The rules:

1. **Check, don't assume.** Read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn): `TWITTER_API_KEY` on that line = `TW_PRESENT`, else `TW_UNSET`; `XAI_API_KEY` on it = `XAI_PRESENT`, else `XAI_UNSET`. If `TW_PRESENT`, Path A is required for handle/topic.
2. **Capture the HTTP status** so the fallback decision is based on fact. The `-w 'twitterapi http=%{http_code} bytes=%{size_download}\n'` in the Path A call prints `http=<code>`; read it before parsing. `HTTP=200` with a non-empty tweet array → use it (`twitterapi=ok`).
3. **Path B - xAI Grok `x_search` (fallback; primary for `list:`).** Only when Path A fails (non-2xx / empty / timeout), `TWITTER_API_KEY` is unset, or `${var}` is a numeric list ID. Direct `curl` to `https://api.x.ai/v1/responses` with `Authorization: Bearer {XAI_API_KEY}`. The `x_search` call typically takes 30-120s - **set the Bash tool `timeout` to at least 180000 (180s)**, and add **`--max-time 150`** to the curl. A slow curl is **not** a missing key. Build the payload with one of the three `jq -n` shapes in A1 (values written in literally) and pipe it straight into the send in the same call:
   ```bash
   jq -n '{...}' | ./secretcurl -s -o /tmp/xai-rm.json -w '%{http_code}' --max-time 150 -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" -H "Authorization: Bearer {XAI_API_KEY}" --data-binary @-
   ```
   Then parse `/tmp/xai-rm.json` with the standard `jq` extractor. `HTTP=200` with a non-empty body → use it (`xai=ok`).
4. **Fall back only on a real failure**, and **record the true reason** - never write "XAI_API_KEY unavailable" / "TWITTER_API_KEY unavailable" when a key was set. Use one of: `key-unset` (only if step 1 said the relevant key was unset), `http-<code>` (non-2xx), `empty` (200 but no tweets parsed), `timeout` (curl exceeded `--max-time`).

**WebSearch and the memory-log candidate pool are last-resort fallbacks only** - lower quality (WebSearch favours old high-engagement tweets). Never reach for them while a key works. **Mode B** is fetch-free by design: it reads only local `memory/` files, so it makes no curl and no API call; `./notify -f` still handles delivery via `.pending-notify/` if needed.

## Environment Variables Required

- `TWITTER_API_KEY` - twitterapi.io API key (sent as the `X-API-Key` header). Declared in `requires:`, so it is **injected into this skill's environment** and is **Mode A's primary fetch path** for handle and topic scopes.
- `XAI_API_KEY` - X.AI API key for Grok's `x_search` tool. Declared in `requires:` (optional `?`). The **fallback** path when twitterapi fails or the key is unset, and the **primary** path for numeric X list IDs. If both keys are unset, Mode A degrades to the memory-log pool + WebSearch at lower quality. **Mode B requires no environment variables** and uses only local memory files and `./notify`.
