#!/usr/bin/env bash
# validate-pack.sh — Local pre-flight validator for community skill-pack authors.
#
# Why this exists:
#   The friction before a community-pack PR isn't the PR format (the
#   PULL_REQUEST_TEMPLATE handles that) — it's "does my pack actually meet the
#   requirements `install-skill-pack` enforces?" This script runs the same
#   structural invariants the installer checks, plus the publishing-checklist
#   items from docs/community-skill-packs.md, against a LOCAL pack directory —
#   so authors catch problems before opening a PR, and maintainers have one
#   runnable definition of "valid pack" to point reviewers at.
#
# Usage:
#   ./scripts/validate-pack.sh [pack-dir]            Validate a local pack directory (default: .)
#   ./scripts/validate-pack.sh pack-dir --path sub   Manifest lives in a subdirectory (skills-pack.json under sub/)
#   ./scripts/validate-pack.sh --help                Show this help
#
# What it checks (mirrors install-skill-pack + docs/community-skill-packs.md):
#   ERROR  (fails the run, exit 1) — install-skill-pack would reject or mis-handle:
#     - skills-pack.json missing or not valid JSON
#     - skills[] missing or empty
#     - a skill with no slug, or a slug containing anything but [A-Za-z0-9_-]
#     - a skill path containing '..'
#     - a declared skill whose SKILL.md is missing on disk
#     - a capability outside the locked taxonomy (sourced from install-skill-pack)
#   WARNING (advisory, exit unaffected) — valid to install but worth fixing:
#     - missing recommended manifest fields (name/version/description/author)
#     - no LICENSE file or no manifest `license` (publishing checklist #1)
#     - SKILL.md missing frontmatter name:/description:
#     - category outside the documented vocabulary
#     - default_enabled:true on a skill that looks like it writes/sends/posts
#     - a skills/*/SKILL.md present on disk but absent from the manifest (won't install)
#
# Exit codes: 0 = no ERRORs (WARNINGs allowed), 1 = at least one ERROR, 2 = bad invocation.
#
# Sandbox note: pure-local, no network. Reads only the pack directory and the
# sibling install-skill-pack for the capability taxonomy. No env-var-auth'd
# calls, no curl — nothing the GitHub Actions sandbox blocks.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_SCRIPT="$ROOT_DIR/bin/install-skill-pack"
source "$ROOT_DIR/scripts/lib/capabilities.sh"

PACK_DIR="."
SUBPATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    --path)
      shift
      [[ $# -gt 0 ]] || { echo "--path requires an argument" >&2; exit 2; }
      SUBPATH="$1"
      ;;
    --path=*)
      SUBPATH="${1#--path=}"
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
    *)
      PACK_DIR="$1"
      ;;
  esac
  shift
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (validate-pack reads skills-pack.json with jq, same as install-skill-pack)." >&2
  exit 2
fi

if [[ ! -d "$PACK_DIR" ]]; then
  echo "Pack directory not found: $PACK_DIR" >&2
  exit 2
fi

# The directory that holds skills-pack.json (pack root, or --path subdir under it).
MANIFEST_ROOT="$PACK_DIR"
[[ -n "$SUBPATH" ]] && MANIFEST_ROOT="$PACK_DIR/${SUBPATH#/}"
MANIFEST_PATH="$MANIFEST_ROOT/skills-pack.json"

ERRORS=0
WARNINGS=0

err()  { echo "  ❌ $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo "  ⚠️  $1"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  ✅ $1"; }

# Locked capability taxonomy — extracted from install-skill-pack's
# ALLOWED_CAPABILITIES array so there is exactly ONE source of truth (the same
# array check-capabilities-parity.sh asserts against docs/CAPABILITIES.md).
# Hardcoding a copy here would add a fourth place to drift; reading it keeps
# the validator correct automatically when the taxonomy changes.
ALLOWED_CAPS=""
if [[ -f "$INSTALL_SCRIPT" ]]; then
  ALLOWED_CAPS=$(extract_allowed_capabilities "$INSTALL_SCRIPT" | tr '\n' ' ')
fi

is_allowed_cap() {
  local needle="$1" cap
  for cap in $ALLOWED_CAPS; do
    [[ "$cap" == "$needle" ]] && return 0
  done
  return 1
}

