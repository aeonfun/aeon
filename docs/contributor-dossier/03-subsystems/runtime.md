# Subsystem: Runtime

The GitHub Actions plumbing that turns a cron tick or an issue label into a running skill, scores it, persists state, and fans out side-effects.

---

## Three workflows, one runtime

All execution lives in `.github/workflows/`:

| File | Role | Triggered by |
|---|---|---|
| [`aeon.yml`](../../../.github/workflows/aeon.yml) | The skill runner. Executes one skill end-to-end. | `workflow_dispatch`, `workflow_call` (from chain-runner), `issues.labeled` |
| [`chain-runner.yml`](../../../.github/workflows/chain-runner.yml) | Orchestrates skill chains (parallel + sequential, with output passing). | `workflow_dispatch` (manual) or fired by `messages.yml` when a chain's cron matches |
| [`messages.yml`](../../../.github/workflows/messages.yml) | The scheduler **and** the inbound message poller. Two jobs: `tick` and `run`. | `cron: */5 * * * *`, plus webhook-style `repository_dispatch` |
| [`sync-upstream.yml`](../../../.github/workflows/sync-upstream.yml) | Pulls changes from `aaronjmars/aeon` into a fork. | Manual or cron |

The runtime is intentionally simple: there is no orchestrator service. `messages.yml` ticks every five minutes, decides what should run, and `gh workflow run`s the appropriate skill job.

## The tick — `messages.yml` job `tick`

