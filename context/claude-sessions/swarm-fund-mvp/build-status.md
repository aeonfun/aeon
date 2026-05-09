# Build Status

## Phase Completion
- Phase 0-A: DONE (repo structure, toolchain)
- Phase 0-B: DONE (calibration surface built — 302M trades, 100 cells)
- Phase 0 COMPLETE: TASK-0.1 ✓, TASK-0.2 ✓, TASK-0.3 ✓, TASK-0.4 ✓
- **Live scanner pipeline working** — scans Polymarket, applies calibration, Kelly sizes
- **Agent base class built** — Bridgewater darwinistic agent framework
- **CalibrationGapAgent v1 running in shadow mode** — paper trading
- **Becker calibration surface LIVE** — data/calibration_surface.parquet (replaces bootstrap)
- WTI dropped from asset universe (2026-03-20) — not available on Hyperliquid

## Parallel Development Lanes (2026-03-22)
- **See `parallel-lanes.md` for full details** — merge order, conflict zones, shared interfaces
- 4 lanes running simultaneously in worktrees: Data Pipeline, Autoresearch, Dashboard V2, Regime Detection
- **Merge order:** Lane 1 + Lane 4 first → Lane 2 + Lane 3 rebase → merge
- **Shared config owner:** Lane 1 (Data Pipeline) owns settings.yaml, docker-compose.yml, pyproject.toml

## Tooling Integration (2026-03-22)
- **last30days** installed globally (`~/.claude/skills/last30days/`); `market-research` wrapper skill created
- **parallel-code-review** skill created (6-agent review extracted from Compound Engineering)
- Compound Engineering plugin NOT installed (5/6 phases redundant with existing skills)

## Lane 2: Autoresearch Loop (Phase 2.6) — COMPLETE (2026-03-22)
- **All 5 tasks done**: SignalConfig, backtest harness, fitness function, program.md, first run
- **Data split**: 326M Becker trades → train 35.7M (2023-03 to 2024-12), val 198M, test 92.3M
- **Baseline**: fitness=0.6786, Sharpe=0.58, win_rate=83.7%, brier=0.15, 2.9s runtime
- **Key decisions**: per-trade Sharpe (not annualized), additive drawdown, vectorized Polars joins, binary option P&L model
- **New files**: split_becker_trades.py, walk_forward_validation.py, test_autoresearch.py (37 tests)
- **vectorbt installed** but not used — binary options don't fit its time-series model

## Lane 3: Dashboard V2 (Phase 3.5) — COMPLETE (2026-03-22)
- **All 5 tasks done**: Foundation, Agents+Markets, Strategy+Evolution, System+Admin, Public+Polish
- **Brand: REVENANT FUND** — spectral purple (#7c5cff), ember (#ff6b35), resurrect teal (#00d4aa)
- **50 frontend files, ~4,900 lines** — Next.js 16 App Router, 17 routes
- **22 components**: AgentDAG (React Flow), PriceChart (Lightweight Charts), CalibrationHeatmap (D3), FitnessRadar, EvolutionLandscape, EquityCurve, AdminControls, TopologyGraph, VenueBalances, Sidebar, etc.
- **Zustand store** replaces useState; **WebSocket client** with exponential backoff
- **8 new backend endpoints** + background broadcaster + 4 Pydantic models
- **Stubbed:** Regime (2.5), Telegram, MiroFish, On-chain, Mint/Redeem
- **Commit:** 313234c on branch claude/vigorous-khorana
- **Skill created:** `revenant-dashboard` — design tokens, component APIs, routing conventions
- **Learnings:** React 19 needs Radix UI v2+; use `--legacy-peer-deps` for npm install

## shadcn/ui Migration — COMPLETE (2026-03-23)
- **Branch:** `feat/shadcn-ui-integration` (no PR yet — `gh auth login` needed)
- **68 files changed, +7,580 / -2,339 lines**
- Replaced custom Card, Badge, Skeleton, NotYetActive with shadcn equivalents
- Added 20+ shadcn components: Button, Table, Tabs, Sidebar, Sheet, Dialog, Select, ScrollArea, Sonner, DropdownMenu, Collapsible, ToggleGroup, Tooltip, etc.
- `components.json` + `lib/utils.ts` (cn helper) added
- Old `app/components/ui/` custom primitives removed, new `components/ui/` from shadcn
