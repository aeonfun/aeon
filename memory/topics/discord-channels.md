# Discord Channel Routing

Per-skill routing: each skill posts to its own Discord channel via a JSON map of `skill_name → webhook_url`.

## How it works

The `aeon` workflow looks up the channel for each skill in this order:

1. **`DISCORD_WEBHOOK_MAP`** repo secret — JSON object mapping skill names to webhook URLs
2. **`._default`** key inside that map — fallback for skills not listed
3. **`DISCORD_WEBHOOK_URL`** repo secret — global fallback (only used if map has no match and no `_default`)
4. **Nothing** — skill produces output but doesn't post to Discord

## Channel layout for this fork

| Skill | Channel | Why a dedicated channel |
|---|---|---|
| `aixbt-pulse` | `#aeon-market-pulse` | Macro/cross-domain context, twice daily — own channel keeps it from drowning out picks |
| `token-call` | `#aeon-picks` | Daily call, the most "signal-heavy" output — easy to find later for accountability |
| `token-movers` | `#aeon-movers` | Daily winners/losers with anti-pump tags — high volume of data per message |
| `monitor-runners` | `#aeon-runners` | Top 5 24h runners — different angle from movers |
| `narrative-tracker` | `#aeon-narratives` | Position calls + phase transitions — slow-moving, worth re-reading |
| `heartbeat` + system | `#aeon-ops` | Operator alerts (failures, stuck skills) — quiet by design |
| Anything not listed | `#aeon-ops` (via `_default`) | Catches `market-context-refresh` if it ever notifies, plus future skills |

Adjust to taste — channel names are arbitrary.

## DISCORD_WEBHOOK_MAP format

Plain JSON. Store as a single repo secret. To update routing, replace the whole JSON (GitHub doesn't support partial secret updates — you re-paste the whole thing).

```json
{
  "aixbt-pulse": "https://discord.com/api/webhooks/123.../market-pulse-hook",
  "token-call": "https://discord.com/api/webhooks/123.../picks-hook",
  "token-movers": "https://discord.com/api/webhooks/123.../movers-hook",
  "monitor-runners": "https://discord.com/api/webhooks/123.../runners-hook",
  "narrative-tracker": "https://discord.com/api/webhooks/123.../narratives-hook",
  "heartbeat": "https://discord.com/api/webhooks/123.../ops-hook",
  "_default": "https://discord.com/api/webhooks/123.../ops-hook"
}
```

The `_default` key is special: when a skill name isn't in the map, that URL is used. If you don't want unlisted skills to post anywhere, omit `_default` and they'll be silent on Discord.

## Setup walkthrough

### 1. Create the channels in Discord

In your server, create text channels:
- `aeon-market-pulse`
- `aeon-picks`
- `aeon-movers`
- `aeon-runners`
- `aeon-narratives`
- `aeon-ops`

Group them under a category (e.g. **Aeon Signals**) by right-clicking a channel → Edit Category, or create a category first and drag channels into it.

### 2. Create one webhook per channel

For each channel:
1. Hover the channel → gear icon → **Edit Channel**
2. **Integrations** → **Create Webhook**
3. Name it after the channel (e.g. `Aeon Picks`)
4. **Copy Webhook URL** — paste it temporarily into a scratch doc

You'll end up with 6 webhook URLs.

### 3. Build the JSON map

In a scratch doc, assemble the JSON like the example above. Use exact skill names from `aeon.yml` (e.g. `token-call`, not `Token Pick`). Verify it's valid JSON — easiest way is to paste it into https://jsonlint.com and click Validate.

### 4. Add the secret

1. Go to `https://github.com/<your_username>/aeon/settings/secrets/actions`
2. If `DISCORD_WEBHOOK_URL` already exists from earlier setup: leave it (it's the fallback when the map doesn't match)
3. Click **New repository secret**
4. **Name:** `DISCORD_WEBHOOK_MAP`
5. **Secret:** paste the JSON (one continuous blob — GitHub accepts multi-line)
6. **Add secret**

### 5. Test routing

Manually trigger each skill in Actions and verify it lands in the correct channel:

| Test order | Skill | Expected channel |
|---|---|---|
| 1 | `aixbt-pulse` | `#aeon-market-pulse` |
| 2 | `token-call` | `#aeon-picks` |
| 3 | `token-movers` | `#aeon-movers` |
| 4 | `monitor-runners` | `#aeon-runners` |
| 5 | `narrative-tracker` | `#aeon-narratives` |

If a message lands in the wrong channel: the skill name in the JSON map doesn't match the workflow's `SKILL_NAME`. Compare against `aeon.yml` and fix the JSON.

If a message lands in the `_default` channel when it shouldn't: that skill isn't in the map. Add it.

If no Discord message arrives but Telegram works: check the workflow run logs for the `Discord` section — most common causes are malformed JSON in `DISCORD_WEBHOOK_MAP` (the `jq` parse fails silently) or a typo in the webhook URL itself.

## Adding a new channel later

When you enable a new skill (e.g. `defi-overview`) and want it routed:

1. Create the channel + webhook in Discord
2. Edit the `DISCORD_WEBHOOK_MAP` secret on GitHub — paste the full updated JSON (with the new entry)
3. Done — next run of that skill posts to the new channel

## Removing a channel

1. Delete the channel in Discord (the webhook dies automatically)
2. Edit the `DISCORD_WEBHOOK_MAP` secret — remove that key
3. Next run of that skill falls back to `_default` or `DISCORD_WEBHOOK_URL`, or stays silent on Discord if neither is set

## Telegram still gets everything (for now)

This change only affects Discord routing. Telegram still receives every signal from every skill. If/when you want to silence Telegram outbound (keeping the agent inbound on Telegram), that's a separate workflow change — covered in `topics/telegram-discord-split.md`.