# Documented per-skill category vocabulary (docs/community-skill-packs.md).
KNOWN_CATEGORIES="research dev crypto social productivity"

echo "Validating pack: $PACK_DIR${SUBPATH:+ (manifest under $SUBPATH/)}"
echo ""

# ── 1. Manifest exists and parses ──────────────────────────────────────────
echo "Manifest (skills-pack.json):"
if [[ ! -f "$MANIFEST_PATH" ]]; then
  err "skills-pack.json not found at $MANIFEST_PATH"
  echo ""
  echo "Cannot continue without a manifest. See docs/community-skill-packs.md for the schema."
  echo "Result: ❌ 1 error, $WARNINGS warning(s)."
  exit 1
fi
if ! jq -e . "$MANIFEST_PATH" >/dev/null 2>&1; then
  err "skills-pack.json is not valid JSON"
  echo ""
  echo "Result: ❌ 1 error, $WARNINGS warning(s)."
  exit 1
fi
ok "skills-pack.json present and valid JSON"

# ── 2. Recommended top-level fields ─────────────────────────────────────────
for field in name version description author; do
  value=$(jq -r --arg f "$field" '.[$f] // ""' "$MANIFEST_PATH")
  [[ -z "$value" ]] && warn "manifest missing recommended field: $field"
done

# ── 3. License (manifest field + file on disk) ──────────────────────────────
echo ""
echo "License:"
manifest_license=$(jq -r '.license // ""' "$MANIFEST_PATH")
license_file=""
for cand in LICENSE LICENSE.md LICENSE.txt COPYING; do
  if [[ -f "$PACK_DIR/$cand" ]]; then
    license_file="$cand"
    break
  fi
done
if [[ -n "$license_file" ]]; then
  ok "license file present ($license_file)"
else
  warn "no LICENSE file at pack root — publishing checklist requires a clear license"
fi
if [[ -z "$manifest_license" ]]; then
  warn "manifest has no \"license\" field (SPDX id, e.g. \"MIT\")"
fi

# ── 4. Per-skill validation ─────────────────────────────────────────────────
echo ""
echo "Skills:"
skill_count=$(jq '.skills | length' "$MANIFEST_PATH" 2>/dev/null || echo 0)
if [[ "$skill_count" == "0" || -z "$skill_count" ]]; then
  err "manifest declares no skills (skills[] is empty or missing)"
  echo ""
  echo "Result: ❌ $ERRORS error(s), $WARNINGS warning(s)."
  exit 1
fi

# Track the manifest-declared paths so we can flag on-disk skills that aren't listed.
declared_paths=""
# Track slugs already seen so a duplicate declaration is caught before install.
seen_slugs=""

