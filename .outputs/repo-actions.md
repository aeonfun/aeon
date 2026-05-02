*Repo Action Ideas — tomscaria/swarm-fund-mvp — 2026-05-02*
Four HIGH-priority ideas this cycle, all anchored to the missing PR-time CI or autoresearch loop gaps. Top pick gives the four stale fix-PRs (#19/#20/#23/#24) the green-check signal they need to merge.

Top pick: Add .github/workflows/ci.yml with ruff + pytest (both trees) + strategy_inventory --check (DX, Medium, Priority HIGH)
 → Every PR gets a green-or-red signal in <10 min; the 'two test trees' footgun cannot recur silently.

1. Add .github/workflows/ci.yml — ruff + pytest + strategy_inventory --check (HIGH, DX, Medium)
2. Upload watchdog_baseline.json artifact from swarm-watchdog.yml for grant/LP evidence trail (HIGH, Content, Small)
3. Add python/tests/test_strategy_inventory_invariant.py pytest regression (HIGH, DX, Small)
4. Replace hardcoded 5-strategy rotation in autoresearch.yml with dynamic _STRATEGY_REGISTRY read (HIGH, Feature, Small)
5. Add .pre-commit-config.yaml — ruff + check-yaml + end-of-file-fixer (MED, DX, Small)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-05-02.md
