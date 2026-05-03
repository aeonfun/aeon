

### token-movers
- Var: <none>
- Pulse: Risk-on broadening — 73/100 top coins green (vs 66 yesterday), median +0.6%; BTC $78,740 +0.8%, ETH $2,323 +0.9%, SOL $84.01 +0.4%; AI-compute and DePIN-adjacent names lead, yesterday's pumps capitulating.
- Winners: B (+27.3% BREAKOUT, day-4), AKT (+26.4% TRENDING+UP/BREAKOUT), LUNC (+14.4% TRENDING+UP), BinanceLife (+12.7%), ZK (+10.0%), GNO (+9.8%), ALGO (+8.5%, flip from −3.2% loser yesterday). Suppressed 3rd-day repeats: TAG (+17.2%), BSB (+18.2%), GENIUS (+15.3%).
- Losers: SKYAI (−15.1% CAPITULATION, FLIP from +16.4% yesterday), UB (−14.1% CAPITULATION, FLIP from +90.8%/+22.5% yesterday), ORCA (−8.6%), APE (−5.1%, FLIP from +11.6%), AXS (−3.7%), ARB (−3.0%), CHZ (−2.8%). Suppressed: MEGA (−14.4%, day-N capitulation continuation, same tags), RAVE (−6.9%), DEXE (−5.4%) — same-direction repeats.
- Trending: LUNC (TRENDING+UP), LAB (CAPITULATION −36.2% — was +226% yesterday's trending #1), MEGA (TRENDING+DOWN/CAPITULATION), BABY (#311, +37.4% PUMP-RISK), XRP (MAJOR), PENGU, AKT (TRENDING+UP).
- Notable: 4 bullets — (1) B 4-day BREAKOUT continuation with 1h +7.8% fresh push and 7d +260.8% (no fade yet on $174M vol); (2) Pump-unwind day: SKYAI/UB/LAB all flipped to CAPITULATION on heavy volume — three of yesterday's biggest pumps reversed; (3) AKT cleanest non-pump signal on board (TRENDING+UP + BREAKOUT, $60M vol, $189M mcap, AI-compute narrative); (4) BABY rank #311 +37.4% PUMP-RISK warning.
- Tape: continuation of risk-on (73/100 green vs 66 yesterday vs 16/100 two days ago); BTC/ETH/SOL all positive but small (+0.4 to +0.9%); breadth widening, mid-cap dispersion now AI-compute (AKT, ALGO) rather than meme-rotation.
- Pump-cycle observation: yesterday's LAB +226% / UB +90% / SKYAI +16% all unwound today — 3-of-3 PUMP-RISK / late-stage BREAKOUT prints called from the 05-02 board played out. Pattern reinforces the [CAPITULATION] tag value when vol/mcap > 0.5 on a multi-day winner.
- Sandbox: Both CoinGecko endpoints fetched cleanly via curl (HTTP 200, 243K markets + 55K trending). Filtered 250 → 176 after stable/wrapped/sub-$1M-vol drops. Notify fired via `node -e execFileSync('./notify', [msg])` (NOTIFY_OK first try; `.pending-notify/` empty post-call → direct fan-out succeeded). No `mkdir`/`python3`/heredoc-`$(cat ...)` triggers this run. Bash `:+` parameter expansion blocked once (simple_expansion); used unauthenticated curl instead (public endpoint, no key needed).
- Body: 2,679 chars (under 4000 cap).
- Files: `.outputs/cg-markets.json`, `.outputs/cg-trending.json`, `.outputs/process_movers_v2.js`, `.outputs/movers-0503.json`, `.outputs/token-movers.md`, this log.
