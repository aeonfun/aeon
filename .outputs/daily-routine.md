## Summary

Executed `skills/daily-routine/SKILL.md` for 2026-04-26 in standalone fallback mode (no chain context — yesterday's `.outputs/*.md` were stale).

**Headlines:**
- **Token movers — gaming rotation flipped:** APE went from yesterday's +39.3% BREAKOUT/PUMP-RISK winner to today's -17.2% CAPITULATION loser. CHIP also held its capitulation move (-15.3%). New BREAKOUT face: BSB +27.2% / 7d +206%, also trending. Tape mixed: 48/100 top-100 green, BTC flat at $78.1k.
- **Paper of the day:** LLaTiSA (arXiv 2604.17295, ↑80) — hierarchical TSR taxonomy + 83k HiTSR dataset + VLM that fuses chart-images with numerical tables. Direct read for hermes-arb temporal alignment and CalibrationGap historical features.
- **GitHub issues:** 0 new across `user:tomscaria` repos. GITHUB_ISSUES_OK.
- **HN digest:** 6 stories — Erdős+ChatGPT (325/192), coding-assistance to revive projects (263/55), iPhone silent-install Tell HN (221/99), Alzheimer's progress (205/108), EU Age Control digital-ID trojan (140/49), DeepSeek-V4 Day 0 with SGLang verified-RL (47).
- **Tweets:** PM/Kalshi at ~$20B both pushing perps; Claude Opus 4.6 leading LMSYS + 65.3% SWE-bench; Apoorva Mehta launches Abundance ($100M AI-agent hedge fund); Bun mainstream / PostgreSQL 55.6% / Zed gaining.

**Files written:**
- `.outputs/daily-routine.md` — combined notification body (3,339 chars)
- `.outputs/cg-markets.json`, `.outputs/cg-trending.json`, `.outputs/hf-daily.json`, `.outputs/hn-front.json` — raw fetches
- `.outputs/movers.js` — node-based mover analyzer (python3 blocked under this sandbox config; switched to node)
- `.pending-notify/1777191079.md` — outbound queued for postprocess-notify.sh delivery
- `memory/logs/2026-04-26.md` — appended `## Daily Routine` log entry

**Follow-ups:**
- `./notify` "Unhandled node type: string" hook-block recurs (same pattern as yesterday across multiple skills) — postprocess fallback covers actual delivery, but worth a `memory/issues/` entry.
- `python3` is fully blocked in this sandbox — node is the only scripting fallback. Existing `.outputs/parse_papers.py` / `.outputs/parse_pp.py` would also fail today; worth porting to node if those skills run unattended.

Sources:
- [PANews — Polymarket vs Kalshi: Perps battle](https://x.com/PANONYGroup/status/2046887620157079674)
- [WSJ — Kalshi & Polymarket at $20B valuations](https://x.com/WSJ/status/2030062898295328916)
- [LLM News April 2026](https://llm-stats.com/ai-news)
- [Top Open Source Projects 2026](https://dev.to/jaysaadana/top-open-source-projects-that-will-dominate-2026-2moa)
