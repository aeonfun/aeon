---
name: weekly-aeoncard
description: Build a weekly token-consumption recap image from memory/token-usage.csv - this week + all-time totals, top skills, rendered as a shareable SVG card.
metadata:
  title: Weekly Aeon Card
  mode: write
  category: productivity
  var: ""
  tags:
    - monitoring
    - meta
  capabilities:
    - sends_notifications
---
> **${var}** — window + delivery control.
> - **empty** → weekly card: last 7 days + all-time, render the image, notify.
> - **`dry-run`** → render the image + report + dashboard spec but send no notification (artifacts still write). Combine with a window, e.g. `dry-run 30`.
> - **integer `N`** → override the weekly window to the last `N` days (default 7, cap 90). Example: `14`, `30`.

Today is ${today}. Turn this instance's own token ledger (`memory/token-usage.csv`) into a one-glance recap: how many tokens it burned **this week**, how many **since it started**, which skills dominate — rendered as a self-contained SVG card an operator can screenshot and share. Every number is measured from the ledger; nothing is fetched, sampled, or estimated. The heavy lifting is in `skills/weekly-aeoncard/render_card.py` (pure Python stdlib, deterministic) so you orchestrate, not hand-compute.

## Steps

1. **Parse `${var}` → window + mode.**
   ```bash
   V="$(echo "${var}" | tr '[:upper:]' '[:lower:]' | xargs)"
   MODE=execute; case "$V" in dry-run*) MODE=dry-run; V="${V#dry-run}"; V="$(echo "$V" | xargs)";; esac
   WINDOW_DAYS=7; case "$V" in ''|*[!0-9]*) : ;; *) WINDOW_DAYS="$V";; esac
   [ "$WINDOW_DAYS" -gt 90 ] 2>/dev/null && WINDOW_DAYS=90
   [ "$WINDOW_DAYS" -lt 1 ] 2>/dev/null && WINDOW_DAYS=7
   ```

2. **Guard the ledger.** The recap is synthesis-only — no ledger, nothing to show.
   ```bash
   CSV=memory/token-usage.csv
   if [ ! -s "$CSV" ] || [ "$(wc -l < "$CSV")" -lt 2 ]; then
     ./notify "weekly-aeoncard skipped: memory/token-usage.csv absent or empty (no runs recorded yet)"
     exit 0   # WEEKLY_AEONCARD_NO_DATA
   fi
   ```

3. **Derive the instance name + image link.** From the git origin, so the card self-labels and the notification deep-links the committed SVG.
   ```bash
   REMOTE="$(git remote get-url origin 2>/dev/null)"
   REPO="$(echo "$REMOTE" | sed -E 's#.*github.com[:/]([^/]+/[^/.]+)(\.git)?/?$#\1#')"
   INSTANCE="${REPO#*/}"; [ -n "$INSTANCE" ] || INSTANCE=aeon
   SVG="output/images/weekly-aeoncard-${today}.svg"
   IMG_LINK="https://github.com/${REPO}/blob/main/${SVG}"
   ```

4. **Render the card + artifacts.** One call writes the SVG (canonical image), a best-effort PNG, the markdown report, the dashboard spec, and appends the run log. It prints a one-line JSON summary on stdout — capture it.
   ```bash
   mkdir -p output/images output/articles apps/dashboard/outputs
   # The PNG (a raster copy committed next to the SVG) needs a rasterizer. The workflow stages `rsvg-convert`
   # (librsvg2-bin) for this skill before the run — the agent allowlist blocks in-run
   # pip/apt. render_card.py uses cairosvg if importable, else rsvg-convert, else SVG-only.
   SUMMARY="$(python3 skills/weekly-aeoncard/render_card.py \
     --csv "$CSV" --today "${today}" --window-days "$WINDOW_DAYS" \
     --instance "$INSTANCE" --img-link "$IMG_LINK" \
     --out "$SVG" \
     --png "output/images/weekly-aeoncard-${today}.png" \
     --report "output/articles/weekly-aeoncard-${today}.md" \
     --dashboard "apps/dashboard/outputs/weekly-aeoncard.json" \
     --log "memory/logs/${today}.md")"
   RC=$?
   if [ "$RC" -ne 0 ]; then
     ./notify "weekly-aeoncard: render failed (rc=$RC) — ledger unreadable"
     exit 0
   fi
   ```
   All writes land under `output/` and `apps/dashboard/outputs/` - paths the run commits. The PNG is a raster copy committed next to the SVG (needs `cairosvg` or `rsvg-convert`); if neither is available the SVG stands alone as the canonical image. Either way the notify is a text recap + link.

