## Summary

Ran the digest skill on topic **"prediction markets"** (defaulted because `aeon.yml`'s `digest:` line has no `var:` set — SKILL.md treats it as required, so logged a config-fix note).

**Digest sent (3 main items + 3 glance, ~2200 chars, no emoji):**
1. *Lead* — Polymarket and Kalshi opening crypto perpetual futures within 6 days (Polymarket Apr 21; Kalshi "Timeless" Apr 27 NYC). Most actionable for hermes-arb.
2. First US insider-trading prosecution on a prediction market — soldier arrested over Maduro-ouster Polymarket bets; Kalshi suspended 3 congressional candidates for self-betting.
3. Brazil blocked Polymarket and Kalshi on Apr 24 over gambling-law non-compliance.
4. *Glance* — Polymarket targeting $15B vs Kalshi's $22B; Bitwise/Roundhill/GraniteShares filing event-contract ETFs for IRAs; 9th Circuit leaning toward Nevada vs Kalshi on sports betting.

**Sources:** WebSearch x2 (broad + narrow Polymarket/Kalshi). `.xai-cache/digest.json` absent — no WebFetch fallback needed (search returned 18 strong links).

**Dedup:** Cross-checked vs today's narrative-tracker, deep-research, polymarket-comments — none covered these news items. Yesterday's log is from 2026-03-19 (unrelated changelog).

**Files written:** `.pending-notify/1777128096.md`, `/tmp/digest_body.txt`, log entry in `memory/logs/2026-04-25.md`, row added to `memory/MEMORY.md` Recent Digests table.

**Follow-up:**
- `./notify` direct call hit the same "Unhandled node type: string" sandbox hook bug seen in polymarket-comments, narrative-tracker, daily-routine today. Postprocess-notify.sh will deliver the queued message. Worth filing as a `memory/issues/` entry — affects every notify-calling skill in this sandbox configuration.
- Add `var: "prediction markets"` to the `digest:` line in `aeon.yml` so future runs don't have to guess.

Sources:
- [Kalshi vs Polymarket: The US Crypto Perps Showdown Begins](https://www.cryptotimes.io/2026/04/24/kalshi-vs-polymarket-the-us-crypto-perps-showdown-begins/)
- [Soldier's arrest comes after pattern of suspicious trades on prediction markets](https://www.cnn.com/2026/04/24/politics/prediction-market-insider-trading-suspicious-activity)
- [Brazil Blocks Polymarket, Kalshi Over 'Illegal Betting'](https://www.bloomberg.com/news/articles/2026-04-24/brazil-moves-to-ban-prediction-markets-on-elections-sports)
- [Polymarket Targets $15 Billion Valuation in New Funding Round](https://www.pymnts.com/news/investment-tracker/2026/polymarket-targets-15-billion-valuation-in-new-funding-round/)
- [Prediction markets could soon be available in your retirement account](https://www.cnbc.com/2026/04/24/prediction-markets-could-soon-be-available-in-your-retirement-account.html)
- [Kalshi's fight over prediction markets sports betting moves toward the Supreme Court](https://fortune.com/2026/04/20/kalshi-supreme-court-sports-betting-prediction-markets/)
