---
name: connect-check
description: Prove the configured model credential works on a GitHub runner. Makes one tiny model call that must answer AEON_CONNECT_OK; no tools, no notifications, no memory. The dashboard dispatches it after a model key is saved and reads the result plus token usage.
metadata:
  title: Connect Check
  mode: read-only
  category: core
  var: ""
  tags:
    - core
    - setup
  capabilities:
    - read_only
---

This is a connection test, not a task. The dashboard dispatches it right after
the operator saves a model credential, and decides pass or fail from two things
only: the run succeeded, and the model reported nonzero token usage.

Do exactly this and nothing else:

- Do not read memory, logs, STRATEGY.md, soul files, or any other file.
- Do not call any tool, run any command, fetch any URL, or call `./notify`.
- Do not write to `memory/` or `output/`.

Reply with exactly this single line as your final message, with no other text,
markdown, or summary before or after it:

AEON_CONNECT_OK
