# Parallel Development Lanes (2026-03-22)

## 4 Independent Lanes — Zero File Conflicts

| Lane | Phase | Branch | Scope | Owner |
|------|-------|--------|-------|-------|
| 1 | 1.5 — Data Pipeline | `feat/data-pipeline` | TASK-NEW-4.1→4.5 | Integration owner |
| 2 | 2.6 — Autoresearch Loop | `feat/autoresearch` | TASK-NEW-6.1→6.5 | Independent |
| 3 | 3.5 — Dashboard V2 | `feat/dashboard-v2` | TASK-NEW-7.1→7.5 | Independent |
| 4 | 2.5 — Regime Detection | `feat/regime-detection` | TASK-NEW-5.1→5.5 | Independent |

## Merge Order (CRITICAL — follow exactly)

```
Phase 1: Lane 1 (Data Pipeline) + Lane 4 (Regime) → merge to main
Phase 2: Lane 2 (Autoresearch) + Lane 3 (Dashboard) → rebase on main → merge
```

**Why this order:** Autoresearch may reference new QuestDB tables from Lane 1. Dashboard stubs regime panels that Lane 4 provides.

## Conflict Zones — Shared Files

These files are touched by multiple lanes. **Only ONE lane owns each file.**

| File | Owner Lane | Others: read-only |
|------|-----------|-------------------|
| `config/settings.yaml` | Lane 1 (Data Pipeline) | All others read, never write |
| `pyproject.toml` | Lane 1 | Others may add deps but must coordinate |
| `docker-compose.yml` | Lane 1 | Lane 4 may need new services — coordinate |
| `.env` / `.env.example` | Lane 1 | Others read only |
| `MEMORY.md` | Lane 1 (integration owner) | Others don't touch |

## Shared Interfaces — Schema Contract

Each lane MUST respect these shared schemas. Changes require coordination.

### RedPanda Topics (Lane 1 creates, others consume)
- `market.prices.raw` — raw price ticks
- `market.trades.raw` — raw trade fills
- `calibration.surface.updated` — surface rebuild notifications
- `regime.state.changed` — regime transitions (Lane 4 publishes)
- `agent.signals` — agent trade signals
- `agent.lifecycle` — agent state changes

### QuestDB Tables (Lane 1 creates DDL)
- `market_prices`, `scanner_opportunities`, `executor_orders`, `accountant_snapshots`, `system_health`
- New tables from Lane 1: check `infra/questdb/` for latest DDL

### ClickHouse Tables (Lane 1 creates DDL)
- `swarm.raw_payloads`, `swarm.trade_fills`
- New tables from Lane 1: check `infra/clickhouse/` for latest DDL

## Best Practices for Multi-Instance Claude Code

### Before Starting Each Instance
1. **Use worktrees** — `git worktree add` or Claude's `/worktree` for full isolation
2. **Scope the prompt tightly** — include directory boundaries ("only touch `/regime/`")
3. **Disable auto-docs updates** — don't let instances fight over README/MEMORY/CLAUDE.md
4. **Pin shared config ownership** — one instance owns `settings.yaml`, others read-only

### Prompting Each Instance
Include in every lane's prompt:
- "Do NOT modify: CLAUDE.md, MEMORY.md, TASKS.md, SWARM_FUND_MASTER.md, ARCHITECTURE.md, config/settings.yaml"
- "Do NOT modify files outside your lane's directory scope"
- "When done, output a HANDOFF.md in your lane's root with: what was built, new tables/topics, integration points, any assumptions"
- "Use `from __future__ import annotations` in all new Python files"

### During Development
- Each instance should `git status -s` before editing to detect drift
- No instance should run `git pull` or `git merge` — only the integration owner merges
- Tests should be scoped: Lane 1 tests in `tests/test_pipeline_*`, Lane 4 in `tests/test_regime_*`, etc.
- If an instance needs a shared interface (topic name, table schema), it should document the assumption in HANDOFF.md rather than changing shared config

### Merge Checklist (Integration Owner — Lane 1)
1. All 4 lanes complete → collect HANDOFF.md from each
2. Review schema assumptions — do topic names and table DDL match?
3. Merge Lane 1 + Lane 4 to main (no conflicts expected)
4. Have Lane 2 + Lane 3 rebase on updated main
5. Resolve any stub replacements (Dashboard may have "not yet active" badges for regime data)
6. Run full test suite: `pytest tests/`
7. Verify Docker stack: all new services start, topics exist, tables created

### After Merge
- Update MEMORY.md with new build status
- Run `skills-audit` to check for stale assumptions
- Tag the merge: `git tag v0.X.0-parallel-merge`

## Lane-Specific Directory Boundaries

- **Lane 1 (Data Pipeline):** `infra/`, `python/pipeline/`, `config/`, `docker-compose.yml`
- **Lane 2 (Autoresearch):** `python/autoresearch/`, `python/backtest/`, `tests/test_autoresearch_*`
- **Lane 3 (Dashboard):** `dashboard/`, `python/api/` (WebSocket bridge), `tests/test_dashboard_*`
- **Lane 4 (Regime):** `python/regime/`, `tests/test_regime_*`
