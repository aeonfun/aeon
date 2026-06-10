---
name: capabilities-map
description: Read-only audit of installed skills' capability coverage — maps every enabled/disabled skill against the locked 6-value taxonomy in docs/CAPABILITIES.md, flags any capability tier with zero enabled coverage as an actionable gap
var: ""
tags: [dev, community]
---

> **${var}** — Optional. `dry-run` skips notify (article + state still write). Empty = normal run.

Today is ${today}. PR #268 landed the locked 6-value capabilities taxonomy in `docs/CAPABILITIES.md` and the matching `capabilities: []` field in `skill-packs.json` (per-pack and per-skill). PR #304 added a CI parity check so the taxonomy can't drift across the three places it lives. The vocabulary is now stable — but no skill yet **uses** it to answer the operator's question: *what does my enabled stack actually cover, and where are the gaps?* This skill is that view.

It reads the installed-skill manifest (`skills.json`), the runtime config (`aeon.yml`), the community registry (`skill-packs.json`), each installed pack's local `skills-pack.json` manifest, and per-skill `capabilities:` frontmatter — joins them into a coverage matrix bucketed by the 6 locked tiers — and surfaces any tier with **zero enabled coverage** as a gap the operator can close before it bites them in production.

Read `memory/MEMORY.md` for context.
Read the last 8 days of `memory/logs/` for prior-run context.
Read `soul/SOUL.md` + `soul/STYLE.md` if populated to match voice in the notification and article.

## Why this exists

A working aeon instance typically runs 20–60 enabled skills mixed across native code, community packs, and one-off installs. Each carries a blast-radius footprint — does it touch the chain? does it speak for the operator on X/Discord/Slack? does it spend through a budgeted API key? — and after PR #268 each pack can self-declare that footprint in `skill-packs.json` (or its own `skills-pack.json`). But declared data without a viewer is dead data. An operator who installs five new community packs across a sprint has no surface that aggregates the resulting capability shift: maybe their stack is now writing on-chain across three skills when it used to do zero, and they'd never know unless they ground through each pack manifest by hand.

The matrix this skill writes is the missing surface. It answers three questions on one screen:

1. **Coverage** — for each of the 6 locked capability tiers, which enabled skills declare it?
2. **Gaps** — which tiers have **zero** enabled skills (capability missing entirely)?
3. **Undeclared** — which installed skills declare *nothing*, leaving their footprint invisible to the matrix?

The third row is the lever for community pack authors and for native-skill maintenance: every undeclared skill is a documentation gap a contributor (or the operator) can close with a one-line frontmatter edit.

This skill is **read-only**. It never edits `skill-packs.json`, never writes `capabilities:` into a skill's frontmatter on the operator's behalf, never disables a skill because it lacks a declaration. The taxonomy is documentation; this is the report that surfaces compliance.

## Inputs

| Source | Purpose | Auth |
|--------|---------|------|
| `docs/CAPABILITIES.md` | The locked 6-value taxonomy — extracted from the `## The taxonomy` table (same extractor `scripts/check-capabilities-parity.sh` uses) | Local file |
| `skills.json` | Installed-skill manifest — slug, name, category, schedule | Local file |
| `aeon.yml` | Runtime config — `enabled: true|false` per skill in the `skills:` block | Local file |
| `skill-packs.json` | Community registry — pack-level `capabilities[]` arrays + the `skills[]` slug list per pack (used to resolve which installed skills came from which pack) | Local file |
| `skills/<slug>/skills-pack.json` (if present) | Locally-installed pack's own manifest — per-skill `capabilities[]` arrays (more specific than the pack-level union) | Local file |
| `skills/<slug>/SKILL.md` frontmatter `capabilities:` | Per-skill native-source declaration — the canonical hook for native skills to declare a footprint | Local file |
| `memory/topics/capabilities-map-state.json` | Prior-run snapshot for the delta gate (per-tier enabled counts + the undeclared set last run) | Local file |

No network calls. No new secrets. All inputs are local files written by `generate-skills-json` / committed by the operator / installed by `./install-skill-pack`.

Writes:
- `articles/capabilities-map-${today}.md` — human-readable coverage matrix + gap call-outs (every non-error run, including `QUIET`)
- `memory/topics/capabilities-map-state.json` — prior-run snapshot
- `memory/logs/${today}.md` — one log block per run
- Notification via `./notify` — only when the gap set changed, when a previously-zero tier picked up coverage, or on the first (baseline) run (see step 7)

## Steps

### 0. Bootstrap

