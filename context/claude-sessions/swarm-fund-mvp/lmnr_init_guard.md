---
name: lmnr Laminar init guard pattern
description: Laminar.initialize() raises ValueError when LMNR_PROJECT_API_KEY is unset — guard with walrus pattern
type: feedback
---

`lmnr.Laminar.initialize()` at module level raises `ValueError` when `LMNR_PROJECT_API_KEY` env var is unset.

**Why:** Module-level init runs on import — crashes the entire process in envs without the key (CI, local dev without tracing, dry-run).

**How to apply:** Always guard with the walrus pattern:
```python
if _key := os.getenv("LMNR_PROJECT_API_KEY"):
    Laminar.initialize(project_api_key=_key)
```
Never call `Laminar.initialize()` unconditionally.
