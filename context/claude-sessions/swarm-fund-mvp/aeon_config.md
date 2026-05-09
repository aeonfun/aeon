---
name: Aeon configuration — cloud-side companion to swarm-fund-mvp
description: 6 GitHub-Actions skills enabled, fully orthogonal to Mac launchd loops
type: project
originSessionId: 07e0fd63-5c10-47dd-9875-df2c9f852fef
---
**Repo:** `aaronjmars/aeon` (forked to `tomscaria/aeon` once Thomas pushes).
**Config location:** `/Users/scaria/aeon-config/aeon/aeon.yml`.
**Deploy guide:** `/Users/scaria/aeon-config/aeon/AEON_DEPLOY.md`.
**Pre-deploy gate:** queued in `outputs/manual_tasks_thomas.md` under "Aeon deployment".

**Why:** runs scheduled, non-trading-loop work in GitHub Actions cloud — never touches the Mac launchd processes (`ai.rswarm.trading-loop` / `ai.rswarm.api` / `ai.rswarm.docker-up`) so there's zero contention. Inherent disposability if Path B (EC2) absorbs some of these later.

**6 task skills enabled (all with context-tuned `var:` payloads):**
- `pr-review` — daily 09:00 UTC — auto-reviews parallel-session PRs against ADRs + CLAUDE.md.
- `monitor-polymarket` — daily 12:30 — qualitative tracking on Revenant builder-attributed + watched markets (orthogonal to our Python scanner's calibration math).
- `polymarket-comments` — daily 13:00 — comment-thread alpha; info asymmetry the scanner doesn't catch.
- `paper-pick` — daily 14:00 — ArXiv pick aligned to Stanford PhD prep (Dec 2026) + autoresearch backlog.
- `evening-recap` — daily 21:00 — Telegram digest (scan count, Revenant orders, NAV delta, top surfaces).
- `weekly-shiplog` — Mondays 09:00 — LP-ready narrative from last week's commits + ADRs + memory.
- `heartbeat` (default-on) — liveness check, 8/14/20 UTC.

**How to apply:**
- When new "I want this checked daily but don't want to think about it" need surfaces, prefer flipping an Aeon skill on (and tuning its `var:`) over writing a new launchd plist or systemd unit.
- When a parallel session adds a recurring task to `manual_tasks_thomas.md`, check Aeon's skill catalog first — if there's a match, just toggle and `var:` it.
- Once Path B (EC2) lands, decide per skill: keep on Aeon (cloud-orthogonal) or migrate to a systemd timer alongside the trading loop. Most stay on Aeon.

**Cost:** ~$30–90/mo Anthropic API (covered by Research Credits) + $0 GitHub Actions on Pro tier. Zero out of pocket.