for i in $(seq 0 $((skill_count - 1))); do
  slug=$(jq -r ".skills[$i].slug // empty" "$MANIFEST_PATH")
  if [[ -z "$slug" ]]; then
    err "skill #$i has no slug"
    continue
  fi

  # Slug must be a clean directory name — same rule install-skill-pack enforces.
  if [[ "$slug" =~ [^a-zA-Z0-9_-] || "$slug" == "." || "$slug" == ".." ]]; then
    err "skill '$slug' has an invalid slug (allowed: A-Z a-z 0-9 _ -)"
    continue
  fi

  # Reject duplicate slugs — a second declaration silently overwrites the first
  # at install time. Catching it here gives the author an actionable message.
  # Space-delimited string check (portable, no associative arrays).
  case " $seen_slugs " in
    *" $slug "*) err "duplicate slug '$slug' — declared more than once in the manifest"; continue ;;
  esac
  seen_slugs="$seen_slugs $slug"

  rel_path=$(jq -r ".skills[$i].path // empty" "$MANIFEST_PATH")
  [[ -z "$rel_path" ]] && rel_path="skills/$slug"
  rel_path="${rel_path#/}"
  if [[ "$rel_path" == *".."* ]]; then
    err "skill '$slug' path may not contain '..': $rel_path"
    continue
  fi
  declared_paths="$declared_paths $rel_path"

  skill_md="$MANIFEST_ROOT/$rel_path/SKILL.md"
  if [[ ! -f "$skill_md" ]]; then
    err "skill '$slug': SKILL.md not found at $rel_path/SKILL.md"
    continue
  fi

  skill_warnings=0
  skill_errors=0

  # Frontmatter conventions — name:/description: keys near the top of SKILL.md.
  head_block=$(head -30 "$skill_md")
  grep -qE '^name:[[:space:]]*\S' <<<"$head_block" || { warn "skill '$slug': SKILL.md frontmatter missing name:"; skill_warnings=$((skill_warnings + 1)); }
  grep -qE '^description:[[:space:]]*\S' <<<"$head_block" || { warn "skill '$slug': SKILL.md frontmatter missing description:"; skill_warnings=$((skill_warnings + 1)); }

  # Category — optional, but if present should be in the documented vocabulary.
  cat=$(jq -r ".skills[$i].category // empty" "$MANIFEST_PATH")
  if [[ -n "$cat" ]] && ! grep -qw "$cat" <<<"$KNOWN_CATEGORIES"; then
    warn "skill '$slug': category '$cat' is outside the documented set ($KNOWN_CATEGORIES)"
    skill_warnings=$((skill_warnings + 1))
  fi

  # Capabilities — locked taxonomy. install-skill-pack rejects unknown values,
  # so flag them as ERROR here too (catches the install-time failure early).
  caps_type=$(jq -r ".skills[$i].capabilities | type" "$MANIFEST_PATH")
  if [[ "$caps_type" != "null" && "$caps_type" != "array" ]]; then
    err "skill '$slug': capabilities must be an array (got $caps_type)"
    skill_errors=$((skill_errors + 1))
  elif [[ "$caps_type" == "array" && -n "$ALLOWED_CAPS" ]]; then
    while IFS= read -r cap_value; do
      [[ -z "$cap_value" ]] && continue
      if ! is_allowed_cap "$cap_value"; then
        err "skill '$slug': unknown capability '$cap_value' (allowed: ${ALLOWED_CAPS%% } — see docs/CAPABILITIES.md)"
        skill_errors=$((skill_errors + 1))
      fi
    done < <(jq -r ".skills[$i].capabilities[]? // empty" "$MANIFEST_PATH")
  fi

  # default_enabled:true on a write/send/post skill — the security concern the
  # publishing model cares about (operator should opt in, not inherit it on).
  # Prefer the declared capabilities; fall back to a conservative keyword scan
  # of the SKILL.md body. WARNING, not ERROR — a maintainer may have a reason.
  default_enabled=$(jq -r ".skills[$i].default_enabled // false" "$MANIFEST_PATH")
  if [[ "$default_enabled" == "true" ]]; then
    write_cap=$(jq -r ".skills[$i].capabilities // [] | map(select(. == \"writes_external_host\" or . == \"onchain_writes\" or . == \"agent_messaging\")) | length" "$MANIFEST_PATH")
    if [[ "$write_cap" != "0" ]]; then
      warn "skill '$slug': default_enabled:true on a skill declaring write/onchain/messaging capabilities — prefer false so the operator opts in"
      skill_warnings=$((skill_warnings + 1))
    elif grep -qiE '\b(POST|PUT|DELETE|transfer|withdraw|\bbet\b|send-tx|sendtransaction)\b' "$skill_md"; then
      warn "skill '$slug': default_enabled:true and SKILL.md mentions write/send actions — confirm it should ship enabled (prefer false)"
      skill_warnings=$((skill_warnings + 1))
    fi
  fi

  [[ "$skill_warnings" == "0" && "$skill_errors" == "0" ]] && ok "skill '$slug' — $rel_path/SKILL.md"
done

# ── 5. On-disk skills missing from the manifest (won't be installed) ─────────
if [[ -d "$MANIFEST_ROOT/skills" ]]; then
  while IFS= read -r found_md; do
    found_path="skills/$(basename "$(dirname "$found_md")")"
    case " $declared_paths " in
      *" $found_path "*) ;;
      *) warn "found $found_path/SKILL.md on disk but it's not in the manifest — it won't be installed" ;;
    esac
  done < <(find "$MANIFEST_ROOT/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -type f 2>/dev/null | sort)
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [[ "$ERRORS" -eq 0 ]]; then
  echo "Result: ✅ pack is valid — $WARNINGS warning(s). Ready to open a PR (see .github/PULL_REQUEST_TEMPLATE.md)."
  exit 0
else
  echo "Result: ❌ $ERRORS error(s), $WARNINGS warning(s). Fix the errors before opening a PR."
  exit 1
fi
