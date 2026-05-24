# Swarm Fund MVP — Memory Router

## Rules
- [No compliance leak in public materials](feedback_no_compliance_in_public.md) — regulator names / ToS / geoblock / "entity restructure" workarounds are 201-deep-dive-only (LP-distributed). Scrub from landing, /investors web, 1-pager, 101 deck.
- [No ASK content on public /investors](project_investor_access_split.md) — public is vision-only; multiples, raise sizes, VC target lists, scenarios live ONLY on gated /investors/101+201+onepager. Stage 1 live (commit `b686093`); Stage 2 PR #21 opened 2026-04-28 by routine `trig_01USVATWYoxg5JYry6UhJLcD` and CLOSED without merging — JSON allowlist + mailto shim remains operational.
- [zsh read-only var names](feedback_zsh_readonly_vars.md) — never assign to `status`, `pipestatus`, `RANDOM`, `SECONDS`, etc. in Monitor/Bash loops. Use `code`/`http_code` instead.
- [Interactive shell aliases on this Mac](feedback_interactive_shell_aliases.md) — `mv -i`, `cp -v`, `mkdir -v` leak into Bash calls; scripted overwrites can hang on the y/n prompt. Use `\mv -f` or pipe `yes`.
- [Hardware revisit at $5M AUM](project_hardware_revisit_5m_aum.md) — when AUM crosses $5M, re-run §2 of `~/.claude/plans/how-does-this-change-precious-twilight.md` (build-vs-rent + peer silicon scan + inference $/Mtok curve). Below threshold answer is fixed: rent, no silicon.
- [Don't agree to close session without PR merged or feature abandoned](workflow_session_closure_rule.md) — on "close session", run `git status` / unpushed commits / open PRs check first, ASK before agreeing. Only auto-agree if PR merged, feature explicitly abandoned, or session produced no shippable work.
- [api.rswarm.ai is hosted on the laptop via Cloudflare tunnel](project_api_rswarm_host_decision.md) — 2026-05-16 update: founder committed to laptop-as-server in NYC, `com.cloudflare.cloudflared` LaunchAgent active (tunnel `cc4a2dc4-...-a48379a5a540`, name `swarm-api`). Off-laptop migration deferred.
- [Founder is exploring local model hosting](project_local_model_exploration.md) — 2026-05-01: workloads TBD. Affects ADR-058 cost calculus and credit-hunt ROI; ask before assuming all-API on LLM-cost-sensitive proposals.
- [Drive autonomous sessions from CODEX_HANDOFF.md](feedback_codex_handoff_queue.md) — founder-confirmed 2026-05-22: when "just build" with no target, work the handoff's P0→P2 queue; verify freshness vs git.
- [Repo is the nested swarm-fund-mvp/swarm-fund-mvp/ dir](reference_repo_nested_path.md) — sessions launch in a wrapper folder; `cd` into the nested subdir (has `.git`, `CLAUDE.md`, `python/`) before any git/pytest/project command.
- [Venv may be missing `[dev]` extras (pytest-asyncio)](feedback_venv_dev_extras.md) — uv-managed .venv lacks `pip`; async tests silently fail with "unknown asyncio_mode" if pytest-asyncio is absent. Install via `uv pip install --python .venv/bin/python pytest-asyncio`.

## Session 2026-05-22 — autonomous overnight: CODEX_HANDOFF P1 queue
- Shipped handoff P1 #3+#4 — `/api/portfolio` now returns `live_realized_pnl` (HL userFills, $68.08) + `live_asset_exposures`; Command Center shows LIVE realized P&L, FundHUD asset rail follows the LIVE/PAPER toggle. Commits `1a9a37bc`/`88726cef`/`ea24832d`, browser-verified. Restarted `ai.rswarm.api` to deploy. Full backend regression 2357 pass / 2 pre-existing unrelated reds (`test_regime` crisis-scalar 0.04≠0.025, `test_aeon_adapter` recovery).
- Handoff P1 #5 canary investigation (`outputs/2026-05-22_stuck_canary_investigation.md`): runner-swarm canary agents place no real trades because the live trading loop (PID 1073, up since 2026-05-20) predates the real-execution fix `28cc525d` and was never restarted. **Codex review then found `28cc525d`'s runner-swarm path has a P0 (`--paper` does NOT gate it) + 3 P1 bugs — do NOT restart the loop until remediated** (`outputs/2026-05-22_runner_swarm_remediation.md`).
- Handoff #6 fs-adoption found STRANDED — see [[feat/fs-adoption branch held]] + `outputs/2026-05-22_fs_adoption_branch_stranded.md`.
- Codex reviewed the session: one P0 + four total bugs in `28cc525d`'s runner-swarm execution. **All fixed under TDD:** P2 dashboard leak (`84875117`), P0 opt-in flag (`598ae1c5` — `--enable-runner-canary-live`, default OFF), PM SHORT side (`e8fafdc8`), HL close-by-coin (`52629092`), RiskGate routing (`ec104f43`). Loop is now safe to restart in default/paper mode; live runner-swarm canary needs `--enable-runner-canary-live`. Reduce-only on HL close is a known follow-up. Memo: `outputs/2026-05-22_runner_swarm_remediation.md`.
- Wave 4 (post-fix autonomous, 2026-05-24): daemon staleness watchdog shipped (`scripts/staleness_watchdog.py` + new LaunchAgent `ai.rswarm.staleness-watchdog`, 15-min cadence, Telegram alert when running code is >30min behind origin/main on watched paths, notify-only). Closes the visibility gap that hid the 25h-stale loop earlier in the session. HL close now reduce_only via SDK `market_close` (`58766d50` — closes the Codex P1 follow-up). Both pre-existing test reds fixed: `test_regime` 3→5 state assertion (`63b59037`), `test_aeon_adapter` needed `uv pip install pytest-asyncio` (venv, no repo change — see [[venv-dev-extras-missing]]). Full regression now 2391/2391 green. Runbook: `docs/runbooks/staleness-watchdog.md`.

## Session 2026-05-17 — NYC handoff to Codex (segmentation re-shipped + handoff doc)
- [CODEX_HANDOFF.md committed](../../swarm-fund-mvp/CODEX_HANDOFF.md) — `5d8aca22` on origin/main. Self-contained P0-P2 priority queue for the next agent: verify health on connect, re-flip `--paper` if it returns (launchd env trap pattern), HL userFills aggregation for LIVE Realized P&L, live asset rail, stuck canary agents (8 of 17 have zero real trades), founder UI work (PR merges, Vercel cleanup, dashboard prod). What NOT to touch: `--paper` without confirmation, becker parquets (gitignored after 34 GB+382 MB push blockage), force-push to main (classifier hard-blocks), public surfaces without compliance scrub.
- [LIVE/PAPER segmentation shipped](../../swarm-fund-mvp/dashboard/app/components/FundHUD.tsx) — `f1acf207`. `/api/portfolio` returns parallel `live_*` ($115.83 HL wallet) + `paper_*` ($111,839,619 sim aggregate across all 180 agents) + legacy aggregate. Dashboard FundHUD has LIVE | PAPER toggle pill, conditional MetricCards, default `live`. Backend: `_aggregate_agent_trades()` helper extracted, runs twice (live agents vs all agents); HL `get_balance()` + `get_open_positions()` for live path.
- **Push backlog resolved** — founder ran `git filter-repo` to strip `data/becker_trades_*.parquet` (382 MB) from commit `8191d124`, force-pushed. Origin/main fully synced (HEAD = origin/main).
- **Real-trade reckoning:** 17 canary · 0 apex/live · **29 real trades** (is_paper=false + hl_order_id) · only 8 of 17 ever fired · net **+$15.45 realized** · `calibration-gap-v1` carries 16/29 trades + $109.56.
- **Transient incident:** metrics watcher's `pull --rebase --autostash` reverted in-progress segmentation files when origin was force-pushed mid-session. Work was re-applied + re-committed once origin stabilized. Lesson: commit-as-you-go during founder history-rewrite windows.

## Session 2026-05-16 — NYC departure close-out (paper band-aid lifted, prod deploy, tunnel live)
- [Paper flag removed, loop live on $148.93](project_paper_band_aid_lifted_2026-05-16.md) — `--paper` removed from `ai.rswarm.trading-loop.plist:27` after 17-day-stale band-aid. Unified wallet **$148.93** (spot $115.95 + perp $32.98), NOT the $64.83 in older memory. Bandit posteriors warm at boot (148 tracked). Boot log: `NAV: $148.94 (live HL unified equity = perp + spot USDC)`. New LaunchAgents: `com.cloudflare.cloudflared` (api.rswarm.ai tunnel), `ai.rswarm.caffeinate` (sleep prevention), `ai.rswarm.log-rotate` (daily 04:00 if >100MB). swarm-lab-site prod deploy `dpl_3RrsFoYpAG7bPcqW` aliased to rswarm.ai. Local commit `8327bf7f` (108 files, +22 927/−1 631) AWAITING `git push origin main` — classifier blocked the automated push. Departure summary: `outputs/2026-05-16_nyc_departure.md`. `total_usdc()` returns `dict[spot,perp,total]` not scalar (older memory wrong). `/api/balance` reports spot-only — needs `total_usdc()['total']` patch.

## Session 2026-05-12 — fs-adoption branch held (23 commits, ADR# pending renumber)
- [feat/fs-adoption branch held](project_fs_adoption_branch_held.md) — 27 `feat(fs_adoption)` commits at `/Users/stew/scaria/swarm-fund-mvp-fs-adoption` (A1 NAV recon + A4 lint + B schemas/handoff + A3 position audit + C MCP/news; 61/61 tests pass as of 2026-05-12). **STRANDED — verified 2026-05-22:** the 2026-05-16 `git filter-repo` rewrite orphaned the branch (merge-base now 2026-03-20; 2069 ahead / 3051 behind); `git merge` corrupts `main`. Recovery = founder-supervised rebase of the 27 commits onto `origin/main` — see `outputs/2026-05-22_fs_adoption_branch_stranded.md`.

## Session 2026-05-09 — ADR-097 CalibrationGap Sharpe fix (gate active, stop dormant)
- [Session 2026-05-09 — ADR-097](session_2026-05-09_adr097_cg_sharpe_fix.md) — commit `d5bfeec9` on origin/main. **Phase 1 sweep finding: CG Sharpe ceiling is structurally 0.85 (oracle stop), NOT 1.5+** — binary payoff caps it; plan target Sharpe ≥ 1.0 unreachable without Approach 3 (HL execution leg). Apex (≥0.5) is reachable. Shipped: HL backfill (23,622 candles 6 assets × 42d at 15m via `/info` candleSnapshot — 1m/5m unavailable that far back), PM CLOB backfill (412 rows × 34 markets via `/prices-history?fidelity=900`), `python/research/calibration_gap_sweep.py`, concordance gate active at 6h/±100bps (`CG_CONCORDANCE_DISABLE` toggle), stop-loss code dormant (`CG_STOP_LOSS_PCT` enables). 35 new tests + 1330 pre-existing pass.

## Session 2026-05-01 — Local-first inference + cross-disciplinary KB substrate (ADR-092)
- [Session 2026-05-01 — local-first + cross-disciplinary KB](session_2026-05-01_local_first_inference.md) — ADR-092. Shipped 5 phases additive to existing infra: OpenRouter as 6th provider + circuit-breaker failover wrapper around `complete()` (auto-retry on 429/credits-exhausted; never on BudgetExceeded); Ollama as 7th provider + `OLLAMA_LOCAL=1` env-flag swaps high-volume tiers (paper_triage flash/deepseek + factor_extractor default + structural_break) to local llama3.2:3b / qwen2.5:7b-instruct, sonnet/opus stay cloud; HF sentence-transformers embeddings (BAAI/bge-small-en-v1.5, 384-dim) over kb_concepts with brute-force cosine retrieval — RAG, not fine-tuning; `Corpus` Protocol + `Domain` enum + 50-entry alias map + stub `harvest_mit_ocw.py` (storage tested, HTTP scrape NotImplementedError pending Firecrawl/selectolax); `analog_of` edge type + analogy synthesis pipeline (Sonnet 4.6 judge, persists to kb_concept_links with `analogy_strength` + `analogy_rationale`). Phases D+E (Ollama Cloud for dashboard explain, Jan as IC chat) deferred with trigger conditions; one-time remote-agent re-eval scheduled at 2026-08-01T10:00Z (`trig_01SmGHv92dTWe5qeUxrnCnKj`). Cost shape at 25k corpus: ~$300-500/mo cloud-only → ~$70/mo local-first. **121 tests pass.** Plan: `~/.claude/plans/reserach-how-we-can-streamed-mccarthy.md`.

## Session 2026-04-30 → 2026-05-01 — runner-swarm v2: snapshot + tick dispatch + history producers (ADR-085)
- [Runner-swarm v2 commits](../../swarm-fund-mvp/python/agents/runner_swarm.py) — `48eba1a` + `55875b6` + `7b8057e`. Three concurrent fixes: (1) `--paper` guards in-loop NAV refresh — unzombies a 3-day stuck loop where transient HL $14.49 response had been overwriting paper $10k NAV → sticky DRAWDOWN HARD STOP since 2026-04-27 23:10 (1,040 wasted iterations, only resolve_trades running). (2) `python/scanner/pm_history.py` + `python/scanner/hl_spot_history.py` — append-only per-market and per-asset history producers writing JSONL each iteration; replaces the naive `rolling_mean = 0.5` prior in pm-prob-reversion that had accumulated $-10,861 paper loss across 359 closed trades. Prob-reversion now returns None on cold-cache (n<6) markets. (3) RunnerSwarmAgent.dispatch_kind ∈ {per_market, snapshot_one, snapshot_list, tick} — wraps 8 PM-direct + 2 PM-snapshot + 3 PM-via-history + 9 Hermes-tick + 9 HL-tick strategies. **Final: 6 → 29 strategies / 20 → 74 paper-trading agents.** Shared HL candle backfill warmup so tick variants fire from iteration 1. 50 related tests pass + 3 skips. All HL trades resolve at +24h via existing resolve_hl_paper_trades.
- **Live evidence at 19:23 PT:** Runner swarm 74 variants scanned + Runner tick swarm 39 variants scanned firing every iteration; 6 new HL paper trades in last 2 tick scans (hl-regime-safe-haven, downside-persistence-hedge on BTC). Founder-ask "agents should be placing trades while i sleep" satisfied — paper-trade ledgers accumulating across all 29 wrapped strategies.

## Session 2026-04-28 → 2026-04-30 — varrd-style backtest standards per agent (ADR-084)
- [ADR-084 varrd guardrails](../../swarm-fund-mvp/DECISIONS.md) — built reverse-engineering varrd.com. Six of varrd's 8 infrastructure-enforced guardrails now apply to every `RegisteredStrategy` backtest: K-tracking, Bonferroni correction, OOS lock (auto-fires when `n≥30 AND corrected_p<0.05`), fingerprint dedup, no-post-OOS-optimization, and lookahead-bias linter (AST scan over each strategy's source). Sample-size minimum: 30 signals. Null fire-rate baseline: 0.001. New on-disk per-strategy state: `last_backtest.json` (sidecar), `k_track.json`, `oos_lock.json`. Audit lines under `process="strategy:<name>"` in `data/process_audit.jsonl`.
- **Realized-P&L ships** — `python/research/realized_pnl.py` adds forward-price replay against the same tick stream, computes per-regime mean return / win rate / Sharpe at 60-min horizon. First real number: ta-rsi-divergence 45 trades, 57.8% win, +12.93 bps mean, Sharpe 0.220 in RANGE regime — auto-locked at corrected_p=0.0003.
- **Per-strategy admin page** — `dashboard/app/(shell)/strategy/[name]/page.tsx` mirrors `/agents/[id]` shape with header badges (lifecycle / OOS-LOCKED / k=N · α<X / N=signals / lookahead ✓), 6-tile metric grid, 5 tabs (Edge matrix / Bar chart / Realized P&L / Lookahead / Audit), action bar with modal-dialog confirmations + audit-logged unlock_reason. Existing `/strategy` scoreboard gets a "Registry strategies — N" card with per-row Backtest column linking to detail.
- **API surface** — `/api/strategies` index now surfaces 8 sidecar fields. New `GET /api/strategies/{name}`, `POST .../backtest`, `POST .../lock`, `POST .../unlock`. 14 API tests, 11 lint tests, 8 realized-PnL tests, 7 sidecar/lock tests, 25 stats tests, 2 smoke regressions — all 75 pass.
- **Bulk-attach CLI** — `scripts/attach_backtests_all.py [--only NAMES] [--unlock REASON] [--dry-run]`. Auto-locks fire automatically; `--unlock` is the only way to re-run a locked strategy.
- **Plan file**: `~/.claude/plans/steal-all-backtest-logic-twinkly-sparrow.md`. Source for varrd guardrail list: [augiemazza/varrd README](https://github.com/augiemazza/varrd).

## Session 2026-04-28 → 2026-04-29 — unified-NAV pivot (ADR-083) + pre-existing transfer scaffold reverted
- [Unified-NAV morning brief](../../swarm-fund-mvp/outputs/2026-04-29_unified_nav_morning_brief.md) — commit `156fa26`, ADR-083. **Root cause of 2026-04-27 phantom-NAV incident: HL wallet is in unified-account mode**, perp.accountValue is the perp slice only ($0 when no positions open), spot USDC is the actual collateral. `HyperliquidAdapter.get_balance()` patched to return `perp.accountValue + spot.USDC` via new `python/execution/hl_balance_manager.py` module. All 10 callers (peak_nav, drawdown, Kelly, /risk, /drawdown, /api/balance, dashboard) auto-pick up unified value. Earlier proposed `usdClassTransfer` CLI/auto-rebalance was rejected — `Action disabled when unified account is active` (verified live $1 dry-run 2026-04-28). 13 tests + ADR-083 (200 lines). Live verification: adapter returns $64.83 unified vs $5.78 perp-only.
- [Canary trade size = $50 × bandit multiplier](../../swarm-fund-mvp/outputs/2026-04-29_unified_nav_morning_brief.md) — investigation finding: $50 canary `max_position_usd` floor binds before Kelly NAV cap, then bandit (ADR-072) multiplies 0.5–1.5×. At calibration-gap-v1's WR=0.73, ~1.45× multiplier yields trades of ~$72.35 (verified against 2026-04-28T06:08:14 BTC + HYPE fills). The "max $50/trade" framing in `python/agents/base.py:30` and CLAUDE.md is no longer accurate post-bandit; effective max ~$75 at high posterior WR.
- **Pending operator action:** revert `--paper` band-aid in `~/Library/LaunchAgents/ai.rswarm.trading-loop.plist:20` (one-line `sed` + `launchctl unload` + `load -w`). Loop boots in live mode with NAV=$65 unified. peak_nav file auto-rebases via `is_peak_stale_suspect` heuristic on first read (paper $10k vs unified $65 = 154x stale → reset).

## Session 2026-04-26 — variant bandit + capital wire-up + reversal toggle
- [Bandit session log](session_2026-04-26_variant_bandit.md) — commit `8b68152`, tag `session/2026-04-26-variant-bandit`. ADR-071 (math + observation) + ADR-072 (capital effect: Kelly multiplier 0.5–1.5× + auto-hold below 0.40 WR) + ADR-074 (SWARM_BANDIT_DISABLE env var + /bandit_status Telegram command + reversal procedure). 542 tests passing (+112). **Live in prod since 2026-04-27 02:06**, 148 posteriors tracked, calibration-gap-v1 leading at WR 0.730. Reversal procedure: [bandit_reversal_procedure.md](bandit_reversal_procedure.md).

## Session 2026-04-27 — Credit-hunt playbook + PM USA late-2025 launch finding
- [Credit-hunt sequencing](project_credit_hunt_playbook.md) — open fresh accounts on `t@rswarm.ai` BEFORE applying to AWS Activate / Anthropic / OpenAI / MS Founders Hub / Cloudflare; Lore-era accounts likely burned the one-shot grants. Self-apply ceiling without VC/entity ≈ $10K–$16K + $5K Cloudflare. AWS Activate is strictest (cross-checks billing history). Plan at `~/.claude/plans/is-there-some-way-polymorphic-newell.md`.
- [PM USA waitlist — manual track, Ireland path primary](polymarket_us_waitlist_2026-04-28.md) — **VERIFIED 2026-04-28.** PM US live invite-only since 2025-11-12 via QCX LLC d/b/a Polymarket US (CFTC DCM). Founder joined polymarket.com/usa waitlist 2026-04-28 ("see you soon," no ETA; Q3/Q4 2026 industry est). KYC=ID+SSN+residency+selfie, FCM-routed deposits. **Ireland VPS path remains primary** for international CLOB; `polymarket_compliance_gate.md` + `polymarket_datacenter_ban.md` stay authoritative for that scope.

## Session 2026-04-27 — Canary HL-leg only; dashboard PnL is simulated PM payouts
- [Canary real vs paper PnL](canary_real_vs_paper_pnl.md) — HL `userFills` API: 4 fills ever, ~+$0.41 real PnL on $5 wallet. 2/32 trades real (`is_paper:false`+`hl_order_id`), 30 paper. PM leg always paper (US geoblock + L2 HMAC TBD). Don't quote $343/$23 dashboard numbers as collected income. Patched `python/api/server.py:510` env-trap for `wallet_address` while here.

## Session 2026-04-27 — KB orphan-fill: 297→0 (foundations layer shipped)
- [KB orphan-fill summary](../../swarm-fund-mvp/outputs/2026-04-27_kb_orphan_fill_summary.md) — ADR-077. **232 new research-backed educational stubs** at kelly-criterion quality (~600-1100 words, KaTeX, mermaid, prereqs, 2-3 sources each), bringing hand-authored MD count 9→243 and DB orphans 297→0. New code: `kb/slug_aliases.yml` (50 canonicals ← 78 variants), `scripts/generate_kb_stubs.py` (Gemini-flash + normalize + validate), `scripts/ingest_hand_stubs.py` (disk → kb_concepts INSERT/UPDATE + edges). Patched `curriculum_builder._topo_sort` for alias-aware orphan detection. $2.32 total LLM (kb-stub-generator agent_id). All stubs `generated: false` so future LLM re-extraction can't clobber. Inspired by Algebrica + Golden — MD-first, then HTML (Astro+KaTeX+Cytoscape), then graph-app.

## Session 2026-04-27 — KB Phase 1+3 overnight loop COMPLETE
- [KB overnight run summary](../../swarm-fund-mvp/outputs/2026-04-27_kb_overnight_summary.md) — **3,204 concepts, 4,375 quotes, 3,203 MD files written under kb/topics/**. 340 concepts tagged with Revenant pillars (P1=161, P3=99, P2=80). $4.29 LLM spend (Gemini-2.5-flash, kb-extractor agent_id, 9% of $50/mo cap). Mid-run DNS blip caused 2,705 papers to error → ~494 of 3,123 LLM-attempted contributed concepts; re-run to retry. JSON parser had to be hardened for Gemini fence variants. Hand-authored stubs preserved (curriculum_builder skips `generated: false`). Loop stopped — one-time routine done.

## Session 2026-04-27 — Runner-swarm wraps harvested PM strategies (paper trades flowing while founder sleeps)
- [Runner-swarm pattern](runner_swarm_pattern.md) — ADR-076 + commit `d312711`. `python/agents/runner_swarm.py` wraps 6 PM-family strategies × 3–5 factor variants = 20 paper-trading TradingAgents. PM-direct (LONG=buy_yes, real PM market_id) and HL-via-PM (LONG=long perp, synthetic `HL-<asset>-<ts>`, +24h horizon resolver) venues. 7 iterations between 02:07–02:16 PT shipped 57 new paper trades. 9 unit tests pass. New ranking tool at `scripts/runner_swarm_signal_sweep.py`. Live workhorse: pm-prob-reversion (98% live fire rate). Dormant pending v2 candidate proxies: pm-resolution-snap, pm-behavioral-drift, pm-conviction-breakout (the last won't fire in RANGE regime by design).

## Session 2026-04-27 — Waves 14-20 + literature→strategies playbook (post-compact resume)
- [Resume sleep summary](../../swarm-fund-mvp/outputs/2026-04-27_overnight_resume_summary.md) — 14 commits this resume (`aee2187..3f9a1af`). 7 strategies shipped: hl-regime-safe-haven (W14), hl-cross-asset-lead-lag (W15, **0.78 top of fresh INDEX**), hermes-herd (W16, P1), hl-vwap-reversion (W17), hermes-correlation-break (W18), downside-persistence-hedge (W19), pm-complete-set-drain (W20, **P2 boost 1→2**). 50 new tests, all green. Registry **45 strategies** / pillar map **49**.
- [Literature→strategies playbook](../../swarm-fund-mvp/docs/03_knowledge_base/literature_to_strategies_playbook.md) — `9865acb`. 9-phase re-runnable pipeline (harvest→triage→extract→deep-dive→ideate→pillar-tag→build→feed→review). ~$50-60/run. Codifies multi-writer SQLite rule + tier-router KeyError trap (hit 3× this session — paper_triage v6, tiered_extractor v4, fixed in `d85bccb` + `3f9a1af`).
- [pm-complete-set-drain real-data feeder](../../swarm-fund-mvp/python/research/runners/pm_complete_set_runner.py) — `4d70c26`+`6022418`. Pulls PM Gamma + CLOB /book → builds PMCompleteSetCandidate → dispatches. Live smoke fired 0 signals (markets within 250bps of $1, baseline). Cooldown bug caught in /review (per-loop strategy reset → fixed via persistent-strategy threading).
- [Wave 14 + retry shim](session_2026-04-27_wave14_safe_haven_lock_retry.md) — paper_triage retries on SQLite "database is locked" with exp backoff (5,10,20,40,60s ×8). **Multi-writer rule:** kill extractor before restarting triage on a busy DB.

## Session 2026-04-27 — KB harvester Phase 0+2 ship + Phase 1 gated
- [KB Phase 1 gated on factor pipeline](project_kb_harvester_phase1_gated.md) — Phase 0 + Phase 2 shipped same session. Phase 0: 4 kb_* tables, `python/research/knowledge/` package, 9 hand-authored stubs in `kb/topics/`, Phase 4 design memo, ADR-075. Phase 2: 6 harvesters built + run = **299 rows in kb_sources** (92 Quantopian notebooks, 100 JS blog posts, 93 RSS posts from 6 working feeds, 11 book metadata entries, 3 HRT entries, Twitter wrapper awaiting founder scrape). Orchestrator at `scripts/run_kb_harvest.py`. **Phase 1 still deferred** until paper_triage / factor_extractor / deep_dive finish — same DB.
- [CryptoHouse public ClickHouse endpoint](cryptohouse_endpoint.md) — Phase 0 verified: dedicated `polymarket` DB has `orders_filled`/`user_positions`/`assets` schema, but data ends 2026-01-05 (~3.7mo stale); HL not indexed; raw `base`/`ethereum` real-time. **Verdict: defer.** Re-probe staleness 2026-05-15 (entry in TASKS.md "Research backlog"). Memo: `outputs/research/cryptohouse_phase0_verification.md`.

## Session 2026-04-26 → 2026-04-27 — overnight strategy creation + paper aggregation (founder asleep)
- [Overnight strategy session](session_2026-04-26_overnight_strategy_creation.md) — 11 commits (`33eab00..8d8d425`), +3,904 lines, 57 new tests. 4 Hermes strategies unstubbed (cascade, funding, oracle-lite, **NEW overnight**). Mage scan pipeline finally wired (was registered with `_stub_scan` despite on_tick being complete). 3,347 arXiv papers ingested → 242 factors / 14 families. 24 strategy candidates ranked at `outputs/ideation/2026-04-26_INDEX.md` (top: hl-liquidity-shock 0.88). Paper pipeline at `python/research/papers/`. Backtest harness at `python/research/backtest.py`. **Did NOT touch** main.py, conviction.py, regime_ensemble.py (parallel session). Anthropic API credits exhausted mid-run (manual_tasks_thomas.md). Factor extractor still running (~5h ETA on remaining 1300 papers).

## Session 2026-04-26 — ADR-073 Hermes venue-data adapter pattern (overnight)
- [ADR-073 session log](session_2026-04-26_adr073_hermes_adapter.md) — 5 commits (`c060d73` schema fix, `f0c7c80` DataAdapter+TickBroker, `a0bb343` HL liquidation adapter, `b1c9d21` replay+synthetic, `fed9786` design memo). 66 new tests passing. **Phase 5b cascade-Signal unstub now SHIPPED in `649b843`** (next-day strategy session). Phase 5a main.py wiring still deferred (parallel session in flight on main.py).

## Session 2026-04-25 → 2026-04-26 — overnight frontend polish (founder asleep)
- [Overnight frontend session](../../swarm-fund-mvp/outputs/2026-04-25_overnight_frontend_session.md) — 8 commits across mini-app, dashboard, landing, investor deck. Halt-trading wired to `/api/loop/pause`. New Python `/api/portfolio/history` endpoint (forward-fill aggregator). Dashboard sparklines restored. Dashboard sidebar now links to Investors + rswarm.ai (open in new tab). Mini-app footer rewired to 3 distinct destinations. Investor 1-pager teaser shipped (HTML + PDF + PNG). Dashboard build verified clean (24 routes prerender). Site build verified clean.
- [Frontend design skill location](frontend_design_skill.md) — `compound-engineering-plugin` cloned at `/Users/stew/scaria/compound-engineering-plugin/`; `ce-frontend-design` SKILL.md installed at `~/.claude/skills/frontend-design/`. Token sources of truth per surface + dashboard Button uses `render` prop NOT `asChild`.
- **Restart required:** the running uvicorn at port 8000 was started before this session and serves 404 on `/api/portfolio/history`. Restart the API server to surface the route. Trading loop does NOT need restart.

## Session 2026-04-25 — phantom-peak hard-stop incident + structural fix
- [launchd env-var loader trap](feedback_launchd_env_trap.md) — under launchd, `os.environ.get("KEY")` ≠ `adapter._load_env_key()`; detection chain MUST mirror the helper or you get silent paper-mode fall-through. Caused 2026-04-25 18:50:24 phantom-$10k peak (commit e2b1660 patched). Repro launchd env locally: `env -i PATH=$PATH HOME=$HOME .venv/bin/python ...`.
- **Phantom-peak fix** — `python/execution/peak_nav.py` (new): wallet-aware + staleness-aware JSON peak file, atomic writes, legacy bare-float upgrade. `/rebase_peak` Telegram command (refuses on HL=$0). Live-mode startup guard refuses to bootstrap on phantom NAV. 26 tests in `python/tests/test_peak_nav_bootstrap.py`. Commits `689e0c8` + `e2b1660`. **Stale-suspect heuristic = peak > 5× current AND age > 24h** (legacy files: ratio check only, no age).

## Session 2026-04-25 — overnight autonomous shipping (founder asleep)
- [Overnight session log](session_2026-04-25_overnight_autonomous.md) — 19 commits this session + parallel-session deluge. Test surface 217 → 624. **Phase 5D Revenant cycle CLOSED end-to-end** (graveyard + spawner v0 + CLI + IC approval + ADR-070). All 5 canary-plan strategy families scaffolded (Hermes×5 + Aeon-Narrative + Bankr-Avantis-Macro + Bankr-Social-Momentum). Cull demoter shipped (ADR-069 follow-up). LLM structural-break detector + conviction wrapper. AWS Activate Portfolio + Harmonic grant drafts. Surface enrichment ETL stub. Founder briefed via `outputs/2026-04-25_overnight_session_summary.md`.

## Session 2026-04-25 — x402 rails live (first paid agent transaction)
- [x402 payment rails on Base](x402_payment_rails.md) — first Python-controlled agent x402 micropayment settled 2026-04-25: 0.10 USDC at agoragentic text-summarizer, receipt `rcpt_1764b016...`, decision hash `0x140953dc...`. Bridge at `bankr_bridge/bridge.mjs` uses `@x402/fetch` v2 + `@x402/evm` (NOT v1 `x402-fetch`). Selector signature is `(x402Version, requirements[])`. Wallet `0x97E2...ca06` funded via tx `0xc9eb2460...`. Unblocks `Bankr-Avantis-Macro` + `Bankr-Social-Momentum` per canary-acceleration plan.

## Session 2026-04-24 — latency plan + PM datacenter-ban flag + Hermes family
- [PM geofence (ToS §2.1.4)](polymarket_datacenter_ban.md) — 33-country IP geoblock; VPN/similar-tools-to-evade banned. PM hosts on AWS eu-west-2 (datacenter-IP-ban claim was wrong, corrected 2026-04-26).
- [PM compliance gate (pre-live)](polymarket_compliance_gate.md) — Phase 0 for live PM: resolve account-holder jurisdiction. US-person via Irish VPS = ToS §2.1.4 + CFTC consent-decree exposure.
- [Latency work gated on proven paper-edge](feedback_latency_gated_on_edge.md) — Tier 1 WS/co-lo only for a strategy that already earned in paper at 15-min cadence; measure bps lift directly. CalibrationGap doesn't qualify (week-resolution edges, latency-insensitive).
- [Hermes family of fast-twitch agents](project_hermes_family.md) — 5-min BTC binary cluster: `hermes-arb` (Kalshi↔PM), `hermes-cascade` (HL liquidations), `hermes-oracle` (Chainlink front-run), `hermes-funding` (HL funding spike), `hermes-fan` (CEX spot-spread). Genealogy = template × factor-tuple × LLM backbone, 30–60 variants per template via Latin Hypercube → realizes 250-agent swarm. Per-regime edge matrix is the backtest deliverable, not pooled Sharpe. Kalshi added; PredictIt skipped (cap kills Kelly).

## Session 2026-04-22 — critique review + MD propagation + classifier-outage workflow
- [Critique review memo + ADR-062/063 propagation](../../swarm-fund-mvp/docs/critiques/2026-04-22.md) — CG-centered organizing principle; Revenant "fine-tuning" → "Prior Updating"; Phase 5A–5D punch list (D1–D15) in `TASKS.md`. Commits `44e595f` (memo) + `d94b06f` (ADR-062/063 + MD propagation) + `1755410` (path fix).
- [Classifier outage → hand user a shell script](feedback_classifier_outage_fallback.md) — ≤3 retries on Bash mutations / Vercel MCP writes before falling back to a copy-pasteable shell block. Verified 2026-04-22 session: ~30 retries wasted while classifier was down.

## Session 2026-04-22 — MD rationalization + design handoff preservation
- [MD three-tier structure (ADR-061)](../../swarm-fund-mvp/DECISIONS.md) — root MDs collapsed 11→4, `docs/` top-level 16→5, 20 stale files moved to `docs/archive/` via `git mv` (history preserved). New root `README.md` indexes by role (critic / Claude Code / LP) with 9-file critique bundle. Commit `f2a841a`.
- [design_handoff_lore is dashboard source](project_design_handoff_lore.md) — keep the folder; it's the design system for future Bloomberg-terminal-style dashboard. Not a runtime dependency (fonts/tokens already copied into `swarm-lab-site/`) but IS the reference library. Deleted+restored this session (commits `173e92b` → `f2d8b47`).

## Session 2026-04-21 — Aristotle v2 intake + 250-agent direction + hero rewrite + live metrics cron
- [250-agent swarm direction](project_250_agent_swarm.md) — 230/20/5 lifecycle, Revenant redefined (Apex/Canary→Revenant with data-feedback), master portfolio allocator for Canary capital, ~$1.1–1.5k/mo cost envelope
- [Session 2026-04-21 Aristotle v2](session_2026-04-21_aristotle_v2.md) — 4 decisions: 100-trade Apex gate, 4-metric edge, Research Backlog, cross-venue removed
- [Forbidden phrases in external docs](feedback_forbidden_phrases.md) — never RenTech/Simons/Medallion; live-ingest-as-moat; cross-venue alpha; Darwinian-as-mechanism. **Darwinian-as-ambition is allowed** (ADR-056).
- **ADRs 050–058 in `DECISIONS.md`:** sample-gate 60→100, Falsification blocks, drift→COLD, Darwinian→A/B (mechanism), cross-venue deferred, Research Backlog, **hero rewrite + Darwinian-as-ambition carveout (056)**, per-agent cost attribution (057 — Stage 1 of 250-agent swarm), multi-provider LLM adapter with tiered caps (058 — Stage 2).
- **ADR-045 refined 2026-04-22:** public lifecycle is now strictly 4-state Birth/Canary/Apex/Revenant; Cold+Dead are internal engineering enum values only (`AgentLifecycle.DEMOTED`/`KILLED`). Revenant redefinition (from "graveyard mutant" to "demoted Apex/Canary with data-feedback to master learner") codified there too.
- **Edge metric supersedes 2266 bps headline:** report `median_edge_bps_net` leading, plus mean/median × gross/net 2×2. Net = gross − 205 bps cost stack. Hero StatsBar = mean-net + median-net side-by-side.
- **Live metrics cron:** `scripts/refresh-site-metrics.sh` runs via `~/Library/LaunchAgents/ai.rswarm.metrics.plist`. **Interval set to 900s (15 min) = 96 deploys/day, fits Vercel Hobby 100/day cap.** [Deploy budget details →](vercel_deploy_budget.md). Pause with `launchctl unload`, resume with `launchctl load -w`.
- **Hero copy landed (founder-authored, ADR-056):** opens "Revenant is a research experiment proven by returns. Our ambition is to explore Darwinian agent swarms..." and closes "So far nothing is statistically significant." Lifecycle shorthand simplified to Birth/Canary/Apex/Revenant on the public site (Cold/Dead remain internal enum values).

## Session 2026-04-20 — landing polish + risk ADRs + multi-agent scaffold
- **Branded lifecycle adopted:** Birth → Canary → Apex → Cold → Dead → Revenant (ADR-045). Revenant = mutant spawned from Dead's graveyard, paper-trading again to re-earn Canary. Revenant = the brand.
- **CalibrationGap clean metrics (post manual-override cleanup, ADR-044):** 26 closed / 73% win / +$295 P&L / Sharpe 0.257 / +2266 bps avg edge. The earlier "Sharpe 0.31, manual trades are drag" framing was based on stale MEMORY; the manual trades were slightly accretive.
- **20% single-asset cap deleted (ADR-039):** layer 4 removed from risk_gates.py + settings.yaml + kelly.py + delta.py + tests + docs + site copy. Layers 0/1/2/3 bind alone. Revisit at NAV > $100k with >3 signals/asset.
- **7pp min-gap derivation codified (ADR-038):** 2% Polymarket taker + 5bps funding + 4.95pp buffer.
- **Strategy registry at `python/agents/strategy_registry.py`** (ADR-046): Pathfinder/Mage/Archer/Shepherd registered with stub scans + per-agent LLM backbone (Gemini / Llama / DeepSeek / Claude). Wired into main.py. Pipelines land one-by-one. Archer file still missing — graceful skip.
- **Landing page three-pillar rework (ADR-040/042/043/047/048):** Darwinian swarm / bidirectional signal+execution / fragmentation thesis. Both modes. Polymarket mode gets extra cuts (no Kalshi, no investor UX, no Sign In, no waitlist). Research Questions promoted above Thesis. Hero stats: 3 cells, no dollar P&L, no Sharpe until Apex gate closes.
- **Research deliverables:** `outputs/literature_review_agentic_trading.md` (8 papers synthesized), `outputs/polymarket_signal_verticals_memo.md` (politics/sports/pop-culture signal sources with named researchers, beat writers, APIs).
- **Internal docs:** `docs/long_term_vision/` + `docs/agent_evolution/` folders. Each indexed in `docs/README.md`.
- **Manual tasks principle:** keep `manual_tasks_thomas.md` live as a running list. Added: multi-LLM API keys for OpenAI / Gemini / Together / DeepSeek to unlock cross-family judge panel (~$25/month at expected volume).
- **Timeline controls:** two segmented toggles — Short Form / Long Form × ELI5 / Technical. Four combinations. Investor-access milestone hidden in Polymarket mode.
- **Next session priority (user-confirmed):** Mage scan pipeline — needs HL candle ingest. Highest-ROI single unlock for multi-agent trade flow. Goal = close pool-wide gate in days, not weeks.
- **Polymarket agent-skills vendored (ADR-049, 2026-04-20):** `.claude/skills/web3-polymarket/` contains 9 upstream SKILL.md files from `Polymarket/agent-skills`. `CLAUDE.md` skill routing points at it for all PM SDK/REST/WS/CTF/bridge/gasless/builder-header work. Pairs with our `polymarket-signals` skill (calibration-gap math). Full-adoption refactor of `polymarket_adapter.py` (L2 HMAC, heartbeat, tick sizes, WS via `real-time-data-client`) deferred — tracked in TASKS.md "ADR-049 follow-up" section. Retry `py-clob-client-v2` (pushed 2026-04-17) as part of that; v1 install was blocked in this env.
- **Polymarket/agents is abandoned:** last push 2024-11-05, demo-grade — do NOT install. `Polymarket/agent-skills` is the maintained equivalent.

## Identity (UPDATED 2026-04-13 — Swarm Lab pivot)
- **Canonical email (forever): `t@rswarm.ai`.** Do not use `thomas@lore.xyz`, `thomas@swarmlab.xyz`, or any legacy alias in any new output — public or internal. Legacy mentions in historical files (scripts, ADR contexts) stay as-is because they describe past state.
- [stewart-lore scrub scope](project_stewart_lore_scrub_scope.md) — scrubbing stewart-lore from swarm-fund-mvp is in scope; **do NOT** revoke his lore-org GitHub admin (he was CTO).
- [macOS rename to tomscaria — pending](project_macos_rename_plan.md) — current home is `/Users/stew/`; eventual rename to `/Users/tomscaria/` will require touching the 3 launchd plists + re-keying `.claude/projects/` memory dir.
- **Swarm Lab** = research lab studying agentic AI behavior in adversarial financial markets
- The fund is the experimental apparatus. The P&L is the error bar.
- Cross-market information asymmetry fund as the underlying trading system
- Polymarket calibration is FIRST EXPRESSION, not the whole strategy
- Python-only signal plane + Hyperliquid execution (Rust/RedPanda/ClickHouse DEFERRED)
- 6 assets: ETH, SOL, BTC, HYPE, XRP + WTI (CL-USDC on HIP-3 — BLOCKED, backtest failed)
- Three north stars: (1) near-term income (advisory, grants), (2) Stanford PhD (Dec 2026), (3) live P&L proof
- Revenue milestones run parallel to system milestones — see `outputs/SWARM_LAB_MASTER_PROMPT.md`
- When current edge decays → rotate to next convergence gap using infrastructure already built
- **External validation:** Multicoin Capital (March 2026) confirms convergence thesis

## Execution Venues (bidirectional signal/execution)
- **Polymarket direct** — PRIMARY signal source; paper mode via `python/execution/polymarket_adapter.py` (httpx, no auth, public read endpoints work fine from US residential — verified 2026-04-26). Live order placement BLOCKED on (a) PM compliance gate (US-blocked IP confirmed via `/api/geoblock` 2026-04-26: `{blocked:true, country:"US"}`), (b) absent `POLY_PRIVATE_KEY`/`POLY_API_KEY`, (c) L2 HMAC not implemented. SDK install is NOT a blocker — `py-clob-client` is in venv, `py-clob-client-v2` resolves on PyPI. See [polymarket_compliance_gate.md](polymarket_compliance_gate.md).
- **Hyperliquid perps** — SOLE MVP EXECUTION (HYPE-PERP + HIP-3 CL-USDC for WTI, leverage plays)
- **Kraken** — DEFERRED (CLI binary at `tools/kraken-cli-main/`; not wired, not in active docs; revisit post-60-trade gate)
- Signals from ANY venue → execution on ANY venue

## MCP Data Layer
- **Crypto.com MCP** — live order books, tickers, candles (agent-native price data)
- **LunarCrush MCP** — social sentiment, engagement spikes (new alpha source)
- Polymarket CLOB — custom Rust ingestion (proprietary microstructure)

## Active Focus (UPDATED 2026-04-13)
- **Current branch:** `main` — all work shipped directly to main
- **Main loop running:** `.venv/bin/python -m python.main` — logs at `/tmp/swarm-main.log`. PID 95781 (started 2026-04-13). Telegram bot auto-starts as subprocess.
- **Agent state (2026-04-13):** CalibrationGap: CANARY lifecycle. 29 closed trades, 13 open. 76% win rate, +$415.80 P&L, composite 0.44, Sharpe 0.31.
  - Promoted shadow→canary on 2026-04-12 (all gates passed: 31>=20 closed, 71%>52% win, 0.43>0.3 composite)
  - FundingRate: no state file yet (scans but rates <1bp, below threshold)
- **HL wallet FUNDED (2026-04-20):** `0x83F4c49cF459cAbEDE08228FC471Ab89D0B189e3`. $60 USDC deposited Arbitrum → HL. Real $50 canary orders now live on next signal. Key in `.env`.
- **NAV is live:** reads from HL balance each iteration. Now using real capital for risk gates.
- **Canary→Live gates:** 60+ total closed trades, Sharpe > 0.5, composite > 0.5. At current rate, expect 60 closed in ~2-3 weeks.
- **Shipped 2026-04-13 (overnight session, 7 commits):**
  - Swarm Lab pivot: 8 MD files aligned with research lab framing
  - swarm-lab-site/: Vite/React landing page with Dark Cartography brand, Privy auth, investor portal, 19-milestone timeline
  - 10 revenue milestone deliverables in outputs/ (bio, templates, grants, research note, SSRN scaffold)
  - A3 risk hardening: daily loss breaker now halts scans (was warn-only), CV_edge bootstrap flows sample_count, P&L field consistency
  - 9 new A3 tests (138 total), /edge shows drift data, /risk shows breaker status
  - Aristotle response updated with Lab pivot addendum, TASKS.md backlog B1/B2/B3 all marked DONE
  - Trading loop restarted (PID 95781)
- **Shipped 2026-04-14 (overnight autonomous session, 6 commits):**
  - S2 Alchemist strategy (funding rate harvester, TREND/RISK_ON)
  - S3 Pathfinder strategy (cross-venue arb, 30bps threshold)
  - S4 Shepherd strategy (drawdown cascade 5/8/10/15%, all regimes)
  - S6 Mage strategy (RANGE-only mean reversion with 4σ regime-break guard)
  - Each with program.md + empty eval_log.jsonl
  - 30 unit tests in tests/test_strategies.py (198 total passing, 1 pre-existing regime test failure unrelated)
  - Site: lazy-load TopoBackground shader (502KB chunk split from main, landing page instant)
  - Site: useSystemMetrics hook + /metrics.json with static fallback
  - Site: Dashboard + Hero StatsBar pull live data (29 closed, 76% win, +\$415.80)
  - scripts/generate_site_metrics.py: reads agent state → writes public/metrics.json (cron-ready)
  - L2.4 autoresearch/scheduler.py: Temporal nightly workflow (stub, not registered)
  - L4.5 regime/daemon/retrainer.py: weekly HMM retraining with 5% loglik gate (stub)
  - vercel.ai domain rswarm.ai live (DNS propagated, Privy wired)
  - TASKS.md marked S1-S4/S6 as SHIPPED, L2.4 + L4.5 as SCAFFOLDED
- **Shipped 2026-04-12 (8 commits):**
  - Fixed Gamma API resolver (resolved field is null, outcomePrices is JSON string)
  - Promoted CalibrationGap to canary
  - HL wallet generated and wired (`0x83F4c49cF459cAbEDE08228FC471Ab89D0B189e3`)
  - HL adapter: fast-fail on missing key, detect API-level errors, close_position()
  - Auto-close HL positions when PM trades resolve
  - Live NAV from HL balance (startup + per-iteration refresh)
  - Trade records carry hl_order_id / hl_close_order_id
  - Telegram: /balance, /reconcile commands; bot auto-starts as subprocess
  - API: GET /api/balance, portfolio shows real lifecycle phase
  - Graceful shutdown with KeyboardInterrupt handler
  - PM scan optimized 20x (early-exit on volume, 1 API call vs 20)
  - Cleaned 2 duplicate closed trades, Sharpe 0.24→0.31, P&L +$166→+$416
  - Performance report CLI: `python -m python.cli.performance_report`
- **HL deposit status:** $60 USDC on Arbitrum, approved to bridge, but `batchedDepositWithPermit` requires HL web UI (EIP-2612 permit flow via their relayer). Manual deposit needed at app.hyperliquid.xyz.
- **Performance profile (29 closed):** BTC 81% win +$305, ETH 64% win +$30, SOL 100% win +$80. Manual $200 trades hurt (Sharpe -0.26); auto $50 trades strong (Sharpe 0.35).
- **Geo→WTI backtest gate:** FAILED 54% hit rate (threshold 65%); WTI blocked in venue_router; assess_geo_risk() active as risk filter only
- WTI/CL-USDC: venue ANTICIPATED (not yet live on HL API) — check monthly; backtest must pass before enabling
- Regime model: 3-state HMM trained; current state=2 (high_vol) 100% confidence as of 2026-03-28
- shadow mode paper accumulation: python.main uses $50 notional for shadow signals (max_position_usd=0 prevents real sizing)
- Run loop: `python -m python.main` (--dry-run for single iteration). Server: `uvicorn python.api.server:app --port 8000`

## Revenue Milestones (ADDED 2026-04-13)
- **Track A (Engine):** A1 HL funding (MANUAL), A2 60-trade gate (ongoing), A3 risk hardening (TODO), A4 edge decay (TODO), A5 regime 5-state (TODO), A6 autoresearch (TODO), A7 dashboard live data (TODO)
- **Track B (Revenue):** M1 expert bio (DONE), M3 outreach templates (DONE), M7 Anthropic credits (DONE), M8 AWS credits (DONE), M2 landing page (TODO), M4 research note (TODO), M5 dYdX grant (TODO), M6 Uniswap fellowship (TODO), M9 SSRN scaffold (TODO), M10 Polymarket Builders Program (TODO — $2.5M+ pool, rolling; Unverified start = no approval; Verified = email builder@polymarket.com), M11 Harmonic grant for Aristotle (TODO — rolling; pitches Aristotle adversarial-critique loop as reproducible methodology; output `/outputs/harmonic_aristotle_grant_application.md`)
- **Research program:** 5 questions — calibration persistence, regime sizing, constitutional drift, cross-domain signals, production chain
- **Full map:** `outputs/SWARM_LAB_MASTER_PROMPT.md`

## Key Decisions (Current — 2026-03-28)
- **WTI status:** BLOCKED. Geo→WTI backtest failed (54% < 65% gate). CL-USDC not live on HL API. Both gates must pass before re-enabling. assess_geo_risk() kept as portfolio risk filter.
- **Aristotle critique:** `docs/aristotle_response_plan.md` — full triage of 12 critiques + Multicoin addendum (2026-03-27)
- **Multicoin convergence thesis:** validates cross-domain architecture externally. Does NOT change MVP scope but strengthens LP narrative and creates urgency (window = months not years)
- Multicoin data answers Aristotle critique #1 (edge decay): rotation to commodity/equity/EM FX perps using same infra
- **User directive:** Hyperliquid focus only. No new execution venues in MVP. Aristotle simplification discipline holds
- Polymarket direct is PRIMARY signal source + direct trading; Hyperliquid is sole execution
- Polymarket direct trading IN SCOPE alongside perp execution
- Per-trade Sharpe (not annualized) for agent fitness
- Binary option P&L model for backtest harness
- **Architecture simplified:** Python-only MVP. Rust/RedPanda/ClickHouse all DEFERRED. Docker = PostgreSQL + QuestDB only
- **Fund thesis reframed:** NOT a Polymarket calibration fund. It's a convergence infrastructure play. Calibration is first expression
- **Track 2 (parallel):** operational infrastructure for multi-venue/multi-jurisdiction — the actual moat
- Kelly: empirical with quarter-fraction + regime scaling + CV haircut. NOT raw binary f*=2p-1

## Aristotle Plan — Sprint Summary (COMPLETED 2026-03-30)
All 5 items shipped. See git log for details. Retained for reference:
1. ✓ Doc truth reconciliation — CLAUDE.md replaced, ARCHITECTURE.md + TASKS.md rewritten
2. ✓ Architecture simplify — RedPanda/ClickHouse deferred in docker-compose; now re-enabled for Phase 0
3. Risk hardening — daily loss limit + CV_edge circularity fix still OPEN (not yet implemented)
4. Edge decay detection — SurfaceDriftDetector not yet wired (OPEN)
5. Response document — docs/aristotle_response_plan.md exists; full response doc OPEN

## Competitive Landscape (Twitter research 2026-03-23)
- Bayes + Kelly + EV is table stakes — everyone building this
- Our edges: regime-conditional sizing, autoresearch parameter evolution, KL-divergence cross-market arb
- MiroFish crowdthink vision (deferred): second-order modeling of crowd reaction, not just probability
- New agent ideas: KL-Divergence Agent, Social Momentum Agent (LunarCrush), Smart Money Tracker

## .gitignore Hygiene
- See `gitignore-checklist.md` for tracked patterns and types to add proactively
- After any feature writing to `data/`, check `git status` and add new extensions before committing

## Manual Tasks for Thomas
- [Manual tasks](manual_tasks_thomas.md) — HL wallet funding, external service setup, IC decisions

## Career & Recruiter Positioning
- [Self-assessment vs. headhunters](self_assessment_vs_headhunters.md) — counter-frame when a recruiter says profile "doesn't fit"; audience-specific pitch (LP vs Tower/DRW/DES vs Harmonic)

## Infra & Deployment
- [Vercel constraints](vercel_constraints.md) — what Vercel can/cannot do; live API via tunnel is the right fix for metrics staleness, not Vercel Cron
- [EC2 migration plan](infra_plan.md) — move trading loop off Mac onto t4g.small + systemd + Cloudflare Tunnel; sequenced with 48h parity verification
- [Aeon config](aeon_config.md) — 6 cloud-side GitHub-Actions skills (pr-review, monitor-polymarket, polymarket-comments, paper-pick, evening-recap, weekly-shiplog) configured at `/Users/scaria/aeon-config/aeon/`; deploy gated on Thomas forking + adding 3 secrets

## Grants, Credits & BD
- [Amazon Bedrock — 100K credits](project_bedrock_credits.md) — 2026-05-06. Affects ADR-058 provider routing: Bedrock = 8th provider candidate (Nova/Claude/Llama). Confirm $ denomination + expiry before wiring.
- [AWS deal playbook](aws_deal_playbook.md) — four-layer stack (Research Credits → Activate Portfolio → Gen AI Accelerator → Fintech → Reference Customer); "lead with story, credits close"
- Live tracker: `outputs/grants_tracker.md` — status across AWS, Anthropic, dYdX, Uniswap, Polymarket, Harmonic + Tower/DRW/DES conversations

## Reference Files
Load ON DEMAND:
- [Data sink architecture](data_sink_architecture.md) — ClickHouse Cloud, becker-revenant package, sync semantics
- [becker-revenant extraction](becker_revenant_extraction.md) — monorepo subdir now; subtree-split to standalone repo before pip/HF publish
- [Cloud infra preferences](cloud_infra_preferences.md) — default to AWS (credits available)
- [Research desktop folder](research_desktop_folder.md) — X/Twitter scrapes + reports route to ~/Desktop/agentic-swarm-fund-research/
- [Polymarket data-api quirks](polymarket_data_api_quirks.md) — offset pagination, ignored timestamp filters, UMA challenge-window resolution semantics
- **Polymarket resolution truth (2026-04-20):** canonical source is on-chain `CTF.payoutNumerators(conditionId, outcomeIndex)` at `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` (Polygon). Gamma `closed`/`outcomePrices` is a cache lagging by UMA challenge window (2h standard, 48h contested). If they disagree, trust chain. Full semantics + sports-oracle distinction in `polymarket_data_api_quirks.md`. Hardening = P3 in TASKS.md (trigger: sports vertical OR first disputed-market incident).
- [Session 2026-04-17 archive](session_2026-04-17_data_sink.md) — data sink infra shipped, next = Chronos-Bolt
- [Polymarket wallets + deposit flow](polymarket_wallets.md) — PM proxy `0x0a10…52B1`, cross-chain aggregator, distinct from HL wallet
- [Brand hierarchy](brand_hierarchy.md) — `Swarm Lab` (lab) vs `Revenant` (agent); Revenant = PM builder brand as of 2026-04-20
- [Upstream SKILL.md watchlist](upstream_skills_watchlist.md) — orgs to quarterly-check for agent-skills repos; vendor via `scripts/vendor-skill.sh`
- [Feedback: schedule recurring tasks](feedback_schedule_recurring_tasks.md) — any "check X every Y" entry should be a scheduled task (`mcp__scheduled-tasks`), not a line in `manual_tasks_thomas.md`
- [Feedback: schema-extension commits go end-to-end](feedback_schema_extension_pattern.md) — add field + write sites + aggregate + verify + one test in one commit before any consumer, else you'll hunt null-defaults tomorrow
- [Workflow: session archival](workflow_session_archival.md) — end-of-session git tag + memory file pattern
- `build-status.md` — phase completion, lane outcomes
- `working-code.md` — module paths
- `agent-architecture.md` — Bridgewater lifecycle, fitness weights, promotion gates
- `dev-environment.md` — venv, docker, databases, Becker dataset (302M trades)
- `roadmap-gaps.md` — missing tasks, next steps
- `parallel-lanes.md` — worktree lane coordination, merge order
- [Lane 2 + Lane 3 parallel execution](parallel_lanes.md) — autoresearch/ and dashboard-v2/ are disjoint; safe to run concurrently in separate sessions
- `research_leads.md` — research opportunities
- [Lane 3 shipped](lane3_dashboard_shipped.md) — dashboard-v2 built as enhancement to existing Next.js app, not new Vite app
- [Skill routing tips](skill_routing_tips.md) — name skills explicitly (e.g. `/design:ux-copy`) instead of describing the task; auto-invocation is probabilistic
- [Bandit reversal procedure](bandit_reversal_procedure.md) — standard ML-loop diagnostic: `SWARM_BANDIT_DISABLE=1` flattens variant Kelly multiplier + auto-hold; `/bandit_status` confirms; posterior preserved. ADR-074.

## Session Resume Gotchas
- [Parallel session artifacts](parallel_session_artifacts.md) — inspect `??` untracked files before planning; autonomous sessions regularly pre-build modules
- Before claiming Phase N work is pending, run `git log --oneline origin/main -20 | grep -iE 'phase.*1\.5|autoresearch|regime|hmm'` — production repo often has the work already shipped under different commit messages than the plan doc names it.

## Shell & Git Aliases
- `gsync` (shell) = `git pull --rebase && git push` — in ~/.zshrc
- `git sync` (global git alias) = same — use this as the canonical push workflow
- After adding any shell alias: run `source ~/.zshrc` immediately so it's testable in the same session
- `git sync` alias (`!git` shell escape) fails in Claude's non-interactive Bash tool — always use `git push origin main` in tool calls
- `git lg` = `git log --oneline --graph --decorate -20` — use for branch inspection instead of `git log --oneline -5`
- `dotfiles-sync` = `cp ~/.zshrc ~/dotfiles/.zshrc && cd ~/dotfiles && git add .zshrc && git commit -m "sync: zshrc" && git push && cd -`

## Dotfiles
- Repo: `https://github.com/tomscaria/dotfiles` (private)
- `~/.zshrc` is a symlink → `~/dotfiles/.zshrc` — edits in any session land directly in the repo, no manual `cp` needed
- After adding aliases: run `dotfiles-sync` (one command: commit + push)
- To add new dotfiles: `cp ~/.<file> ~/dotfiles/.<file> && ln -sf ~/dotfiles/.<file> ~/.<file>`

## Brand & Design
- [Dark Cartography Brand](dark_cartography_brand.md) — deep navy-black, topographic grids, Space Grotesk + IBM Plex Mono, `#2dd4bf` teal accent (supersedes Icy Teal Futurism)
- [Brand Aesthetic — Icy Teal Futurism](brand_aesthetic.md) — SUPERSEDED by Dark Cartography (2026-03-31)

## Dashboard Development (UPDATED 2026-03-31)
- **Tufte primitives shipped:** `sparkline.tsx` (pure SVG), `data-cell.tsx` (BarCell/HeatCell/SparklineCell), `live-dot.tsx`, `lib/dummy-data.ts` (5 agents, 140 trades, full seed)
- **Dummy data fallback:** store.ts falls back to `DUMMY.*` when API offline — no more empty states
- **Dark Cartography rebrand:** colors, fonts, coordinate grid all in `globals.css`. All `#00d4c8` replaced with `#2dd4bf`
- **Fonts:** `@fontsource-variable/space-grotesk` + `@fontsource/ibm-plex-mono` (imported in `layout.tsx`, no next/font)
- **Stray ~/package.json hazard:** if `npm install` runs in `~/` it creates `~/package-lock.json` which breaks Turbopack workspace root detection. Delete `~/package.json`, `~/package-lock.json`, `~/node_modules` if this happens.
- Validation: run `npx tsc --noEmit` in `dashboard/` before marking any frontend task complete — catches Base UI/shadcn API mismatches before runtime
- Base UI Select: `onValueChange` is `(value: string | null, eventDetails) => void` — always handle `null`
- Base UI trigger pattern: `<DialogTrigger render={<Button>...</Button>} />` and `<SheetTrigger render={<Badge>...</Badge>} />` — `render` prop, not children
- Base UI SheetTrigger with custom element (e.g. Badge): wrap with `<SheetTrigger render={<button type="button" className="appearance-none border-0 bg-transparent p-0" />}>{trigger}</SheetTrigger>` — avoids hydration errors when trigger is not a native button
- `eslint-disable-next-line` inside JSX MUST be `//` (JS comment), NOT `{/* */}` (JSX comment) — JSX comments are not parsed as eslint directives and cause TS parse errors inside ternary expressions
- Mock WS auto-starts via `dashboard/instrumentation.ts` (`register()` hook, Node.js runtime only, dev only) — no second terminal needed
- `instrumentation.ts` pattern: use for any dev-only side-process (seed scripts, mock servers) — check `process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development"`
- ESM/CJS dual-use files: wrap `require.main === module` in `try/catch` — throws in Next.js ESM import context, works fine in `tsx` standalone
- Dashboard asset universe: ETH, SOL, BTC, HYPE, XRP, WTI (WTI = CL-USDC on HIP-3, near-term production candidate)
- WS audit trail: clicking LIVE/OFFLINE badge opens Sheet panel with timestamped log of all WS events (store.wsLog, max 200 entries)

