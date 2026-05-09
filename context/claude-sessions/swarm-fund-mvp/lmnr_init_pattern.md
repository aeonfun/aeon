---
name: lmnr Laminar init guard pattern
description: Correct way to initialize lmnr at module level without raising ValueError when API key is absent
type: feedback
---

Never call `Laminar.initialize(project_api_key=os.getenv("LMNR_PROJECT_API_KEY", ""))` at module level — lmnr raises `ValueError` if the key is an empty string.

Always guard with the walrus pattern:
```python
if _lmnr_key := os.getenv("LMNR_PROJECT_API_KEY"):
    Laminar.initialize(project_api_key=_lmnr_key)
```

**Why:** All 6 Lane 1 pipeline files failed import in CI/test because `LMNR_PROJECT_API_KEY` was unset. Required a sed pass across every file after the fact.

**How to apply:** Use this pattern in every new Python file that imports lmnr, at module level, before any `@observe` decorators are used. The `@observe` decorator is a no-op when lmnr is not initialized — tracing silently skips, which is correct behavior in test/dev environments.