5. **Read the numbers back.** Parse `$SUMMARY` for the notification (it holds `week_human`, `week_runs`, `life_human`, `life_runs`, `since`, `cache_read_pct`, `top_week`):
   ```bash
   WK=$(echo "$SUMMARY" | jq -r .week_human); WKR=$(echo "$SUMMARY" | jq -r .week_runs)
   LF=$(echo "$SUMMARY" | jq -r .life_human); LFR=$(echo "$SUMMARY" | jq -r .life_runs)
   SINCE=$(echo "$SUMMARY" | jq -r .since)
   TOP=$(echo "$SUMMARY" | jq -r '[.top_week[:3][] | "\(.[0]) \(.[1]/1e6|floor)M"] | join(", ")')
   PNG=$(echo "$SUMMARY" | jq -r '.png // ""')   # empty when no rasterizer was available
   ```

6. **Log.** The render step already appended a `### weekly-aeoncard` block to `memory/logs/${today}.md` (window, weekly + all-time totals, top skills, image path, `WEEKLY_AEONCARD_OK`). Do not duplicate it.

7. **Notify.** If `MODE` is `dry-run`, skip this step (log `WEEKLY_AEONCARD_DRY_RUN` and stop - the image, report, and dashboard spec are already written). Otherwise send the recap + the committed card link via `./notify -f`. `./notify` is text-only: it has no `--photo`/`--video` flag (an unknown flag exits 2 and sends nothing), so never attach the image:
   ```bash
   [ "$MODE" = dry-run ] && exit 0
   BODY="This week (${WINDOW_DAYS}d): ${WK} tokens · ${WKR} runs
   All-time: ${LF} tokens · ${LFR} runs (since ${SINCE})
   Top this week: ${TOP}
   Card: ${IMG_LINK}"
   # Body from a file (any length); the card itself ships as the IMG_LINK in the body.
   NOTE_FILE="${TMPDIR:-/tmp}/weekly-aeoncard-notify.md"
   echo "$BODY" > "$NOTE_FILE"
   ./notify --title "Weekly Aeon Card - ${INSTANCE}" -f "$NOTE_FILE"
   ```

## Network note

The skill issues no `gh api` and puts no secrets on the command line. Stats are read from `memory/token-usage.csv`; the card is rendered by `skills/weekly-aeoncard/render_card.py` using only the Python standard library (deterministic - `${today}` is passed in, never read from the clock). To also emit a raster PNG it uses `cairosvg` (best-effort `pip install`) or an `rsvg-convert` fallback - both optional; without them the run still succeeds with the SVG as the image. The image link is built from `git remote get-url origin` (a local read). Delivery goes through `./notify`, a text-only queue-writer (the post-run notify step owns the channel tokens and does the send).

## Constraints

- **Synthesis-only.** Every number is measured from the ledger. If the ledger is missing a skill's runs, that skill simply doesn't appear — never invent rows.
- **Write skill.** It renders and commits artifacts, so it is `mode: write` (the read-only tier withholds `Bash(python3:*)` — an interpreter is a write vector — so a Python-rendered card cannot run read-only; a Node renderer could, but this skill is honestly a write). All file writes still happen inside `render_card.py` (Python `open()`) for deterministic, single-shot output.
- **Idempotent.** Same-day reruns overwrite `output/images/weekly-aeoncard-${today}.svg`, the report, and the dashboard spec; the log block appends (one per run) so reruns show drift.
- **The SVG is the deliverable.** The PNG is a convenience for chat/social; its absence is never an error.
