# Telegram webhook proxy

Cloudflare Worker that converts Telegram updates into GitHub `repository_dispatch`
events. Replaces the `*/5 * * * *` cron poll in `.github/workflows/messages.yml`,
cutting time-to-first-byte from ~5–90 min down to ~5 s + GHA runner cold start.

The Worker also handles:

- **Webhook auth** — verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header.
- **Multi-chat allowlist** — `ALLOWED_CHAT_IDS` env var, comma-separated.
- **Group mode** — only responds to `/commands`, `@botname` mentions, or replies
  to the bot. Strips the `@botname` from the forwarded message.
- **Optional ack** — sends a fast "on it" message back to Telegram before GHA
  spins up, so the user sees something within ~1 s.

## Setup

### 1. Install wrangler

```sh
cd webhook-proxy
npm install
npx wrangler login
```

### 2. Create a GitHub fine-grained PAT

[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

- Resource owner: your account/org
- Repository access: only the aeon repo
- Permissions: **Actions → Read and write**, **Metadata → Read-only**

Copy the token (`github_pat_...`).

### 3. Pick a webhook secret

Generate any random string — Telegram will echo it back on every delivery.

```sh
openssl rand -hex 32
```

### 4. Set Worker secrets

```sh
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # paste the openssl output
npx wrangler secret put TELEGRAM_BOT_TOKEN        # same as your GHA secret
npx wrangler secret put GITHUB_TOKEN              # the PAT from step 2
npx wrangler secret put TELEGRAM_CHAT_ID          # your DM chat id (optional fallback)
```

### 5. Edit `wrangler.toml`

- Set `GITHUB_REPO` to `owner/repo` (already defaults to `azh1er/aeon`).
- Set `BOT_USERNAME` (no `@`) if you want group mode.
- Set `ALLOWED_CHAT_IDS` to a comma-separated list if you want multi-user DM
  or a specific group. Leave unset to fall back to `TELEGRAM_CHAT_ID`.

### 6. Deploy

```sh
npx wrangler deploy
```

Note the URL it prints, e.g. `https://aeon-telegram-webhook.<sub>.workers.dev`.

### 7. Point Telegram at the Worker

```sh
TG_TOKEN=...           # bot token
TG_SECRET=...          # same value as TELEGRAM_WEBHOOK_SECRET
WORKER_URL=https://aeon-telegram-webhook.<sub>.workers.dev

curl -sX POST "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg url "$WORKER_URL" --arg secret "$TG_SECRET" '{
    url: $url,
    secret_token: $secret,
    allowed_updates: ["message"],
    drop_pending_updates: true
  }')"
```

Verify:

```sh
curl -s "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo" | jq
```

### 8. Disable the cron poll (optional but recommended)

Once webhook is live, the `*/5 * * * *` poll in `messages.yml` becomes redundant
and will race the webhook. Edit `.github/workflows/messages.yml`:

```yaml
on:
  # schedule:
  #   - cron: '*/5 * * * *'   # disabled — replaced by webhook-proxy
  workflow_dispatch: { ... }
  repository_dispatch:
    types: [telegram-message, discord-message, slack-message, cron-tick]
```

Leave the `tick` job intact — it's still useful for `workflow_dispatch` and
manual `repository_dispatch: cron-tick` invocations for the scheduler. Or split
the scheduler into its own workflow if you want a clean separation.

## Group mode

To use in a group:

1. Add the bot to the group via the Telegram client.
2. Talk to [@BotFather](https://t.me/BotFather): `/setprivacy` → your bot →
   `Disable` (otherwise the bot only sees `/commands` and replies — fine if
   that's all you want).
3. Find the group's chat id:
   - Send a test message in the group, then
   - `curl "https://api.telegram.org/bot${TG_TOKEN}/getUpdates" | jq '.result[0].message.chat'`
   - Group ids are negative, e.g. `-1001234567890`.
4. Set `BOT_USERNAME` and add the group id to `ALLOWED_CHAT_IDS` in `wrangler.toml`.
5. `npx wrangler deploy`.

## Testing

```sh
# Send a fake update through the worker
curl -sX POST "$WORKER_URL" \
  -H "X-Telegram-Bot-Api-Secret-Token: $TG_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": {"id": 1, "username": "tester"},
      "chat": {"id": 1, "type": "private"},
      "text": "hello aeon"
    }
  }'
```

Check the Actions tab for a new `Messages & Scheduler` run with the
`telegram-message` payload.

Tail the Worker logs while testing:

```sh
npx wrangler tail
```

## Known limitations

- **Replies still go to `TELEGRAM_CHAT_ID`.** The webhook forwards `chat_id` in
  `client_payload`, but the existing `./notify` script in `messages.yml` reads
  `TELEGRAM_CHAT_ID` from env when sending replies. For real multi-chat /
  group support, `messages.yml` needs to thread `github.event.client_payload.chat_id`
  through to the `notify` script. That's a separate change.
- **Cold start still dominates.** Webhook delivery is ~1 s; the rest of the
  latency (30 s–3 min) is GHA runner queue + Claude CLI install. To go lower,
  you'd need to move the handler out of GHA entirely.

## Cost

Cloudflare Workers free tier: 100k requests/day. Telegram won't come close.
GitHub `repository_dispatch`: unmetered for public repos, 5000 req/hr for the
PAT on private repos. Also fine.