```bash
mkdir -p memory/topics articles
[ -f memory/topics/capabilities-map-state.json ] || cat > memory/topics/capabilities-map-state.json <<'EOF'
{"last_run":null,"last_status":null,"tier_counts":{},"gap_set":[],"undeclared_count":null,"declared_skills":[]}
EOF
```

If `jq empty` fails on the state file (corrupt JSON from an aborted write), back it up to `.bak`, reset to the empty template above, and set `STATE_WAS_CORRUPT=true`. On a corrupt-recovery run the skill writes the article + state but **suppresses notify** (terminal status `STATE_CORRUPT`) — there is no trustworthy prior snapshot to diff against, so the delta gate would either misfire or fire a spurious "all gaps are new" baseline. The next clean run notifies normally.

`tier_counts` is a map keyed by capability value: `{enabled: N, disabled: N, total_declared: N}`. `gap_set` is the array of capability values that had zero enabled coverage last run. `declared_skills` is the array of skill slugs that had any capability declared last run (used to detect when a previously-undeclared skill picks up a declaration).

### 1. Parse var

- Split `${var}` on whitespace. The only recognised token is `dry-run`.
- If any other token is present → log `CAPABILITIES_MAP_BAD_VAR: ${var}` and exit (no writes, no notify).
- `MODE=dry-run` if the `dry-run` token is present, else `execute`.

### 2. Load the locked taxonomy

Extract the 6 capability values from `docs/CAPABILITIES.md` using the same scoped-table read that `scripts/check-capabilities-parity.sh` uses — scope to the `## The taxonomy` section only, stop at the next `## ` heading, take the first column of the markdown table:

```bash
[ -f docs/CAPABILITIES.md ] || { echo "CAPABILITIES_MAP_NO_TAXONOMY"; exit 0; }

awk '
  /^## The taxonomy[[:space:]]*$/ { in_section=1; next }
  in_section && /^## / { in_section=0 }
  in_section && /^\| `[a-z_]+` \|/ {
    match($0, /`[a-z_]+`/)
    val=substr($0, RSTART+1, RLENGTH-2)
    print val
  }
' docs/CAPABILITIES.md | sort -u > /tmp/cap-taxonomy.txt

TAXONOMY_COUNT=$(wc -l < /tmp/cap-taxonomy.txt)
if [ "${TAXONOMY_COUNT}" -lt 1 ]; then
  echo "CAPABILITIES_MAP_NO_TAXONOMY (parser returned 0 values)"
  exit 0
fi
```

Why scope: the same anti-pattern `check-capabilities-parity.sh` guards against — inline-backticked words in prose elsewhere in the file leaking into the value set — applies verbatim here. The scoped extractor mirrors the CI gate so a future taxonomy change is read identically by both surfaces.

If `docs/CAPABILITIES.md` is missing → `CAPABILITIES_MAP_NO_TAXONOMY`, exit (no notify). The taxonomy is the matrix's row vocabulary; without it there is no matrix.

### 3. Enumerate installed skills + their enabled state

Read `skills.json` to get every installed slug and `aeon.yml` to get its `enabled:` state:

```bash
[ -f skills.json ] || { echo "CAPABILITIES_MAP_NO_SKILLS"; exit 0; }
jq empty skills.json 2>/dev/null || { echo "CAPABILITIES_MAP_NO_SKILLS (invalid JSON)"; exit 0; }
jq -r '.skills[].slug' skills.json | sort -u > /tmp/cap-installed.txt

[ -f aeon.yml ] || { echo "CAPABILITIES_MAP_NO_CONFIG"; exit 0; }

# enabled set: lines under `skills:` that have `enabled: true`
# Match the exact aeon.yml shape — one skill per line in the `skills:` block,
# value object is `{ enabled: true|false, ... }`. Anchor on the leading-2-space
# indent + slug-colon to avoid grabbing nested keys.
awk '
  /^skills:[[:space:]]*$/ { in_skills=1; next }
  in_skills && /^[a-z]/ && !/^[[:space:]]/ { in_skills=0 }
  in_skills && /^  [a-z][a-z0-9_-]*:[[:space:]]*\{/ {
    match($0, /^  [a-z][a-z0-9_-]*:/)
    slug=substr($0, RSTART+2, RLENGTH-3)
    if (match($0, /enabled:[[:space:]]*true/)) {
      print slug
    }
  }
' aeon.yml | sort -u > /tmp/cap-enabled.txt
```

