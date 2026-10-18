---
name: memory-flush
description: Promote important recent log entries into MEMORY.md and prune stale ones
scorable: false  # meta skill: no gradable output, skip the post-run quality scorer
metadata:
  title: Memory Flush
  category: core
  var: ""
  tags:
    - meta
---
> **${var}** - Topic to focus on. If empty, flushes all recent activity.

If `${var}` is set, only promote entries related to that topic. Pruning (step 3), the index upkeep (step 6), and the deterministic watermark + rotation (steps 0 and 8) still run globally - a focused flush must never leave the rest of the store stale.

Read `memory/MEMORY.md` for current memory state. **The scan window and log rotation are computed for you in step 0** - you no longer parse the watermark or rotate logs by hand.

## Steps

### 0. Prepare (deterministic bookkeeping - run this first)

Run `python3 scripts/memory_prep.py window` and read its stdout. It:
- computes your **scan window** from the structured watermark `memory/memory-flush-state.json` (fallback for a first-run migration: the MEMORY.md `*Last consolidated:*` line; then the last 3 days; a gap over 14 days is clamped to 14 and flagged), and prints the exact in-window log files to read;
- has **already rotated** whole old months out of `memory/logs/` into `memory/logs/archive/YYYY-MM.md` (content-preserving) once the directory passed ~45 files.
- prints `MEMORY.md size` (bytes, lines, over-long lines) against the budget step 3e holds.

Read exactly the files it lists. Do not recompute the window or rotate logs yourself - that work is now deterministic and unit-tested (`scripts/memory_prep.py`), so it never silently falls back to 3 days or gets skipped. This closed two old holes: entries older than 3 days were lost whenever the agent skipped runs, and a daily schedule re-scanned the same 3 days every time.

### 1. Scan the in-window logs for entries worth promoting to long-term memory

- New lessons learned (errors encountered, workarounds found)
- Topics covered (articles, digests) - add to the recent output/articles/digests tables
- Features built or tools created
- Important findings from monitors (on-chain, GitHub, papers)
- Ideas captured that are still relevant
- Goals completed or progress milestones

### 2. Check each candidate against existing MEMORY.md content - dedup precisely

Skip if already recorded. Dedup by the fact's **subject**, not by string match:
- Identify what each candidate is *about* (a skill, a token, a repo, a lesson, a priority).
- If MEMORY.md already carries that subject, **edit the existing line in place** (merge the new detail, bump any date). Never append a second bullet that paraphrases an existing one - that near-duplicate drift is what a memory flush exists to prevent.
- Only add a new bullet when the subject is genuinely absent.
- **When a candidate contradicts an existing entry** (same subject, different fact), check the evidence before choosing: run `python3 scripts/memory_prep.py source <ref>` for each side that carries a `[source: ...]` tag (it prints that log section, from `memory/logs/` or the monthly archive). Keep what the log actually says. The newer statement wins only when the sources do not settle it; a sourced entry beats an untagged one. Do not drop the old fact silently: if history matters, say so in the entry ("moved to X in Oct, was Y").

### 3. Remove stale entries - this is as important as adding new ones

a. **Open Improvement PRs section**: Run `gh pr list --state open --search "improve:" --json number,title,url` and compare against any "Open Improvement PRs" section in MEMORY.md.
   - If all listed PRs are now merged/closed, remove the section entirely.
   - If some PRs are merged, update the list to reflect only current open ones.
b. **Next Priorities section**: Cross-check each listed priority against recent logs and current repo state. Remove priorities that are already done (e.g., "Merge open PRs" if 0 open PRs exist). Add any newly urgent priorities surfaced by recent logs.
c. **Lessons Learned**: Remove lessons that are now outdated or resolved (e.g., a workaround for a bug that was later fixed).
d. **Overflow any section that outgrows its budget** (keeps MEMORY.md an index, not a ledger): if a section has grown past the last ~10-15 rows - the Skills Built table is the usual first offender, but the rule is general - archive the oldest rows to `memory/topics/<section>-history.md` (e.g. `skills-history.md`) and leave a one-line pointer to that file. Trim newest-kept, oldest-archived.
e. **Hold the byte budget** (MEMORY.md loads into every skill run, so size is cost): step 0 prints `MEMORY.md size` against the budget of **8 KB, ~50 lines, no line over 300 chars**, and lists the over-long lines by number. When it says OVER BUDGET or names long lines, cut those first: move the detail of a long bullet to its topic file (`memory/topics/lessons.md` for Lessons Learned, `memory/topics/priorities.md` for Next Priorities, or the matching topic) and keep a one-line summary with a pointer in MEMORY.md. Keep the `[source: ...]` tag with the detail you move. A flush that leaves MEMORY.md over budget must say so in its log entry.

