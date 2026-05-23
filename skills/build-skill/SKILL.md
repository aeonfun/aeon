---
name: Build Skill
description: Design and build a new reusable skill
var: ""
tags: [meta, dev]
---
> **${var}** — What skill to build. If empty, picks from issues or capability gaps.

If `${var}` is set, build that specific skill instead of auto-selecting.


Your task is to design and build a new reusable skill.

## Steps

1. **Decide what to build.** Check open issues (`gh issue list`) and
   memory/MEMORY.md for ideas. Pick the most useful one, or reason about what
   capability gap exists.

2. **Research.** Search the web or fetch documentation for any APIs or patterns
   needed.

3. **Design the skill.** Define:
   - Name and description
   - What it does step by step
   - What environment variables it needs

4. **Write a skill file.** Create a new `.md` file in `skills/` with:
   - Frontmatter (name, description, schedule, commits, permissions)
   - A clear prompt describing the task steps
   - Documentation of required env vars

5. **Update memory.** Record what skill was built and when.

6. **Send a notification via `./notify`** with what was built and what it does.

## Guidelines

- Keep skills focused — one skill, one job.
- Include clear step-by-step instructions in the prompt.
- Document any required environment variables.