## python-telegram-bot v22 Patterns
- `run_polling()` is **synchronous** and manages its own event loop — call it directly from `main()`, NEVER inside `asyncio.run()` (causes `RuntimeError: This event loop is already running`)
- Correct pattern: sync `main()` builds `Application`, adds handlers, calls `app.run_polling(allowed_updates=Update.ALL_TYPES)`
- `FitnessScore` canonical fields: `composite`, `sharpe_ratio`, `win_rate`, `calibration_accuracy`, `total_pnl`, `total_trades`, `avg_edge_predicted`, `avg_edge_realized`
- `TradingAgent` fields: `agent_id`, `hypothesis` (not `thesis_name`), `lifecycle`, `trades`, `fitness`

## Telegram Bot — Implemented Commands (UPDATED 2026-03-31)
- Module: `python/alerting/telegram.py` | Run: `python -m python.alerting.telegram`
- **Three-tier prefix system:** `AUTO |` (bot acted alone), `REPORT |` (answer to command), `ACTION NEEDED |` (waiting for human)
- **Morning briefing:** `/recap` (24h summary), `/pnl` (today/7d/30d/all breakdown)
- **Situational awareness:** `/status` (all agents), `/trades`, `/nav`, `/regime` (HMM state), `/funding` (HL rates + open trades + time-to-close), `/edge` (decay analysis), `/risk` (limits + exposure + pause status)
- **Signal hunting:** `/scan`, `/opportunities`, `/promote` (gate status all agents)
- **IC decisions:** `/confirm_promote <id>`, `/resolve`, `/pause`, `/resume`, `/kill <id>`
- **Promotion is manual:** `check_promotion_gates()` is read-only; `promote()` requires explicit `/confirm_promote`. Demotions are still automatic (capital protection).
- Pause flag: `data/.loop_paused` — checked by main.py each iteration; paused loop still resolves trades
- Push alerts: entry card (`AUTO`), outcome card (`AUTO`), promotion gate met (`ACTION NEEDED`), demotion (`AUTO`), edge decay (`AUTO`), loop start/stop (`AUTO`)
- Rate limit: opportunity scan alerts 30 min/asset; entry/resolution cards unthrottled
- Credentials: `.env` → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- **Mini App:** `telegram-mini-app/` — standalone HTML/CSS/JS Fund HUD, served by FastAPI at `/mini/`. Shows regime, NAV, P&L, agent cards, loop pause/resume. No build step. To connect: BotFather → `/setmenubutton` → set URL to `https://<host>/mini/`
- **Loop control API:** `GET /api/loop/status`, `POST /api/loop/pause`, `POST /api/loop/resume` — shared between Telegram bot commands and mini app

