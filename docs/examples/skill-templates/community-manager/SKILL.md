---
name: [REPLACE: SKILL_NAME]
description: Summary of the [REPLACE: CHANNEL_PLATFORM] channel [REPLACE: CHANNEL_NAME] — top [REPLACE: TOP_N_THREADS] threads + open questions
metadata:
  category: productivity
  var: ""
  tags:
    - social
  requires:
    - DISCORD_BOT_TOKEN?
    - DISCORD_CHANNEL_ID?
    - TELEGRAM_BOT_TOKEN?
    - TELEGRAM_CHAT_ID?
    - SLACK_BOT_TOKEN?
    - SLACK_CHANNEL_ID?
---

> **${var}** — Optional. Override the channel name. If empty, summarises `[REPLACE: CHANNEL_NAME]`.

Today is ${today}. Read the last 24h of activity in **[REPLACE: CHANNEL_PLATFORM]** channel **[REPLACE: CHANNEL_NAME]** and produce a community digest.

## Required secrets per platform

| Platform | Secrets | Notes |
|----------|---------|-------|
| `discord` | `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID` | Bot must be in the server with `View Channel` + `Read Message History`. |
| `telegram` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot must have been added to the chat (private chats and groups both work). |
| `slack` | `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` | Bot needs `channels:history` (public) or `groups:history` (private) scope. |

Read the "Keys set for this run" line in your run notes, never a shell test (those are refused and cost a turn). If the secrets for `[REPLACE: CHANNEL_PLATFORM]` are not on it, log `COMMUNITY_NO_TOKEN` and exit cleanly.

## Steps

1. **Resolve channel** - the channel is `${var}` if set, else `[REPLACE: CHANNEL_NAME]`. A channel or chat ID is not a credential, so `./secretcurl` does not fill a `{DISCORD_CHANNEL_ID}` style placeholder: print the ID with its own call, `node -e 'console.log(process.env.DISCORD_CHANNEL_ID)'` (or `SLACK_CHANNEL_ID`), and write the printed value into the call literally (the `<CHANNEL_ID>` below). The exact API call depends on `[REPLACE: CHANNEL_PLATFORM]`, one call each:

   - **discord**:
     ```bash
     ./secretcurl -s -o /tmp/community-messages.json -w 'discord http=%{http_code}\n' -H "Authorization: Bot {DISCORD_BOT_TOKEN}" "https://discord.com/api/v10/channels/<CHANNEL_ID>/messages?limit=100"
     ```
   - **telegram** - `getUpdates` polling has limits; better to read the bot's stored offset state from `memory/topics/[REPLACE: SKILL_NAME]-tg-offset.json` (Read it, then write the offset in literally):
     ```bash
     ./secretcurl -s -o /tmp/community-messages.json -w 'telegram http=%{http_code}\n' "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset=<OFFSET>&limit=100"
     ```
   - **slack** - get the window start with its own call, `date -u -d '24 hours ago' +%s`, and write it in as `<OLDEST>`:
     ```bash
     ./secretcurl -s -o /tmp/community-messages.json -w 'slack http=%{http_code}\n' -H "Authorization: Bearer {SLACK_BOT_TOKEN}" -G "https://slack.com/api/conversations.history" -d channel=<CHANNEL_ID> -d oldest=<OLDEST> -d limit=200
     ```

2. **Filter to the last 24h** — drop messages older than `now - 24h`. Drop bot messages (most platforms expose `is_bot` / `bot_id`). Keep replies.

3. **Cluster into threads** — Discord and Slack expose explicit thread/parent IDs; Telegram doesn't. For Telegram, cluster by reply-chain hops.

4. **Score threads** — for each thread:
   - **Reach** — unique participants × log(message count).
   - **Question pressure** — does the parent message end with `?` or contain words like "how", "why", "anyone", "stuck"? +5.
   - **Recency** — within the last 12h gets full marks.

   Pick the top **[REPLACE: TOP_N_THREADS]** threads.

5. **Detect open questions** — scan all parent-level messages. If a message ends with `?` and has zero replies after 6 hours, mark it as `OPEN_QUESTION`. List them separately so the operator can chase.

6. **Write `output/articles/[REPLACE: SKILL_NAME]-${today}.md`**:
   ```markdown
   # [REPLACE: CHANNEL_NAME] — ${today}

   **Volume**: N messages from M participants (vs 7d avg of K).

   ## Top [REPLACE: TOP_N_THREADS] threads
   1. [Author · timestamp] "Parent message excerpt..."
      → N replies, M reactions
      → Permalink

   ...

   ## Open questions (no reply > 6h)
   - [Author] "Question text..." → permalink

   ## Volume sparkline (last 7 days)
   ▁▂▃▅▇▆▄
   ```

7. **Notify** via `./notify` with a 3-line summary:
   ```
   *[REPLACE: CHANNEL_NAME] — ${today}*
   N messages · M participants · K open questions · top thread: <one-line>
   Full digest: <url>
   ```
   Skip the notification on quiet days (volume < 25% of 7d avg AND zero `OPEN_QUESTION`s).

8. **Log** — append to `memory/logs/${today}.md`:
   ```
   ## [REPLACE: SKILL_NAME]
   - **Channel**: [REPLACE: CHANNEL_PLATFORM]/[REPLACE: CHANNEL_NAME]
   - **Volume**: messages=N, participants=M, vs_7d_avg=Δ%
   - **Threads picked**: [REPLACE: TOP_N_THREADS] (of K candidates)
   - **Open questions**: N
   - **Status**: COMMUNITY_OK | COMMUNITY_QUIET | COMMUNITY_DEGRADED (api errors)
   ```

## Network note

Discord and Slack need their bot token in the `Authorization` header; Telegram puts it in the URL path (`/bot{TELEGRAM_BOT_TOKEN}/`). A bare `$TOKEN` on a `curl` line is refused by the Bash permission analyzer - so call `./secretcurl` with a `{ENV_NAME}` placeholder instead. The token (injected via the skill's `requires:`) is substituted inside the helper and never appears on the command line, as in the step 1 calls.

**Shell shape.** Each Bash call is one allowed command (pipes are fine). The run refuses a call that sets a variable (`CHANNEL=...`), uses `if` / `for`, tests a key, joins commands with `;`, `&&` or `||`, redirects into a file, or puts a shell variable on a `./secretcurl` line (`$DISCORD_CHANNEL_ID`), and each refusal costs a model turn. So write IDs, offsets and dates into each call literally, save replies with `-o /tmp/<file>`, and write the offset file, the article and the log with Write/Edit.

## Constraints

- **Privacy**. Don't quote DMs or anything from a private channel verbatim into a public notification — paraphrase, attribute by display name only, never include user IDs.
- **The "open questions" section is the most useful output**. Even on a quiet day, if there's an unanswered question, surface it. That's the operator-action signal.
- **Avoid bot-on-bot loops**. If this skill notifies into the same channel it reads from, filter your own bot's messages out before scoring.
