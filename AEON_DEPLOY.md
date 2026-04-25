# Aeon for Swarm Lab — deployment status

Companion to `tomscaria/swarm-fund-mvp`. Runs in GitHub Actions, fully orthogonal to the Mac launchd loops (`ai.rswarm.trading-loop` / `ai.rswarm.api` / `ai.rswarm.docker-up` / `ai.rswarm.metrics`).

## What's enabled

The full 92-skill catalog is on (per the `b851a79: enable all 92 skills — full spec, OODA-loop autonomy` commit). Most run with default prompts; six carry context-tuned `var:` payloads anchored to swarm-fund-mvp specifics.

| Skill | `var:` highlight |
|---|---|
| `pr-review` | review parallel-session PRs against ADRs + CLAUDE.md conventions |
| `monitor-polymarket` | watched markets include Revenant builder code `0xcddc4ba3…8286f` |
| `polymarket-comments` | narrative-shift mining (info asymmetry the quant scanner misses) |
| `paper-pick` | Stanford PhD prep — calibration, agentic finance, FinCon-style RL |
| `evening-recap` | Telegram digest: scan count, Revenant orders, NAV delta |
| `weekly-shiplog` | LP-ready narrative from commits + ADRs + memory updates |

The other 86 skills run with framework defaults — fine for OODA-loop discovery; tighten with `var:` as you observe which deliver value.

## Pre-deploy checklist

- [x] Fork `aaronjmars/aeon` → `tomscaria/aeon` (created 2026-04-25)
- [x] Push customized `aeon.yml`
- [ ] Add 3 GitHub Secrets at `tomscaria/aeon → Settings → Secrets → Actions`:
  - `ANTHROPIC_API_KEY` — from `~/.zshenv` or shell env
  - `TELEGRAM_BOT_TOKEN` — from `swarm-fund-mvp/.env`
  - `TELEGRAM_CHAT_ID` — from `swarm-fund-mvp/.env`
- [ ] Trigger heartbeat: `gh workflow run heartbeat.yml -R tomscaria/aeon`

## Cost projection

92 skills × ~$0.05–0.30 per run × varying frequencies ≈ **$200–500/mo Anthropic API**. Covered by Anthropic Research Credits. GitHub Actions on Pro free tier handles the workflow minutes.

## Known tension with disciplined-6 plan

A previous draft enabled only 6 narrowly-scoped skills. The current parallel-session choice is "enable everything, prune later from observed signal." Both are valid; the OODA approach wins on discovery speed and loses on prompt-engineering precision. If skill output starts to feel noisy after a week, the path is to disable the bottom-quartile rather than re-narrow upfront.