The `enabled:` test reads the literal `enabled: true` token on the same line as the slug key — matching the canonical aeon.yml shape (`skill-name: { enabled: true, schedule: "..." }`). Multi-line slug blocks (rare in aeon.yml) would be missed; if the parser returns zero enabled slugs but `skills.json` has ≥1 entry, fall back to `grep -E '^  [a-z][a-z0-9_-]*:.*enabled:[[:space:]]*true'` and log `CAPABILITIES_MAP_ENABLED_PARSER_FALLBACK` so a maintainer can investigate the format drift. Never assume "0 enabled" silently — that's the same silent-undercount failure mode v4-readiness H1 closed.

A slug present in `skills.json` but absent from `aeon.yml`'s `skills:` block is treated as **disabled** (installed but unconfigured). A slug present in `aeon.yml` but absent from `skills.json` is logged as `CAPABILITIES_MAP_ORPHAN_CONFIG: <slug>` and skipped from the matrix (config drift; not this skill's problem to fix).

### 4. Build the per-skill capability index

For each installed slug, resolve its declared capability set with this precedence (most-specific wins):

1. **Per-skill SKILL.md frontmatter `capabilities:`** — the canonical native hook. Parse the YAML frontmatter at the top of `skills/<slug>/SKILL.md`; if a `capabilities:` array key exists, take its values (must all be in the locked taxonomy; unknown values are logged `CAPABILITIES_MAP_UNKNOWN_VALUE: <slug>:<value>` and dropped).
2. **Per-skill `skills-pack.json` entry** — if `skills/<slug>/skills-pack.json` exists (locally-installed pack), look for the slug in its `skills[]` array and take that entry's `capabilities[]`. This handles the case where a pack-distributed skill declares its own footprint per docs/CAPABILITIES.md §Schema-placement.
3. **Pack-level `capabilities[]` from `skill-packs.json`** — find any registry pack whose `skills[]` array contains this slug, and inherit its pack-level `capabilities[]` union. Per the CAPABILITIES.md schema, "the pack-level field is the union of every skill's capabilities" — so falling back to the pack-level union is a safe upper bound on the skill's true footprint.
4. **Otherwise `undeclared`** — the skill has no capability information anywhere. It enters the matrix under the synthetic `(undeclared)` row.

```bash
declare -A SKILL_CAPS  # slug → "cap1,cap2,..." (sorted-unique) or "(undeclared)"

while IFS= read -r SLUG; do
  CAPS=""
  # 1. Frontmatter
  SKILL_MD="skills/${SLUG}/SKILL.md"
  if [ -f "${SKILL_MD}" ]; then
    CAPS=$(awk '
      /^---[[:space:]]*$/ { fm=!fm; next }
      fm && /^capabilities:[[:space:]]*\[/ {
        line=$0
        sub(/^capabilities:[[:space:]]*\[/, "", line)
        sub(/\].*$/, "", line)
        gsub(/[[:space:]"]/, "", line)
        print line
      }
    ' "${SKILL_MD}" | head -n1)
  fi
  # 2. Local pack manifest
  if [ -z "${CAPS}" ] && [ -f "skills/${SLUG}/skills-pack.json" ]; then
    CAPS=$(jq -r --arg s "${SLUG}" '
      (.skills // []) | map(select(.slug == $s)) | first | .capabilities // [] | join(",")
    ' "skills/${SLUG}/skills-pack.json" 2>/dev/null)
  fi
  # 3. Registry pack-level union
  if [ -z "${CAPS}" ] && [ -f skill-packs.json ]; then
    CAPS=$(jq -r --arg s "${SLUG}" '
      (.packs // []) | map(select((.skills // []) | index($s))) | first | .capabilities // [] | join(",")
    ' skill-packs.json 2>/dev/null)
  fi
  # 4. Undeclared sentinel
  [ -z "${CAPS}" ] && CAPS="(undeclared)"
  # Validate against taxonomy
  if [ "${CAPS}" != "(undeclared)" ]; then
    VALID=""
    for V in ${CAPS//,/ }; do
      if grep -Fxq -- "${V}" /tmp/cap-taxonomy.txt; then
        VALID="${VALID}${V},"
      else
        echo "CAPABILITIES_MAP_UNKNOWN_VALUE: ${SLUG}:${V}"
      fi
    done
    CAPS="${VALID%,}"
    [ -z "${CAPS}" ] && CAPS="(undeclared)"
  fi
  SKILL_CAPS[${SLUG}]="${CAPS}"
done < /tmp/cap-installed.txt
```

