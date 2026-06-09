# Aeon Telegram webhook — instant mode

Default polling checks Telegram every 5 minutes. Deploy this Cloudflare Worker as
a Telegram webhook to drop that to **~1 second**: the Worker relays each message
to your Aeon fork via a GitHub `repository_dispatch`, which fires the
**Messages & Scheduler** workflow immediately.

Each user deploys it into **their own** Cloudflare account. There's no shared
relay and no credential custody — your bot token and GitHub PAT live only in your
Worker's secrets.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aaronjmars/aeon/tree/main/apps/webhook)

> Forked Aeon? Change `aaronjmars/aeon` in the button URL above to
> `your-username/your-fork` so it deploys from your repo. (The button requires a
> **public** source repo.)

Or from a clone:

```bash
cd apps/webhook
npm install
npx wrangler deploy
```

## Configure

The deploy button prompts for all four values during the wizard (declared in
[`.dev.vars.example`](.dev.vars.example)) and stores them as encrypted Worker
secrets — the Worker comes out configured. Deploying from a clone instead? Set
them via the CLI:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN        # bot token from @BotFather
npx wrangler secret put TELEGRAM_CHAT_ID          # your chat id (only this chat is allowed)
npx wrangler secret put GITHUB_REPO               # owner/repo of your Aeon fork
npx wrangler secret put GITHUB_TOKEN              # GitHub PAT (see scopes below)
```

| Secret | Required | Notes |
|--------|----------|-------|
| `TELEGRAM_BOT_TOKEN` | yes | From [@BotFather](https://t.me/BotFather). |
| `TELEGRAM_CHAT_ID` | yes | Only messages from this chat are relayed; everything else is dropped. |
| `GITHUB_REPO` | yes | `owner/repo` of your Aeon fork, e.g. `aaronjmars/aeon` — not the worker repo the deploy button creates. |
| `GITHUB_TOKEN` | yes | Fine-grained PAT scoped to your fork with **Contents: read/write** and **Actions: read/write**, or a classic token with `repo`. |

To edit values later: Cloudflare dashboard → Workers & Pages → your worker →
Settings → Variables and secrets.

## Point Telegram at the Worker

Register your Worker URL as the bot's webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://aeon-telegram-webhook.<your-subdomain>.workers.dev"
```

Verify it took:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Messages now arrive in ~1s. To go back to polling, clear the webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

## How it coexists with polling

A webhook and `getUpdates` polling are **mutually exclusive** — once a webhook is
set, `getUpdates` returns `409 Conflict`. The Messages & Scheduler workflow's
poller calls `getWebhookInfo` first and **skips the Telegram branch when a webhook
is active**, so the two never fight. Delivery then runs entirely through this
Worker → `repository_dispatch`.

Dedupe in webhook mode is by the `update_id` carried in the dispatch payload:
the Worker returns `200` once GitHub accepts the dispatch (so Telegram never
redelivers) and a non-2xx only when the dispatch genuinely failed (so Telegram
retries).

## What it does

```
Telegram → POST update → Worker
  ├─ verify method
  ├─ ignore (200) anything not a text message from TELEGRAM_CHAT_ID
  └─ POST repository_dispatch {event_type: telegram-message, client_payload:{message,…}}
       → GitHub Actions: Messages & Scheduler `run` job acts on it (~1s)
```

The Worker source is [`src/worker.js`](src/worker.js) — ~30 lines, no build step.
