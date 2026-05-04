*Repo Action Ideas — tomscaria/swarm-fund-mvp — 2026-05-04*
Yesterday's 5 ACT NOW PRs all merged 21:57 UTC; today's gaps are supply-chain (unpinned trading SDKs at the canary's surface) and contract-shape (the Aeon adapter polls a JSON shape Aeon doesn't yet emit).

Top pick: Pin py-clob-client>=0.34.6,<0.40 + py-builder-signing-sdk>=0.0.2,<0.1 in pyproject.toml (Security, Small, Priority HIGH)
 → Cold installs stop drifting under CalibrationGap; the only canary's order-signing path locks to known-working SDK floors instead of whatever PyPI ships.

1. Pin py-clob-client + py-builder-signing-sdk floors and ceilings in pyproject.toml (HIGH, Security, Small)
2. Write docs/contracts/aeon_signal_contract.md so the Aeon side has a JSON spec to ship against (HIGH, Content, Small)
3. Add a Quickstart section to README.md (pip install -e ".[dev]" + python -m python.main) (MED, Content, Small)
4. Add .github/workflows/uv-lock-drift.yml running uv lock --locked on every PR (MED, DX, Small)
5. Add .github/workflows/weekly-eval-digest.yml cron'ing scripts/eval_one_shot.py Mondays 14:00 UTC (MED, DX, 1-2 days)

Full details: https://github.com/tomscaria/aeon/blob/main/articles/repo-actions-2026-05-04.md