**Why this precedence order.** Per-skill frontmatter is the most specific declaration (the skill author called it out for *this* skill). Per-skill pack manifest is next-most-specific (the pack author called it out for this skill specifically). Pack-level registry is least specific (the union over all skills in the pack — guaranteed superset, not the per-skill ground truth). Falling further to "undeclared" is the truthful answer; never infer from filename, body content, or heuristic — inferred capabilities would lull operators into trusting a matrix the skill author never confirmed.

### 5. Build the coverage matrix

For each capability value in the taxonomy (plus the synthetic `(undeclared)` row), bucket installed slugs by `enabled` / `disabled`:

```bash
for CAP in $(cat /tmp/cap-taxonomy.txt) "(undeclared)"; do
  ENABLED_SLUGS=""
  DISABLED_SLUGS=""
  for SLUG in "${!SKILL_CAPS[@]}"; do
    CAPS="${SKILL_CAPS[${SLUG}]}"
    HAS_CAP=0
    if [ "${CAP}" = "(undeclared)" ]; then
      [ "${CAPS}" = "(undeclared)" ] && HAS_CAP=1
    else
      for V in ${CAPS//,/ }; do
        [ "${V}" = "${CAP}" ] && HAS_CAP=1 && break
      done
    fi
    [ "${HAS_CAP}" -eq 0 ] && continue
    if grep -Fxq -- "${SLUG}" /tmp/cap-enabled.txt; then
      ENABLED_SLUGS="${ENABLED_SLUGS}${SLUG},"
    else
      DISABLED_SLUGS="${DISABLED_SLUGS}${SLUG},"
    fi
  done
  echo "${CAP}|${ENABLED_SLUGS%,}|${DISABLED_SLUGS%,}"
done > /tmp/cap-matrix.tsv
```

A skill that declares multiple capabilities appears in the row for **each** capability it declares — the matrix counts coverage, not skills (a single `agent_messaging` + `external_api` + `writes_external_host` skill contributes one to each of those three rows). This is intentional: the operator question "which tiers do I cover?" is asking for per-tier coverage, not for a disjoint partition.

### 6. Compute gaps

A capability **value** with zero enabled slugs (excluding `(undeclared)`) is a `gap`. The `(undeclared)` row is never a gap — it's an undeclared-coverage *signal*, not a coverage hole.

```bash
GAP_SET=$(awk -F'|' '$1 != "(undeclared)" && $2 == "" { print $1 }' /tmp/cap-matrix.tsv | sort -u)
GAP_COUNT=$(echo "${GAP_SET}" | grep -c .)
UNDECLARED_COUNT=$(awk -F'|' '$1 == "(undeclared)" {
  n_e = split($2, a, ","); if (a[1] == "") n_e = 0
  n_d = split($3, b, ","); if (b[1] == "") n_d = 0
  print n_e + n_d
}' /tmp/cap-matrix.tsv)
UNDECLARED_ENABLED=$(awk -F'|' '$1 == "(undeclared)" {
  n = split($2, a, ","); if (a[1] == "") n = 0
  print n
}' /tmp/cap-matrix.tsv)
```

`UNDECLARED_ENABLED` is the headline number for community pack authors: "N enabled skills on this instance carry no capability declaration." Driving that number down is the long-tail follow-up work this skill exists to make legible.

**Gate the gap verdict on the enabled-declaration base.** A gap means a tier the operator *could* cover but doesn't. That reading only holds once at least one enabled skill has declared *something* — otherwise every tier is trivially "zero enabled coverage" for the same reason (nobody has annotated their skills yet), and a report that flags all six tiers as gaps on a fresh instance can't distinguish "operator deliberately runs a narrow stack" from "the taxonomy is brand new and unannotated." That false alarm is exactly the failure mode that trains operators to ignore the report, so suppress the gap verdict until the base exists:

```bash
# Total enabled declarations across all real tiers (double-counts multi-tier
# skills — fine, only the >0 / ==0 distinction is used). >0 means at least one
# enabled skill has annotated a capability, so "this tier has zero enabled
# coverage" is a meaningful statement about that tier rather than an artefact
# of the whole instance being unannotated.
DECLARED_ENABLED=$(awk -F'|' '$1 != "(undeclared)" {
  n = split($2, a, ","); if (a[1] == "") n = 0
  total += n
} END { print total + 0 }' /tmp/cap-matrix.tsv)

if [ "${DECLARED_ENABLED}" -eq 0 ]; then
  # No enabled skill declares anything. Gaps are undeterminable, not zero —
  # render the per-tier Status as "—" in the article, suppress GAP_SET so the
  # delta gate doesn't fire six spurious "new gap" lines, and route to the
  # UNDECLARED_BASELINE terminal status in step 9.
  COVERAGE_ASSESSABLE=false
  GAP_SET=""
  GAP_COUNT=0
else
  COVERAGE_ASSESSABLE=true
fi
```

