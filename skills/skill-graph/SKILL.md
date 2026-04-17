---
name: Skill Dependency Graph
description: Generate a Mermaid dependency map of all skills grouped by category
var: ""
tags: [meta, dev]
---
> **${var}** — Output path override. If empty, writes to `docs/skill-graph.md`.

Today is ${today}. Generate a self-updating Mermaid dependency map of all Aeon skills.

## Steps

1. **Parse `aeon.yml`** — extract all skill entries, their schedules, and enabled status. Parse `chains:` for `consume:` and `parallel:` relationships. Parse `reactive:` for trigger dependencies.

2. **Scan all `skills/*/SKILL.md` files** — for each skill, extract:
   - `name` and `tags` from YAML frontmatter
   - `depends_on: [...]` from frontmatter (direct dependencies)
   - Inline references to other skills (patterns: `skills/X/SKILL.md`, `read skills/X`, skill names in backticks that match known skill slugs)
   - References to shared state files (`memory/cron-state.json`, `memory/skill-health/`, `memory/issues/`)

3. **Read `skills.json`** for the canonical category mapping:
   - `research` → Research & Content
   - `dev` → Dev & Code
   - `crypto` → Crypto & Markets
   - `social` → Social
   - `productivity` → Productivity & Meta

4. **Build the dependency graph** with these edge types:
   - **Solid arrows** (`-->`) for `depends_on` relationships
   - **Dashed arrows** (`-.->`) for chain `consume:` relationships
   - **Dotted arrows** (`-..->`) for reactive trigger relationships

5. **Generate the Mermaid diagram** as `flowchart LR`:
   - Group skills into `subgraph` blocks by category
   - Style each category subgraph with a distinct color
   - Highlight the self-healing loop: `heartbeat` → `skill-health` → `skill-evals` → `skill-repair` → `self-improve`
   - Include a legend explaining edge types

6. **Write the output** to `docs/skill-graph.md` (or `${var}` if set) with:
   - Title and generation timestamp
   - The Mermaid diagram
   - A summary table: total skills, dependencies by type, categories
   - Notes on key architectural patterns (self-healing loop, hub skills, data providers)

7. **Update the README** — if `docs/skill-graph.md` is new, add a "Skill Architecture" link in the README under the Skills table:
   ```markdown
   **Dependency graph:** [`docs/skill-graph.md`](docs/skill-graph.md) — visual map of how skills connect
   ```

8. **Create a branch and PR** with the updated graph.

9. **Log** to `memory/logs/${today}.md`.

## Sandbox note

No external APIs needed — all data comes from local files. No sandbox workarounds required.
