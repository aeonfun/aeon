*Push Recap — 2026-05-04*
HARDENING — five-PR robustness wave clears the swarm-fund-mvp research backlog; aeon adds a skill-freshness watchdog (disabled).

Shipped to users:
- swarm-fund-mvp #23 (`aaf745b`): pm-tail-risk runner now uses fractional-day horizon (was integer-truncating via `timedelta.days`); `fair_yes_probability` for 3-7d horizons moves up to ~24% of T, polarity could flip the gap-direction filter — direct P&L impact on the strategy that feeds CalibrationGap-adjacent paths.
- swarm-fund-mvp #24 (`f2e1e28`): `paper_triage` no longer crashes the batch when Opus 4.7 returns `null` for `relevance_score`; `_safe_float()` + extracted decision builder + 142-line test file.
- aaronjmars/aeon #157 (`32c77d7`): new `skill-freshness` skill audits enabled-skill upstream file deps for staleness across `.outputs/` (4h) / daily articles (28h) / weekly (192h) / topics (7d) / state (30d), fingerprint dedup with 7-day re-emit; ships `enabled: false`.

Under the hood:
- swarm-fund-mvp #19/#20 (`36a998c`/`0d0ba40`): ssrn_harvest swaps `con.total_changes` → `cur.rowcount` (silent papers_new inflation since `2625a07` 04-26); harvest markdown image-strip regex `\[\!` → `!\[` (the wrong branch had been firing).
- swarm-lab-site brand-voice + design-token cleanup (`bf21c22`): mid-paragraph `**bold**` → `*italic*` per `soul/STYLE.md`; `--bg-alt` promoted to system token; vestigial `index.css` deleted.

Shape: 6 user-visible · 3 internal · 0 infra · 93 bot-filtered (cron metrics.json refresh) · 6 merged PRs
Volume: ~16 files, +1,149/-213 lines across 9 substantive commits

Full recap: https://github.com/tomscaria/aeon/blob/main/articles/push-recap-2026-05-04.md

