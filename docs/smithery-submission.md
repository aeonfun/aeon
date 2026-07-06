---
type: Reference
---

# Aeon — Smithery / MCP Registry Submission
*Generated from `skills.json` (the `smithery-manifest` skill was retired in #566). Regenerate by re-deriving from `skills.json` when the skill catalog changes.*

## Submission targets

| Registry | Form URL | Manifest file to point at |
|----------|----------|---------------------------|
| Smithery | https://smithery.ai/server/new | `docs/smithery.yaml` (this repo) |
| MCP Registry | https://github.com/modelcontextprotocol/registry → submit a PR adding `servers/io.github.aaronjmars/aeon-mcp.json` | `docs/smithery-manifest.json` (this repo) |

## Field values (copy/paste)

- **Name:** `io.github.aaronjmars/aeon-mcp`
- **Title:** Aeon
- **Version:** 1.0.0
- **Repository URL:** https://github.com/aaronjmars/aeon
- **Subfolder:** `apps/mcp-server`
- **Website URL:** https://github.com/aaronjmars/aeon
- **Transport:** stdio
- **Auth required:** no (reads operator's `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from env)
- **Tags:** `agent`, `automation`, `github-actions`, `crypto`, `research`, `social`, `dev`

## Description (short — for the listing card)

The most autonomous agent framework — give it a direction and it leverages 59 skills like deep research, PR reviews, market monitoring, and Vercel deploys.

## Description (long — for the listing body)

Aeon is an autonomous agent framework that runs on GitHub Actions and exposes its 59 skills as MCP tools so any Claude Desktop or Claude Code session can invoke them directly. The catalog spans Basics (13), Crypto & Markets (12), Core (11), Dev & Code (8), Productivity (8), and Evolution (7) — the self-improvement loop that authors, evolves, installs, and heals its own skills (create-skill, autoresearch, skill-repair). Each MCP tool maps 1:1 to an Aeon skill — calling `aeon-digest` from Claude Desktop runs the same prompt that the scheduled cron runs. The server speaks stdio, requires no extra API keys, and reuses whichever Claude credential is already configured for the operator.


## Tool catalog (59 tools)

| Tool | Category | Description |
|------|----------|-------------|
| `aeon-action-converter` | Basics | 5 concrete real-life actions, leverage-scored against open loops with specificity and anti-fluff gates |
| `aeon-article` | Basics | Write a publication-ready article in one of three angles — a general trending long-form piece (or a single-mechanism technical explainer), a thesis-driven article about a watched repo, or a project-through-a-lens essay. Optionally generate a Replicate hero image with --visual. |
| `aeon-auto-merge` | Core | Automatically merge open PRs that have passing CI, no blocking reviews, and no conflicts |
| `aeon-auto-workflow` | Core | Two-mode aeon.yml workflow builder — (analyze) inspect one or more URLs and emit a tiered, signal-verified skill-enablement plan plus an aeon.yml diff, or (enable) flip enabled:false→true for a slug list, validating against skills/ and opening a PR. The analyze mode recommends what to turn on; the enable mode turns it on. |
| `aeon-autoresearch` | Evolution | Evolve a skill by generating variations, evaluating them, and updating the best version |
| `aeon-base-mcp` | Crypto | Access a Base Account via the Base MCP server (mcp.base.org) — wallet, portfolio, sending, swapping, signing, x402 payments, batched contract calls, and transaction history across supported chains. |
| `aeon-bd-radar` | Basics | Business-development radar across your product family — find who's building, forking, integrating, and mentioning your products, then rank them into a who-to-talk-to-this-week lead list with a suggested next move per lead |
| `aeon-changelog` | Dev | Generate a user-facing changelog from recent commits/PRs across watched repos — write it in-repo (Keep a Changelog format), or with push-to open a cross-repo changelog PR on a marketing/docs website repo |
| `aeon-create-skill` | Evolution | Generate a complete new skill from a one-line prompt and ship it as a PR |
| `aeon-ctrl` | Crypto | Build on-chain automation workflows on Base via CTRL. Use for recurring or triggered actions — DCA, price-gated swaps, launchpad sniping, whale-follow — that should run autonomously after a single wallet signature. The wallet signs once (EIP-5792 batch), and the CTRL keeper executes every trigger after, bounded by per-swap and per-day caps the user pre-authorized. |
| `aeon-defi-overview` | Crypto | One-pass crypto read — tracked-protocol positions/health plus macro context. Regime Take + DeFi verdict, biggest movers with "why it matters", sustainable-vs-incentive yields, fees fundamentals, breadth, Fear & Greed, prediction markets; refreshes memory/topics/market-context.md. |
| `aeon-deploy-prototype` | Dev | Generate a small app or tool and deploy it live to Vercel via API |
| `aeon-digest` | Basics | Generate and send a digest on a configurable topic, optionally pulling RSS/Atom feeds as an input source alongside web + X signal |
| `aeon-distribute-tokens` | Crypto | Two-phase contributor rewards — computes a tier-priced reward plan from the repo's merged-PR contributor ranking (plan phase) and executes the on-chain send via Bankr Wallet API with per-recipient idempotency, resolve→execute, dry-run, and partial-run recovery (send phase). Run either phase alone or both back-to-back. |
| `aeon-feature` | Dev | Build, enhance, or revive GitHub repos — sweep every watched repo and ship one feature PR each (watched), make the best single enhancement on one external repo or issue (external), or reactivate the highest-scoring dormant repo (dormant); optional --fix-issues bias |
| `aeon-fetch-tweets` | Basics | Search and curate X/Twitter behind one selector — by keyword/query, topic roundup, a single account or a tracked-account digest, an X list, or the AI-agent "buzz" preset — clustered into sub-narratives with signal-scored, insight-per-item output. |
| `aeon-fleet-control` | Core | Operate managed Aeon instances registered in memory/instances.json — health-check, dispatch skills, and full status snapshots (control view), plus a fleet-wide scorecard of runs, tokens (OpenRouter shape), est. cost and reliability with day-over-day deltas and alerts (scorecard view) |
| `aeon-fork-fleet` | Core | Fork divergence monitor — tracks where the fleet's active forks diverge in CODE (unique commits, new/modified skills, upstream-contribution candidates) and in CONFIG (enable/disable/var/model/schedule decisions vs upstream defaults), and gates notifications on real change |
| `aeon-github-monitor` | Dev | Watch your GitHub repos across four selectable views — a combined urgency monitor (stale PRs, new issues, new releases), a ranked new-issue triage queue, a release upgrade-triage digest, and a tracker for PRs this aeon instance opened. Empty var = combined monitor; issues\|releases\|prs select a focused view. |
| `aeon-github-trending` | Basics | Curated trending across GitHub repos and the Hugging Face Hub (models, datasets, spaces) — filtered, clustered, and labeled by momentum, with a one-line "why notable" per pick. A source selector routes to either the GitHub repo layer or the HF artifact layer. |
| `aeon-heartbeat` | Core | Ambient fleet-health check that surfaces anything worth attention (default), or an on-demand priority brief — the 3 things to focus on, why now, and what moved (var=brief) |
| `aeon-idea-forge` | Basics | Three-mode idea engine. generate — collide the week's zeitgeist with what the operator can ship now into 3-5 wedges scored by timing-window/fit/edge, appended to the shared backlog. validate — viability-screen and score the startup-idea backlog (competition, funding, timing, operator-fit, market size). memo — 2 evidence-backed startup memos with ICP, wedge, monetization, cited pain, and numeric kill criteria. |
| `aeon-idea-pipeline` | Productivity | Execution-gap audit — cross-references the startup idea backlog against shipped skills, prototypes, and cross-repo PRs. Surfaces the top 3 ideas to build next based on narrative fit and operator fit. |
| `aeon-inbox-triage` | Dev | Daily GitHub notification inbox triage — surfaces aging vuln PR replies, security advisories, review requests, and mentions that need action |
| `aeon-install-skill` | Evolution | Install a community skill pack into this fork from a GitHub repo and ship it as an auto-merged PR |
| `aeon-investigation-report` | Crypto | One-shot composite investigation of a Base token — a single report that runs any subset of six onchain-security analyzers (rug-scan, contract-audit, deployer-trace, holder-concentration, honeypot-check, lp-lock) behind a selector and merges them into one at-a-glance verdict. Each check preserves its full standalone logic, so selecting a single check reproduces that analyzer exactly. Keyless core; a Basescan/Etherscan key or custom Base RPC deepens it. |
| `aeon-last30` | Basics | Cross-platform social research — narrative-first intelligence on what people are saying about a topic across Reddit, X, HN, Polymarket, and the web over the last 30 days |
| `aeon-memory-flush` | Core | Promote important recent log entries into MEMORY.md and prune stale ones |
| `aeon-mention-radar` | Productivity | Monitor external web and social mentions of the operator's active projects — surface what people are discovering, where they're confused, and where to engage |
| `aeon-monitor-polymarket` | Crypto | Monitor Polymarket and/or Kalshi prediction markets for 24h price moves, volume changes, fresh comments, and high-conviction alerts |
| `aeon-narrative-convergence` | Core | Cross-skill signal detector — finds entities or themes surfaced independently by 3+ different skill categories within 48h and surfaces them as high-confidence write opportunities |
| `aeon-narrative-tracker` | Crypto | Track rising, peaking, and fading crypto/tech narratives with quantitative mindshare + velocity signals and explicit positioning calls |
| `aeon-okf-export` | Productivity | Backfill memory/topics into an OKF-conformant bundle by adding type frontmatter, then open a PR |
| `aeon-okf-ingest` | Productivity | Fetch, validate, and quarantine an EXTERNAL OKF knowledge bundle into memory/topics/ingested, then open a PR |
| `aeon-onchain-monitor` | Crypto | Monitor blockchain addresses and contracts for notable activity |
| `aeon-operator-scorecard` | Productivity | Three recap modes behind one selector — (default) a plain-language operator scorecard synthesizing agent health + community growth + economic activity into a was-it-worth-it verdict; `ops` an operational day-recap of what Aeon shipped, what failed, and what needs a human call; `push` a diff-reading deep-dive that ranks push impact and separates user-visible shipments from internal work. |
| `aeon-picks-tracker` | Crypto | Retrospective on past token and prediction market picks — what hit, what flopped, what the score is |
| `aeon-pm-manipulation` | Crypto | Detect suspected manipulation on prediction markets over the past 3 days by cross-referencing price/volume/comment anomalies with multilingual local-press coverage |
| `aeon-pr-review` | Basics | Review open PRs two ways — default is a per-PR deep review with severity-tagged findings, inline comments, and a one-line verdict; `--survey` runs a risk-tiered triage digest that buckets every open PR by touched-file blast radius (FAST_TRACK / INFRA_REVIEW / SKILL_PASS / SKILL_WARN_OR_BLOCK / CORE_REVIEW), runs skill-scan on every changed SKILL.md, and emits one operator digest of what's safe to merge first |
| `aeon-pr-triage` | Dev | First-touch triage for external pull requests — verdict + label + welcoming comment within minutes of open |
| `aeon-price-alert` | Basics | Fire when the tracked token does something — new ATH, sharp 1h move, or operator-set target crossed. Silent on normal days. |
| `aeon-reply-maker` | Productivity | Draft copy-paste-ready X replies — either two reply options per reply-worthy tweet from tracked accounts/topics/lists (default), or (from-logs mode) ready-to-post responses to engagement opportunities flagged in recent logs |
| `aeon-schedule-ads` | Productivity | Manage paid ads on AdManage.ai from declarative config. Default branch schedules ad launches across Meta/TikTok/Snapchat/Pinterest/LinkedIn (PAUSED by default, never auto-activates live spend); `create` branch provisions Meta campaigns + ad sets (created PAUSED, IDs written back to state so the schedule branch can launch into them). |
| `aeon-search-skill` | Evolution | Search the open agent skills ecosystem for skills that fill a real gap and install them via the native add-skill path |
| `aeon-self-improve` | Evolution | Improve the agent itself, or audit its recent performance — better skills, prompts, workflows, and config, plus a quality/reliability/memory-hygiene review of what the agent did and what failed |
| `aeon-send-email` | Productivity | Compose and send a one-off email to a named recipient via Resend — written in the operator's voice, staged locally, then sent in postprocess with caps and an operator audit copy |
| `aeon-shiplog` | Core | Recap of everything shipped since the last run — cross-repo PRs and commits, security fixes merged into other people's repos, star deltas, and X + ecosystem traction — synthesized into a digest article AND a ready-to-post shiplog in the operator's voice. Cadence-agnostic: schedule it daily, weekly, or on-demand. |
| `aeon-skill-health` | Evolution | Fleet skill observability with two views. Health view audits per-skill metrics, files/resolves issues in memory/issues/, and notifies on state change only. Analytics view ranks the fleet by 7d run count, surfaces success rates, exit-taxonomy distribution, and anomaly flags (significance-gated). The selector picks the view. |
| `aeon-skill-repair` | Evolution | Diagnose and fix failing or degraded skills automatically — systemic-first triage, per-category playbooks, verification plan |
| `aeon-soul-builder` | Core | Build a SOUL from an X handle — read a wide sample of someone's public X account, then draft soul/SOUL.md (identity, worldview, opinions, influences), soul/STYLE.md (voice), and soul/examples/good-outputs.md so every content skill can speak in that voice. |
| `aeon-spawn-instance` | Core | Clone this Aeon agent into a new GitHub repo — fork, configure skills, validate, register in fleet |
| `aeon-strategy-builder` | Core | Draft STRATEGY.md from a goal — read the operator's brief (goal text, repo, links) plus the repo README + memory, then write a tight north-star/priorities/audience/constraints strategy that every skill reads on every run. |
| `aeon-token-movers` | Basics | Crypto market scanner + single-token analyst. Movers mode scans top winners/losers/trending (CoinGecko) or on-chain "runners" (GeckoTerminal) with signal enrichment and pump-risk flags; single-token mode produces a verdict-first deep report (price, volume, liquidity, treasury, social) for one address or symbol. |
| `aeon-token-pick` | Crypto | One token recommendation and one prediction market pick — scored, quantified, with a skip branch when signals are weak |
| `aeon-tx-explain` | Basics | Decode any Base transaction into a plain-English story — method, token movements, swaps/approvals, counterparties, and suspicious-approval flags. Keyless via Base RPC + Etherscan v2. |
| `aeon-unlock-monitor` | Crypto | Token unlock and vesting tracker — quantify supply pressure via absorption ratio, classify cliff vs linear, deliver one-line market reads |
| `aeon-vuln-scanner` | Dev | Audit trending repos for real security vulnerabilities and disclose responsibly — scan and route findings (PVR / dependency PR), re-submit queued advisories when a watched repo enables private reporting, and auto-send armed out-of-band email disclosures via Resend |
| `aeon-vuln-tracker` | Dev | One lifecycle poll over everything vuln-scanner produces — PR & advisory status (merges, stale opens, maintainer replies needing an answer, queued-too-long carve-outs), PVR triage-state transitions on submitted advisories, and pending-disclosure queue aging — with a stars-secured impact headline and a single operator-action queue. |
| `aeon-write-tweet` | Basics | Multi-format tweet studio — standalone drafts (10 across 5 size tiers), a 5–10 tweet thread, or 10 remixes of past tweets, selected via ${var} |

## Install instructions for end users

```bash
# 1. Clone Aeon and build the MCP server
git clone https://github.com/aaronjmars/aeon
cd aeon/apps/mcp-server && npm install && npm run build
```

```jsonc
// 2. Add to Claude Desktop config
//    macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
//    Linux:   ~/.config/Claude/claude_desktop_config.json
//    Windows: %APPDATA%\Claude\claude_desktop_config.json
{
  "mcpServers": {
    "aeon": {
      "command": "node",
      "args": ["/absolute/path/to/aeon/apps/mcp-server/dist/index.js"]
    }
  }
}
```

3. Restart Claude Desktop. All 68 Aeon skills appear as `aeon-<slug>` tools.

## Notes for the maintainer

- The `aeon-mcp` npm package referenced by `packages[0].identifier` in `smithery-manifest.json` is **not yet published**. Either publish it (`cd apps/mcp-server && npm publish --access public`) or remove the `packages` block before submitting to the MCP Registry. Smithery's URL-based listing works without the npm publish.
- This document is regenerated by the `smithery-manifest` skill — re-run after every `skills.json` change to keep the tool catalog accurate.
- Category breakdown: Dev (30), Productivity (24), Research (17), Crypto (16), Social (8).
