---
name: repo-nested-path
description: "The swarm-fund-mvp git repo is the NESTED dir swarm-fund-mvp/swarm-fund-mvp/, not the wrapper folder Claude Code launches in"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2cefedce-36fc-4527-a2d7-b7efd33de3c4
---

Claude Code sessions for this project launch with primary working directory `/Users/stew/scaria/swarm-fund-mvp/` — but that is a **wrapper folder**, not the repo. It holds only a `.DS_Store`, a stray `cg_hl_analysis.json`, and the actual project subdir.

**The git repository is one level down: `/Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp/`.** That nested dir is where `.git`, `CLAUDE.md`, `AGENTS.md`, `CODEX_HANDOFF.md`, `python/`, `dashboard/`, `tests/`, `outputs/`, `DECISIONS.md` all live. `git`, `.venv/bin/pytest`, and every project command must run from there.

`cd /Users/stew/scaria/swarm-fund-mvp/swarm-fund-mvp` at session start, or use absolute paths throughout. The `feat/fs-adoption` worktree is a separate sibling at `/Users/stew/scaria/swarm-fund-mvp-fs-adoption/` (see [[feat/fs-adoption branch held]]).
