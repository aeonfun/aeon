---
name: macOS account rename to tomscaria — pending follow-up
description: When the macOS account is renamed from `stew` to `tomscaria`, what files need updating
type: project
originSessionId: 2cae8c9b-f28b-48b0-996a-9164174234e5
---
The macOS account on this machine is currently `stew` (home `/Users/stew/`). Plan is to eventually rename to `tomscaria` to match the rest of the identity consolidation. Not done yet.

**Why deferred:** macOS account rename is a multi-step OS operation (System Settings → Users & Groups → advanced → rename home dir + user); user wanted to keep moving on the project-side scrub first.

**How to apply (when the rename happens):**

1. **Re-write all hard-coded `/Users/stew/` paths** in `infra/launchd/*.plist` (3 files: api, docker-up, trading-loop). Plists need absolute paths — there's no env-var indirection. Then `launchctl unload` + `launchctl load -w` each plist for the new path to take effect.
2. **Project-side scripts** were intentionally left at hard-coded `/Users/stew/` rather than `$HOME` because they're co-mingled with cron-comment examples that document the actual install path. Fine to leave them as cron-doc — they're not executed from those comments. Real entrypoints (`scripts/refresh-site-metrics.sh`) already use `$(cd "$(dirname "$0")/.." && pwd)` for repo root.
3. **`.claude/` symlinks / paths** under `/Users/stew/.claude/` — Claude Code's project memory dir is keyed off CWD (`/Users/stew/.claude/projects/-Users-stew-scaria-swarm-fund-mvp/memory/`). Renaming the home dir without re-keying would orphan the memory. Move the project memory dir to the new key (`-Users-tomscaria-scaria-swarm-fund-mvp` if the project path moves too).
4. **Vercel / GitHub / cron remote** — already on `tomscaria` accounts; no change needed.

**Detection:** if `git grep "/Users/stew/"` ever returns matches in `infra/launchd/`, the macOS rename hasn't been propagated yet.
