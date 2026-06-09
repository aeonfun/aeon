# Telegram Instant Mode

Default polling checks for messages every 5 minutes. For ~1s response time, deploy
the Cloudflare Worker in [`../apps/webhook/`](../apps/webhook/) as a Telegram webhook.

The Worker is now a self-contained, one-click-deployable package — source,
`wrangler.toml`, and full setup instructions live in
**[`apps/webhook/README.md`](../apps/webhook/README.md)**, including the "Deploy to
Cloudflare" button.

In short:

1. Deploy `webhook/` to your own Cloudflare account (button or `npx wrangler deploy`).
2. Fill in `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_REPO`, and `GITHUB_TOKEN`
   when the deploy wizard prompts for them (or set them as Worker secrets via
   `wrangler secret put` when deploying from a clone).
3. Point your bot at the Worker:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-worker.workers.dev"
   ```

Once a webhook is active the poller detects it via `getWebhookInfo` and skips the
Telegram branch, so polling and the webhook never conflict.
