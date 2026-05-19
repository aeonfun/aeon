/**
 * Telegram → GitHub repository_dispatch proxy.
 *
 * Replaces the every-5-minutes cron poll in .github/workflows/messages.yml with a webhook,
 * cutting per-message latency from minutes-hours to seconds.
 *
 * Flow:
 *   Telegram sends update → this Worker → POST /repos/:owner/:repo/dispatches
 *   → workflow's `repository_dispatch: [telegram-message]` trigger fires.
 *
 * The existing run job in messages.yml unpacks client_payload.message.
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response('aeon-telegram-webhook ok', { status: 200 });
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    // Verify Telegram secret token. Telegram echoes the secret we set on
    // setWebhook back in this header on every delivery.
    const providedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      console.error('TELEGRAM_WEBHOOK_SECRET not configured');
      return new Response('server misconfigured', { status: 500 });
    }
    if (providedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('unauthorized', { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('invalid json', { status: 400 });
    }

    // We only care about regular text messages. Edits, callbacks, etc. dropped.
    const message = update.message;
    if (!message || typeof message.text !== 'string' || !message.text.trim()) {
      return new Response('ok', { status: 200 });
    }

    const chatId = String(message.chat.id);
    const chatType = message.chat.type || 'private';
    const userId = String(message.from?.id ?? '');
    const username = message.from?.username ?? '';
    const text = message.text;

    // Allowlist by chat id (comma-separated). Empty = allow only the legacy
    // TELEGRAM_CHAT_ID, matching messages.yml's current behavior.
    const allowedRaw = env.ALLOWED_CHAT_IDS || env.TELEGRAM_CHAT_ID || '';
    const allowed = allowedRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(chatId)) {
      console.log(`rejected chat ${chatId} (${chatType}) — not in allowlist`);
      return new Response('ok', { status: 200 });
    }

    // In groups, ignore unless the bot is mentioned or the message is a
    // command. Avoids responding to every line of chitchat.
    if (chatType === 'group' || chatType === 'supergroup') {
      const botUsername = env.BOT_USERNAME?.toLowerCase();
      const mentioned = botUsername && text.toLowerCase().includes(`@${botUsername}`);
      const isCommand = text.startsWith('/');
      const isReplyToBot = message.reply_to_message?.from?.username?.toLowerCase() === botUsername;
      if (!mentioned && !isCommand && !isReplyToBot) {
        return new Response('ok', { status: 200 });
      }
    }

    // Strip the @botname mention from group messages so downstream sees clean text.
    let cleanText = text;
    if (env.BOT_USERNAME) {
      const re = new RegExp(`@${env.BOT_USERNAME}\\b`, 'gi');
      cleanText = cleanText.replace(re, '').trim();
    }

    // Fire dispatch + optional ack in parallel; return 200 to Telegram fast.
    ctx.waitUntil(
      Promise.all([
        dispatchToGithub(env, {
          message: cleanText,
          chat_id: chatId,
          chat_type: chatType,
          user_id: userId,
          username,
          message_id: String(message.message_id),
        }),
        env.SEND_ACK === 'true'
          ? sendTelegramAck(env, chatId, message.message_id)
          : Promise.resolve(),
      ]),
    );

    return new Response('ok', { status: 200 });
  },
};

async function dispatchToGithub(env, clientPayload) {
  if (!env.GITHUB_REPO || !env.GITHUB_TOKEN) {
    console.error('GITHUB_REPO or GITHUB_TOKEN not configured');
    return;
  }
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'aeon-telegram-webhook',
    },
    body: JSON.stringify({
      event_type: 'telegram-message',
      client_payload: clientPayload,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`github dispatch failed ${res.status}: ${body}`);
  }
}

async function sendTelegramAck(env, chatId, replyToId) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '⏳ on it — spinning up a runner',
      reply_to_message_id: replyToId,
      disable_notification: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`telegram ack failed ${res.status}: ${body}`);
  }
}
