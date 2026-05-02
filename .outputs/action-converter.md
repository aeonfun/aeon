*5 Actions — 2026-05-02*
Shape: Configure Vercel bot-email, post Putin-truce tweet 4a, untrack lore .env, audit pyth feeds, demote ISS-017.

1. Configure `aeonframework` bot's git commit-email in the `tomscaria/swarm-fund-mvp` Vercel project Git settings — current bot email isn't verified, blocking 3 Vercel preview deploys × 4 PRs (#19/#20/#23/#24). Today's github-monitor flagged all four as ACT NOW with identical `setting-your-commit-email-address-in-git` failure URL.
why: one config change unblocks 4 stalled PRs at once incl. #24 approve-ready since 05-01.
done: `gh pr checks 24 --repo tomscaria/swarm-fund-mvp` shows Vercel SUCCESS on at least one check.
loop: vercel-bot-email-block

2. Post draft 4a (Russia-Ukraine "the trade is the language" thesis, ties CalibrationGap 29/76%/+$415/Sharpe 0.31 to May-31 6% binary) to @rswarmai. Source: `articles/2026-05-02.md` + write-tweet output in `memory/logs/2026-05-02.md`.
why: May-9 Putin Victory-Day truce window opens the resolution-debate spike 05-08 to 05-10; today is the freshest the catalyst gets.
done: tweet URL `https://x.com/rswarmai/status/...` captured + appended to `memory/logs/2026-05-02.md`.
loop: tweet-4a-russia-ukraine

3. Untrack `.env` in `tomscaria/lore-financial-teaser` — `git rm --cached .env`, rename to `.env.local`, verify `.gitignore` lines 15-19 cover both. Today's code-health flagged the file is committed in violation of its own gitignore; current values are publishable-anon but the next real secret leaks silently.
why: pre-empt secret exposure on a fresh repo just brought into multi-repo coverage today.
done: PR opened on `tomscaria/lore-financial-teaser` removing `.env` from index.
loop: lore-env-untracked

4. Audit two hardcoded feed-ID TODOs in swarm-fund-mvp: `pipeline/ingestion/pyth_ws.py:36` (XRP/USD) + `pipeline/ingestion/birdeye_rest.py:36-37` (bIB01, dSPY). Cross-check vs Pyth + Birdeye canonical IDs; commit a one-line fix or comment-out per pair.
why: today's code-health calls these "gate CalibrationGap correctness" — wrong feed-ID = wrong price = corrupted Revenant signal.
done: commit pushed to `tomscaria/swarm-fund-mvp` resolving the two TODO lines.
loop: pyth-birdeye-feed-id-audit

5. Demote ISS-017 critical → high in `memory/issues/INDEX.md` + `memory/issues/ISS-017.md` frontmatter. Today's 07:00/07:30/08:00 morning chain dispatched batched at 08:08 UTC (~68 min late) and 14:00 heartbeat fired at 14:39 — pattern is delayed-batch dispatch, not silent skip.
why: keeping it critical mis-signals the operator's external-watchdog priority; today's evidence is degraded-but-functioning scheduler.
done: both files show `severity: high`; INDEX.md timestamp 2026-05-02.
loop: iss-017-demote

sources: memory=92 lines logs=7 dates topics=8 .md files prs=12 open (aeon=6, swarm-fund-mvp=6, lore=0) cron_failing=3 (chain wrappers, same root cause) mode=OK

