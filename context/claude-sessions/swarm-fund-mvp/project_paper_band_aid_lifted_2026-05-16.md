---
name: --paper band-aid lifted 2026-05-16, trading loop live on unified $148.93
description: NYC departure close-out — trading loop now placing real Hyperliquid orders. Unified wallet = $148.93 (spot $115.95 + perp $32.98), not the $64.83 stale memory claimed.
type: project
originSessionId: nyc-departure-2026-05-16
---
**Action:** removed `<string>--paper</string>` from `~/Library/LaunchAgents/ai.rswarm.trading-loop.plist:27`, `launchctl unload && launchctl load -w`. Boot log confirmed live: `NAV: $148.94 (live HL unified equity = perp + spot USDC)`. PID 8206 at boot.

**Wallet state at flip:** unified `$148.93` = spot `$115.95` + perp `$32.98`. Memory `session_2026-04-28_unified_nav_pivot` quoted `$64.83` which is 18 days stale — actual wallet is ~2.3× that. Bandit-sized trades will accordingly be larger (was estimated $25–$75 / trade, now ~$50–$130 at full bandit multiplier).

**At flip-time, real positions existed on the wallet** (`BTC short 0.0031 @ $80,390.9`, `SOL long`). Visible in `/api/balance` during the foreground tunnel sanity run. By the final roll call those positions had closed (resolved or closed by something — needs founder reconciliation against HL UI). The new live loop did NOT directly cause them — they pre-existed the paper-flag removal.

**Why:** founder relocating to NYC 2026-05-16, MacBook stays in NYC as production server. The `--paper` flag was a band-aid from 2026-04-29 (post-phantom-NAV incident, before ADR-083 unified-NAV fix shipped) that survived ~2 weeks beyond its useful life. Founder explicitly chose "Go live, full bandit sizing" in plan-mode question.

**How to apply:**
- The trading loop is now placing real money trades. Reversal = re-add the `--paper` line and reload. One-line, fully reversible.
- Bandit posteriors restored warm at boot (148 variant posteriors tracked from disk). Sizing won't cold-start.
- `total_usdc()` returns `dict[spot, perp, total]`, not a scalar — use `total_usdc()['total']` for unified NAV. (Memory `session_2026-04-28_unified_nav_pivot` is stale on the return signature.)
- `/api/balance` endpoint reports spot-only ($115.83), NOT the unified value. Dashboard displays may show a low-by-$33 number until the endpoint is patched to use `total_usdc()['total']`. Non-blocking for trading.

**Source:** `~/.claude/plans/i-need-to-close-glowing-moore.md` (Phase 5), executed 2026-05-16 ~01:46 PT. Departure summary at `outputs/2026-05-16_nyc_departure.md`.