### 4. Update memory

- Add brief entries to MEMORY.md (keep it an index: under 8 KB, ~50 lines, no line over 300 chars).
- If a topic needs more detail, write to `memory/topics/<topic>.md` instead (see step 6 - register it in the index).
- Update tables (recent articles, recent digests) with new rows.
- **Cite the log every fact came from.** End each bullet you add or change (in MEMORY.md or a topic file) with `[source: logs/YYYY-MM-DD#<skill>]`: the log file's date and the `### <skill>` heading the entry sat under. For a table row, put the tag at the end of the last cell. When you merge new detail into an existing line, replace its tag with the newer source. Never invent a source, and do not backfill tags on untouched legacy lines. The tag is what lets a later flush (or the operator) check a fact and trace a bad entry back to the run that wrote it.
- Before adding a section, check whether its `## Heading` already exists anywhere in MEMORY.md - if it does, update that section in place. Never prepend a duplicate heading.
- **Do not hand-edit the consolidation date.** It is stamped by step 8 (`memory_prep.py stamp`), which writes the structured watermark `memory/memory-flush-state.json` (the source of truth) and mirrors it into the MEMORY.md `*Last consolidated:*` line. Skipping step 8 after a real flush is a bug - other skills (e.g. `action-converter`) read that line to tell a live, consolidated store from an untouched template.

### 5. Make targeted edits only

Do NOT rewrite the whole file - make targeted additions and removals.

### 6. Register any new topic files in the index

If step 4 created a new `memory/topics/<topic>.md` (or a `*-history.md` archive in step 3d), add a one-line pointer to it under the `# Reference` section of `memory/topics/index.md`, matching the existing row format. New topic notes that aren't linked from the index become orphans no other run can find.

### 7. (Automated) Log rotation

Log rotation now runs deterministically in step 0 (`memory_prep.py window`): whole calendar months entirely older than the 14-day scan floor are appended to `memory/logs/archive/YYYY-MM.md` and `git rm`'d once `memory/logs/` passes ~45 files. The archive preserves every line, respecting the append-only contract while bounding the file count. Nothing to do here by hand; a log inside the scan window is never touched.

### 8. Log the run, then stamp the watermark

Log what you promoted, pruned, and archived, plus the scan window you used (start date to today; note if a >14-day gap was clamped), to `memory/logs/${today}.md` as bullets under a `### memory-flush` heading (the health loop keys entries by slug).

Then run `python3 scripts/memory_prep.py stamp` as your **final** action - it writes today's date to `memory/memory-flush-state.json` and mirrors it into the MEMORY.md `*Last consolidated:*` line.

If nothing was worth promoting or removing, log `MEMORY_FLUSH_OK` - but still run `memory_prep.py stamp`: a clean flush is still a consolidation and must advance the watermark.

## Network note

`gh pr list` uses the `gh` CLI's built-in auth - no curl env-var expansion. `python3 scripts/memory_prep.py` and all other work is local file I/O against `memory/` (plus `git rm` for log rotation).

## Constraints

- Keep MEMORY.md an index: under 8 KB, ~50 lines, no line over 300 chars (step 0 measures it). Detail lives in `memory/topics/`.
- Never duplicate an existing `## Heading` or an existing fact - update in place.
- Pruning stale entries is as important as adding new ones.
- The watermark and log rotation are owned by `scripts/memory_prep.py` (steps 0 and 8), not by hand. The model's job is judgment: what to promote, dedup, and prune.
- **Idle runs never reach you.** Before the model starts, the workflow's "Idle gate" runs `memory_prep.py idle`: when no daily log changed since the last flush (fingerprints written by `stamp`, ignoring this skill's own entries and the "under the hood" footers) and that flush is under 7 days old, the run is skipped and recorded as a success. That is why step 8's `stamp` must run on every real flush, a clean one included.
- **This skill owns MEMORY.md consolidation.** Other skills (e.g. `self-improve`) may *flag* memory-hygiene problems, but structural pruning and archiving of MEMORY.md should land here to avoid two skills thrashing the same file. If `self-improve` prunes in an audit, treat it as a stopgap, not a reason to skip the next flush.