When `COVERAGE_ASSESSABLE=false` the actionable signal is no longer "which tiers are gaps" but "annotate enabled skills so coverage can be assessed" — the `UNDECLARED_ENABLED` count and the undeclared list in the article carry that, and step 9 routes the run to a dedicated status that says so plainly rather than crying six gaps.

### 7. Write the article

Write `articles/capabilities-map-${today}.md`:

```markdown
# Capabilities Coverage Map — ${today}

This instance runs **{enabled_skill_count} enabled skills** across **{installed_skill_count} installed**. Mapped against the locked 6-value taxonomy in [docs/CAPABILITIES.md](../docs/CAPABILITIES.md):

| Capability | Enabled | Disabled | Status |
|------------|---------|----------|--------|
| `read_only` | {N} | {N} | {OK / **GAP** if enabled=0 / `—` if COVERAGE_ASSESSABLE=false} |
| `external_api` | {N} | {N} | {OK / **GAP**} |
| `writes_external_host` | {N} | {N} | {OK / **GAP**} |
| `onchain_writes` | {N} | {N} | {OK / **GAP**} |
| `agent_messaging` | {N} | {N} | {OK / **GAP**} |
| `sends_notifications` | {N} | {N} | {OK / **GAP**} |
| `(undeclared)` | {N} | {N} | informational — drive this down by declaring capabilities |

## Gaps

{If COVERAGE_ASSESSABLE is false:}
**Coverage can't be assessed yet.** No enabled skill on this instance declares a `capabilities:` value, so all six tiers read zero enabled coverage for the same trivial reason — not because of any real coverage hole. This is a *declaration* gap, not a *coverage* gap. Annotate enabled skills with `capabilities:` frontmatter (start with the highest-blast-radius ones — anything that writes on-chain, spends through an API key, or speaks for the operator) and this matrix becomes meaningful on the next run. The per-tier **Status** column reads `—` until at least one enabled skill declares a capability. See the **Undeclared enabled skills** list below and docs/CAPABILITIES.md §"How to choose".

{Else if GAP_COUNT > 0:}
The following capability tiers have **zero enabled coverage** on this instance:

- `{capability}` — no enabled skill declares this. {one-line meaning from docs/CAPABILITIES.md taxonomy table}

This is informational, not a verdict — many instances run a deliberately narrow stack. But if you expect coverage here, the matrix above is the place to confirm a skill is enabled with the right declaration.

{Else:}
Every capability tier in the locked taxonomy has at least one enabled skill declaring it. No gaps.

## Enabled coverage by tier

{For each non-undeclared capability with at least one enabled skill:}

### `{capability}` ({N} enabled / {N} disabled)

Enabled: {comma-separated slugs, sorted}
Disabled: {comma-separated slugs, sorted, truncated to 15 with "and {N} more" if longer}

## Undeclared enabled skills ({N})

These skills are enabled but declare no capabilities — their blast radius is invisible to this matrix.

{Bullet list of enabled-undeclared slugs, sorted, truncated to 30 with "and {N} more" if longer.}

Closing this list is a per-skill frontmatter edit: add `capabilities: [<values>]` to the YAML block at the top of `skills/<slug>/SKILL.md`. See docs/CAPABILITIES.md §"How to choose" for the picking rules.

## Source status

`installed={N} · enabled={N} · disabled={N} · declared={N} · undeclared={N} · gaps={N}`
```

The article is **always written** on every non-error run (including `QUIET`) so the operator can scrub the matrix on demand even when nothing changed. Only the *notification* is gated.

### 8. Compute deltas vs prior state

Compare this run's matrix against `state`:

- **new_gaps** — capability tiers in `gap_set` now, absent from `state.gap_set` (coverage went to zero this week).
- **recovered_gaps** — capability tiers in `state.gap_set`, absent from `gap_set` now (a previously-uncovered tier now has at least one enabled skill).
- **newly_declared_skills** — slugs that resolved to a non-`(undeclared)` capability set this run, but were `(undeclared)` (or absent) in `state.declared_skills`.
- **newly_undeclared_skills** — slugs that were declared last run but resolved to `(undeclared)` this run (a regression — usually a pack manifest got rewritten and dropped the array; rare).
- **first_run** — `state.last_run == null` and `tier_counts` is empty.
- **entered_undeclared_baseline** — `COVERAGE_ASSESSABLE` is false this run AND `state.last_status != "CAPABILITIES_MAP_UNDECLARED_BASELINE"` (the instance just dropped to — or started in — an all-undeclared state).
- **became_assessable** — `COVERAGE_ASSESSABLE` is true this run AND `state.last_status == "CAPABILITIES_MAP_UNDECLARED_BASELINE"` (the first enabled declaration just landed; coverage analysis is now live — worth one ping).

