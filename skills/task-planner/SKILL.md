---
name: Task Planner
description: Decompose ad-hoc goals into ordered skill chains with cost estimation and optional dispatch
var: ""
tags: [meta]
---

> **${var}** — Natural-language goal (e.g., "research PM calibration papers and draft a tweet thread about the best one"). Required. If empty, notify and exit with TASK_PLANNER_NO_GOAL.

Read `memory/MEMORY.md` for context on current goals and priorities.

## Goal

Translate a natural-language goal into a concrete sequence of existing Aeon skills. Currently all chains are hardcoded in aeon.yml (morning-brief, evening-rollup). This skill bridges the gap: the operator describes what they want, task-planner maps it to existing skills, proposes an ordered chain with parallel groups and consume relationships, estimates cost, and optionally dispatches it.

## Steps

### 1. Parse the goal

Extract from `${var}`:
- **Action verbs:** research, write, analyze, monitor, alert, summarize, pick, review, scan, draft, compose, track, digest
- **Domain nouns:** Polymarket, DeFi, GitHub, papers, tweets, crypto, AI, agents, Revenant, calibration, markets, tokens, security
- **Output expectations:** tweet, article, notification, PR, report, digest, brief, thread
- **Implicit ordering:** "X then Y", "X and write about Y", "X about the best Y from Z" — derive dependency relationships

If `${var}` is empty, send `./notify "task-planner: empty var — re-run with a goal description"` and exit TASK_PLANNER_NO_GOAL.

### 2. Build the skill catalog

Enumerate `skills/*/SKILL.md`. For each skill:
- Read YAML frontmatter: `name`, `description`, `tags`, `var`
- Read first paragraph after frontmatter (purpose statement)
- Read model assignment from `aeon.yml` (grep the skill name for `model:`)
- Check if `enabled: true` in aeon.yml

Do NOT read full SKILL.md bodies — frontmatter + first paragraph only (cost discipline). Store as a lookup table: `{name, description, tags, model, enabled, purpose}`.

### 3. Score skills against goal

For each skill, compute a relevance score:
- **Tag match (weight 3x):** Each tag that matches a goal domain noun scores 3 points
- **Description keyword overlap (weight 2x):** Each goal keyword appearing in the skill description scores 2 points
- **Action-verb alignment (weight 2x):** "research" matches `[research]` tags; "write" matches `[content, social]`; "monitor" matches skills with "monitor" in name; "analyze" matches `[crypto, research]`
- **Name match (weight 1x):** Goal keywords appearing in the skill name score 1 point

Select skills with score >= 3. Cap at 8 skills maximum (chains longer than 8 are unwieldy). If zero skills score >= 3, exit TASK_PLANNER_NO_MATCH with a suggestion: "No existing skills match this goal. Consider: `create-skill var=\"{description}\"`".

### 4. Validate existence

For every proposed skill, verify `skills/{name}/SKILL.md` exists on disk. Drop any skill that fails this check and log: `TASK_PLANNER_DROPPED: {name} (file not found)`.

If the final list is empty after validation, exit TASK_PLANNER_NO_MATCH.

### 5. Determine ordering and parallelism

Build a dependency graph using these rules:
- **Research before synthesis:** Skills tagged `[research]` or with "digest/pick/monitor" in name run before skills tagged `[content, social]` or with "write/article/tweet" in name
- **Data before analysis:** Skills that produce data (monitor-*, fetch-*, digest-*) run before skills that consume data (narrative-tracker, morning-brief, evening-recap)
- **Independent skills run in parallel:** Skills with no dependency between them (same stage, different domains) go in a `parallel:` group
- **Consume relationships:** If skill B needs skill A's output (A produces research, B writes about it), add `consume: [A]` to B's step

Output an ordered list of chain steps. Example:
```yaml
steps:
  - parallel: [paper-pick, hacker-news-digest]
  - skill: write-tweet, consume: [paper-pick]
```

