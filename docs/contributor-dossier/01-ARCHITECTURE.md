# Architecture

A single-page picture of how Aeon's parts fit together, with the data flow that ties them.

---

## The whole picture

```
                              ┌─────────────────────────┐
                              │   GitHub Actions cron   │  every 5 min
                              │   (messages.yml tick)   │
                              └────────────┬────────────┘
                                           │
                            ┌──────────────┴───────────────┐
                            │                              │
                ┌───────────▼──────────┐      ┌────────────▼──────────────┐
                │  Cron matcher reads  │      │  Reactive trigger reads   │
                │  aeon.yml + cron-    │      │  cron-state.json — fires  │
                │  state.json — picks  │      │  skills on conditions     │
                │  skills to dispatch  │      │  (consecutive_failures≥3) │
                └───────────┬──────────┘      └────────────┬──────────────┘
                            │                              │
                            └──────────┬───────────────────┘
                                       │
                                       ▼  gh workflow run aeon.yml -f skill=…
                              ┌─────────────────┐
                              │   aeon.yml      │  21 steps
                              │ (workflow_call) │
                              │                 │
                              │  1. validate    │
                              │  2. install     │
                              │  3. prefetch ───┼──> scripts/prefetch-*.sh
                              │                 │     (auth, full env)
                              │  4. Fleet pre   │
                              │     flight ─────┼──> Fleet Watcher /api/aeon/preflight
                              │                 │
                              │  5. claude -p - ┼──> reads SKILL.md
                              │     (sandboxed) │     reads memory/
                              │                 │     reads .outputs/<deps>.md
                              │                 │     writes .pending-*/ memory/
                              │                 │     calls ./notify ───────────┐
                              │                 │                                │
                              │  6. quality     │  Haiku scores 1-5              │
                              │     scoring     │  writes memory/skill-health/   │
                              │                 │                                │
                              │  7. ./notify-   │  Haiku converts md to spec     │
                              │     jsonrender ─┼──> dashboard/outputs/          │
                              │                 │                                │
                              │  8. retry pend- │                                │
                              │     ing notify  │                                │
                              │                 │                                │
                              │  9. postprocess─┼──> scripts/postprocess-*.sh    │
                              │                 │     (auth, side-effects)       │
                              │                 │                                │
                              │ 10. Fleet post  │                                │
                              │     flight      │                                │
                              │                 │                                │
                              │ 11. commit      │  rebase-resolves memory/* ◄────┘
                              │ 12. update      │
                              │     cron-state  ┼──> memory/cron-state.json
                              └─────────────────┘             │
                                                              ▼
                          ┌────────────────────────────────────────────┐
                          │  Next tick's heartbeat reads cron-state    │
                          │  → skill-health classifies                 │
                          │  → if CRITICAL, files memory/issues/       │
                          │  → if consecutive_failures≥3, the reactive │
                          │     trigger fires skill-repair             │
                          │  → skill-repair opens a fix PR             │
                          │  → skill-evals next run flips issue to     │
                          │     resolved when fix lands                │
                          └────────────────────────────────────────────┘
```

This is the **closed loop**. Everything else (dashboard, MCP, A2A, fleet, soul) is a side-channel onto the same primitives.

---

## The three execution surfaces

Aeon exposes the same `SKILL.md` files through three execution paths:

| Surface | Trigger | Where it runs | Auth | Side-effects |
|---|---|---|---|---|
| **GitHub Actions** | Cron, label, dispatch | GitHub runner sandbox | Repo secrets | Full (notify, commits, prefetch/postprocess) |
| **MCP server** | Claude Desktop / Code / any MCP host | Operator's machine | Operator's `ANTHROPIC_API_KEY` / OAuth | None — output returned to host only |
| **A2A gateway** | Any HTTP agent (LangChain, AutoGen, …) | Operator's machine | None by default | None — output returned to caller only |

The MCP and A2A surfaces shell to `claude -p -` exactly like the workflow does — same skill prose, same allowlist, same prompt-injection rules. The only difference is what happens after the skill completes (notify/commit/postprocess only in Actions).

---

## Data flow: skill ↔ memory

A skill in the middle of execution interacts with **five** layers of file state:

```
                        ┌───────────────────────────────────────┐
                        │   memory/MEMORY.md  (index, ≤50 lines)│
                        │      │                                │
                        │      ▼                                │
                        │   memory/topics/*.md  (long-form)     │  read
        SKILL.md  ◄─────┤   memory/logs/*.md    (history)       │◄─── prose
        (the           │   memory/skill-health/*.json (quality) │     decides
         agent)        │   memory/state/*.json   (bookkeeping)  │     what
                        │   memory/cron-state.json (scheduling)  │     to read
                        │                                       │
                        └───────────────────────────────────────┘
                                          │
                                          │ writes
                                          ▼
                        ┌───────────────────────────────────────┐
                        │   memory/logs/${today}.md             │  always
                        │   memory/topics/<topic>.md            │  freq
                        │   memory/state/<skill>.json           │  bookkeeping
                        │   articles/<skill>-${today}.md        │  content
                        │   .outputs/<skill>.md                 │  auto, chain-passable
                        │   .pending-<service>/<id>.json        │  side-effect queue
                        └───────────────────────────────────────┘
```

