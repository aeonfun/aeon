---
name: Memory Dedupe
description: Detect and collapse structural duplicate rows in MEMORY.md — sections like Recent Articles and Skills Built that accumulate multiple content blocks across memory-flush cycles. Companion to scripts/memory-dedupe (topic-pointer dedup); this handles section-level row accumulation and duplicate H2 headings (the same section heading appearing 2+ times in the file).
var: ""
tags: [meta, memory]
schedule: "10 6 2/2 * *"
---

> **${var}** — Optional section heading to check (e.g. "Recent Articles"). If empty, checks all known single-canonical sections.

Today is ${today}. Read `memory/MEMORY.md` before starting.

## Why this skill exists

`scripts/memory-dedupe --fix` removes duplicate topic-file *pointer* rows (e.g. two `- [Papers](topics/papers.md)` bullets). It does **not** catch structural row accumulation: when a section that should have one canonical content block — like `## Recent Articles` or `## Skills Built` — accumulates multiple separate content blocks because `reflect` and `memory-flush` prepend new rows without pruning old ones.

This has caused a recurring manual cleanup pattern: every 2–4 days, memory-flush manually collapses 4 rows → 1 for both Recent Articles and Skills Built. This skill automates that detection and merge.

There is a second, distinct failure mode: `reflect` and `memory-flush` can prepend a brand-new `## Skills Built` (or `## Issue Tracker`, `## Known Follow-ups`) block without noticing the same heading already exists lower in the file. MEMORY.md then carries the same H2 heading 2–3 times, each with its own content. Step 2 detects this as a **duplicate heading** and step 4 merges all spans into one canonical block.

## Single-canonical sections

These sections should have exactly ONE content block (paragraph or bullet entry). Multiple blocks = structural dupe drift:

- `## Recent Articles` — one compact paragraph summarizing all article categories + counts. Heading may include " (N since ...)".
- `## Skills Built` — one bullet row listing all skills built with count. Heading may include " (N since ...)".
- `## Lessons Learned` — one pointer sentence (e.g. "See [infrastructure.md](...)").
- `## Wallet` — one bullet with wallet address and balance.
- `## Issue Tracker` — one bullet summarizing tracker state.
- `## Recent Newsletters` — typically 3–5 rows max (legitimate to have several); only flag if >6 rows accumulate.

If `${var}` is set, check only that section (partial match on heading).

## Steps

### 1. Read and parse MEMORY.md

Read `memory/MEMORY.md`. Split into sections on `## ` headings. For each section, collect its content lines (non-empty lines after the heading, up to the next `## `).

Count distinct content blocks per section. A content block is a non-empty line or a paragraph run. For this skill, treat each non-empty line as a potential content block for single-canonical sections.

While parsing, also build a heading map: `{ heading → [list of (start_line, end_line) spans] }` — one span per occurrence of the same `## ` heading, covering the lines from that heading to (but not including) the next `## ` heading or end of file.

### 2. Detect structural duplicates

For each single-canonical section:

- Count how many non-empty content lines exist under that heading.
- **Clean:** 1 content block → no action.
- **Drift detected:** 2+ content blocks → flag as structural dupe.

Exceptions:
- `## Known Follow-ups` and `## Operational Status` are **intentionally multi-line** — skip them.
- `## Topic Files` is handled by `scripts/memory-dedupe` — skip it.
- `## Recent Newsletters` flag only if >6 lines.

Separately, from the heading map: flag any heading with 2+ spans as a **duplicate heading**. This check applies to ALL headings (including the intentionally multi-line ones — multi-line content under ONE heading is fine; the same heading appearing twice is not).

### 3. If clean — log and stop

```
MEMORY_STRUCTURAL_DEDUPE_OK: all sections clean
```

Append to `memory/logs/${today}.md` and stop. No notification needed.

### 4. If drift detected — merge and rewrite

For each flagged section:

1. **Read all content blocks** for that section.
2. **Identify the canonical block** — the most complete/up-to-date one:
   - For `## Recent Articles`: the block with the highest article count (e.g. "37 daily + 15 explainers" > "35 daily + 14 explainers"). If counts are equal, keep the first (most recently prepended).
   - For `## Skills Built`: the block with the highest skill count (e.g. "31 since 3/24" > "29 since 3/24").
   - For other sections: keep the first block (most recent since reflect prepends).
3. **Check if any non-canonical blocks contain unique information** not in the canonical block. If so, fold that unique info into the canonical block before dropping the duplicate.
4. **Rewrite the section** to contain only the canonical block.

For each **duplicate heading** (same `## ` heading with 2+ spans):

1. **Collect all content blocks** from all spans of that heading.
2. **Pick the canonical span:**
   - `## Skills Built` / `## Recent Articles`: the span whose content carries the highest count (e.g. "43 since 3/24" > "40 since 3/24"). Parse the leading number.
   - `## Issue Tracker`: the span mentioning the most resolved issues; most content lines on a tie.
   - `## Known Follow-ups` (and other intentionally multi-line sections): don't pick — concatenate unique lines from all spans into one block.
   - All other headings: keep the **first** span (most recently prepended, since reflect/memory-flush prepend).
3. **Fold unique information** from non-canonical spans into the canonical block before dropping them.
4. **Rewrite** so the heading appears exactly once, at the first span's position.

Preserve exact markdown formatting, indentation, and bolding from the canonical block.

Do NOT rewrite the entire MEMORY.md — use targeted section replacement. Write the updated file back using the Write tool.

### 5. Run topic-pointer dedupe

After any structural rewrite, also run:

```bash
./scripts/memory-dedupe --fix
```

Belt-and-suspenders: structural rewrites can occasionally re-expose pointer dupes. Idempotent — no-op if already clean.

### 6. Format notification

Write to `.pending-notify-temp/mem-struct-dedupe-${today}.md`, then send:

```
./notify -f .pending-notify-temp/mem-struct-dedupe-${today}.md
```

Message format (only sent if drift was detected and fixed):

```
memory structural dedupe — ${today}

${N} section(s) collapsed:
${forEach flagged section}
- ${section_heading}: ${old_count} blocks → 1 canonical
  dropped: ${dropped_block_preview}
${end}
${forEach duplicate heading}
- ${heading}: ${span_count} duplicate headings → 1
${end}

MEMORY.md: ${old_line_count} → ${new_line_count} lines
```

No notification if clean.

### 7. Log to memory

Append to `memory/logs/${today}.md`:

```markdown
## Memory Structural Dedupe
- **Sections checked:** ${list of sections checked}
- **Sections fixed:** ${list of fixed sections or "none"}
- **Duplicate headings fixed:** ${list of merged headings or "none"}
- **Lines removed:** ${count or 0}
- **Pointer dedupe:** ran post-fix / skipped (clean input)
- MEMORY_STRUCTURAL_DEDUPE_OK
```

(Use `MEMORY_STRUCTURAL_DEDUPE_OK` in all cases — it marks the skill ran successfully, not that zero drift was found.)

## Sandbox Note

Reads and writes only local files (`memory/MEMORY.md`, `memory/logs/`). Calls `./scripts/memory-dedupe --fix` as a local shell command. No external network calls. No prefetch/postprocess needed.