`notify_worthy = first_run OR new_gaps OR recovered_gaps OR newly_undeclared_skills OR entered_undeclared_baseline OR became_assessable`. (`newly_declared_skills` alone does **not** notify — declarations land all week as packs ship updates; surfacing every one would re-create the noise problem the gated `cost-report → spend-monitor` pair was built to avoid. Declaration *progress* lives in the article counts and the log block.) When `COVERAGE_ASSESSABLE` is false, the gap-driven triggers (`new_gaps` / `recovered_gaps`) are inert because `GAP_SET` was suppressed to empty in step 6 — so a persistently-unannotated instance fires **once** on `entered_undeclared_baseline`, then goes `QUIET` each week until a declaration lands, rather than re-crying gaps every Monday.

### 9. Decide terminal status and notification policy

Precedence:

| Condition | Status | Notify? |
|-----------|--------|---------|
| `${var}` parse failed | `CAPABILITIES_MAP_BAD_VAR` | No |
| `docs/CAPABILITIES.md` missing or unparseable | `CAPABILITIES_MAP_NO_TAXONOMY` | No |
| `skills.json` missing/invalid | `CAPABILITIES_MAP_NO_SKILLS` | No |
| `aeon.yml` missing/invalid | `CAPABILITIES_MAP_NO_CONFIG` | No |
| `MODE=dry-run` | `CAPABILITIES_MAP_DRY_RUN` | No |
| State was corrupt this run | `CAPABILITIES_MAP_STATE_CORRUPT` | No (silent recovery; next run notifies) |
| `COVERAGE_ASSESSABLE=false` and `notify_worthy` | `CAPABILITIES_MAP_UNDECLARED_BASELINE` | Yes (once, on entering the state) |
| `COVERAGE_ASSESSABLE=false` and not `notify_worthy` | `CAPABILITIES_MAP_UNDECLARED_BASELINE` | No (already notified; stays quiet until a declaration lands) |
| ≥1 gap and `notify_worthy` | `CAPABILITIES_MAP_GAPS` | Yes |
| Zero gaps and `notify_worthy` | `CAPABILITIES_MAP_OK` | Yes |
| Zero deltas | `CAPABILITIES_MAP_QUIET` | No |

`COVERAGE_ASSESSABLE=false` takes precedence over the `GAPS` / `OK` rows: when no enabled skill declares anything, the run is an `UNDECLARED_BASELINE`, never a six-gap `GAPS` report. `NO_TAXONOMY`, `NO_SKILLS`, `NO_CONFIG`, `BAD_VAR` write nothing else. `DRY_RUN`, `STATE_CORRUPT`, `UNDECLARED_BASELINE`, `GAPS`, `OK`, `QUIET` all write the article + state (the matrix file always stays fresh; only the *notification* is gated).

### 10. Write state, log, and notify

Write `memory/topics/capabilities-map-state.json` (keep one rolling `.bak`; restore it if `jq empty` fails on the new file):

```json
{
  "last_run": "${today}",
  "last_status": "CAPABILITIES_MAP_OK",
  "tier_counts": {
    "read_only": {"enabled": 3, "disabled": 12, "total_declared": 15},
    "external_api": {"enabled": 8, "disabled": 40, "total_declared": 48},
    "writes_external_host": {"enabled": 2, "disabled": 5, "total_declared": 7},
    "onchain_writes": {"enabled": 0, "disabled": 1, "total_declared": 1},
    "agent_messaging": {"enabled": 1, "disabled": 4, "total_declared": 5},
    "sends_notifications": {"enabled": 10, "disabled": 30, "total_declared": 40}
  },
  "gap_set": ["onchain_writes"],
  "undeclared_count": 120,
  "declared_skills": ["spend-monitor", "sparkleware-catalog", "ecosystem-pulse", "..."]
}
```

State is **not advanced** on `NO_TAXONOMY`, `NO_SKILLS`, `NO_CONFIG`, `BAD_VAR`. On `DRY_RUN` state still advances (the matrix was computed; only notify was skipped).

