---
layout: default
title: "Skills"
permalink: /skills/
---

# Skills

Aeon ships with **69 skills** across **10 packs**. Each skill is a self-contained markdown instruction file in `skills/<name>/SKILL.md`. Enable any skill in `aeon.yml` and it runs on its schedule (schedules live in `aeon.yml`; many skills also accept a `var` selector — see the skill's frontmatter).

Install any skill into your own agent:
```bash
./add-skill aaronjmars/aeon <skill-name>
```

> Authoritative catalog: [`skills.json`](../skills.json) + [`packs.json`](../packs.json), or the dashboard **Packs** view. This page is generated from them.

---

## Core (`core`, 9)

| Skill | Description |
|-------|-------------|
| `autoresearch` | Evolve a skill by generating variations, evaluating them, and updating the best version |
| `cost-report` | API cost intelligence — the full weekly report (dollar costs from token usage, anomaly flags, burn forecast, concrete optimizations) plus a `watch` budget watchdog that checks running weekly spend against a cap and alerts on WATCH/WARN/ALERT tiers |
| `create-skill` | Generate a complete new skill from a one-line prompt and ship it as a PR |
| `digest` | Generate and send a digest on a configurable topic, optionally pulling RSS/Atom feeds as an input source alongside web + X signal |
| `heartbeat` | Ambient fleet-health check that surfaces anything worth attention (default), or an on-demand priority brief — the 3 things to focus on, why now, and what moved (var=brief) |
| `install-skill` | Install a community skill pack into this fork from a GitHub repo and ship it as an auto-merged PR |
| `self-improve` | Improve the agent itself, or audit its recent performance — better skills, prompts, workflows, and config, plus a quality/reliability/memory-hygiene review of what the agent did and what failed |
| `skill-health` | Fleet skill observability with two views. Health view audits per-skill metrics, files/resolves issues in memory/issues/, and notifies on state change only. Analytics view ranks the fleet by 7d run count, surfaces success rates, exit-taxonomy distribution, and anomaly flags (significance-gated). The selector picks the view. |
| `skill-repair` | Diagnose and fix failing or degraded skills automatically — systemic-first triage, per-category playbooks, verification plan |

---

## Fleet & Replication (`fleet`, 5)

| Skill | Description |
|-------|-------------|
| `deploy-prototype` | Generate a small app or tool and deploy it live to Vercel via API |
| `distribute-tokens` | Two-phase contributor rewards — computes a tier-priced reward plan from the repo's merged-PR contributor ranking (plan phase) and executes the on-chain send via Bankr Wallet API with per-recipient idempotency, resolve→execute, dry-run, and partial-run recovery (send phase). Run either phase alone or both back-to-back. |
| `fleet-control` | Operate managed Aeon instances registered in memory/instances.json — health-check, dispatch skills, and full status snapshots (control view), plus a fleet-wide scorecard of runs, tokens (OpenRouter shape), est. cost and reliability with day-over-day deltas and alerts (scorecard view) |
| `spawn-instance` | Clone this Aeon agent into a new GitHub repo — fork, configure skills, validate, register in fleet |
| `vuln-scanner` | Audit trending repos for real security vulnerabilities and disclose responsibly — scan and route findings (PVR / dependency PR), re-submit queued advisories when a watched repo enables private reporting, and auto-send armed out-of-band email disclosures via Resend |

---

## Research & Content (`research`, 6)

| Skill | Description |
|-------|-------------|
| `article` | Write a publication-ready article in one of three angles — a general trending long-form piece (or a single-mechanism technical explainer), a thesis-driven article about a watched repo, or a project-through-a-lens essay. Optionally generate a Replicate hero image with --visual. |
| `bd-radar` | Business-development radar across your product family — find who's building, forking, integrating, and mentioning your products, then rank them into a who-to-talk-to-this-week lead list with a suggested next move per lead |
| `fetch-tweets` | Search and curate X/Twitter behind one selector — by keyword/query, topic roundup, a single account or a tracked-account digest, an X list, or the AI-agent "buzz" preset — clustered into sub-narratives with signal-scored, insight-per-item output. |
| `idea-forge` | Three-mode idea engine. generate — collide the week's zeitgeist with what the operator can ship now into 3-5 wedges scored by timing-window/fit/edge, appended to the shared backlog. validate — viability-screen and score the startup-idea backlog (competition, funding, timing, operator-fit, market size). memo — 2 evidence-backed startup memos with ICP, wedge, monetization, cited pain, and numeric kill criteria. |
| `last30` | Cross-platform social research — narrative-first intelligence on what people are saying about a topic across Reddit, X, HN, Polymarket, and the web over the last 30 days |
| `narrative-convergence` | Cross-skill signal detector — finds entities or themes surfaced independently by 3+ different skill categories within 48h and surfaces them as high-confidence write opportunities |

---

## Dev & Code (`dev`, 18)

| Skill | Description |
|-------|-------------|
| `auto-merge` | Automatically merge open PRs that have passing CI, no blocking reviews, and no conflicts |
| `auto-workflow` | Two-mode aeon.yml workflow builder — (analyze) inspect one or more URLs and emit a tiered, signal-verified skill-enablement plan plus an aeon.yml diff, or (enable) flip enabled:false→true for a slug list, validating against skills/ and opening a PR. The analyze mode recommends what to turn on; the enable mode turns it on. |
| `changelog` | Generate a user-facing changelog from recent commits/PRs across watched repos — write it in-repo (Keep a Changelog format), or with push-to open a cross-repo changelog PR on a marketing/docs website repo |
| `code-health` | Report on TODOs, dead code, and test coverage gaps |
| `ecosystem-pulse` | One weekly pass over ECOSYSTEM.md covering both project liveness (stars / forks / last-push recency + new releases for any project that resolves to a GitHub repo) AND link-health (URL audit of every link in every row — archived/disabled GitHub repos, HTTP 4xx/5xx dead links, cross-host redirects). Runs both branches by default; scope with var=liveness\|links. |
| `feature` | Build, enhance, or revive GitHub repos — sweep every watched repo and ship one feature PR each (watched), make the best single enhancement on one external repo or issue (external), or reactivate the highest-scoring dormant repo (dormant); optional --fix-issues bias |
| `fork-fleet` | Fork divergence monitor — tracks where the fleet's active forks diverge in CODE (unique commits, new/modified skills, upstream-contribution candidates) and in CONFIG (enable/disable/var/model/schedule decisions vs upstream defaults), and gates notifications on real change |
| `github-monitor` | Watch your GitHub repos across four selectable views — a combined urgency monitor (stale PRs, new issues, new releases), a ranked new-issue triage queue, a release upgrade-triage digest, and a tracker for PRs this aeon instance opened. Empty var = combined monitor; issues\|releases\|prs select a focused view. |
| `github-trending` | Curated trending across GitHub repos and the Hugging Face Hub (models, datasets, spaces) — filtered, clustered, and labeled by momentum, with a one-line "why notable" per pick. A source selector routes to either the GitHub repo layer or the HF artifact layer. |
| `inbox-triage` | Daily GitHub notification inbox triage — surfaces aging vuln PR replies, security advisories, review requests, and mentions that need action |
| `issue-triage` | Decision-ready triage — classify, dedupe, and emit a verdict + next action per new GitHub issue |
| `pr-review` | Review open PRs two ways — default is a per-PR deep review with severity-tagged findings, inline comments, and a one-line verdict; `--survey` runs a risk-tiered triage digest that buckets every open PR by touched-file blast radius (FAST_TRACK / INFRA_REVIEW / SKILL_PASS / SKILL_WARN_OR_BLOCK / CORE_REVIEW), runs skill-scan on every changed SKILL.md, and emits one operator digest of what's safe to merge first |
| `pr-triage` | First-touch triage for external pull requests — verdict + label + welcoming comment within minutes of open |
| `repo-scanner` | Unified GitHub fleet intelligence — catalog repos into a prioritized report with concrete coded opportunities (that downstream skills consume directly), generate anchored, implementable per-repo action ideas, and map who's building on the fleet (forks, third-party ecosystem repos, builder announcements). One scan, three facets, selected via a var scope keyword. |
| `search-skill` | Search the open agent skills ecosystem for skills that fill a real gap and install them via the native add-skill path |
| `star-milestone` | Two complementary star-growth jobs for watched repos in one pass. (1) CROSSING — announces when a repo crosses a star-count milestone (25, 50, 100, 150, 175, 200, 250, 500, 1000, ...) with a velocity-shaped narrative (time-to-milestone, growth shape, projection, tight highlight reel) and optionally auto-dispatches downstream skills (e.g. the `product-hunt` Show HN post via `product-hunt:showhn` at 500⭐) per the rule map in `memory/topics/milestone-dispatch.json`. (2) MOMENTUM — projects the date the next un-crossed milestone will be hit from the 7-day star growth-rate and fires a Show HN launch-timing alert only when that date lands in the dispatch window (7-14 days out, landing Tue/Wed/Thu). A default run reports crossings + momentum + next-milestone projection together. |
| `vuln-tracker` | One lifecycle poll over everything vuln-scanner produces — PR & advisory status (merges, stale opens, maintainer replies needing an answer, queued-too-long carve-outs), PVR triage-state transitions on submitted advisories, and pending-disclosure queue aging — with a stars-secured impact headline and a single operator-action queue. |
| `workflow-audit` | Audit .github/workflows and composite actions with zizmor + actionlint, classify findings against the prior audit, auto-fix Critical/High regressions, and open a PR only when something actually changed. |

---

## Crypto & Markets (`markets`, 16)

| Skill | Description |
|-------|-------------|
| `base-mcp` | Access a Base Account via the Base MCP server (mcp.base.org) — wallet, portfolio, sending, swapping, signing, x402 payments, batched contract calls, and transaction history across supported chains. |
| `ctrl` | Build on-chain automation workflows on Base via CTRL. Use for recurring or triggered actions — DCA, price-gated swaps, launchpad sniping, whale-follow — that should run autonomously after a single wallet signature. The wallet signs once (EIP-5792 batch), and the CTRL keeper executes every trigger after, bounded by per-swap and per-day caps the user pre-authorized. |
| `defi-overview` | One-pass crypto read — tracked-protocol positions/health plus macro context. Regime Take + DeFi verdict, biggest movers with "why it matters", sustainable-vs-incentive yields, fees fundamentals, breadth, Fear & Greed, prediction markets; refreshes memory/topics/market-context.md. |
| `fear-divergence` | Conditional scan — fires only when Fear & Greed < 25. Identifies assets outperforming during broad market fear, synthesizes narrative catalysts from memory, and delivers a terse conviction setup brief. Skips silently when market conditions don't qualify. |
| `monitor-polymarket` | Monitor Polymarket and/or Kalshi prediction markets for 24h price moves, volume changes, fresh comments, and high-conviction alerts |
| `narrative-tracker` | Track rising, peaking, and fading crypto/tech narratives with quantitative mindshare + velocity signals and explicit positioning calls |
| `onchain-monitor` | Monitor blockchain addresses and contracts for notable activity |
| `picks-tracker` | Retrospective on past token and prediction market picks — what hit, what flopped, what the score is |
| `pm-manipulation` | Detect suspected manipulation on prediction markets over the past 3 days by cross-referencing price/volume/comment anomalies with multilingual local-press coverage |
| `pm-pulse` | Prediction-market & coordination-market tracker — volume, new mechanism designs, regulatory moves, plus competitive intel on what platforms ship and who's entering |
| `price-alert` | Fire when the tracked token does something — new ATH, sharp 1h move, or operator-set target crossed. Silent on normal days. |
| `token-movers` | Crypto market scanner + single-token analyst. Movers mode scans top winners/losers/trending (CoinGecko) or on-chain "runners" (GeckoTerminal) with signal enrichment and pump-risk flags; single-token mode produces a verdict-first deep report (price, volume, liquidity, treasury, social) for one address or symbol. |
| `token-pick` | One token recommendation and one prediction market pick — scored, quantified, with a skip branch when signals are weak |
| `treasury-info` | Decision-ready treasury overview — verdict, concentration, depegs, significant changes |
| `unlock-monitor` | Token unlock and vesting tracker — quantify supply pressure via absorption ratio, classify cliff vs linear, deliver one-line market reads |
| `x402-monitor` | Configurable weekly vertical/ecosystem tracker. Defaults to x402 (agent micropayments); preset selectors track RWA tokenization, the AI compute market, the MCP ecosystem, or AI agent job-displacement — each with its own sources, scoring, and output format. Repoint the default protocol via memory/topics/tracked-protocol.md. |

---

## Onchain Security (`hound`, 3)

| Skill | Description |
|-------|-------------|
| `investigation-report` | One-shot composite investigation of a Base token — a single report that runs any subset of six onchain-security analyzers (rug-scan, contract-audit, deployer-trace, holder-concentration, honeypot-check, lp-lock) behind a selector and merges them into one at-a-glance verdict. Each check preserves its full standalone logic, so selecting a single check reproduces that analyzer exactly. Keyless core; a Basescan/Etherscan key or custom Base RPC deepens it. |
| `tx-explain` | Decode any Base transaction into a plain-English story — method, token movements, swaps/approvals, counterparties, and suspicious-approval flags. Keyless via Base RPC + Etherscan v2. |
| `wallet-profile` | One read-only wallet-analysis skill for Base with six modes — behavioral profile (default), balance digest, drain-risk audit (approvals + honeypot + severity), live approval inventory, same-entity clustering, and multi-hop fund-flow tracing with a Mermaid graph. Keyless via Etherscan v2 + Base RPC; optional Basescan key deepens history. Analysis only — never revokes, never sends a transaction. |

---

## Social & Writing (`social`, 5)

| Skill | Description |
|-------|-------------|
| `mention-radar` | Monitor external web and social mentions of the operator's active projects — surface what people are discovering, where they're confused, and where to engage |
| `reply-maker` | Draft copy-paste-ready X replies — either two reply options per reply-worthy tweet from tracked accounts/topics/lists (default), or (from-logs mode) ready-to-post responses to engagement opportunities flagged in recent logs |
| `schedule-ads` | Manage paid ads on AdManage.ai from declarative config. Default branch schedules ad launches across Meta/TikTok/Snapchat/Pinterest/LinkedIn (PAUSED by default, never auto-activates live spend); `create` branch provisions Meta campaigns + ad sets (created PAUSED, IDs written back to state so the schedule branch can launch into them). |
| `soul-builder` | Build a SOUL from an X handle — read a wide sample of someone's public X account, then draft soul/SOUL.md (identity, worldview, opinions, influences), soul/STYLE.md (voice), and soul/examples/good-outputs.md so every content skill can speak in that voice. |
| `write-tweet` | Multi-format tweet studio — standalone drafts (10 across 5 size tiers), a 5–10 tweet thread, or 10 remixes of past tweets, selected via ${var} |

---

## Productivity (`productivity`, 5)

| Skill | Description |
|-------|-------------|
| `action-converter` | 5 concrete real-life actions, leverage-scored against open loops with specificity and anti-fluff gates |
| `idea-pipeline` | Execution-gap audit — cross-references the startup idea backlog against shipped skills, prototypes, and cross-repo PRs. Surfaces the top 3 ideas to build next based on narrative fit and operator fit. |
| `send-email` | Compose and send a one-off email to a named recipient via Resend — written in the operator's voice, staged locally, then sent in postprocess with caps and an operator audit copy |
| `shiplog` | Recap of everything shipped since the last run — cross-repo PRs and commits, security fixes merged into other people's repos, star deltas, and X + ecosystem traction — synthesized into a digest article AND a ready-to-post shiplog in the operator's voice. Cadence-agnostic: schedule it daily, weekly, or on-demand. |
| `strategy-builder` | Draft STRATEGY.md from a goal — read the operator's brief (goal text, repo, links) plus the repo README + memory, then write a tight north-star/priorities/audience/constraints strategy that every skill reads on every run. |

---

## Agent Ops (`agent-ops`, 2)

| Skill | Description |
|-------|-------------|
| `memory-flush` | Promote important recent log entries into MEMORY.md and prune stale ones |
| `operator-scorecard` | Three recap modes behind one selector — (default) a plain-language operator scorecard synthesizing agent health + community growth + economic activity into a was-it-worth-it verdict; `ops` an operational day-recap of what Aeon shipped, what failed, and what needs a human call; `push` a diff-reading deep-dive that ranks push impact and separates user-visible shipments from internal work. |

---

## Installing Skills

```bash
# Install a single skill
./add-skill aaronjmars/aeon article

# Install multiple skills
./add-skill aaronjmars/aeon article digest heartbeat

# Install everything
./add-skill aaronjmars/aeon --all

# Browse available skills
./add-skill aaronjmars/aeon --list
```

Installed skills land in `skills/` and appear in `aeon.yml` as disabled. Flip `enabled: true` to activate.
