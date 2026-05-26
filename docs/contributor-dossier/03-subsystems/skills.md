# Subsystem: Skills

A skill is a Markdown file. That is the whole format.

---

## The contract

Every skill lives at `skills/<slug>/SKILL.md`. The slug is the canonical identifier — it appears in `aeon.yml`, in `skills.json`, in `.outputs/`, in `memory/skill-health/`, as the MCP tool name (`aeon-<slug>`), and as the A2A skill id.

A `SKILL.md` is YAML frontmatter + Markdown prose. The runtime ([`aeon.yml:461-480`](../../../.github/workflows/aeon.yml#L461-L480)) reads the whole file, substitutes `${var}` and `${today}`, prepends a system note, and pipes it to `claude -p - --output-format json`. There is no transpiler, no compile step, no schema validator at runtime (only at commit-time, via the lint we ship in [`07-TESTING.md`](../07-TESTING.md)).

## Frontmatter

```yaml
---
name: "Display Name"
description: "One-sentence verb-starting description, <= 90 chars"
var: ""                          # default value (usually empty; filled by user input)
tags: [research, content]        # max 3; pick from a fixed taxonomy (see below)
depends_on: [skill-a]            # (optional) prerequisites; scheduler waits 5s before dependents
---
```

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Human-readable; appears in MCP/A2A tool descriptions. |
| `description` | yes | One sentence, verb-starting, ≤90 chars. Appears in `skills.json` and in tool catalogs. |
| `var` | yes | Default value, usually `""`. Overridden by workflow input or aeon.yml entry. |
| `tags` | yes | Max 3. Taxonomy: `content, crypto, dev, meta, news, research, social`. Used by `skills.json` categorization and skill-discovery surfaces. |
| `depends_on` | no | List of skill slugs. Scheduler orders dependencies first ([`messages.yml:209-220`](../../../.github/workflows/messages.yml#L209-L220)). |

Anything else in frontmatter is ignored. We do not have a versioning field, an author field, or a license field — those are open questions captured in [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md).

## Prose conventions

The codebase has settled on a tight set of prose conventions. They are not enforced by the runtime, but they are enforced by skill-evals (LLM-as-judge) and by what makes skills compose well. They are:

1. **Var documentation block** as a single blockquote near the top:
   ```markdown
   > **${var}** — What the var controls. If empty, fall back to <behavior>.
   ```
2. **Task statement** as a single sentence with `${today}` injection:
   ```markdown
   Today is ${today}. Generate a daily X.
   ```
3. **Numbered steps**, typically 4–8. Each step gets a title:
   ```markdown
   1. **Fetch sources.** Use WebSearch for "<query>" and WebFetch for any cited URLs.
   ```
   Steps contain *exact* commands (`curl`, `jq`, `gh`, `./notify`), not pseudocode. The output of a skill is what the steps describe; the runtime does not add intelligence.
4. **Log step** (second-to-last):
   ```markdown
   N-1. **Log.** Append to `memory/logs/${today}.md`:
   - [What was done]
   ```
5. **Notify step** (last):
   ```markdown
   N. **Notify.** Send via `./notify`:
   <output template, explicit char limit (≤4000 chars typical for Telegram)>
   ```
6. **Sandbox note** (final section, mandatory by convention):
   ```markdown
   ## Sandbox note
   <Which fallback pattern this skill uses, and why>
   ```

### Template variables

Only **two** values are injected by the workflow ([`aeon.yml:276-277`](../../../.github/workflows/aeon.yml#L276-L277)):

| Variable | Value |
|---|---|
| `${var}` | The skill's `var` (workflow input → per-skill default → frontmatter default) |
| `${today}` | ISO-format UTC date |

`${GITHUB_REPOSITORY}` is available as a bash env var. Inventing new `${...}` template variables in a skill does nothing — they pass through as literal text. This is a frequent first-time-contributor bug.

## The minimal valid skill

```markdown
---
name: Example
description: Do something useful
var: ""
tags: [dev]
---

> **${var}** — Optional parameter. If empty, uses default.

Today is ${today}. Execute the task.

## Steps

1. **Fetch data.** Use WebSearch or WebFetch to get the latest X.

2. **Process.** Analyze results and extract key insights.

3. **Log.** Append to `memory/logs/${today}.md`:
- Task: done
- Result: [outcome]

4. **Notify.** Send via `./notify`:
Done! Found: [summary]

## Sandbox note
Uses WebSearch/WebFetch. No auth required; if an external API needs a key, switch to the prefetch pattern.
```

That is genuinely all that is required. No build step. Drop it in `skills/example/`, register it in `aeon.yml` as `example: { enabled: false, schedule: "0 14 * * *" }`, and the next tick will see it.

## Composition primitives

Skills compose three ways:

### `var` — one universal input

Every skill takes a single `var`. Each skill's prose decides what `var` means for it. The four common patterns from `README.md` Configuration section:

| Skill type | What `var` does | Example |
|---|---|---|
| Research / content | Topic | `var: "rust"` → digest about Rust |
| Dev / code | Repo or repo#issue | `var: "owner/repo#42"` → review that one PR |
| Crypto | Token/wallet | `var: "solana"` → only check SOL |
| Productivity | Focus area | `var: "shipping v2"` → morning brief emphasizes v2 |

`var` is documented in the blockquote at the top of the SKILL.md so the dashboard, MCP server, and A2A server can surface it as a tool parameter.

### Chains — `parallel:` + `consume:`

Defined in `aeon.yml`:

```yaml
chains:
  morning-pipeline:
    schedule: "0 7 * * *"
    on_error: fail-fast        # or: continue
    steps:
      - parallel: [token-movers, hacker-news-digest]   # run concurrently
      - skill: morning-brief                            # waits for the parallel group
        consume: [token-movers, hacker-news-digest]    # gets their .outputs/*.md injected
```

Mechanics: each step dispatches `aeon.yml` as a workflow_call; the runner writes `.outputs/<skill>.md` for every skill that completes; downstream `consume:` steps get those files concatenated into `.outputs/.chain-context-<target>.md`, which is passed to the skill run as `chain_context_file` ([`chain-runner.yml:121-147`](../../../.github/workflows/chain-runner.yml#L121-L147)). The skill prose can read the context as a markdown block prepended to its prompt ([`aeon.yml:461-480`](../../../.github/workflows/aeon.yml#L461-L480)).

`on_error: fail-fast` (default) skips remaining steps on any failure. `on_error: continue` keeps going. Both record the chain status to `memory/cron-state.json` under `chain:<name>`.

### Reactive — fire on conditions

```yaml
reactive:
  skill-repair:
    trigger:
      - { on: "*", when: "consecutive_failures >= 3" }
```

Evaluated every tick by `messages.yml` ([`messages.yml:336-406`](../../../.github/workflows/messages.yml#L336-L406)) against `memory/cron-state.json`. Conditions:

- `consecutive_failures >= N`
- `last_status = success | failed | dispatched`
- `on: "*"` matches any enabled skill; `on: "<slug>"` matches one.

Reactive triggers are not for general event-driven work — they're a circuit-breaker primitive. Use them sparingly.

## Allowed tools, per skill run

The runtime hard-codes the tool allowlist ([`aeon.yml:451-456`](../../../.github/workflows/aeon.yml#L451-L456)):

```
Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
Bash(curl), Bash(gh), Bash(git), Bash(jq), Bash(./notify),
Bash(mkdir), Bash(ls), Bash(cat), Bash(echo), Bash(date), …
```

There is no raw `Bash(*)`. A skill cannot install packages, cannot run arbitrary binaries, cannot spawn subshells outside the allowlist. If your skill needs something not on the allowlist:

- **Read-only operation that the sandbox allows** → use the existing tools.
- **Auth-required outbound API** → use the prefetch pattern ([`scripts/prefetch-*.sh`](../../../scripts/)).
- **Auth-required side-effect** → use the postprocess pattern ([`scripts/postprocess-*.sh`](../../../scripts/)).
- **Anything else** → that's a runtime change, not a skill. Discuss in an issue.

## Skill categories

From `README.md`, the 156 skills cluster into:

| Category | Count | Typical pattern |
|---|---|---|
| Research & content | 24 | Fetch → summarize → notify (article, digest, deep-research, paper-digest) |
| Dev & code | 41 | GitHub API → triage / review / PR (pr-review, issue-triage, external-feature, create-skill) |
| Crypto & markets | 27 | Price/onchain API → threshold/anomaly → alert (token-alert, monitor-polymarket, defi-monitor) |
| Social & writing | 14 | Compose → format → schedule (write-tweet, reply-maker, thread-formatter) |
| Productivity | 18 | Read MEMORY → infer state → recap (morning-brief, daily-routine, weekly-review) |
| Meta / agent | 32 | Inspect Aeon itself → score / repair / report (heartbeat, skill-health, skill-repair, self-improve) |

Pick the right exemplar to copy from when writing a new one. The closest match by *shape* (not by topic) is the strongest signal.

## Exemplar walkthroughs

**`heartbeat` ([`skills/heartbeat/SKILL.md`](../../../skills/heartbeat/SKILL.md), 170 lines)** — The only skill enabled by default. Reads `memory/cron-state.json`, flags failed/stuck/chronically-broken skills, stalled PRs, missed schedules. Notifies one consolidated alert or logs `HEARTBEAT_OK` silently. The shape: read state → diagnose → notify-or-silent. Most meta skills follow this.

**`article` ([`skills/article/SKILL.md`](../../../skills/article/SKILL.md), 37 lines)** — Daily writer. Auto-selects a trending topic from MEMORY if `var` is empty; otherwise treats `var` as the topic. Writes `articles/YYYY-MM-DD.md`. The shape: pick topic → fetch sources → write → log → notify. Most content skills follow this.

**`token-alert` ([`skills/token-alert/SKILL.md`](../../../skills/token-alert/SKILL.md), 60 lines)** — Reads tracked tokens from MEMORY, polls CoinGecko, fires `./notify` on threshold breach. Dedup against the last 48h of `memory/logs/`. The shape: threshold + dedup + log + notify. Most monitoring skills follow this.

**`pr-review` ([`skills/pr-review/SKILL.md`](../../../skills/pr-review/SKILL.md), 133 lines)** — Iterates open PRs across watched repos. Skip rules (draft, WIP, bot author, already bot-reviewed, dedup by SHA). Severity-tagged findings (`[CRITICAL]/[ISSUE]/[NIT]`, max 5 per PR). Posts inline + consolidated review. The shape: list-and-skip → review-one-by-one → post → log.

**`skill-repair` ([`skills/skill-repair/SKILL.md`](../../../skills/skill-repair/SKILL.md), 258 lines)** — Reactive. Triaged by category (api-change, rate-limit, timeout, sandbox-limitation, prompt-bug, quality-regression, missing-secret, config). Per-category playbook. Opens a PR with risk classification (LOW/MED/HIGH). The shape: classify → repair → PR. Most self-healing skills are smaller; this is the heavy one.

**`create-skill` ([`skills/create-skill/SKILL.md`](../../../skills/create-skill/SKILL.md), 240 lines)** — Generates new skills from a one-line prompt. Duplicate detection, API research, new-secret guard, frontmatter validation, opens a PR to `create-skill/<name>` branch. The shape: validate → generate → quality-check → PR.

**`deep-research` ([`skills/deep-research/SKILL.md`](../../../skills/deep-research/SKILL.md), 246 lines)** — On-demand only (`workflow_dispatch`). Two modes (`shallow`: 5 sources, ~600 words; `deep`: 30–50 sources, 3–5K words). CRAAP-lite source-tiering (T1/T2/T3). Falsifiable-claims section required. The shape: pick mode → tier sources → write → cite. The most rigorous research skill in the catalog.

## What good skills do

- **Read MEMORY before doing anything** — `memory/MEMORY.md`, the relevant `memory/topics/*.md`, recent `memory/logs/*.md`. This is how skills coordinate without explicit state.
- **Dedup by content hash or substring against recent logs** — prevents the same alert firing daily.
- **Log explicitly** — the daily log is what other skills (reflect, weekly-review, morning-brief) read.
- **Notify with a strict character budget** — Telegram limits 4096; Discord 2000; Slack 40000 but humans don't read past 2000.
- **Document the sandbox posture** — every skill that calls an external API explains how it works inside the sandbox.

## What good skills do not do

- They do not chain logic deep enough to need branching. If you need `if X then run-different-skill`, that's a chain or reactive trigger, not a skill internal.
- They do not write to anywhere outside `memory/`, `.outputs/`, `.pending-*/`, `dashboard/outputs/`, `articles/`, `docs/`. The commit step's conflict-resolution only handles `memory/*`.
- They do not call `git` for anything other than reading. The commit step at the end of `aeon.yml` is the only writer.
- They do not assume access to env vars they did not declare. The secret-validation step ([`aeon.yml:134-169`](../../../.github/workflows/aeon.yml#L134-L169)) lints `${VAR_*}` references; an undeclared var gets a warning at run time.

## Related docs

- [`runtime.md`](runtime.md) — how skills get invoked.
- [`memory.md`](memory.md) — what skills read and write.
- [`self-healing.md`](self-healing.md) — what happens when skills fail.
- [`skill-discovery.md`](skill-discovery.md) — embedding-based search across the catalog (Session 06).
- [`../06-IMPLEMENTATION-PATTERNS.md`](../06-IMPLEMENTATION-PATTERNS.md) — full author guide with checklists.
- [`../07-TESTING.md`](../07-TESTING.md) — how to test a new skill.