Every five minutes, the `tick` job ([`messages.yml:36-466`](../../../.github/workflows/messages.yml#L36-L466)) does the following:

1. **Parse `aeon.yml`** ([`messages.yml:106-200`](../../../.github/workflows/messages.yml#L106-L200)) — extracts every enabled skill, its cron expression, its `var`, its `model`, its `depends_on` (read from the skill's frontmatter), the `chains:` block, and the `reactive:` block.
2. **Match the current time** against every cron expression. Supports `*`, `*/N`, `N-M`, `N,M`, `N/step`, `N-M/step` ([`messages.yml:68-95`](../../../.github/workflows/messages.yml#L68-L95)).
3. **Apply dedup** ([`messages.yml:190-199`](../../../.github/workflows/messages.yml#L190-L199)) — won't re-fire a skill within a 90-min window (or `interval*2 + 5` min if the cron is `*/N`). Prevents Actions latency from causing double-fires.
4. **Apply retry** ([`messages.yml:155-160`](../../../.github/workflows/messages.yml#L155-L160)) — if a skill failed and 30+ min have passed, re-mark it for dispatch.
5. **Apply catch-up** ([`messages.yml:175-185`](../../../.github/workflows/messages.yml#L175-L185)) — if a scheduled slot was missed (GH Actions can lag 5–15 min), still fire it in the next hour.
6. **Evaluate reactive triggers** ([`messages.yml:336-406`](../../../.github/workflows/messages.yml#L336-L406)) — for each reactive skill, check whether its `when:` condition (e.g. `consecutive_failures >= 3`) is satisfied by the current `memory/cron-state.json`. Wildcard `on: "*"` matches any skill.
7. **Order by `depends_on`** ([`messages.yml:209-220`](../../../.github/workflows/messages.yml#L209-L220)) — dependencies dispatch first, with a 5s wait before dependents ([`messages.yml:412-414`](../../../.github/workflows/messages.yml#L412-L414)).
8. **Dispatch** — `gh workflow run aeon.yml -f skill=<name>` for each matched skill ([`messages.yml:410-430`](../../../.github/workflows/messages.yml#L410-L430)). Matched chains dispatch `chain-runner.yml -f chain=<name>` instead.
9. **Update `memory/cron-state.json`** — persists per-skill execution metadata so the next tick can see what just fired.

**Important property:** `cron-state.json` is the source of truth for scheduling, *not* GitHub Actions run logs. Workflow logs are ephemeral; cron-state is committed to the repo and survives Actions retention.

## The skill run — `aeon.yml`

When dispatched, `aeon.yml` ([`.github/workflows/aeon.yml`](../../../.github/workflows/aeon.yml)) walks 21 steps. The interesting ones:

### Entry points

- **`workflow_dispatch`** ([`aeon.yml:5-10`](../../../.github/workflows/aeon.yml#L5-L10)) — inputs: `skill`, `model` (choice list), `var`, `chain_context_file`.
- **`workflow_call`** ([`aeon.yml:34-51`](../../../.github/workflows/aeon.yml#L34-L51)) — same inputs, invoked by `chain-runner.yml`.
- **`issues.labeled`** ([`aeon.yml:52-53`](../../../.github/workflows/aeon.yml#L52-L53)) — when an issue gets the `ai-build` label; hard-codes skill to `feature`.

### Pre-Claude

1. **Validate skill name** ([`aeon.yml:87-100`](../../../.github/workflows/aeon.yml#L87-L100)) — regex `^[a-zA-Z0-9_-]+$`. Refuses garbage.
2. **Install Claude Code** ([`aeon.yml:130-132`](../../../.github/workflows/aeon.yml#L130-L132)) — `npm install -g @anthropic-ai/claude-code`.
3. **Validate skill secrets** ([`aeon.yml:134-169`](../../../.github/workflows/aeon.yml#L134-L169)) — greps `SKILL.md` for `${VAR_*}` references, checks they're present as workflow env. Warns (not fails) on missing optional secrets.
4. **Run all `scripts/prefetch-*.sh`** ([`aeon.yml:171-191`](../../../.github/workflows/aeon.yml#L171-L191)) — outside the sandbox, full env access. Each receives `$SKILL` and `$VAR` as args. This is how auth-required data ([`scripts/prefetch-xai.sh`](../../../scripts/prefetch-xai.sh) for Grok, etc.) becomes available to the in-sandbox skill via the `.xai-cache/` and `.pending-*/` directories.
5. **Fleet Watcher preflight** ([`aeon.yml:204-240`](../../../.github/workflows/aeon.yml#L204-L240)) — if `FLEET_ENDPOINT` + `FLEET_TOKEN` are set, POST to `/api/aeon/preflight`. Fails closed on non-200. Audit ref returned for postflight pairing.

### Claude execution ([`aeon.yml:242-510`](../../../.github/workflows/aeon.yml#L242-L510))

- **Model resolution** ([`aeon.yml:280-286`](../../../.github/workflows/aeon.yml#L280-L286)) — priority: workflow input → per-skill `model:` in `aeon.yml` → global `model:` default (`claude-opus-4-7`).
- **Gateway routing** ([`aeon.yml:292-310`](../../../.github/workflows/aeon.yml#L292-L310)) — if `gateway.provider == bankr`, the request is routed through `https://llm.bankr.bot` using `BANKR_LLM_KEY` instead of direct Anthropic. Unlocks Gemini/GPT/Kimi/Qwen via Bankr.
- **`./notify` is injected** ([`aeon.yml:319-449`](../../../.github/workflows/aeon.yml#L319-L449)) — a shell script written to the workspace just for this run, fanning out to Telegram/Discord/Slack/Email if their secrets exist.
- **Allowed tools** ([`aeon.yml:451-456`](../../../.github/workflows/aeon.yml#L451-L456)) — `Read, Write, Edit, Glob, Grep, WebFetch, WebSearch`, plus an explicit Bash allowlist (`curl`, `gh`, `git`, `jq`, `./notify`, `mkdir`, `ls`, etc.). No raw shell.
- **Prompt build** ([`aeon.yml:461-480`](../../../.github/workflows/aeon.yml#L461-L480)) — concatenates today's date, the path to `SKILL.md`, the resolved `var`, and (for chained runs) the contents of the chain context file.
- **Dispatch** ([`aeon.yml:481-483`](../../../.github/workflows/aeon.yml#L481-L483)) — `claude -p - --model $MODEL --allowedTools $ALLOWED --output-format json`. The skill prompt arrives on stdin; the result returns as `{ result: "..." }` JSON.
- **Token usage capture** ([`aeon.yml:491-509`](../../../.github/workflows/aeon.yml#L491-L509)) — input, output, cache_read, cache_creation.

### Post-Claude

1. **Fleet Watcher postflight** ([`aeon.yml:518-555`](../../../.github/workflows/aeon.yml#L518-L555)) — always runs (`if: always()`). Maps step outcome to `ok | error | blocked`, POSTs to `/api/aeon/postflight`. Logs `chainsDetected` count as a taint-analysis signal.
2. **Log token usage** to `$GITHUB_STEP_SUMMARY` ([`aeon.yml:557-573`](../../../.github/workflows/aeon.yml#L557-L573)) and to `memory/token-usage.csv` ([`aeon.yml:575-583`](../../../.github/workflows/aeon.yml#L575-L583)).
3. **Capture output** ([`aeon.yml:585-599`](../../../.github/workflows/aeon.yml#L585-L599)) — copies `.pending-${SKILL}.md` or `/tmp/skill-result.txt` into `.outputs/${SKILL}.md`. This file is what chained downstream steps will `consume:`.
4. **Quality scoring** ([`aeon.yml:601-701`](../../../.github/workflows/aeon.yml#L601-L701)) — Haiku reads the output, scores 1–5 (Failed / Low / Acceptable / Good / Excellent), flags issues (`api_error`, `empty_output`, `stale_data`, `rate_limited`, `low_quality`, etc.). Appends to `memory/skill-health/${SKILL}.json` (rolling 30-run history, avg score). **Skipped for meta skills** (heartbeat, skill-health, skill-analytics, reflect, memory-flush, self-review, cost-report) — they don't need self-judgment.
5. **Convert `.pending-*` to json-render** ([`aeon.yml:704-721`](../../../.github/workflows/aeon.yml#L704-L721)) — `./notify-jsonrender` calls Haiku to convert markdown to a 15-component json-render spec written to `dashboard/outputs/`.
6. **Send pending notifications** ([`aeon.yml:723-790`](../../../.github/workflows/aeon.yml#L723-L790)) — retries `.pending-notify/*.md` delivery, dedup by content hash.
7. **Run all `scripts/postprocess-*.sh`** ([`aeon.yml:793-811`](../../../.github/workflows/aeon.yml#L793-L811)) — outside the sandbox. This is how the Dev.to / Farcaster / AdManage / Replicate side-effects happen.
8. **Commit results** ([`aeon.yml:813-880`](../../../.github/workflows/aeon.yml#L813-L880)) — auto-commits to `main`, signed as `aeonframework <aeonframework@proton.me>`. Auto-resolves `memory/*` rebase conflicts, retries with exponential backoff up to 5 times. This is what allows parallel skills to coexist without manual merge.
9. **Update cron-state** ([`aeon.yml:882-998`](../../../.github/workflows/aeon.yml#L882-L998)) — persists `last_status`, `last_success`, `last_failed`, `total_runs`, `success_rate`, `consecutive_failures`, `last_quality_score`, `last_error`.

## Chains — `chain-runner.yml`

When a chain matches its cron, the scheduler dispatches `chain-runner.yml -f chain=<name>`. The runner ([`chain-runner.yml:1-339`](../../../.github/workflows/chain-runner.yml)) is a single 60-min job that:

1. **Parses the chain block** out of `aeon.yml` ([`chain-runner.yml:149-162`](../../../.github/workflows/chain-runner.yml#L149-L162)) using awk — extracts `on_error` mode (`fail-fast` default, or `continue`) and the list of steps.
2. **Per step:** dispatches each skill (or all skills in a `parallel: [...]` group) by calling `gh workflow run aeon.yml -f skill=<s>` and polling for the new run id ([`chain-runner.yml:46-75`](../../../.github/workflows/chain-runner.yml#L46-L75)).
3. **Builds chain context** for `consume: [...]` steps ([`chain-runner.yml:121-147`](../../../.github/workflows/chain-runner.yml#L121-L147)) — concatenates upstream `.outputs/<dep>.md` files into `.outputs/.chain-context-<target>.md` with markdown section headers, commits it so the skill run can read it.
4. **Waits for all runs in the step** to complete ([`chain-runner.yml:78-118`](../../../.github/workflows/chain-runner.yml#L78-L118)) before proceeding.
5. **Handles failure** per `on_error` ([`chain-runner.yml:260-263`](../../../.github/workflows/chain-runner.yml#L260-L263)) — fail-fast skips remaining steps; continue keeps going.
6. **Records chain status** in `memory/cron-state.json` under key `chain:<name>` ([`chain-runner.yml:282-338`](../../../.github/workflows/chain-runner.yml#L282-L338)).

The composition primitive is just **a file**: `.outputs/<skill>.md`. That's why chains can be tested by running upstream skills first and inspecting the file before wiring up the consumer.

## Inbound messages — `messages.yml` job `run`

The second job in `messages.yml` ([`messages.yml:564-791`](../../../.github/workflows/messages.yml#L564-L791)) handles inbound chat messages from Telegram/Discord/Slack. It's triggered by `repository_dispatch` (webhook) or `workflow_dispatch` (manual), spawns Claude Code with the message as a prompt, and uses the same allowlisted tools as a skill run. Responses go back through the same `./notify` script. See [`notifications.md`](notifications.md) for the polling and fan-out details.

## Cost model

Per the `aeon.yml` cron defaults and `README.md`:

- A tick with no matched skill is ~10s (checkout + bash + exit).
- A skill run is 2–10 min depending on complexity.
- A heartbeat with nothing to report is ~2 min.
- Public repos get unlimited free Actions minutes; private repos burn from the plan budget.

Token costs are tracked per run in `memory/token-usage.csv` and aggregated weekly by the `cost-report` skill.

## What you should never assume

- **The scheduler is not real-time.** GitHub Actions cron drifts up to 15 minutes. If you need second-level latency, that's an expansion topic — see [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) #1.
- **Two skills can race on the same files.** The commit step ([`aeon.yml:813-880`](../../../.github/workflows/aeon.yml#L813-L880)) handles rebase conflicts only for `memory/*`. If you write to anywhere else, design for idempotency and don't depend on within-tick ordering.
- **`workflow_dispatch` is the only manual handle.** The dashboard's "Run" button shells out to `gh workflow run`; there is no other entry point.
- **Concurrency is per-skill.** ([`aeon.yml:61-72`](../../../.github/workflows/aeon.yml#L61-L72)) — the same skill cannot run twice in parallel. Different skills can. This is important for any skill that writes shared state.

## Related docs

- [`skills.md`](skills.md) — the `SKILL.md` contract executed inside step 9.
- [`memory.md`](memory.md) — what gets committed back in step 22 / 23.
- [`self-healing.md`](self-healing.md) — how `consecutive_failures` from cron-state triggers `skill-repair`.
- [`../05-SECURITY.md`](../05-SECURITY.md) — secret handling, sandbox, Fleet Watcher.
