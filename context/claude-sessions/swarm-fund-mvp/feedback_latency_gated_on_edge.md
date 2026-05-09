---
name: Latency work is gated on proven paper-edge
description: Don't build Tier 1 WS/co-lo until a latency-sensitive strategy proves edge in paper at the existing 15-min cadence; then build latency for that strategy specifically and measure bps lift directly
type: project
originSessionId: 3ca7274e-999b-461c-b163-3e469018f0a8
---
**Rule (from Thomas, 2026-04-24):**
> Build Tier 1 only for the strategy that proved edge — and measure the bps lift directly.

**Why it matters:** CalibrationGap (the only proven-edge strategy as of 2026-04-24) earns ~+2061 bps net per trade on markets that resolve in weeks. Tier 1 WS-triggered scan would gain it maybe 5–20 bps of better entry fill — rounding error against the thesis. Latency infrastructure is a force multiplier; force-multiplying a strategy with no proven edge multiplies zero.

**How to apply:**
- When user asks about latency reduction: first ask "for which strategy with proven paper-edge?"
- If the strategy hasn't earned in paper at the current 15-min cadence, propose proving edge first, latency second.
- When latency work IS justified, scope it to the specific strategy, instrument `scan_trigger_to_order_latency_ms` in `lmnr` before+after, and report bps lift in `eval_log.jsonl` for that strategy. No global rollouts.
- Never build the full latency stack as a prerequisite for new strategies — build the strategy at 15-min cadence first, see if it earns.

**Sequencing (committed 2026-04-24):**
1. Design + paper-trial a 5-min BTC strategy at current cadence (Polymarket 5-min BTC up/down + Kalshi cross-venue + HL liquidations / funding signal).
2. Backtest + Monte Carlo on historical 5-min BTC markets to estimate gross edge per latency tier.
3. ONLY if (1) shows positive paper-edge AND (2) shows latency-sensitivity (edge curve drops sharply with simulated added ms): build Tier 1 WS-triggered scan + co-lo.
4. Measure bps lift directly post-deploy in `eval_log.jsonl`.

**Related:** `polymarket_datacenter_ban.md` (PM co-lo constraints), `~/.claude/plans/what-are-other-latency-golden-corbato.md` (full latency surface).
