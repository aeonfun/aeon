---
name: venv-dev-extras-missing
description: "The uv-managed .venv often lacks [project.optional-dependencies] dev — pytest-asyncio missing makes async tests silently error with \"unknown config option: asyncio_mode\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2cefedce-36fc-4527-a2d7-b7efd33de3c4
---

The `.venv` at `/Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp/.venv` is uv-managed and frequently lacks the `[project.optional-dependencies] dev` extras (`pytest-asyncio`, `ruff`).

**Symptom (caught 2026-05-24):** async tests (e.g. `tests/test_aeon_adapter.py::TestAeonAdapterPollLoop::test_last_error_clears_after_recovery`) fail with:

> async def functions are not natively supported.
> You need to install a suitable plugin for your async framework, for example:
>   - anyio / pytest-asyncio / pytest-tornasync / pytest-trio / pytest-twisted

…and pytest emits `PytestConfigWarning: Unknown config option: asyncio_mode` on every run. The async tests appear as pre-existing reds; the code under test is fine.

**Fix:**

```bash
uv pip install --python .venv/bin/python pytest-asyncio
# or, to install all dev extras at once:
uv pip install --python .venv/bin/python -e ".[dev]"
```

The `.venv` has **no `pip` binary** (uv-managed venvs skip it by default), so `.venv/bin/pip install` fails with "no such file or directory". Always use `uv pip … --python .venv/bin/python`.

The project's `pyproject.toml` has `[tool.pytest.ini_options] asyncio_mode = "auto"` — installing pytest-asyncio is enough; no other config change needed.