The runtime ([`aeon.yml`](../../.github/workflows/aeon.yml)) commits everything under `memory/`, `articles/`, `docs/` at the end. The `.outputs/<skill>.md` file is auto-populated from `.pending-<skill>.md` or `/tmp/skill-result.txt` and committed too — that's the file downstream chain steps `consume:`.

---

## Composition primitives

Three ways skills combine:

### `var` — universal input

Every skill takes one `var`. The shape is skill-specific but the channel is uniform:

```
workflow_dispatch input → per-skill default in aeon.yml → frontmatter default
```

A skill that wants two parameters has to encode them in the var string (e.g. `var: "owner/repo#42"`). The MCP and A2A surfaces respect the same var shape.

### Chains — file-passed composition

```yaml
chains:
  morning-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast
    steps:
      - parallel: [token-movers, hacker-news-digest]
      - skill: morning-brief
        consume: [token-movers, hacker-news-digest]
```

`chain-runner.yml` dispatches each step as a `workflow_call`, waits for it, then for the next. `consume:` concatenates upstream `.outputs/<dep>.md` into a chain context file that downstream skills receive as `chain_context_file`.

The composition primitive is **a file on disk**. You can debug any chain by running upstream skills first and inspecting the file before wiring up the consumer.

### Reactive — event-driven

```yaml
reactive:
  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
```

Evaluated every tick by `messages.yml`. Conditions are about state in `cron-state.json` (`consecutive_failures`, `last_status`). Use sparingly — this is a circuit-breaker primitive, not a general event bus.

---

## Trust + control plane

Optional layers, off by default:

```
                                  ┌─────────────────────┐
            Operator              │   Fleet Watcher     │  ALLOW/BLOCK auth
            decision   ───────────┤   /api/aeon/        │  per skill run
                                  │   preflight         │  (out-of-tree)
                                  └──────────┬──────────┘
                                             │
                                             │ inline gate in
                                             ▼ aeon.yml steps
                                  ┌─────────────────────┐
                                  │  Bankr LLM Gateway  │  routes claude -p -
                                  │  https://llm.bankr  │  through bankr instead
                                  │  .bot               │  of api.anthropic
                                  └─────────────────────┘
```

Set `FLEET_ENDPOINT` + `FLEET_TOKEN` → preflight runs, fails closed on errors. Set `gateway: { provider: bankr }` + `BANKR_LLM_KEY` → routing flips to Bankr's gateway, unlocking GPT/Gemini/Kimi/Qwen.

---

## Distribution plane

Aeon's outputs reach humans through five channels and the public site:

```
   Skill output (markdown)
            │
   ┌────────┼─────────────────────────────────┐
   │        │                                 │
   ▼        ▼                                 ▼
./notify   ./notify-jsonrender              git commit
   │        │                                 │
   ├─Telegram  (TELEGRAM_BOT_TOKEN)       articles/<skill>-${today}.md
   ├─Discord   (DISCORD_WEBHOOK_URL)        │
   ├─Slack     (SLACK_WEBHOOK_URL)          ▼
   ├─Email     (SENDGRID_API_KEY)         docs/ (Jekyll) ──> GitHub Pages site
   │                                       │                  + RSS feed
   │        │                              ▼
   │        ▼                          docs/status.md (heartbeat-written)
   │   dashboard/outputs/*.json
   │        │
   │        ▼
   │   Next.js dashboard renders via
   │   @json-render/react
   │
   ▼
.pending-notify/*.md (retry queue, dedup-by-hash)
```

Inbound (Telegram / Discord / Slack messages) → `messages.yml` `run` job → Claude with the message as a prompt → response via the same `./notify`.

---

## Fleet plane

Two kinds of fleet, both observable through the same skills:

- **Managed instances** — `spawn-instance` creates a fork, registers in `memory/instances.json`. `fleet-control` health-checks and dispatches to them.
- **Wild forks** — anyone who clicks Fork. Enumerated via the GitHub API by `fork-fleet`, `fork-cohort`, `fork-skill-digest`, `fork-contributor-leaderboard`, `fork-first-run-alert`, `fork-release-tracker`.

The signal back upstream is the `DEFAULT_FLIP` flag: when 2+ forks independently flip the same `aeon.yml` default, the weekly digest flags it as a candidate for upstream adoption.

---

## What you should read next

- **Want the per-subsystem deep-dive?** → [`03-subsystems/`](03-subsystems/).
- **Want to write a skill?** → [`06-IMPLEMENTATION-PATTERNS.md`](06-IMPLEMENTATION-PATTERNS.md).
- **Want to understand the security posture?** → [`05-SECURITY.md`](05-SECURITY.md).
- **Want to know what's still being figured out?** → [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md).
- **Want to see where this could go next?** → [`09-EXPANSION-OPTIONS.md`](09-EXPANSION-OPTIONS.md).