## Agent State Safety Rules (UPDATED 2026-03-29)
- **Never close a trade with `realized_pnl=0` to clean it up** — zero-pnl closures count as losses (win = `pnl > 0`). Delete the trade from `agent.trades` instead and call `_update_fitness()` + `_save_state()` directly.
- **Seed/test trades in production state** — any `market_id` starting with `seed-` or with `size_usd=0` is a test artifact. `resolve_trades._close_invalid_trades()` now deletes these (not closes). If you discover old closed seed trades: remove from JSON manually, zero out the `fitness` block, let the agent recompute on next load.
- **Fitness drift detection** — after any direct JSON edit to `data/agents/*.json`, verify `fitness.total_trades == len([t for t in trades if exit_price is not None])`. Divergence = stale fitness; zero the block to force recompute.

## FundingRateAgent — Threshold Reference (2026-03-29)
- **Cost floor (limit orders, used in code):** 8bps round-trip (2bps maker × 2 legs + 2bps slippage × 2)
- **Cost floor (market orders):** 14bps round-trip (5bps slippage × 2 + 2bps taker × 2)
- **Typical HL funding rates:** BTC/ETH 8–15bps/8h; SOL 2–5bps/8h; HYPE spikes to 30–50bps during pumps; XRP 1–3bps/8h
- **MIN_FUNDING_8H = 0.0001** (1bp scan threshold); **MIN_EDGE_AFTER_COST = 0.0008** (8bps limit basis)
- BTC/ETH at ~12bps will fire on limit basis (12 > 8); would NOT fire on market basis (12 < 14)
- `_fetch_funding_rates()` uses `POST /info {"type": "metaAndAssetCtxs"}` — public, no auth

