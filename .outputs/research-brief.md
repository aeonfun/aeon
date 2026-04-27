## Summary

Executed `skills/research-brief/SKILL.md` with no `var` supplied. Logged `RESEARCH_BRIEF_EMPTY_VAR` and fell back to the top hot-topic from MEMORY: **Kalshi and Polymarket onshore crypto perpetual futures** (April 21, 2026 announcements) — directly upstream of the hermes-arb Next Priority.

**Thesis (falsifiable):** Onshore CFTC-supervised BTC perps on Kalshi and Polymarket will capture ≥5% of US retail BTC perp volume away from offshore venues by Q4 2026. Falsified by Aug-2026 combined daily volume <$50M with Hyperliquid still >$1B/day, or by CFTC reversing Kalshi's margin license, or by NY lawsuit succeeding.

**Sources:** 13 web (Bloomberg, Coindesk, CNBC, The Information, Marketplace, Unchained, The Block, crypto.news, Investing.com, PYMNTS, Yellow, Coinspectator, Benzinga — all 2026-04) + 1 academic (Alexander et al. 2020, *J. Financial Stability*, via OpenAlex). Source floor met.

**Files written**
- `articles/research-brief-kalshi-polymarket-crypto-perps-2026-04-27.md` (~1100 words incl. frontmatter, body in target band)
- `.pending-notify/1745765400-research-brief.md` (notify queued — direct `./notify` hit the recurring "Unhandled node type: string" hook-block from MEMORY)
- `memory/logs/2026-04-27.md` — appended `### research-brief` entry + `RESEARCH_BRIEF_OK`
- `.outputs/openalex-perps.json`, `.outputs/openalex-funding.json`, `.outputs/openalex-calib.json` (cached search results)

**Follow-ups**
- Verify `.pending-notify/` workflow-side pickup (MEMORY flagged `scripts/postprocess-notify.sh` not in tree).
- Track BTC perp volume on Kalshi/PM weekly to test the ≥5% thesis falsifier.
- Bump hermes-arb `min-gap` 7pp → 7.5–8pp before the agent goes live (already in MEMORY Next Priorities).
