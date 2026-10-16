#!/usr/bin/env bash
# Usage: ./notify-jsonrender <skill_name> <markdown_output>
# Converts skill markdown output into a json-render spec via Haiku,
# then writes it to apps/dashboard/outputs/ for the dashboard feed.
# Works with both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN.
set -euo pipefail

SKILL="$1"
CONTENT="$2"
MODEL="claude-haiku-5-5"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
OUTDIR="apps/dashboard/outputs"
OUTFILE="$OUTDIR/${SKILL}-${TIMESTAMP}.json"

mkdir -p "$OUTDIR"

SYSTEM='You convert skill notification output into a json-render spec for a dashboard feed card. Your job is to FAITHFULLY represent ALL content — not to summarize it.

Output a json-render spec as a single JSON object: { "root": "<id>", "state": {}, "elements": { "<id>": { "type": "...", "props": {...}, "children": [...] } } }

COMPONENTS (use ONLY these — 15 total):

Layout:
- Card: props { title?, description? } — container, accepts children (array of element IDs)
- Stack: props { direction?: "horizontal"|"vertical", gap?: "sm"|"md"|"lg" } — flex container, accepts children
- Grid: props { columns?: number, gap?: "sm"|"md"|"lg" } — grid layout, accepts children
- Separator: props { orientation?: "horizontal"|"vertical" } — NO children, visual divider between sections

Text:
- Heading: props { text: string, level?: "h1"|"h2"|"h3"|"h4" } — NO children, content goes in text prop
- Text: props { text: string, variant?: "body"|"caption"|"muted"|"lead" } — NO children, content goes in text prop
- Badge: props { text: string, variant?: "default"|"secondary"|"destructive"|"outline" } — NO children
- Link: props { label: string, href: string } — NO children, clickable URL

Data:
- Table: props { columns: string[], rows: string[][] } — NO children, data in props
- Stat: props { label?: string, value: string, delta?: string, trend?: "up"|"down"|"neutral" } — NO children. Shows a big number with optional change. Use for prices, TVL, volume, counts
- Progress: props { value: number, max?: number (default 100), label?: string } — NO children, percentage bar

Content cards:
- TweetCard: props { author: string, handle?: string, text: string, likes?: number, retweets?: number } — NO children. Use for any tweet or social post
- StoryLink: props { title: string, href: string, source?: string, score?: string } — NO children. Use for news items, HN stories, GitHub repos, papers — anything with a title + URL
- Alert: props { title?: string, message?: string, type?: "info"|"warning"|"error"|"success" } — NO children, for warnings/advisories

Other:
- Button: props { label: string, variant?: "primary"|"secondary"|"danger" } — NO children

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown fences. Every ID in a children array must exist in elements.
2. You are a FAITHFUL TRANSCRIBER, not a summarizer. Include ALL content from the input — every line, every data point, every URL.
3. Do NOT summarize, condense, or omit anything. If the input has 10 items, the output must have 10 items.
4. ALL URLs must use Link or StoryLink (never plain text in a Text prop).
5. Use StoryLink for news items, HN stories, repos, papers — anything with title + URL + optional source.
6. Use TweetCard for tweets and social posts — not Text.
7. Use Stat for any numeric value with a label (prices, volumes, TVL, odds, counts). Put % changes in delta with trend "up" or "down".
8. Use Progress for odds and percentages that should be visualized as a bar.
9. Use Badge for tags, labels, categories, or short status indicators.
10. Use Alert for warnings, errors, or notable callouts.
11. Use Separator between major sections.
12. Wrap the whole output in one Card. Use the first heading or skill name as the Card title.'

# Use claude CLI - works with both API key and OAuth token.
# Tracing: this call runs outside run-harness, so it borrows run-harness's
# tracing (harness-adapter/lib/otel-span.sh): a root span named
# aeon:feed:<skill> plus a priced `usage <model>` row from the JSON envelope.
# No-op unless the caller sourced scripts/langfuse-otel.sh.
# Lean context: --tools "" drops the tool schemas, and running from an empty
# scratch dir skips the repo CLAUDE.md, so the call carries only the system
# prompt and the note (it used to load ~28k tokens to convert a short note).
WORK=$(mktemp -d "${TMPDIR:-/tmp}/jsonrender.XXXXXX")
RH_LIB_DIR="${GITHUB_WORKSPACE:-$PWD}/harness-adapter/lib"
RH_ROOT_SPAN_ID=""
if [ -f "$RH_LIB_DIR/otel-span.sh" ]; then
  export RH_HARNESS=claude RH_MODEL="$MODEL"
  # shellcheck source=/dev/null
  . "$RH_LIB_DIR/otel-span.sh"
  rh_trace_begin || true
fi
_jr_done() {
  local rc=$?
  if [ -n "${RH_ROOT_SPAN_ID:-}" ]; then rh_trace_end "$rc" "$WORK/out.json" || true; fi
  rm -rf "$WORK"
}
trap _jr_done EXIT

ARGS=(-p "Convert this skill output into a json-render spec. Skill: ${SKILL}"
  --model "$MODEL" --system-prompt "$SYSTEM" --tools "" --max-turns 1 --output-format json)
# Same ~1s first-turn hold as harness-adapter/adapters/claude.sh, so Claude
# Code's own spans land under the root span (see the comment there).
if [ -n "${RH_ROOT_SPAN_ID:-}" ] && [ "${CLAUDE_CODE_ENABLE_TELEMETRY:-}" = 1 ]; then
  _delay="${AEON_OTEL_STARTUP_DELAY:-1}"
  if [[ "$_delay" =~ ^[0-9]+(\.[0-9]+)?$ ]] && [ "$_delay" != 0 ]; then
    ARGS+=(--settings "{\"hooks\":{\"SessionStart\":[{\"hooks\":[{\"type\":\"command\",\"command\":\"sleep $_delay\"}]}]}}")
  fi
fi

printf '%s\n' "$CONTENT" | (cd "$WORK" && claude "${ARGS[@]}") > "$WORK/out.json" 2>/dev/null
SPEC=$(jq -r '.result // empty | strings' "$WORK/out.json")
[ -n "$SPEC" ] || { echo "json-render: $SKILL: empty result" >&2; exit 1; }

# Strip markdown fences if Haiku wraps them
SPEC=$(echo "$SPEC" | sed '/^```json$/d; /^```$/d')

# Validate it parses as JSON before writing
echo "$SPEC" | jq . > "$OUTFILE"

echo "json-render: wrote $OUTFILE"
