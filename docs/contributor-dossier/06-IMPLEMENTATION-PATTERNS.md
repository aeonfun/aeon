# Implementation Patterns

How to write code for Aeon that fits the conventions and ships without bouncing.

---

## When you're writing a new skill

### 0. Confirm it should be a skill

Aeon skills are for *recurring, autonomous work*. Before writing one, ask:

- **Does this need to run on a schedule (or in response to a condition)?** If no, it's a one-shot — not a skill.
- **Does it have a stable output contract you could test against?** If no, consider whether it's premature.
- **Is there an existing skill in the same category you could extend?** If yes, extend it.
- **Will fork operators want this?** If no, it should live in a *private* fork or skill pack, not upstream.

If you're unsure, draft the skill as `skills/<name>/SKILL.md` and pair it with an issue describing the use case. Get sign-off before merging.

### 1. Pick the closest exemplar by *shape*

Not by *topic*. The patterns that matter are read-fetch-summarize-notify, threshold-and-alert, list-and-skip, read-state-and-diagnose, etc. The right exemplar to copy from is the skill with the same shape, even if a totally different domain.

| Shape | Exemplars |
|---|---|
| Threshold + alert + dedup | [`token-alert`](../../skills/token-alert/SKILL.md), [`price-threshold-alert`](../../skills/price-threshold-alert/SKILL.md) |
| Fetch + summarize + notify | [`article`](../../skills/article/SKILL.md), [`digest`](../../skills/digest/SKILL.md), [`paper-digest`](../../skills/paper-digest/SKILL.md) |
| List repos + filter + iterate | [`pr-review`](../../skills/pr-review/SKILL.md), [`issue-triage`](../../skills/issue-triage/SKILL.md), [`github-monitor`](../../skills/github-monitor/SKILL.md) |
| Read state + diagnose + notify | [`heartbeat`](../../skills/heartbeat/SKILL.md), [`skill-health`](../../skills/skill-health/SKILL.md), [`batch-health`](../../skills/batch-health/SKILL.md) |
| Compose + format + schedule | [`write-tweet`](../../skills/write-tweet/SKILL.md), [`thread-formatter`](../../skills/thread-formatter/SKILL.md) |
| Generate + PR | [`create-skill`](../../skills/create-skill/SKILL.md), [`external-feature`](../../skills/external-feature/SKILL.md), [`skill-repair`](../../skills/skill-repair/SKILL.md) |
| Multi-source synthesis with source tiers | [`deep-research`](../../skills/deep-research/SKILL.md) |
| Cron + audit + roll-up | [`skill-analytics`](../../skills/skill-analytics/SKILL.md), [`weekly-review`](../../skills/weekly-review/SKILL.md), [`cost-report`](../../skills/cost-report/SKILL.md) |

### 2. Write `SKILL.md` to the conventions

Per [`03-subsystems/skills.md`](03-subsystems/skills.md) — the contract is:

```markdown
---
name: "Display Name"
description: "Verb-first one-sentence summary, <= 90 chars"
var: ""
tags: [research, content]      # max 3, from the fixed taxonomy
depends_on: [skill-a]          # optional
---

> **${var}** — What the var controls. If empty, fall back to <behavior>.

Today is ${today}. <One-sentence task statement.>

## Steps

1. **Fetch.** <Exact instructions — curl, gh, WebFetch.>
2. **Process.** <What to extract, what to compute.>
3. **<More steps as needed.>**

N-1. **Log.** Append to `memory/logs/${today}.md`:
- SKILL_<NAME>_OK | SKILL_<NAME>_SKIP_QUIET | SKILL_<NAME>_ERROR
- [Outcome details]

N. **Notify.** Send via `./notify` (max <CHAR_LIMIT> chars):
<Output template>

## Sandbox note
<Which pattern this skill uses for outbound network, and why.>
```

Hard rules:

