# Push Recap — 2026-05-02

## Verdict
> SHIPPING — 32-article research surface, Discover product, per-strategy dashboard.

**Shape:** 14 user-visible commits · 6 internal · 1 infra · 96 bot-filtered (data: refresh site metrics)
**Volume:** ~227 files changed, +22,525 lines across 21 substantive commits by 2 authors
**Merged PRs:** 4 (swarm #26 docs(vision): no silicon; lore #5 fork URL; lore #4 rename to Lore Financial Teaser; lore #1 Wire Aeon + migration plan)

---

## Top impact today

1. `9d0aab2` — feat(site): research surface + 32 SEO articles (recovers lost stash 552092c). Restores the entire research SEO framework — 32 long-form articles, registry/topic taxonomy, `/research` routes, sitemap/feed/OG generators — that an overnight loop's stash dropped on 04-30. Public-facing. (46 files, +5425/-1)
2. `ff091e6` — chore(site): rewrite 32 research articles in founder voice + compliance scrub. Strips em-dashes (target 0) and banned vocab from every article body and SEO metadata; swaps regulator-name + geofence framing for "fragmentation pays" / "different counterparty mix". (35 files, +2052/-2058)
3. `e2afbda` — feat(backtest): varrd-style guardrails + per-strategy backtest sidecar (ADR-084). Adds Bonferroni correction, fingerprint-based k-tracker, OOS lock state machine, AST lookahead lint, multi-horizon realized P&L replay, and a Karpathy-style factor autoresearch loop. 106 new tests. (12 files, +2896/-0)
4. `55f048b` — docs(changelog): introduce CHANGELOG.md + ADR-084 entry. Adds Keep-A-Changelog rollup separate from DECISIONS.md, but the bigger payload here is `STRATEGY_INVENTORY.md`, the migration of pillar-map data into per-strategy `program.md` frontmatter across ~40 strategies, plus three new TA strategy programs (`ta_bb_squeeze`, `ta_macd_cross`, `ta_rsi_divergence`). (58 files, +2774/-207)
5. `58407ee` — fix(site): commit untracked Discover/ + declare framer-motion + d3-scale. Vercel deploys had been red since the lazy import landed without the underlying folder; stages all 5 Discover/* `.tsx` + 992-line styles.css and adds the missing dependency declarations. (8 files, +1838/-1)
6. `648725d` — ADR-089/090/091: per-regime variant bandit + cull corroboration + posterior history. VariantStats gains regime overlay with three-tier Kelly fallback, `corroborate_with_bandit()` joins t-test + Beta posterior at cull time, and an append-only JSONL snapshot per (variant, day) lands. New Telegram commands: `/bandit_regime`. (8 files, +1272/-52)
7. `fe904be` — feat(dashboard): per-strategy detail page + sortable scoreboard + fleet health (ADR-084). New `/strategy/[name]` page with edge-matrix table, bar chart, multi-horizon realized-P&L picker, lookahead findings, audit log; index page gains 6-KPI fleet-health card and sortable + CSV-exportable scoreboard. (4 files, +1249/-9)
8. `d5f902e` — feat(api): /api/strategies* routes for ADR-084 dashboard surface. Seven routes (`GET /api/strategies`, `GET /api/strategies/{name}`, `GET /api/strategies.csv`, `POST .../backtest|lock|unlock`) with 409 lock-payload responses, 412 sample-size guards, and audit-log writes for every lock transition. (1 file, +1181/-44)
9. `121ba3e` — chore(site): rewrite full marketing surface in founder voice + compliance scrub. 119 em-dashes → 0 across the central 1,630-line COPY object, every page component, every Discover surface; banned-word swaps ("Leverage" → "Effect", "unlocks" → "opens"); regulator-name reframes on landing pillars. (28 files, +234/-235)
10. `c48f773` — feat(backtest): wire backtest_path field, sidecar render, throttled HL backfill. RegisteredStrategy gains a `backtest_path` field so eval tooling and the dashboard can ask "what did this factor tuple produce?" without re-running; HL backfill gets 200ms inter-asset delay + 1s/2s/4s 429 backoff (eliminated 27/47-strategy 429 drop rate from earlier bulk runs). (3 files, +210/-39)

---

## tomscaria/swarm-fund-mvp

### Research surface restoration + voice/compliance pass

**What this is:** The marketing site went from "research framework was lost overnight, deploys are red" to "32 articles live, founder-voice rewritten, compliance-scrubbed, and the public landing references no named regulators." This is a recovery + editorial pass on the public-facing surface that drives SEO and LP discovery, not a build-out of new pages.

**Shipped to users**
- `9d0aab2` — feat(site): research surface + 32 SEO articles (recovers lost stash 552092c)
  - `swarm-lab-site/src/content/research/articles/*.tsx`: 32 long-form articles restored from unreachable commit `552092c`. (+5425 across 46 files, –1)
  - `swarm-lab-site/src/pages/Research.tsx`, `src/lib/seo.ts`, `src/components/SEO.tsx`, `src/components/RelatedArticles.tsx`, `src/styles/research.css`: index/topic/article routes, JSON-LD helpers, `RESEARCH_TOPICS` taxonomy, related-article cards, page styling.
  - `scripts/generate-{sitemap,feed,og}.mjs`: build-time emitters; `vite build` now produces 43 sitemap URLs, 32 feed items, 32 OG SVGs.
  - `swarm-lab-site/src/App.tsx`, `Nav.tsx`, `index.html`, `public/robots.txt`, `package.json`: route wiring (both Privy + no-Privy branches), nav link, RSS auto-discovery `<link>`, build script.
- `ff091e6` — chore(site): rewrite 32 research articles in founder voice + compliance scrub
  - `swarm-lab-site/src/content/research/**`: every article body rewritten — opens as provocations / two-sentence cold opens, closers as aphorisms or reversals, fragment lists / anaphora / "Not X. Y." reversals throughout. (+2052/-2058 across 35 files)
  - Em-dash count in research content: 0. Banned-word strip (`empower`, `robust`, `leverage`, `seamless`, `holistic`, `journey`, `unlock`, generic `ecosystem`).
  - Compliance reframes: "Capital is regulatory-fenced" → "the capital pools don't meet on the same venue"; "cross-venue alpha" → "fragmentation pays" / "settlement layer + information surface fragmentation"; "Polymarket's datacenter IP ban" removed; zero hits on `(CFTC|SEC|FinCEN|MiCA)` regex.
  - `seo.ts` + `Research.tsx`: page-title separator switched from " — " to " · ".
- `700fa4e` — chore(site): tighten closers on three highest-traffic research articles
  - `articles/calibration-gap.tsx`, `agent-lifecycle.tsx`, `revenant-cycle.tsx`: closers rewritten as aphorisms instead of summaries — "The gap is the trade. The discipline is the cage we built around the trade.", "ambition is a system that culls itself faster than I can", "The graveyard is the seed bank. The seed bank is the brand." (+11/-13 across 3 files)
- `121ba3e` — chore(site): rewrite full marketing surface in founder voice + compliance scrub
  - `src/content/copy.tsx` (the central 1,630-line COPY object): 119 em-dashes → 0; voice rewritten across hero/statsBar/pillars/timeline/founder/advisory/footer + investor decks (22 slides + 4 appendices). (+132/-132)
  - `src/pages/{Landing,Investors,InvestorsDeck,InvestorsDeck201,InvestorsOnePager,Pricing,Signals,Dashboard}.tsx` + 17 components: hardcoded prose tightened, em-dashes purged, "Median is robust to outliers" → "Median resists outliers".
  - Public landing compliance scrub: "SEC Atkins: markets onchain in two years" reframed as "Major US regulators publicly endorsing onchain markets within two years" (no named regulator on public surface).
  - `index.html`: title rewritten as "Swarm Lab. Agentic AI in adversarial markets."

### Discover product launch

**What this is:** A new public-facing product surface — drop a Polymarket URL, see the calibration cell it lives in, read the verdict — went from "lazy-imported in App.tsx but folder uncommitted, Vercel red since 18804b4" to "live, building, and wired to typed API helpers". Users can now hit `/discover` (or whatever the route is) and interact with calibration data.

**Shipped to users**
- `58407ee` — fix(site): commit untracked Discover/ + declare framer-motion + d3-scale
  - `src/components/Discover/{AuroraBackground,CalibrationCodex,EdgeFeed,MarketScorer,index}.tsx` + `styles.css`: the 5 components (227 + 87 + 230 + 126 + 19 lines of TSX, 992 lines of CSS) that the lazy import in `App.tsx` was reaching for. (+1838/-1 across 8 files)
  - `package.json`: adds `framer-motion ^12.38.0` + `d3-scale ^4.0.2`; `package-lock.json` regenerated (+154 lines).
- `f2240a7` — fix(site): commit api.ts SurfaceCell/TopEdgeCell exports for Discover
  - `src/lib/api.ts`: 135-line addition adds `SurfaceCell`, `TopEdgeCell`, `fetchSurface`, `fetchTopEdges` typed helpers + XRay/Discover wire types. Without it, `Discover/index.tsx`'s `.then(r => …)` callbacks failed Vercel's `tsc -b` with implicit-any. (+135/-0 across 1 file)

### Backtest guardrails + per-strategy admin (ADR-084)

**What this is:** Every registered strategy now carries a fingerprint, a k-tracker, a Bonferroni-corrected p-value, an OOS lock, an AST lookahead scan, and forward-price realized P&L across four horizons — and the operator can drill into any of them from a per-strategy admin page in the dashboard. Six of varrd.com's eight infrastructure-enforced backtest guardrails are now in place. The first concrete win is visible immediately: mage's edge is +9.95 bps Sharpe 0.307 on SOL but –3.06 bps on ETH, and the dashboard surfaces that.

**Shipped to users**
- `e2afbda` — feat(backtest): varrd-style guardrails + per-strategy backtest sidecar (ADR-084)
  - `python/research/backtest_stats.py`: Bonferroni correction, binomial p-value, signal-density p-value, sha256 factor fingerprinting, k-tracker with same-fingerprint dedup, OOS lock state machine, `should_auto_lock()` decision (sample_size≥30 AND corrected_p<0.05 AND not locked), audit logging. (+261)
  - `python/research/lookahead_lint.py`: AST scan over strategy source for forbidden future-data patterns. (+185)
  - `python/research/realized_pnl.py`: forward-price replay with per-regime + per-asset breakdown across 5/15/60/240-min horizons. (+218)
  - `python/research/factor_autoresearch.py`: Karpathy-style runtime factor mutation — random-walk on numeric Factors, accept only if corrected_p improves AND realized_sharpe improves AND sample_size_min_met AND lookahead_clean. (+330)
  - `python/agents/backtest_attach.py`: `attach_backtest(reg, force, unlock_reason)` writes the `last_backtest.json` sidecar, computes p-values, auto-locks. (+361)
  - `python/tests/test_*.py` (7 files): 106 new tests. (+1541)
- `d5f902e` — feat(api): /api/strategies* routes for ADR-084 dashboard surface
  - `python/api/server.py`: 7 routes added — fleet index, per-strategy detail, CSV export, force-rerun, manual lock, unlock. 409 lock-payload responses, 412 sample-size-min refusals, audit log writes for every lock transition. (+1181/-44, 1 file)
- `fe904be` — feat(dashboard): per-strategy detail page + sortable scoreboard + fleet health
  - `dashboard/app/(shell)/strategy/[name]/page.tsx`: new — header (lifecycle + OOS lock + k + corrected-p), 6-tile metric grid, tabs for edge matrix / per-regime bar chart / realized P&L (horizon picker) / lookahead findings / audit log, action bar with Run / Force / Lock / Unlock. (+812)
  - `dashboard/app/(shell)/strategy/page.tsx`: fleet-health card (auto-locked count, with-realized count, profitable count, mean Sharpe, lookahead leaks) + 49-strategy sortable table with CSV download. (+277/-2)
  - `dashboard/app/lib/api.ts`, `lib/types.ts`: typed client surface for the new routes. (+33/-7, +127)
- `c48f773` — feat(backtest): wire backtest_path field, sidecar render, throttled HL backfill
  - `python/agents/strategy_registry.py`: `RegisteredStrategy.backtest_path: Path | None` field; auto-attaches when `BACKTEST_ON_REGISTER=1`. (+102/-15)
  - `python/research/backtest.py`: `render_edge_matrix(sidecar=…)` appends a "Statistical guardrails" markdown section (fingerprint, k, raw p, corrected p, sample-size gate, lock state). (+50/-1)
  - `python/scanner/hl_candle_backfill.py`: 200ms inter-asset delay + 1s/2s/4s 429 backoff; eliminates the 27/47-strategy 429 drop rate from earlier bulk runs. (+58/-23)
- `55f048b` — docs(changelog): introduce CHANGELOG.md + ADR-084 entry
  - `CHANGELOG.md` (new, +269): Keep-A-Changelog format, points back to ADRs for the why. Backfilled entries for ADR-077, ADR-076, ADR-073, ADR-070, ADRs 045–067.
  - `outputs/research/STRATEGY_INVENTORY.md` (new, +147), `scripts/strategy_inventory.py` (new, +518), `scripts/migrate_pillar_frontmatter.py` (new, +134), `scripts/eval_one_shot.py` (new, +453): pillar-map data migrated into per-strategy `program.md` frontmatter; legacy `STRATEGY_PILLAR_MAP.md` removed.
  - `strategies/{ta_bb_squeeze,ta_macd_cross,ta_rsi_divergence}/program.md` (new, +147 across 3): three new TA strategies registered. (+44/+51/+52)
  - `strategies/*/program.md` (40 files, +7 each): YAML frontmatter migration. (+280)
- `c76064d` — fix(strategies): Signal.fired_at = tick.ts (not datetime.now) — caught by ADR-084 gate
  - `strategies/{mage,alchemist,pathfinder,researcher,shepherd}/*.py`: one-character substitutions per file (`datetime.now(...)` → `tick.ts`). Before: 1350 mage signals fired, 1350 dropped as horizon-overflow. After: 1645/1645 resolved at 60-min horizon, +0.89 bps mean return, 55.8% win rate. (+5/-5 across 5 files)

**Infra**
- `5a1b3c8` — feat(ops): bulk-attach CLI + weekly snapshot routine for ADR-084
  - `scripts/attach_backtests_all.py` (+159): iterates registry, calls `attach_backtest(force=True)` per tick-driven strategy, paces inter-strategy attaches (5 req/sec ceiling).
  - `scripts/weekly_backtest_snapshot.py` (+188): writes self-contained snapshots to `outputs/research/fleet_snapshots/<YYYY-MM-DD>/` — `fleet_index.json` + per-strategy sidecars + `summary.md` (top-15 by realized Sharpe).
  - `infra/launchd/ai.rswarm.weekly-backtest-snapshot.plist` (+71): Sundays 22:00 PT, `RunAtLoad=false`. Operator-enabled with `launchctl load -w`.

### Variant bandit + cull corroboration (ADR-089/090/091)

**What this is:** The variant bandit gains a per-regime overlay (different Kelly multiplier per market regime, falling back to global, falling back to 1.0); the fleet cull joins t-test evidence with Beta posterior evidence so a strategy doesn't get culled on one signal alone; and posterior snapshots are now persisted to an append-only JSONL for backtest comparison week-over-week. New Telegram bot commands surface this for the operator.

**Shipped to users**
- `648725d` — ADR-089/090/091: per-regime variant bandit + cull corroboration + posterior history
  - `python/signal/variant_bandit.py` (+292/-30): `VariantStats.regime_posteriors: dict[str, RegimePosterior]` overlay; `kelly_multiplier(vid, regime=None)` 3-tier fallback; independent per-regime decay; schema v1→v2 forward-compat (load accepts both, save emits v2); `canonical_regime_label()` normalizes HMM labels.
  - `python/stats/fleet_cull.py` (+90/-6): `corroborate_with_bandit()` joins ADR-069 t-test + ADR-072 Beta posterior; `CullReport.corroborated_culls` + `bandit_evidence`.
  - `python/main.py` (+53/-10): `append_history_snapshot()` fires once per UTC day; tail-read for date check (O(1) on file size). Append-only JSONL at `data/variant_bandit_history.jsonl`.
  - `python/alerting/telegram.py` (+219/-5): `/bandit_status` compact per-regime breakdown; new `/bandit_regime` command (spread leaderboard or single-variant deep dive).
  - `scripts/run_fleet_cull.py` (+31/-1): gains `--bandit-state`, `--bandit-wr-max`, `--bandit-strength-min`. Default-on bandit join when state file present; degrades silently when absent.
  - `python/tests/test_variant_bandit.py` (+360, new file), `tests/test_fleet_cull.py` (+121, new file): 50 new tests across 5 new test classes + 8 corroboration tests. 173 pass total.

### Internal: Vision/positioning

- `3da8139` — docs(vision): no silicon — moats are upstream of compute. Names compute-commoditization explicitly alongside the existing data/models commoditization line. Pressure-tested against Naval's "hardware is the durable moat" thesis. (1 file, `docs/long_term_vision/README.md`, +3/-1)
- `0a2604d` — Merge PR #26.

---

## tomscaria/lore-financial-teaser

### Project rename + Aeon wire-in

**What this is:** The repo's in-tree identity migrated from "Lore Pre-Series A" to "Lore Financial Teaser" to match the production domain (lore.financial). Aeon was wired in as a sibling-dir clone so the migration plan can leverage Aeon skills for cross-repo work. The domain itself is unaffected — Vercel tracks by project ID, not repo name.

**Shipped to users**
- `120cb40` — chore: rename project to Lore Financial Teaser (PR #4)
  - `package.json`: name → `lore-financial-teaser`. (+1/-1)
  - `src/components/SlideDeckNav.tsx`, `src/components/FloatingPitchProgressHUD.tsx`: markdown-export titles drop the "Pre-Series A" qualifier. (+2/-2)
  - `README.md`, `MIGRATION.md`, `docs/SLIDE-DECK-CONVERSION.md`: rewritten to use the new name. (+8/-8)
  - `CLAUDE.md`: project identity updated. (+3/-3)
  - Companion changes (out of this commit): GitHub repo rename via `gh repo rename` + local directory rename.

**Under the hood**
- `c5433fa` — Wire Aeon + add Lore Inc migration master plan (PR #1). Adds `.claude/aeon-skills` symlink → `../../aeon/skills`, `CLAUDE.md` (25 lines, documents the Aeon setup + relevant skill catalog), `MIGRATION.md` (97 lines, master cross-repo plan covering lore.xyz / lore.financial / LTP Platform / Revenant / Lore Safe App / prysm.xyz). (3 files, +123/-0)
- `d43722c` — docs(claude-md): point Aeon clone URL at tomscaria/aeon fork (PR #5). The skill catalog (incl. 13 newly-added Firecrawl skills) lives in the fork, not upstream `aaronjmars/aeon`; cloning upstream produces a working but stale catalog. Companion-repos diagram + dangling-symlink remediation command updated. (1 file, +3/-3)
- `15be741`, `679f105` — Merge commits for PRs #4 and #5.

---

## aaronjmars/aeon

No commits or merged PRs in the 24h window.

---

## Developer notes

- **New dependencies (swarm-fund-mvp / `swarm-lab-site/package.json`):** `framer-motion ^12.38.0`, `d3-scale ^4.0.2`; `@types/d3-scale` to devDependencies. Added because Vercel's fresh install was failing — they were resolving from local `node_modules` but undeclared.
- **Breaking changes:** None at the API or schema layer. The `last_backtest.json` sidecar is additive alongside the existing `last_backtest.md`. The bandit state file gains a v2 schema, but `load_state` accepts v1 + v2 (forward-compat); `save_state` emits v2.
- **New public surface:**
  - **Site (swarm-fund-mvp):** `/research`, `/research/:slug`, `/research/topic/:topic` (32 articles); `Discover/*` component surface (`MarketScorer`, `CalibrationCodex`, `EdgeFeed`, `AuroraBackground`); `feed.xml` RSS auto-discovery; sitemap with 43 URLs.
  - **API (swarm-fund-mvp):** `GET /api/strategies`, `GET /api/strategies/{name}`, `GET /api/strategies.csv`, `POST /api/strategies/{name}/{backtest,lock,unlock}`.
  - **Dashboard (swarm-fund-mvp):** `/strategy/[name]` per-strategy detail page; `/strategy` index gains fleet-health card + sortable + CSV-exportable scoreboard.
  - **Telegram (swarm-fund-mvp):** `/bandit_regime` (new), `/bandit_status` (per-regime breakdown added).
  - **Strategies (swarm-fund-mvp):** `ta_bb_squeeze`, `ta_macd_cross`, `ta_rsi_divergence` newly registered (program.md frontmatter only at this stage).
  - **Settings (swarm-fund-mvp):** `BACKTEST_ON_REGISTER=1` env flag (default off; eval scripts and the dashboard endpoint enable it explicitly).
- **Tech debt added:** None new visible in the diffs. ADR-084 explicitly *retires* tech debt by refusing factor mutations that don't improve corrected_p AND realized_sharpe.

## Open threads

- **swarm-fund-mvp open PRs (4 stalled):**
  - #24 `fix(triage): defensive parsing of LLM scores + reasoning` (created 2026-04-30, head `ai/paper-triage-defensive-parse`).
  - #23 `fix(runner): use fractional days for pm-tail-risk fair-prob horizon` (2026-04-29, `ai/pm-tail-risk-fractional-days`).
  - #20 `fix(harvest): correct markdown image-strip regex bracket order` (2026-04-27, `ai/markdown-image-strip-regex`).
  - #19 `fix(ssrn_harvest): use cursor.rowcount, not connection.total_changes` (2026-04-27, `ai/ssrn-harvest-rowcount-bug`).
- **lore-financial-teaser open PRs:** none.
- **Incomplete work visible in diffs:**
  - Two of varrd.com's eight backtest guardrails are not yet implemented (only six of eight landed in `e2afbda`).
  - The `BACKTEST_ON_REGISTER=1` env flag is "default off" in the trading loop because the candle-pull cost on startup is not yet acceptable for the main loop — eval tooling carries the cost instead.

## Sources
- tomscaria/swarm-fund-mvp: ok
- tomscaria/lore-financial-teaser: ok
- aaronjmars/aeon: empty (no commits, no merged PRs in window)
- gh api events: ok
- gh api commits: ok
- gh pr list: ok
- bot-filtered: 96 (`data: refresh site metrics` commits, all touching only `swarm-lab-site/public/metrics.json`)
- diff-truncated: 0

---

## Tail re-run — 2026-05-02 21:40 UTC

Skill re-invoked ~7h after the canonical run above. Window 2026-05-01T21:40Z → 2026-05-02T21:40Z.

**Shape (this window):** 3 user-visible · 1 internal · 0 infra · 95 bot-filtered · 1 merged PR
**Substantive deltas vs. canonical run:** none — the three user-visible commits in this narrower window (`58407ee`, `f2240a7`, `121ba3e`) are already in the canonical Top-impact list above. The merged PR (lore #5) is already listed in the header. Everything new since 14:39 UTC is `data: refresh site metrics` (95 commits, each touching only `swarm-lab-site/public/metrics.json`).

**Verdict:** SHIPPING — same site-shipping verdict as the canonical run, no new substantive shape.

**Notification:** suppressed. Re-sending the same Top-3 within 7h would degrade the channel's high-signal contract. Logged as `PUSH_RECAP_REPEAT_SAMEDAY`. Spec's significance gate (zero user-visible / ≤3 internal / zero PRs) does not literally trigger silence here, but its stated intent ("the gate exists so the channel stays high-signal") does.

**Sources (this window):**
- tomscaria/swarm-fund-mvp: ok (98 commits — 3 substantive + 95 metric-refresh)
- tomscaria/lore-financial-teaser: ok (2 commits + 1 merged PR)
- aaronjmars/aeon: empty
- gh api commits / gh pr list: ok
- bot-filtered (this window): 95
- diff-truncated: 0
