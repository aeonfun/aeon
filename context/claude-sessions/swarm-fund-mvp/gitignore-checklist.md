# .gitignore Data Patterns Checklist

When a new runtime/generated data file type appears untracked, add it to the `data/` block in `.gitignore` before committing.

## Current patterns in `.gitignore` (data/ block)
```
data/*.parquet        # calibration surfaces, regime surfaces
!data/calibration_surface.parquet  # exception: this one IS tracked
data/*.duckdb         # DuckDB working databases
data/*.db             # generic DB files
data/*.jsonl          # runtime logs (costs.jsonl, trade logs, etc.)
*.pid                 # all process ID files (blanket pattern)
data/becker/          # raw Becker dataset (too large)
data/reports/         # generated reports
```

## Add proactively when you see these file types appear:
- `data/*.csv` — exported trade/signal CSVs
- `data/*.arrow` / `data/*.feather` — Arrow IPC files
- `data/*.pkl` — pickled models (regime_hmm.pkl tracked separately)
- `data/*.png` / `data/*.svg` — generated charts/heatmaps
- `data/regime_surfaces/` — if this dir grows large, ignore the whole dir

## Intentionally ignored directories (do NOT flag in audits)
- `.claude/` — machine-local skills and settings; skills are never committed by design
- `tools/` — large external datasets and third-party tools
- `node_modules/`, `.next/`, `.venv/` — standard build/runtime artefacts

## Workflow
1. After any new feature that writes to `data/`, check `git status` for new untracked data files.
2. If a new extension appears, add it here AND to `.gitignore` in the same commit as the feature.
3. Before adding a specific path, check if a blanket pattern already covers it (e.g. `data/*.jsonl` covers any `data/foo.jsonl`). Prefer blanket over specific.
4. Exception: `data/calibration_surface.parquet` is intentionally tracked (pinned surface).
