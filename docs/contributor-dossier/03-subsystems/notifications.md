# Subsystem: Notifications

How skills talk to humans, and how humans talk back.

---

## The two halves

**Outbound** — `./notify` is the universal fan-out. Every skill that needs to surface output runs `./notify "message"`. The script (synthesized inline at [`aeon.yml:319-449`](../../../.github/workflows/aeon.yml#L319-L449)) sends to **every configured channel**. A channel is "configured" if its secrets exist. Missing secret = silently skipped, no error.

**Inbound** — `messages.yml` polls Telegram/Discord/Slack every 5 minutes, dispatches each new message as a `messages.yml` `run`-job execution that spawns Claude with the message as a prompt. Responses go back through `./notify`.

## Channels at a glance

| Channel | Outbound secrets | Inbound secrets | Inbound mechanism |
|---|---|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | same | `getUpdates` long-poll with offset-based ack ([`messages.yml:481-502`](../../../.github/workflows/messages.yml#L481-L502)) |
| Discord | `DISCORD_WEBHOOK_URL` | `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` | fetch last 10, skip bot messages and ✅-reacted, react with ✅ to ack ([`messages.yml:505-523`](../../../.github/workflows/messages.yml#L505-L523)) |
| Slack | `SLACK_WEBHOOK_URL` | `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` | fetch last 10, skip bot/`white_check_mark`-reacted, react to ack ([`messages.yml:526-546`](../../../.github/workflows/messages.yml#L526-L546)) |
| Email | `SENDGRID_API_KEY` + `NOTIFY_EMAIL_TO` | — (outbound only) | — |
| Dashboard feed | none (always-on, local) | — | json-render specs written to `dashboard/outputs/` |

Set the secrets for the channels you want, leave the rest unset. No code change.

**Message priority for inbound** (when multiple channels have unread messages in the same poll): Telegram > Discord > Slack. First message wins per poll cycle.

## Outbound — `./notify`

`./notify` is a shell script written into the workspace on every skill run ([`aeon.yml:319-449`](../../../.github/workflows/aeon.yml#L319-L449)). The skill calls it like any other allowed bash command:

```bash
./notify "Daily token report ready. BTC: +3.2%, ETH: +1.1%, SOL: -2.4%."
```

Per channel, the script does:

- **Telegram** — POST to `https://api.telegram.org/bot$TOKEN/sendMessage` with `chat_id` and `text`. Char limit 4096.
- **Discord** — POST to `$DISCORD_WEBHOOK_URL` with `content`. Char limit 2000.
- **Slack** — POST to `$SLACK_WEBHOOK_URL` with `text`. Char limit ~40000, but humans don't read past 2000.
- **Email (SendGrid)** — POST to `https://api.sendgrid.com/v3/mail/send`. From address defaults to `aeon@notifications.aeon.bot`; subject prefix defaults to `[Aeon]`. Both overridable by repo vars `NOTIFY_EMAIL_FROM` and `NOTIFY_EMAIL_SUBJECT_PREFIX`.

If a channel's POST fails, `./notify` logs to stderr and continues to the next channel — one bad webhook doesn't break a multi-channel skill.

## Outbound — dashboard feed (`./notify-jsonrender`)

In parallel with `./notify`, every skill output that lands in `.pending-<skill>.md` (or `/tmp/skill-result.txt`) gets converted to a json-render spec by `./notify-jsonrender` ([`aeon.yml:704-721`](../../../.github/workflows/aeon.yml#L704-L721)).

The script ([`notify-jsonrender`](../../../notify-jsonrender), ~76 lines):

1. Receives skill name + markdown.
2. Calls **Haiku** with a system prompt defining 15 component types (Card, Stack, Grid, Heading, Text, Badge, Link, Table, Stat, Progress, TweetCard, StoryLink, Alert, Button, Separator).
3. Validates the JSON shape.
4. Writes `dashboard/outputs/<skill>-<timestamp>.json`.

The dashboard tails `dashboard/outputs/` and renders the spec in real time. Local-only by default; if you've enabled the host gate hatches in `dashboard/middleware.ts`, the feed can be reached from another machine.

This conversion is **why every skill output looks consistent in the dashboard** even though skills write free-form markdown. It is also a hidden source of token cost (Haiku per skill output) — visible in `memory/token-usage.csv`.

## Outbound — retry queue

Some skills can't notify inline (e.g. they ran a long batch and want to send several follow-ups). They write `.pending-notify/*.md` files; the runtime retries delivery in [`aeon.yml:723-790`](../../../.github/workflows/aeon.yml#L723-L790) with dedup by content hash against what was already sent inline.

This is invisible to most skill authors — use it only if you have a genuine batched-notification need.

## Inbound — `messages.yml` job `tick` (poll)

Every 5 minutes ([`messages.yml:468-562`](../../../.github/workflows/messages.yml#L468-L562)):

1. **Telegram** — `getUpdates?timeout=0&offset=<last+1>`. Acknowledge by passing the next offset on the following poll. Atomic — never duplicates a message.
2. **Discord** — fetch last 10 messages. Skip bot-authored and already-reacted (`✅`). React with `✅` on collection to ack.
3. **Slack** — fetch last 10. Skip bot-authored and `white_check_mark`-reacted. React on collection.

Each collected message becomes a `repository_dispatch` event that triggers the `run` job in the same workflow.

## Inbound — `messages.yml` job `run` (handle)

The handler ([`messages.yml:564-791`](../../../.github/workflows/messages.yml#L564-L791)):

1. Extract source platform + message text.
2. Install Claude Code + Node ([`messages.yml:609-617`](../../../.github/workflows/messages.yml#L609-L617)).
3. Inject `./notify` ([`messages.yml:645-664`](../../../.github/workflows/messages.yml#L645-L664)) — same fan-out as a skill run.
4. Spawn Claude with the message as a prompt, restricted allowlist ([`messages.yml:667-672`](../../../.github/workflows/messages.yml#L667-L672)) and the same MEMORY context as a skill.
5. Log token usage ([`messages.yml:698-710`](../../../.github/workflows/messages.yml#L698-L710)).
6. Commit results ([`messages.yml:737-790`](../../../.github/workflows/messages.yml#L737-L790)) with the same rebase-resolution as skill runs.

This is how you "chat with your Aeon" today: send a Telegram message, the bot replies. The bot has read access to MEMORY, can call skills if you instruct it, and writes its own log entries.

## Telegram instant mode

The default 5-min poll cadence is too slow for conversational use. `docs/telegram-instant.md` documents an optional ~20-line Cloudflare Worker that registers a Telegram webhook and forwards updates to GitHub via `repository_dispatch` — ~1s round-trip. Not deployed by default; opt-in.

## Operational gotchas

- **Inbound polling races outbound notifications.** If you send a `./notify` reply and the poller hasn't acked the original message, the next tick may re-handle it. Both Discord and Slack guard against this via the reaction-ack pattern; Telegram via offset. Don't disable those acks.
- **Reaction-ack is not idempotent across cold restart.** If the workflow crashes after handling a message but before reacting, the next tick re-handles. Skills should be idempotent. Aeon's commit semantics make this mostly true; a few skills (tweet posting, token distribution) are not — they're already gated to `workflow_dispatch` for this reason.
- **Outbound char limits matter.** If a skill's notify exceeds the channel's limit, the channel's API will reject it. Most skill prose specifies a budget; new skills should too.
- **The dashboard feed converter costs Haiku tokens per skill run.** For a busy operator, this can be a non-trivial fraction of cost. Disable via `channels.jsonrender.enabled: false` in `aeon.yml` if not using the dashboard.
- **There is no Discord/Slack message-threading.** Each inbound message starts a fresh Claude context. If you need conversation memory, the skill must read it from `memory/`.

## Related docs

- [`runtime.md`](runtime.md) — where `./notify` and json-render conversion get wired in.
- [`skills.md`](skills.md) — the `Notify` step convention.
- [`memory.md`](memory.md) — how inbound messages persist (or don't).
