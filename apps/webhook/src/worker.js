/**
 * Aeon — Telegram instant-delivery webhook.
 *
 * A Cloudflare Worker that receives Telegram webhook updates and relays them to
 * your Aeon fork via a GitHub `repository_dispatch` (event_type: telegram-message).
 * The "Messages & Scheduler" workflow's `run` job picks it up immediately, so a
 * message is acted on in ~1s instead of waiting up to 5 minutes for the next poll.
 *
 * Each user deploys this into their OWN Cloudflare account — there is no shared
 * infrastructure and no credential custody. See README.md for deployment.
 *
 * Required vars/secrets (the deploy wizard prompts for them; see .dev.vars.example):
 *   TELEGRAM_BOT_TOKEN        bot token from @BotFather
 *   TELEGRAM_CHAT_ID          the only chat allowed to command the agent
 *   GITHUB_REPO               "owner/repo" of your Aeon fork
 *   GITHUB_TOKEN              GitHub PAT — fine-grained with Contents: read/write
 *                             and Actions: read/write on your fork (or classic `repo`)
 */
export default {
  async fetch(request, env) {
    // Telegram only ever POSTs updates. Treat anything else as a health probe.
    if (request.method !== "POST") {
      return new Response("aeon telegram webhook: ok", { status: 200 });
    }

    // Reject forged requests when a shared secret is configured. Telegram echoes
    // the secret passed to setWebhook(secret_token) in this header on every call.
    if (
      env.TELEGRAM_WEBHOOK_SECRET &&
      request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET
    ) {
      return new Response("forbidden", { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    const message = update?.message;
    // Return 200 for anything we intentionally ignore so Telegram marks the
    // update delivered and never redelivers it. Only commands from the configured
    // chat are relayed — every other chat is dropped.
    if (!message?.text || String(message.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) {
      return new Response("ignored", { status: 200 });
    }

    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "aeon-telegram-webhook",
      },
      body: JSON.stringify({
        event_type: "telegram-message",
        client_payload: {
          message: message.text,
          update_id: update.update_id,
          chat_id: message.chat.id,
        },
      }),
    });

    // On failure return non-2xx so Telegram retries the update later — dedupe is
    // by the update_id carried in client_payload. On success return 200 so the
    // update is never redelivered.
    if (!res.ok) {
      return new Response(`dispatch failed: ${res.status}`, { status: 502 });
    }
    return new Response("ok", { status: 200 });
  },
};