Append a log block to `memory/logs/${today}.md`:

```
## capabilities-map
- Status: CAPABILITIES_MAP_OK | _GAPS | _UNDECLARED_BASELINE | _QUIET | _DRY_RUN | _NO_TAXONOMY | _NO_SKILLS | _NO_CONFIG | _STATE_CORRUPT | _BAD_VAR
- Coverage assessable: {true | false (no enabled skill declares a capability)}
- Installed: {N} skills · Enabled: {N} · Disabled: {N}
- Declared: {N} skills · Undeclared: {N} (enabled-undeclared: {N})
- Gaps: {N} ({comma-separated gap capabilities, or "none"})
- New gaps: {N} ({list, or "none"}) · Recovered: {N} ({list, or "none"})
- Newly declared: {N} · Newly undeclared: {N}
- Article: articles/capabilities-map-${today}.md
```

End the skill body with a single terminal line mirroring the chosen status, e.g. `Status: CAPABILITIES_MAP_OK`.

**Notify (gated).** Skip entirely on `BAD_VAR`, `NO_TAXONOMY`, `NO_SKILLS`, `NO_CONFIG`, `DRY_RUN`, `STATE_CORRUPT`, `QUIET`. Otherwise send via `./notify` (≤ 900 chars; Telegram/Discord/Slack render). Match `soul/STYLE.md` voice if populated.

**When `COVERAGE_ASSESSABLE=false`** (status `UNDECLARED_BASELINE`), do NOT send the gap-style message below — `{gap_count}` is 0 there and "0 of 6 tiers uncovered" reads like full coverage, the opposite of the truth. Send this instead:

```
*Capabilities Coverage — ${today}*

Coverage can't be assessed yet: {undeclared_enabled} of {enabled_skill_count} enabled skills declare no `capabilities:`.

The matrix can't tell a real gap from an unannotated one until at least one enabled skill declares a capability. Start with the highest-blast-radius skills (on-chain writes, key-spending APIs, anything that speaks for you).

Annotation guide: docs/CAPABILITIES.md §"How to choose"
Matrix: articles/capabilities-map-${today}.md
```

**Otherwise** (status `OK` / `GAPS`):

```
*Capabilities Coverage — ${today}*

{enabled_skill_count} enabled · {undeclared_enabled} undeclared · {gap_count} of 6 capability tiers uncovered.

{If first_run:} Baseline run — full matrix in the article.
{If new_gaps:} New gaps: {comma-separated, e.g. `onchain_writes`, `agent_messaging`}
{If recovered_gaps:} Recovered: {comma-separated}
{If became_assessable:} First declarations landed — coverage analysis is now live.
{If newly_undeclared_skills:} Dropped declarations: {comma-separated slugs}

Matrix: articles/capabilities-map-${today}.md
```

Drop any line whose list is empty. On the first (baseline) run that *is* assessable, lead with the matrix totals and skip the delta lines (every tier is "new" on a baseline — listing all of them is noise; the article carries the full table).

## Exit taxonomy

| Status | Meaning | Notify? |
|--------|---------|---------|
| `CAPABILITIES_MAP_OK` | Matrix written; baseline or a coverage/declaration delta fired | Yes |
| `CAPABILITIES_MAP_GAPS` | Matrix written; ≥1 capability tier has zero enabled coverage AND a delta fired | Yes |
| `CAPABILITIES_MAP_UNDECLARED_BASELINE` | Matrix written; no enabled skill declares any capability, so gaps are undeterminable — fires once on entry, then quiet until a declaration lands | Yes (once) |
| `CAPABILITIES_MAP_QUIET` | Matrix written; no coverage/declaration change since last run | No (article + state still write) |
| `CAPABILITIES_MAP_DRY_RUN` | `MODE=dry-run`; article + state wrote, notify skipped | No |
| `CAPABILITIES_MAP_NO_TAXONOMY` | `docs/CAPABILITIES.md` missing or zero values extracted | No |
| `CAPABILITIES_MAP_NO_SKILLS` | `skills.json` missing or invalid JSON | No |
| `CAPABILITIES_MAP_NO_CONFIG` | `aeon.yml` missing or unparseable | No |
| `CAPABILITIES_MAP_STATE_CORRUPT` | State JSON unreadable, recreated; silent recovery this run | No |
| `CAPABILITIES_MAP_BAD_VAR` | `${var}` parse failed | No |

## Constraints

