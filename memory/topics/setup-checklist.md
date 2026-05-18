# Setup Checklist — Crypto Signals → Telegram

Goal: run Aeon as an autonomous crypto-signals agent that pushes daily picks, narrative maps, and macro context to a Telegram DM.

## Phase 1 — Fork

1. Go to https://github.com/aaronjmars/aeon → **Fork** to your account
2. Make the fork **private** (Settings → Change visibility → Private)
   - Keep public if you don't mind your config + memory being visible; public repos also get unlimited GitHub Actions minutes
3. Clone your fork locally if you want a working copy:
   ```bash
   git clone https://github.com/<your-username>/aeon
   cd aeon
   ```
4. Copy the changes from this prep branch into your fork:
   - `aeon.yml` — the enabled-skills config
   - `memory/topics/setup-checklist.md` — this file
   - `memory/topics/telegram-discord-split.md` — the future migration note
   - `memory/MEMORY.md` — updated index
   - `memory/logs/2026-05-18.md` — today's log entry

## Phase 2 — Auth (Claude OAuth via Pro/Max subscription)

1. Install Claude Code locally if you haven't: https://docs.claude.com/en/docs/claude-code
2. Run `claude setup-token`
   - Opens browser → log in with the account that owns your Pro/Max subscription
   - Prints `sk-ant-oat01-...` token (valid 1 year)
3. Copy the token
4. In your fork: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CLAUDE_CODE_OAUTH_TOKEN`
   - Value: paste the token
5. **Do not** also set `ANTHROPIC_API_KEY` — set only one auth secret

## Phase 3 — Telegram (agent + signals, same channel for now)

1. Open Telegram → search `@BotFather` → `/newbot`
2. Pick a name (e.g. `My Aeon Signals`) and a unique username (must end in `bot`, e.g. `myaeon_signals_bot`)
3. BotFather replies with a token like `1234567890:AAH...`. Save it.
4. **Start a chat with your new bot** (search its username, press Start) so it can DM you
5. Get your chat ID — visit in browser:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
   Look for `"chat":{"id":12345678,...}` — that number is your chat ID
6. Add **two secrets** to your fork (same Settings → Secrets path as above):
   - `TELEGRAM_BOT_TOKEN` = the bot token from BotFather
   - `TELEGRAM_CHAT_ID` = the chat ID from getUpdates

That's it for required secrets. Everything below is optional polish.

## Phase 4 — Optional API keys (free tiers, raise rate limits)

| Secret | Why | Where to get |
|---|---|---|
| `COINGECKO_API_KEY` | Higher rate limits for `token-movers`, `token-call`, on-chain USD pricing | https://www.coingecko.com/en/api/pricing (Demo tier free) |
| `ALCHEMY_API_KEY` | Powers `on-chain-monitor` (preferred path; Etherscan v2 fallback works without) | https://www.alchemy.com (300M compute units/mo free) |
| `ETHERSCAN_API_KEY` | Higher rate limits on `on-chain-monitor` Etherscan fallback | https://etherscan.io/myapikey |
| `XAI_API_KEY` | Powers Grok x_search pre-fetch for `narrative-tracker` — falls back to WebSearch without it | https://x.ai/api |

Skip these for v1 — the skills all degrade gracefully without them.

## Phase 5 — Push and verify

1. From your fork's local clone:
   ```bash
   git add aeon.yml memory/
   git commit -m "enable crypto signal skills + telegram setup"
   git push
   ```
2. Wait for the next scheduler tick (every 5 min by default — see `.github/workflows/messages.yml`)
3. Or trigger a test run manually:
   - GitHub UI: Actions tab → pick a workflow (e.g. `aeon`) → Run workflow → choose a skill like `aixbt-pulse`
4. Run `./onboard` to validate everything is wired up:
   - Locally: `./onboard` (checks secrets, workflows, memory writability)
   - Remotely: trigger the `onboard` workflow with `workflow_dispatch` — the checklist arrives in Telegram

## Phase 6 — First-day expectations

Once enabled and merged, here's what should hit your Telegram on day 1 (UTC times):

| Time | Skill | What you'll see |
|---|---|---|
| 09:00 | `aixbt-pulse` | Cross-domain market pulse (crypto / macro / geo / tradfi) + bridge call |
| 12:00 | `token-movers` | Top winners/losers/trending with anti-pump tags + market pulse one-liner |
| 12:00 | `monitor-runners` | Top 5 tokens that ran hardest in last 24h with Runner Score |
| 12:30 | `token-call` | One token call per day, scored 0-10 with conviction tier — or skip-day message |
| 13:00 | `market-context-refresh` | Updates `memory/topics/market-context.md` (no notification by default) |
| 13:30 | `narrative-tracker` | Quantitative narrative map with phase transitions + position calls |
| 21:00 | `aixbt-pulse` | Second daily macro pulse |
| 08/14/20 | `heartbeat` | Silent unless something needs attention |

~6–7 notifications/day on a normal day.

## Phase 7 — Add later (when ready)

When you have a specific token to track:

1. Add a "Tracked Token" section to `memory/MEMORY.md`:
   ```markdown
   ## Tracked Token

   | Symbol | Contract | Chain |
   |--------|----------|-------|
   | MYTOK  | 0x...    | base  |
   ```
2. Flip `price-threshold-alert: { enabled: true, ... }` in `aeon.yml`
3. Optionally pass target prices via `var`: `var: "0.00001, 0.00005"`

When you have wallets/contracts to watch on-chain:

1. Create `memory/on-chain-watches.yml`:
   ```yaml
   watches:
     - label: Whale 1
       address: "0x..."
       chain: ethereum
       type: wallet
       threshold_usd: 10000
   ```
2. Optionally create `memory/known-addresses.yml` to humanize counterparties
3. Flip `on-chain-monitor: { enabled: true, ... }` in `aeon.yml`

## Phase 8 — Costs to monitor

- **GitHub Actions:** check **Settings → Billing → Actions** monthly. Public repo = unlimited free. Private repo = 2000 min/mo free, then $0.008/min.
- **Claude OAuth:** flat subscription cost. Subject to Pro/Max plan rate limits — if you start hitting them, either upgrade tier or move heavy skills to `model: "claude-sonnet-4-6"` (several already are).
- **No other paid services** in this config.

## Maintenance

- The repo's `heartbeat` skill is the watchdog. It runs 3x daily, checks for failing/stuck skills, and notifies if something needs attention.
- If a skill fails 3x in a row, you can enable the reactive `skill-repair` trigger in `aeon.yml` to auto-fix.
- Watch `memory/issues/` — health skills file issues there for tracking degradations.
