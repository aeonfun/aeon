# Discord Channel Routing

Per-skill routing: each signal skill posts to its own Discord channel via a JSON map of `skill_name → webhook_url`.

## How it works

The `aeon` workflow looks up the channel for each skill in this order:

1. **`DISCORD_WEBHOOK_MAP`** repo secret — JSON object mapping skill names to webhook URLs
2. **`._default`** key inside that map — fallback for skills not listed
3. **`DISCORD_WEBHOOK_URL`** repo secret — global fallback (only used if map has no match and no `_default`)
4. **Nothing** — skill produces output but doesn't post to Discord

## Signal vs internal skills

Only **signal skills** post to Discord. Internal skills (`market-context-refresh`, `aixbt-pulse`, `token-movers`) write artifacts consumed by downstream skills and never notify any channel.

Signal skills also pass the `--signal` flag to `./notify`, which suppresses Telegram outbound (Telegram is reserved for inbound agent conversation). Signal output therefore lands only in Discord.

## Channel layout for this fork

| Skill | Channel | Purpose |
|---|---|---|
| `monitor-runners` | `#runners` | Yesterday's top 24h runners, grouped by tag |
| `narrative-tracker` | `#narratives` | Phase-grouped narratives (RISING / PEAK / FADING) with leading tokens |
| `token-call` | `#token-call` | Daily single highest-conviction call with thesis + invalidation |
| `perps-scan` | `#perps` | Daily perps regime classification per pair + summary table |
| `perps-brief` | `#perps` | 4-pass confluence synthesizer for perps sector (lands after `perps-scan`, sits on top) |
| `morning-macro` | `#morning-macro` | Cross-sector strategist read consumed at start of day |
| `daily-ops-review` | `#aeon-ops` | Chain-final health check — step statuses, anomalies, follow-ups |
| Anything not listed | `#aeon-ops` (via `_default`) | Catches unexpected output so it's never lost |

`perps-scan` and `perps-brief` share the same `#perps` webhook by design — the brief lands second and sits on top of the scan in the channel feed.

## DISCORD_WEBHOOK_MAP format

Plain JSON. Store as a single repo secret. To update routing, replace the whole JSON (GitHub doesn't support partial secret updates — re-paste the whole thing).

```json
{
  "monitor-runners":   "https://discord.com/api/webhooks/.../runners-hook",
  "narrative-tracker": "https://discord.com/api/webhooks/.../narratives-hook",
  "token-call":        "https://discord.com/api/webhooks/.../token-call-hook",
  "perps-scan":        "https://discord.com/api/webhooks/.../perps-hook",
  "perps-brief":       "https://discord.com/api/webhooks/.../perps-hook",
  "morning-macro":     "https://discord.com/api/webhooks/.../morning-macro-hook",
  "daily-ops-review":  "https://discord.com/api/webhooks/.../ops-hook",
  "_default":          "https://discord.com/api/webhooks/.../ops-hook"
}
```

The `_default` key is special: when a skill name isn't in the map, that URL is used. If you don't want unlisted skills to post anywhere, omit `_default` and they'll be silent on Discord.

## Setup walkthrough

### 1. Create the channels in Discord

In your server, create six text channels:
- `runners`
- `narratives`
- `token-call`
- `perps`
- `morning-macro`
- `aeon-ops`

Group them under a category (e.g. **Aeon Signals**) by right-clicking a channel → Edit Category, or create a category first and drag channels into it.

### 2. Create one webhook per channel

For each channel:
1. Hover the channel → gear icon → **Edit Channel**
2. **Integrations** → **Create Webhook**
3. Name it after the channel (e.g. `Aeon Runners`)
4. **Copy Webhook URL** — paste it temporarily into a scratch doc

You'll end up with six webhook URLs.

### 3. Build the JSON map

In a scratch doc, assemble the JSON like the example above. Use exact skill names from `aeon.yml` (e.g. `token-call`, not `Token Pick`). Note `perps-scan` and `perps-brief` reuse the same `#perps` URL. Verify it's valid JSON — paste into https://jsonlint.com and click Validate.

### 4. Add the secret

1. Go to `https://github.com/<your-username>/aeon/settings/secrets/actions`
2. If `DISCORD_WEBHOOK_URL` already exists from earlier setup: leave it (it's the global fallback when the map doesn't match)
3. Click **New repository secret**
4. **Name:** `DISCORD_WEBHOOK_MAP`
5. **Secret:** paste the JSON (one continuous blob — GitHub accepts multi-line)
6. **Add secret**

### 5. Test routing

Manually trigger each signal skill in Actions and verify it lands in the correct channel:

| Test order | Skill | Expected channel |
|---|---|---|
| 1 | `monitor-runners` | `#runners` |
| 2 | `narrative-tracker` | `#narratives` |
| 3 | `token-call` | `#token-call` |
| 4 | `perps-scan` | `#perps` |
| 5 | `daily-ops-review` | `#aeon-ops` |
| 6 | full `morning-review` chain | covers `perps-brief` → `#perps` + `morning-macro` → `#morning-macro` |

If a message lands in the wrong channel: the skill name in the JSON map doesn't match the workflow's `SKILL_NAME`. Compare against `aeon.yml` and fix the JSON.

If a message lands in the `_default` channel when it shouldn't: that skill isn't in the map. Add it.

If no Discord message arrives: check the workflow run logs for the `Discord` section — most common causes are malformed JSON in `DISCORD_WEBHOOK_MAP` (the `jq` parse fails silently) or a typo in the webhook URL itself.

## Adding a new channel later

When you enable a new signal skill (e.g. `on-chain-brief` from v2 expansion) and want it routed:

1. Create the channel + webhook in Discord
2. Edit the `DISCORD_WEBHOOK_MAP` secret on GitHub — paste the full updated JSON (with the new entry)
3. Make sure the skill calls `./notify --signal "..."` so Telegram is suppressed
4. Done — next run of that skill posts to the new channel

## Removing a channel

1. Delete the channel in Discord (the webhook dies automatically)
2. Edit the `DISCORD_WEBHOOK_MAP` secret — remove that key
3. Next run of that skill falls back to `_default` or `DISCORD_WEBHOOK_URL`, or stays silent on Discord if neither is set

## Telegram

Telegram is for inbound agent conversation only. Signal skills pass `--signal` to `./notify`, which suppresses Telegram outbound. If you want a non-signal skill (e.g. `heartbeat`, manual operator messages) to reach Telegram, omit the `--signal` flag and `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` must be set.
