Done. The digest is queued for delivery via the workflow's pending-notify pickup.

## Summary

Generated and queued today's `prediction markets` digest (second run; the morning run had already shipped at ~14:35 UTC). Took the topic from mission context — `aeon.yml` line 49 still has `var:` empty, so defaulted to "prediction markets" (matches earlier-today and 2026-04-25 precedent).

**Lead item:** *Polymarket V2 cutover tomorrow at 11 UTC* — every open limit order gets cancelled, USDC.e collateral converts 1:1 to new pUSD ERC-20, API integrations must be on v2 SDK. **Operational consequence: any CalibrationGap/Revenant resting quotes or hermes-arb PM legs need to be flattened before 07 UTC tomorrow** — this matches the OPS ALERT flagged earlier today by `polymarket-comments`.

Items 2–3: Polymarket chain-migration plan off Polygon (POLY L2 lead candidate; PM = 50–70% of Polygon fee revenue); FanDuel enters prediction markets (Bloomberg, Apr 27). Glance: Brazil's 29-platform block now in force.

**Files written**
- `.pending-notify/1777300045.md` (2334 chars, under 3000 cap) — picked up by workflow's pending-notify postprocess step on run completion
- `memory/logs/2026-04-27.md` — appended digest log entry (raw=22 / filter=4 / sent=4) with full dedup pass against earlier-today digest, narrative-tracker, polymarket-comments, fetch-tweets, article, plus 04-25/04-26 logs
- `memory/MEMORY.md` — new row in Recent Digests table; relabeled earlier-today row as "(earlier run)" to disambiguate
- `.audit-tmp/digest-log-fragment.md` — scratch fragment used for the log append (safe to leave)

**Follow-ups for operator**
- **Config gap:** add `var: "prediction markets"` (or alternative) to `digest:` in `aeon.yml` line 49 — same fix already in MEMORY.md "Next Priorities" alongside `list-digest`/`refresh-x`/`remix-tweets`
- **Critical ops:** flatten Polymarket resting orders before 07 UTC tomorrow Apr 28 — V2 cutover at 11 UTC wipes the book (also in today's polymarket-comments OPS ALERT)
- **Sandbox bug recurring:** `./notify "$(cat …)"` still hook-blocked ("Unhandled node type: string"), and bash `>>` redirect is also sandbox-blocked from this session — used Edit-tool anchor to append to log; pending-notify fallback used for delivery

Sources:
- [Polymarket Exchange Upgrade: April 28, 2026 (primary)](https://help.polymarket.com/en/articles/14762452-polymarket-exchange-upgrade-april-28-2026)
- [Polymarket's executive reveals chain migration plans (TheStreet)](https://www.thestreet.com/crypto/markets/worlds-largest-prediction-market-announces-migration-from-polygon)
- [FanDuel Pushes Into Prediction Markets (Bloomberg)](https://www.bloomberg.com/news/articles/2026-04-27/fanduel-pushes-into-prediction-markets-as-users-download-kalshi-polymarket)
- [Brazil Bans Polymarket, Kalshi, and 27 Other Prediction Markets (FXLeaders)](https://www.fxleaders.com/news/2026/04/27/brazil-bans-polymarket-kalshi-and-27-other-prediction-markets-full-block-now-in-effect/)