- **Frontmatter is required.** `name`, `description`, `var`, `tags`. `depends_on` optional.
- **Var documentation as a blockquote** below the frontmatter.
- **`${var}` and `${today}` are the only template variables** the workflow substitutes. Anything else is literal.
- **Steps are numbered.** No bulleted prose for the body.
- **Penultimate step is `Log`.** Always append to `memory/logs/${today}.md` with an exit-taxonomy marker.
- **Final step is `Notify`.** Always via `./notify` with an explicit char limit.
- **Sandbox note as the last section.** Specifies WebFetch / prefetch / postprocess pattern.

### 3. Write the exit-taxonomy marker explicitly

The `skill-analytics` skill greps `memory/logs/YYYY-MM-DD.md` for markers like `SKILL_FOO_OK`, `SKILL_FOO_SKIP_UNCHANGED`, `SKILL_FOO_ERROR`. If your skill doesn't emit one, it shows up as `uncategorized` in fleet rollups.

Convention:

| Marker | When |
|---|---|
| `SKILL_FOO_OK` | Normal successful run with output |
| `SKILL_FOO_OK_SILENT` | Successful run, nothing to notify (e.g. no alerts triggered) |
| `SKILL_FOO_SKIP_QUIET` | Skipped intentionally (e.g. already ran today) |
| `SKILL_FOO_SKIP_UNCHANGED` | No change vs last run; nothing to do |
| `SKILL_FOO_NEW_INFO` | New information detected (variant of OK) |
| `SKILL_FOO_ERROR` | Real failure |
| `SKILL_FOO_FAILED` | Same as ERROR (some skills prefer this) |
| `SKILL_FOO_PARTIAL` | Partial success, some sub-tasks failed |

### 4. Don't assume tools you can't use

