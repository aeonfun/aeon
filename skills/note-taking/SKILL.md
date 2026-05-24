---
name: Note Taking
description: Save a note as a Supernotes card (if configured) or to a local memory/notes/ file
var: ""
tags: [meta]
---
> **${var}** — The note content to save. Can be a thought, idea, link, quote, or anything worth remembering.

Read `memory/MEMORY.md` for context.

## Destinations

This skill writes to one of two destinations, in priority order:

1. **Supernotes** (primary, if `SUPERNOTES_API_KEY` is set) — queues a card via the post-process pattern. The card lands after the workflow finishes.
2. **Local fallback** (always available) — appends to `memory/notes/${today}.md`. This guarantees the note is never lost even when Supernotes is unconfigured or unreachable.

If `SUPERNOTES_API_KEY` is set, write to BOTH destinations — Supernotes for cross-device sync, local for persistent provenance under git. If it's not set, write only to the local file.

## Steps

1. **Parse the input.** `${var}` is the note the user wants to save. If `${var}` is empty, check today's `memory/logs/${today}.md` for the most recent notable finding or insight and use that instead. If neither yields content, log `NOTE_TAKING_SKIP: no input` and stop.

2. **Clean up the note:**
   - Keep the user's intent and voice intact — don't rewrite, just tidy if needed.
   - If it's a URL, fetch it with WebFetch and generate a one-line summary to include as context.
   - If it's a raw thought, keep it raw.

3. **Pick a color** based on the note's vibe (used by Supernotes; ignored by the local file):
   - `blue` — information, links, references
   - `green` — ideas, plans, things to build
   - `yellow` — questions, things to investigate
   - `red` — urgent, time-sensitive
   - `purple` — opinions, takes, hot thoughts

4. **Pick 1–3 tags** based on the content (lowercase, hyphenated). Always include `aeon` as a tag.

5. **Generate a title** — short, descriptive, 3–8 words. If the note is a URL, base it on the page title from the WebFetch summary.

6. **Local fallback (always)** — append to `memory/notes/${today}.md`:

   ```bash
   mkdir -p memory/notes
   cat >> memory/notes/${today}.md <<EOF

   ## ${TITLE}
   *${HH:MM} UTC · tags: ${TAGS} · color: ${COLOR}*

   ${MARKUP}
   EOF
   ```

   Create the file with a top-level `# Notes — ${today}` heading if it doesn't already exist.

7. **Supernotes (if configured)** — write a request file (the sandbox blocks direct curl — the workflow post-processes it):

   ```bash
   if [ -n "$SUPERNOTES_API_KEY" ]; then
     mkdir -p .pending-supernotes
     jq -n \
       --arg name "$TITLE" \
       --arg markup "$MARKUP" \
       --arg color "$COLOR" \
       --argjson tags "$(printf '%s\n' "${TAGS_ARRAY[@]}" | jq -R . | jq -s .)" \
       '{name: $name, markup: $markup, color: $color, tags: $tags}' \
       > ".pending-supernotes/note-$(date -u +%s).json"
   fi
   ```

   The workflow's Supernotes post-processing step will deliver the card after the skill run. If the key is unset, this step is skipped silently — the local file is the canonical record.

8. **Confirmation via `./notify`:**
   ```
   note saved: [title]
   ```
   Keep it short — the user just wants confirmation it landed. If Supernotes was skipped, optionally append `(local only — set SUPERNOTES_API_KEY for sync)` on the first run per day; suppress that hint afterwards.

9. **Log to memory/logs/${today}.md:**
   ```
   ## Note Taking
   - **Title:** [title]
   - **Color:** [color]
   - **Tags:** [comma-separated]
   - **Local:** memory/notes/${today}.md
   - **Supernotes:** queued / skipped (no key)
   - NOTE_TAKING_OK
   ```

## Environment Variables

- `SUPERNOTES_API_KEY` — optional. When set, notes are also queued for Supernotes via the post-process pattern. When unset, the local `memory/notes/${today}.md` file is the only destination — and that's fine.

## Sandbox Note

- Direct calls to Supernotes' API are blocked by the GitHub Actions sandbox; the skill writes a JSON payload to `.pending-supernotes/` and a post-process step delivers it after Claude finishes.
- Local file writes happen inside the sandbox without issue.
- WebFetch for URL summaries bypasses the sandbox.