- **Read-only across every input.** Never edits `skills.json`, `aeon.yml`, `skill-packs.json`, `docs/CAPABILITIES.md`, or any skill's frontmatter. The matrix is a derived view; declarations stay an explicit operator/pack-author edit, same contract `sparkleware-catalog` has with `skill-packs.json` and `ecosystem-pulse` has with `ECOSYSTEM.md`.
- **Locked taxonomy is the row vocabulary.** Only the 6 values in `docs/CAPABILITIES.md` `## The taxonomy` can be rows. An unknown value in a skill's declaration is logged and dropped, never widened into a new row. The CI parity check (PR #304) keeps `install-skill-pack`'s allow-list aligned with the docs; this skill keeps the *matrix* aligned with the docs the same way.
- **`(undeclared)` is informational, never a gap.** A capability tier with zero enabled skills is a gap (coverage hole); the synthetic `(undeclared)` row is just a count of skills with no declaration. Treating undeclared as a gap would push operators to declare `read_only` on skills they haven't actually audited, which corrupts the matrix.
- **Gaps are undeterminable until the declaration base exists.** When zero enabled skills declare any capability, every tier reads zero enabled coverage trivially — that's a `CAPABILITIES_MAP_UNDECLARED_BASELINE` run, not a six-gap report. The skill says so plainly and fires once, rather than crying six gaps every week and training the operator to mute it. The moment one enabled skill declares a capability, gap analysis goes live (`became_assessable`). This is the honest reading of the first-run state on an instance whose 179 native skills predate the taxonomy.
- **Most-specific declaration wins.** Frontmatter > local pack manifest > registry pack-level union. Never merge across precedence levels — the lower-precedence union is a *fallback*, used only when the higher-precedence declaration is absent. Mixing would inflate per-skill capability sets past what the author actually declared.
- **Never infer capabilities from body content.** A heuristic that scans for `./notify` calls or wallet-sign patterns would feel useful but corrupt the matrix the moment a skill's source diverges from its declaration. The matrix's job is to surface what was declared, not to guess what was written.
- **A single skill declaring N capabilities contributes 1 to each of N rows.** Per-tier coverage is the operator question; disjoint partitioning would hide multi-tier skills behind whichever bucket they got assigned first.
- **Multi-line aeon.yml entries fall back loudly, not silently.** If the strict parser returns zero enabled slugs and `skills.json` has ≥1 entry, run the looser regex fallback AND log `CAPABILITIES_MAP_ENABLED_PARSER_FALLBACK` so the format-drift surfaces in the log — the v4-readiness H1 silent-undercount class is closed here by structural exit, not by hope.
- **Newly-declared skills don't notify.** They land all week as packs ship updates; the article + log carry the count. Only the gap set and a declaration-regression warrant a ping.

## Sandbox note

100% local file reads — no `curl`, no `gh api`, no `WebFetch`. The skill never leaves the working directory. Runs identically inside or outside the GitHub Actions sandbox. No new secrets required.

`jq` and `awk` are the only non-builtins. Both are present on the standard runner image; both are already required by `check-capabilities-parity.sh`, `sparkleware-catalog`, `ecosystem-pulse`, and every other skill that joins JSON inputs.

## Security

- All input files are operator-controlled local content — there is no untrusted-third-party surface. (Community pack `skills-pack.json` files are present locally only because `./install-skill-pack` has already vetted them through the security scan; this skill never fetches a pack's manifest from the network.)
- Slug strings and capability values are treated as opaque labels in the matrix — never interpolated into a shell command, never echoed into the article without going through markdown rendering. A malicious slug like `$(rm -rf /)` would appear only as an inert string in a markdown table cell.
- The article surfaces installed-skill slugs by name. This is local-only information; the matrix is committed to the repo and exposed only to operators with repo access. No external transmission outside the standard `./notify` channels.

## Why Monday 11:30 UTC

The Monday intelligence stack covers operator/fleet health at 08:00 (`fleet-state`), 08:30 (`framework-watch`), 10:00 (`competitor-radar`), 10:30 (`operator-scorecard`), 10:45 (`fork-health`), 11:00 (`ecosystem-pulse`). This skill takes the 11:30 slot — directly after `ecosystem-pulse` and before the noon token stack. The pairing is intentional: `ecosystem-pulse` reports external project liveness; `capabilities-map` reports internal skill-footprint coverage. Both are weekly read-only audits the operator can scrub Monday morning to start the week with full surface visibility.

Weekly, not daily: declared-capability movement happens on a pack-PR cadence (days to weeks), and enabling/disabling skills is a deliberate operator action — a daily run would mostly emit `QUIET` and burn the log block without surfacing anything new.