The allowlist is hard-coded in [`aeon.yml:451-456`](../../.github/workflows/aeon.yml#L451-L456):

```
Read, Write, Edit, Glob, Grep, WebFetch, WebSearch,
Bash(curl), Bash(gh), Bash(git), Bash(jq), Bash(./notify),
Bash(mkdir), Bash(ls), Bash(cat), Bash(echo), Bash(date),
Bash(node), Bash(npm), Bash(npx), Bash(head), Bash(tail),
Bash(wc), Bash(sort), Bash(grep), Bash(chmod)
```

If you need `wget`, `python3`, `psql`, `aws`, `docker`, etc. — **you can't**. Either:

- Reframe the work to use the allowed tools (most cases).
- Use the prefetch / postprocess pattern (auth-required or sandbox-blocked).
- Propose a runtime change in an issue (rare; needs author review).

### 5. Pick the right sandbox pattern

| Pattern | When | Files |
|---|---|---|
| **Direct call** | Public read API, no auth, low rate-limit risk | Skill calls `curl` or `WebFetch` directly |
| **WebFetch fallback** | Public read API but `curl` may be flaky | Skill calls `curl`, falls back to `WebFetch` on failure |
| **Pre-fetch** | Auth-required outbound read | `scripts/prefetch-<skill>.sh` runs before Claude; caches to `.xai-cache/` or `.<service>-cache/` |
| **Post-process** | Auth-required outbound write (side-effect) | Skill writes `.pending-<service>/*.json`; `scripts/postprocess-<service>.sh` reads and posts |
| **`gh` CLI** | Anything GitHub-API | Use `gh api` — handles auth internally |

Write the sandbox note in your skill explaining which pattern you chose and why. Example:

```markdown
## Sandbox note
This skill calls the Polymarket gamma-api (public, no auth, ~100 req/min limit). Uses `curl` direct with `WebFetch` fallback if `curl` fails inside the sandbox. No prefetch needed.
```

### 6. Memory: write to the right place

| What | Where |
|---|---|
| Daily log entry | `memory/logs/${today}.md` (every skill, every run) |
| Long-form topic state owned by the skill | `memory/topics/<topic>.md` |
| Internal bookkeeping (cooldowns, dedup hashes) | `memory/state/<skill>.json` |
| Cross-skill summary you want to surface | Append to `memory/MEMORY.md` (sparingly — it caps at 50 lines) |
| Article-style output for the public site | `articles/<skill>-${today}.md` |
| Chain-passable output | `.outputs/<skill>.md` (always written automatically; you may add structure) |
| Pending notifications (batch sends) | `.pending-notify/<id>.md` |
| Pending side-effects | `.pending-<service>/<id>.json` |

Don't write outside `memory/`, `articles/`, `docs/`, `.outputs/`, `.pending-*/`, `dashboard/outputs/`. The commit step's conflict resolution only handles `memory/*`.

### 7. Dedup against recent logs

Almost every skill should dedup against `memory/logs/` from the last 24–48h. Pattern:

```markdown
Before sending an alert, grep memory/logs/ for the last 48h
for the same token symbol. If found, skip (silent).
```

This is what makes daily skills tolerable — the operator gets one alert per new event, not one per day.

### 8. Notification budget

| Channel | Hard limit | Practical limit |
|---|---|---|
| Telegram | 4096 chars | <=4000 |
| Discord | 2000 chars | <=2000 |
| Slack | ~40000 chars | <=2000 (humans don't read past this) |
| Email | (no practical limit) | <=2000 lead, more detail in body |

Document your budget in the Notify step.

### 9. Add an entry to `aeon.yml`

```yaml
your-skill: { enabled: false, schedule: "0 14 * * *" }
```

Conventions:
- **Enabled `false` by default** for new skills — operators opt in.
- **UTC schedule.**
- **Cron format** — `*`, `*/N`, `N-M`, `N,M`, `N/step`, `N-M/step`. No `@hourly` shortcuts.
- **Order matters** — the scheduler picks the first matching skill per tick. Put day-specific skills before daily ones.
- **`heartbeat` stays last** so it only fires when no other skill claims the slot.
- For on-demand only: `schedule: "workflow_dispatch"`.
- For reactive: `schedule: "reactive"` + add an entry to the `reactive:` block.

### 10. Add an entry to `skills.json`

Regenerate via `./generate-skills-json` — it reads frontmatter from `SKILL.md` and auto-populates the catalog. Don't hand-edit `skills.json`.

### 11. Document the sandbox note

Your skill's `## Sandbox note` section is read by other contributors when they want to extend it. Be explicit: "uses `curl` + `WebFetch` fallback" or "auth-required; needs `prefetch-foo.sh`" or "no outbound; pure compute".

### 12. Add an eval

If your skill has a stable output, add an assertion to [`skills/skill-evals/evals.json`](../../skills/skill-evals/evals.json). Minimum:

```json
{
  "your-skill": {
    "output_pattern": "articles/your-skill-*.md",
    "max_age_hours": 28,
    "required_patterns": ["<thing it should always say>"],
    "forbidden_patterns": ["<thing that indicates failure>"],
    "min_word_count": 200,
    "max_word_count": 2000
  }
}
```

This is how `skill-evals` will catch regressions in your skill's output quality.

---

## When you're touching the runtime

### Don't, lightly

`.github/workflows/aeon.yml`, `chain-runner.yml`, `messages.yml` are the *infrastructure*. A change here propagates to every fork on next sync-upstream. Treat them as breaking-ABI surfaces.

### If you must

- **One workflow change per PR.** Don't bundle.
- **Run `workflow-security-audit` mentally.** Don't pipe `toJson(github.event)` into a shell. Don't add unpinned actions. Don't interpolate `inputs.*` into `run:` blocks.
- **Add to `07-TESTING.md`'s test scaffolding** — every workflow change should have an explicit verification step.
- **Document in [`08-OPEN-QUESTIONS.md`](08-OPEN-QUESTIONS.md)** if your change changes a default that forks may have customized.

---

## When you're touching the dashboard

### Adding a route

1. Place under `dashboard/app/api/<resource>/<action>/route.ts`.
2. The middleware auto-protects it. Don't try to bypass.
3. Validate every user-provided input. The existing routes use whitelist regex — follow that pattern.
4. Use `execFileSync` (not `exec`) for shelling out. Always pass args as an array.
5. Never return secrets to the browser. Return `{ isSet: bool }` if you need to surface presence.

### Adding a page

Pure Next.js. App Router. RSC default; Client Components when needed.

### Adding a json-render component

Update [`dashboard/lib/catalog.ts`](../../dashboard/lib/) (the catalog) and the Haiku prompt in [`notify-jsonrender`](../../notify-jsonrender) (so existing skills can produce specs that use it).

---

## When you're touching `add-skill` / `install-skill-pack`

These are the supply-chain entry points. **Every change requires a security review.** Pull `[`05-SECURITY.md`](05-SECURITY.md) § Surface 4 — Supply chain` into your PR description.

Don't relax the trusted-sources check. Don't auto-advance `commit_sha` without explicit operator consent. Don't add new sources to `skills/security/trusted-sources.txt` without author sign-off.

---

## When you're touching memory hygiene

`memory-flush`, `memory-structural-dedupe`, `reflect`, `janitor`. These are infrastructure for the memory subsystem. A bug here can lose memory.

Defensive patterns:
- **Dry-run mode** — every memory-mutating skill should support a `var: dry-run` that logs intended actions but doesn't write.
- **Append-only logs** — record every promotion / removal / merge so you can reconstruct if needed.
- **Never overwrite without a backup line in the log.**

---

## Common bugs and how to avoid them

- **Inventing template variables.** Only `${var}` and `${today}` get substituted. Inventing `${user}` does nothing.
- **Forgetting the exit-taxonomy marker.** Skills without `SKILL_FOO_OK` markers don't get classified — they show as `uncategorized` in analytics.
- **Writing to disk outside the safe set.** The commit step only conflict-resolves `memory/*`. Writes elsewhere can be lost in races.
- **Calling tools not on the allowlist.** Bash commands not in the allowlist will fail with a permission error mid-skill, often confusingly.
- **Missing sandbox note.** No automated check yet (the lint we ship in [`07-TESTING.md`](07-TESTING.md) adds it), but every reviewer asks.
- **Notify exceeding char budget.** Telegram returns an error; Discord truncates silently.
- **Reading `MEMORY.md` and then writing to it without dedup.** Pile-on duplicates that `memory-structural-dedupe` then has to collapse weekly. Be deliberate.
- **Adding a skill enabled by default.** New skills are off. Operators opt in. (`heartbeat` is the only default-on exception.)

---

## What good Aeon code looks like

- **Skill prose is concrete.** Exact `curl`s, exact `jq` expressions, exact filenames. Not "fetch the API."
- **Skill prose names its failure modes.** "If rate-limited, log SKILL_FOO_SKIP_RATE_LIMITED and notify nothing."
- **Skill prose is testable.** Assertions in `evals.json` should be obvious from reading the SKILL.md.
- **Runtime code is defensive but not paranoid.** Validates inputs at the boundary, trusts internal callers.
- **Dashboard code is loud about its trust assumptions.** Every `gh` shellout's input is whitelist-validated.
- **Documentation is paired with code.** A new subsystem doc lands with the subsystem.

---

## Related docs

- [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md) — the data flow your skill plugs into.
- [`03-subsystems/skills.md`](03-subsystems/skills.md) — the contract.
- [`03-subsystems/runtime.md`](03-subsystems/runtime.md) — what happens to your skill when it runs.
- [`03-subsystems/memory.md`](03-subsystems/memory.md) — where to write.
- [`05-SECURITY.md`](05-SECURITY.md) — what to read before touching the dashboard or `add-skill`.
- [`07-TESTING.md`](07-TESTING.md) — what tests ship with new skills.
