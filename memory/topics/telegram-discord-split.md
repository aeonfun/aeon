# Telegram → Discord Migration Plan

Future state goal:
- **Telegram** = agent conversations only (inbound — operator messages the bot, agent responds)
- **Discord** = signal feed only (outbound — daily picks, narrative maps, on-chain alerts)

Current state (v1):
- **Telegram** = both inbound (agent) and outbound (signals)
- **Discord** = not yet configured

## Why this split

Telegram is the better personal-conversation surface — DM with a bot, instant push, fast search. Discord is better as a group/team signal channel where multiple people can see the feed. Splitting lets each surface play to its strength.

## What changes when you split

The `./notify` script currently fans out to every configured channel. To route signals to Discord while keeping the agent on Telegram, one of:

### Option A — env-var toggle in `./notify` (simplest, recommended)

Add an env var `NOTIFY_TELEGRAM_ENABLED=false` that `./notify` honors. The Telegram inbound poller in `.github/workflows/messages.yml` doesn't read that var, so it keeps listening. Outcome: agent inbound still works; outbound goes to Discord only.

Implementation sketch:
1. Edit `./notify` to skip the Telegram block when `NOTIFY_TELEGRAM_ENABLED=false`
2. Add `NOTIFY_TELEGRAM_ENABLED=false` as a repo variable (Settings → Variables → Actions)
3. Add Discord secrets: `DISCORD_WEBHOOK_URL` (outbound)
4. Done

### Option B — `./notify-signal` wrapper

Create a sibling script `./notify-signal` that targets Discord only. Bulk-edit signal skills to call `./notify-signal "..."` instead of `./notify "..."`. The agent path keeps using `./notify` → Telegram.

More work (touches ~10 SKILL.md files) but cleaner: each skill explicitly declares which surface it pushes to. Useful if you later want a third surface (email weekly digest, etc.) without rewriting everything.

### Option C — channel flag

Add `--channel` to `./notify`: `./notify --channel discord "..."` or `./notify --channel telegram "..."`. Default fan-out behavior stays for backward compat. Signal skills get `--channel discord`.

## Prep work to do now (no action required, just decisions)

1. **Pick the channel name in Discord.** When you're ready, create the dedicated `#aeon-signals` channel in your Discord. Don't add the webhook yet — just decide on the home.
2. **Decide who sees signals.** Restrict channel to the right roles before you flip it on.
3. **Generate the webhook URL when ready.** Channel → Edit Channel → Integrations → Webhooks → New Webhook. Save the URL but **don't add it as a repo secret yet** — adding it now makes Aeon fan out to both surfaces.

## Migration day (when you decide to split)

1. Create `#aeon-signals` Discord channel + webhook (if not already done)
2. Add to fork secrets:
   - `DISCORD_WEBHOOK_URL` = the webhook URL
3. Implement one of the options above (A, B, or C) in a PR
4. Push the PR
5. Verify next signal lands in Discord, agent still responds in Telegram
6. Remove or downgrade the old Telegram signal volume (don't touch the inbound secrets)

## What does NOT change

- `aeon.yml` skill list, schedules, vars
- Skill SKILL.md files (unless you pick Option B/C and edit `./notify` calls)
- Memory, state files, dedup logic
- GitHub Actions workflows
- The Telegram inbound agent poller — keeps working

The migration is a config + thin wrapper change, not an architectural one.

## Estimated effort

- Option A: ~30 min (one script edit + repo var + Discord webhook + test)
- Option B: ~1h (script + sweep skills + test)
- Option C: ~45 min (script + selective skill edits + test)

Aeon can do this migration itself via a PR when you're ready — just ask.