## MCP Data Layer
- [Birdeye endpoint routing](birdeye_endpoints.md) — price poll vs OHLCV backfill vs smart money; Lite plan sufficient until Lane 2 backfill

## Database / Migrations
- [Alembic SQLAlchemy type patterns](alembic_patterns.md) — use sa.DateTime(timezone=True) not TIMESTAMPTZ import

## Python Patterns
- [lmnr Laminar init guard pattern](lmnr_init_pattern.md) — walrus guard prevents ValueError when LMNR_PROJECT_API_KEY unset

## Drift Scalar Pattern (2026-03-31)
- `drift_kelly_scalar` must flow into `empirical_kelly_binary(drift_scalar=...)`, never applied post-hoc to `size_usd`
- `opportunity.py` is the canonical location — computes drift once per scan, passes into Kelly
- Main loop must NOT independently call `_get_drift_scalar()` — that was a double-application bug, now fixed

## Hard Rules
- **Decision log is mandatory** — [feedback: log every architectural decision in DECISIONS.md](feedback_decision_log.md); use `scripts/decision-log-helper.sh "<title>"`
- **Always update memory at session close** — when reflect skill runs, always write findings to MEMORY.md without asking; never skip
- **Always maintain a running list of manual tasks** — whenever a human-only action surfaces (API key to provision, wallet to fund, account to create, decision to make), add it to `manual_tasks_thomas.md` in the same turn it surfaces. Do not batch to end-of-session. Running list, always.
- See `CLAUDE.md` Constraints for: jurisdiction_mode, evolution gate, Kelly formula, Docker compose path
- Session start: `git log --oneline -5 && git show HEAD --stat && git worktree list` — canonical command is in global ~/.claude/CLAUDE.md
- `claude-audit` on CLAUDE.md: flag session-start commands, tooling aliases, and personal workflow conventions as candidates to move here
- Run `doc-hygiene` skill at the start of any session that modifies CLAUDE.md (sequences claude-audit + reconcile-docs)
- `.claude/` is gitignored — skills are machine-local, never commit or push them; `git add -f .claude/` will fail by design
- All new Python files: `from __future__ import annotations`
- After decision changes: run `reconcile-docs` skill
- [Auto-commit hook race](feedback_auto_commit_race.md) — after multi-file Edit batches in repos with auto-commit, run `git log -1 --stat` before the next major edit; the hook may capture your work under a misleading label (seen 2026-04-22, polymarket_adapter.py under "docs:" commit)