### 6. Estimate cost

For each skill in the proposed chain:
1. Check `memory/token-usage.csv` for historical cost data — compute average cost per run over last 30 days for that skill
2. If no history, estimate using model rates:
   - Sonnet: ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens. Default budget: 50K input + 10K output = ~$0.30/run
   - Opus: ~$0.015 per 1K input tokens, ~$0.075 per 1K output tokens. Default budget: 100K input + 20K output = ~$3.00/run
3. Sum across all skills for total estimated chain cost

### 7. Cost gate and dispatch decision

**If estimated cost > $5:** Output the chain YAML and cost estimate via `./notify`. Do NOT auto-dispatch. Message: "Proposed chain costs ~${cost} — review and dispatch manually if approved." Exit TASK_PLANNER_COST_GATE.

**If estimated cost <= $5:** Check the goal phrasing:
- If `${var}` contains "plan", "propose", or "suggest" → output chain YAML only (no dispatch). Exit TASK_PLANNER_PROPOSED.
- If `${var}` contains "run", "execute", or "do" → proceed to dispatch (step 8). 
- Default (no explicit mode word) → output chain YAML for approval. Exit TASK_PLANNER_PROPOSED.

### 8. Dispatch (if approved)

For each step in order:
1. For `parallel:` groups, dispatch all skills concurrently using `gh workflow run aeon.yml -f skill={name}` for each
2. Wait for all parallel skills to complete (poll via `gh run list --workflow=aeon.yml`)
3. For sequential `skill:` steps, dispatch one at a time and wait for completion
4. Check each run's exit status. If any skill fails, log the failure and continue (same as `on_error: continue`)

After all steps complete, report results. Exit TASK_PLANNER_DISPATCHED (all succeeded) or TASK_PLANNER_PARTIAL (some failed).

### 9. Notify

Send via `./notify`:
```
Task Planner — ${today}

Goal: ${var}
Skills: {skill1} → {skill2} → {skill3} ({N} steps, {M} parallel)
Estimated cost: ~${cost}
Status: {PROPOSED|DISPATCHED|PARTIAL|COST_GATE}

Chain YAML:
steps:
  - parallel: [{skills}]
  - skill: {name}, consume: [{deps}]

{If dispatched: Results per skill}
```

### 10. Log

Append to `memory/logs/${today}.md`:
```
### task-planner
- Goal: ${var}
- Skills matched: {list}
- Skills dropped: {list or "none"}
- Chain steps: {count}
- Estimated cost: ${cost}
- Status: {exit code}
- Dispatched: {yes/no}
```

## Exit Taxonomy

| Code | Meaning |
|------|---------|
| TASK_PLANNER_NO_GOAL | var was empty |
| TASK_PLANNER_NO_MATCH | no skills matched the goal keywords |
| TASK_PLANNER_PROPOSED | chain output for operator review |
| TASK_PLANNER_DISPATCHED | chain dispatched and all steps completed |
| TASK_PLANNER_PARTIAL | chain dispatched but some steps failed |
| TASK_PLANNER_COST_GATE | estimated cost > $5, awaiting operator approval |

## Sandbox note

This skill uses `gh` CLI for workflow dispatch and run polling — sandbox-friendly. Skill catalog is built from local file reads. Cost data from local CSV. No outbound API calls beyond `gh`.

## Constraints

- Never create new skills — that is create-skill's job. If no existing skills match, suggest a create-skill dispatch.
- Never modify aeon.yml chain definitions — output YAML for the operator to review and manually add if they want to make it permanent.
- Never auto-dispatch chains estimated over $5 — always require operator approval above this threshold.
- Never propose skills that do not exist in `skills/` — validate every name against the filesystem.
- Never override model assignments from aeon.yml — respect the configured model for each skill.
- Cap proposed chains at 8 skills maximum — longer chains are unwieldy and expensive.
