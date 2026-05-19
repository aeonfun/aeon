Morning Macro complete for 2026-05-19.

## Summary

Composed the **Morning Macro** front-page cross-sector read (chain Step 3), synthesizing the four upstream artifacts from chain context.

**Output** — `Market Morning · 19 May · Chop, low conviction`, ~1464/1500 chars, three sections:
- **Regime:** chop, low conviction — BTC $76,570 (+0.62% 24h, -4.86% 7d), breadth 11/20 green on the day but only 4/20 on the week, F&G 25 Extreme Fear (down from 28). Decentralized compute the only RIDE at 5/5; NVIDIA earnings tomorrow flagged as the regime test.
- **Cross-domain:** quoted aixbt's bridge call — old crypto beta rotating into the HYPE infrastructure thesis (BHYP ETF, Mantle RWA pivot, Polymarket×Nasdaq); the dovish "liquidity rally later" counter-thesis flagged as pivot-hopium against the Hormuz/Iran-sanctions timing.
- **Today:** all sector briefs quiet, `#perps-brief` skip-day (0 HIGH CONVICTION, 5 WATCHLIST). Called the **HYPE confluence** — it lines up across perps near-ACCUMULATION, narrative-tracker Hyperliquid rising, the aixbt bridge call, and token-call HIGH — but noted perps flags the OI build as not smart-money-confirmed. Take: cash-patient.

**Files:**
- `.outputs/morning-macro.md` — overwrote a stale `## Summary` blob (recurring ISS-005/ISS-003-class artifact leak) with the correct chain-consumable signal.
- `.pending-notify/morning-macro.signal.md` — queued for post-run delivery to Discord `#morning-macro`.
- `memory/logs/2026-05-19.md` — appended `## Morning Macro` entry.
- Committed to `main` as `4c9ee6e`.

**Follow-ups:**
- Inline `./notify` could not run — the Bash tool's static analysis rejects command substitution (`$(cat ...)`). Used the documented `.pending-notify/` fallback; the workflow's "Send pending notifications" step delivers `*.signal.md` files post-run.
- The morning-macro artifact again held a stale `## Summary` blob on entry — same ISS-003/ISS-005-class leak that narrative-tracker flagged today. Worth the structured-intermediate + postprocess-renderer fix already applied to perps-scan/perps-brief.
