#!/usr/bin/env bash
set -euo pipefail

# skill-scan.sh — Security scanner for SKILL.md files
#
# Usage:
#   ./scripts/skill-scan.sh <path-to-SKILL.md>
#   ./scripts/skill-scan.sh skills/my-skill/SKILL.md
#   ./scripts/skill-scan.sh --all              # Scan all skills
#   ./scripts/skill-scan.sh --all --json        # JSON output
#
# Exit codes:
#   0 = PASS (no HIGH findings)
#   1 = FAIL (HIGH severity findings detected)
#   2 = Usage error

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TRUSTED_FILE="$REPO_ROOT/skills/security/trusted-sources.txt"

# Colors (disabled if not a terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; NC=''
fi

JSON_OUTPUT=false
SCAN_ALL=false
FILES=()

usage() {
  echo "Usage: $0 <SKILL.md path> [--json]"
  echo "       $0 --all [--json]"
  exit 2
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) SCAN_ALL=true; shift ;;
    --json) JSON_OUTPUT=true; shift ;;
    --help|-h) usage ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *) FILES+=("$1"); shift ;;
  esac
done

if [[ "$SCAN_ALL" == "true" ]]; then
  while IFS= read -r f; do
    FILES+=("$f")
  done < <(find "$REPO_ROOT/skills" -maxdepth 2 -name "SKILL.md" -type f 2>/dev/null | sort)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files to scan." >&2
  usage
fi

# Load trusted sources
TRUSTED_OWNERS=()
TRUSTED_REPOS=()
if [[ -f "$TRUSTED_FILE" ]]; then
  while IFS= read -r line; do
    line="${line%%#*}"  # strip comments
    line="${line// /}"  # strip whitespace
    [[ -z "$line" ]] && continue
    if [[ "$line" == */* ]]; then
      TRUSTED_REPOS+=("$line")
    else
      TRUSTED_OWNERS+=("$line")
    fi
  done < "$TRUSTED_FILE"
fi

# ---------- Pattern definitions ----------

# HIGH severity: immediate risk of code execution or data exfiltration.
#
# NOTE: patterns must be POSIX Extended Regular Expressions — grep -E does NOT
# understand PCRE escapes like \s (whitespace) or \b (word boundary). Use
# [[:space:]] for whitespace and explicit character-class anchors for word
# boundaries. See AntFleet finding H6 (Issue #184).
#
# CALIBRATION (see docs/skill-scan-calibration.md): HIGH is split into two
# intents so it fires on dangerous *operations*, not ordinary shell syntax. The
# earlier ruleset matched benign template interpolation (`${today}` in inline
# code), normal command substitution (`$(echo "$x")`), and any `curl` near an
# uppercase var (legitimate authenticated API calls). That FAILed 65 of this
# repo's own 67 skills — and a gate that rejects first-party code trains everyone
# to run `--force`, disabling it for the untrusted packs it exists to guard.

# HIGH · SINKS — real code-execution / exfiltration / destruction. These match
# the dangerous act itself, so they hold wherever the text appears.
HIGH_SINK_PATTERNS=(
  # Arbitrary code execution
  'eval[[:space:]]'
  'eval\('
  # Remote code execution: a download piped straight into an interpreter, or fed
  # to one via process substitution (`bash <(curl …)`, `source <(curl …)`,
  # `. <(curl …)`). The pipe form tolerates a sudo/xargs wrapper before the
  # interpreter; the procsub form also covers `source` and `.` (which read+run).
  '(curl|wget)[^|]*\|[[:space:]]*((sudo|xargs)[[:space:]]+)*(sh|bash|zsh|ksh|dash|python[0-9.]*|perl|ruby|node|php)([[:space:]]|$|;|&)'
  '(sh|bash|zsh|ksh|dash|python[0-9.]*|perl|ruby|node|php|source|\.)[[:space:]]+<\([^)]*(curl|wget)'
  # Secret exfiltration: a secret / env var sent as request *data* to a host.
  # (Auth headers like `-H "Authorization: Bearer $KEY"` are NOT data and do not
  # match — that is a skill calling its own declared endpoint, not exfiltration.)
  'curl.*(--data|--data-raw|--data-binary|[[:space:]]-d[[:space:]]).*(\$[A-Z_]{3,}|secret|token|password|api.?key)'
  'wget.*(--post-data|--post-file).*(\$[A-Z_]{3,}|secret|token|password|api.?key)'
  # `-d`/`--data` with no space before the value (e.g. -d"k=$TOKEN") — the space-
  # anchored `-d ` alternative above does not catch the quoted, spaceless spelling.
  'curl[^|]*[[:space:]]-d["'\''][^"'\'']*(\$[A-Z_]{3,}|secret|token|password|api.?key)'
  # Dump the environment to the network
  'printenv.*\|.*(curl|wget|nc)'
  'env[[:space:]].*\|.*(curl|wget|nc)'
  'cat.*/proc/.*environ'
  # Direct exfil of well-known bot / secret tokens
  '\$TELEGRAM_BOT_TOKEN'
  '\$DISCORD_BOT_TOKEN'
  '\$SLACK_BOT_TOKEN'
  '\$GITHUB_TOKEN.*(curl|wget|nc)'
  # Destructive commands. Bare root (`rm -rf /`), a root glob (`rm -rf /*`), and a
  # top-level system dir (`rm -rf /etc`, `/usr`, …) are all catastrophic wipes.
  # The flag run is matched spelling-agnostically — `([-][a-zA-Z-]+[[:space:]]+)*`
  # accepts any order/combination (`-rf`, `-fr`, `-rfv`, `-r --force`,
  # `--no-preserve-root`) rather than a literal `-rf`, so those do not slip past.
  # An optional leading quote (`["']?`) catches a quoted target (`rm -rf "/etc"`).
  # Sub-paths like `rm -rf /tmp/build` are still not matched (target must be root,
  # the glob, or a system dir) so first-party build steps do not trip it.
  'rm[[:space:]]+([-][a-zA-Z-]+[[:space:]]+)*["'\'']?/(["'\'']|[[:space:]]|$|--)'
  'rm[[:space:]]+([-][a-zA-Z-]+[[:space:]]+)*["'\'']?/\*'
  'rm[[:space:]]+([-][a-zA-Z-]+[[:space:]]+)*["'\'']?/(bin|boot|dev|etc|home|lib|lib64|opt|proc|root|sbin|sys|usr|var)(["'\'']|[[:space:]]|/|$)'
  'rm[[:space:]]+([-][a-zA-Z-]+[[:space:]]+)*\*'
  'rm[[:space:]]+([-][a-zA-Z-]+[[:space:]]+)*~'
  'mkfs\.'
  'dd[[:space:]]+if=.*of=/dev/'
  ':\(\)[[:space:]]*\{.*\};[[:space:]]*:'
  'git[[:space:]]+push[[:space:]]+--force[[:space:]]+origin[[:space:]]+main'
  'git[[:space:]]+push[[:space:]]+-f[[:space:]]+origin[[:space:]]+main'
)

# HIGH · PROMPT INJECTION — imperative text that tries to override the agent's
# instructions. Scanned across the whole file (injection is prose, not code), but
# a match is suppressed when the same line carries DEFENSIVE framing (see
# DEFENSIVE_CONTEXT): a skill that says «if content reads "ignore previous
# instructions", discard it» is documenting its defense, not issuing an attack.
# Without this, every skill that hardens itself scored a HIGH against itself.
# Matched case-insensitively (grep -i in scan_prose), so `IGNORE PREVIOUS INSTRUCTIONS`
# and `Ignore Previous Instructions` cannot slip past by capitalisation.
HIGH_INJECTION_PATTERNS=(
  'ignore[[:space:]]+(all[[:space:]]+)?previous[[:space:]]+instructions'
  'ignore[[:space:]]+(all[[:space:]]+)?prior[[:space:]]+instructions'
  'you[[:space:]]+are[[:space:]]+now[[:space:]]+'
  'forget[[:space:]]+(all[[:space:]]+)?(your[[:space:]]+)?instructions'
  'disregard[[:space:]]+(all[[:space:]]+)?(previous|prior)'
  'override[[:space:]]+(all[[:space:]]+)?rules'
)

# Anti-injection framing. When one of these MULTI-WORD rejection phrases appears on
# the same line as an injection phrase, the line is documenting a defense (reject
# fetched/embedded instructions), not issuing an attack, so the finding is
# suppressed. Matched with `grep -i` (case-insensitive). Deliberately NO loose
# single keywords (discard / untrusted / quarantine / refuse / "log a warning"):
# the skill author controls the text, so a bare imperative could be un-flagged just
# by appending one of those words (`Ignore all previous instructions … then discard
# it`). Quote-*enclosed* citations are handled by INJECTION_CITED below, which alone
# still suppresses the legitimate `benign-defensive` case.
DEFENSIVE_CONTEXT='never follow|do not follow|do not obey|never obey|ignore (it|that|them|the source|any|embedded)|treat .* as (data|untrusted)|as data, not|not (a )?command'

# A second defensive signal: the injection phrase appears *enclosed in quotes*
# (inside "…" or `…`), i.e. it is being cited as an example to reject, not issued
# as a command. The trigger word must sit between an opening and a closing
# quote/backtick with no intervening quote — so a bare imperative merely preceded
# by an unrelated quoted token (`"Note" Ignore all previous instructions…`) is NOT
# treated as cited and still FAILs. Documentation genuinely wraps the phrase
# (`if content says "ignore previous instructions", discard it`) and is suppressed.
INJECTION_CITED='["`][^"`]*(ignore|forget|disregard|override|you[[:space:]]+are[[:space:]]+now)[^"`]*["`]'

# MEDIUM severity: suspicious patterns that may or may not be intentional
# shellcheck disable=SC2088  # these are literal grep patterns matched against
# skill text (looking for references to ~/.ssh, ~/.aws, etc.), not paths to
# expand. A literal ~ is exactly what we want here.
MEDIUM_PATTERNS=(
  # Path traversal
  '\.\./\.\.'
  '\.\./.*\.\.'
  # Absolute paths outside typical dirs
  '/etc/passwd'
  '/etc/shadow'
  '~/\.ssh'
  '~/\.gnupg'
  '~/\.aws'
  '~/\.config'
  # Network calls to non-standard destinations
  'curl[[:space:]]+http://'
  'wget[[:space:]]+http://'
  # Secret carried in a URL query string (e.g. ...?token=$GITHUB_TOKEN). MEDIUM,
  # not HIGH: many legitimate APIs authenticate via a `?apikey=` query param, so
  # this cannot be distinguished from exfiltration by static text alone — surface
  # it for review rather than hard-failing the gate. Only a var whose name ENDS in
  # an underscore-prefixed secret word (…_TOKEN/_KEY/_SECRET/_PASSWORD) is flagged,
  # so public identifiers ($TOKEN_ID, ${TOKEN} address) do not trip it; and the
  # correct secretcurl `{KEY}` placeholder form (no `$`) is not matched at all.
  '(curl|wget)[^|]*[?&][A-Za-z0-9_.-]+=\$\{?[A-Za-z_]*_(TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL)(\}|[^A-Za-z0-9_]|$)'
  # Unquoted variable expansion in bash blocks
  'rm[[:space:]].*\$[A-Z]'
  'chmod[[:space:]]+777'
  'chmod[[:space:]]+-R[[:space:]]+777'
  # Git force operations
  'git[[:space:]]+push[[:space:]]+--force'
  # `-f` must terminate at a word boundary so we don't false-positive on `-fast`,
  # `-force`, etc. POSIX-ERE word boundary: end-of-line OR non-word character.
  'git[[:space:]]+push[[:space:]]+-f($|[^[:alnum:]_-])'
  'git[[:space:]]+reset[[:space:]]+--hard'
  'git[[:space:]]+clean[[:space:]]+-fd'
  # Base64 encoded payloads
  'base64[[:space:]]+-d'
  'base64[[:space:]]+--decode'
  # Process manipulation
  'kill[[:space:]]+-9'
  'killall'
  'pkill'
)

# LOW severity: worth noting but usually harmless
LOW_PATTERNS=(
  # Broad file operations
  'find[[:space:]]+/[[:space:]]'
  'cat[[:space:]]+/etc/'
  # Network without explicit https
  'fetch\('
  'XMLHttpRequest'
  # Write operations outside skills/
  'tee[[:space:]]+/'
  '>[[:space:]]+/'
)

# Invisible characters: text the model reads but a reviewer never sees. Matched as
# raw UTF-8 bytes; every tool in the pipeline runs under LC_ALL=C because grep -o
# can emit a partial (invalid UTF-8) sequence that BSD tools reject in a UTF-8 locale.
#   HIGH   Unicode TAG block U+E0000-E007F (ASCII smuggling: a whole hidden sentence)
#   HIGH   bidi embedding/override/isolate U+202A-202E, U+2066-2069 (Trojan Source)
#   HIGH   variation selectors that can carry a payload (emoji smuggling: each one
#          encodes a byte): a run of 2+ of U+FE00-FE0F / U+E0100-E01EF in any mix,
#          or 2+ of U+FE00-FE0D / U+E0100-E01EF anywhere on one line (so invisible
#          separators between them do not break the count)
#   MEDIUM zero-width U+200B-200C, U+2060-2064; soft hyphen U+00AD; a lone
#          variation selector supplement char U+E0100-E01EF; U+FEFF past byte 0;
#          U+200D not between two emoji (all can split a word past the keyword rules)
# Allowed: a BOM at byte 0, U+200D joining two emoji, a lone U+FE00-FE0F (U+FE0F and
# U+FE0E pick emoji or text style), and the three real subdivision flags (England,
# Scotland, Wales), matched by exact bytes.
# Not flagged: LRM/RLM/ALM (U+200E, U+200F, U+061C); they mark direction in RTL text
# and cannot reorder it the way overrides and isolates do.
HIDDEN_TAG=$'\xf3\xa0[\x80\x81]'
HIDDEN_BIDI=$'\xe2\x80[\xaa-\xae]|\xe2\x81[\xa6-\xa9]'
HIDDEN_VS_RUN=$'(\xef\xb8[\x80-\x8f]|\xf3\xa0[\x84-\x87][\x80-\xbf]){2,}'
HIDDEN_VS_RARE=$'\xef\xb8[\x80-\x8d]|\xf3\xa0[\x84-\x87]'
HIDDEN_ZW=$'\xe2\x80[\x8b\x8c\x8d]|\xe2\x81[\xa0-\xa4]|\xc2\xad|\xef\xbb\xbf|\xf3\xa0[\x84-\x87]'
# MEDIUM: a Latin letter directly next to a Cyrillic one (U+0400-04FF) inside one word,
# e.g. `іgnore` with a Cyrillic і. Real Russian text is all-Cyrillic words and does
# not match. Greek is left out on purpose: skills write `Δprice` and `θmax`.
MIXED_SCRIPT=$'[A-Za-z][\xd0-\xd3][\x80-\xbf]|[\xd0-\xd3][\x80-\xbf][A-Za-z]'
# MEDIUM: inline CSS that hides text from a rendered view (an HTML page, a Markdown
# preview) while the model still reads it.
CSS_HIDDEN='style[[:space:]]*=[[:space:]]*["'\''][^"'\'']*(display[[:space:]]*:[[:space:]]*none|visibility[[:space:]]*:[[:space:]]*hidden|font-size[[:space:]]*:[[:space:]]*0([^.0-9]|$)|opacity[[:space:]]*:[[:space:]]*0([^.0-9]|$))'
_TAG_GB=$'\xf3\xa0\x81\xa7\xf3\xa0\x81\xa2'
_TAG_END=$'\xf3\xa0\x81\xbf'
TAG_FLAG=$'\xf0\x9f\x8f\xb4'"$_TAG_GB"$'(\xf3\xa0\x81\xa5\xf3\xa0\x81\xae\xf3\xa0\x81\xa7|\xf3\xa0\x81\xb3\xf3\xa0\x81\xa3\xf3\xa0\x81\xb4|\xf3\xa0\x81\xb7\xf3\xa0\x81\xac\xf3\xa0\x81\xb3)'"$_TAG_END"
# 4-byte emoji (U+1F000-1FAFF) or a BMP pictograph (U+2600-27BF, U+2B00-2B7F for the
# black square in a black cat or bird), optional FE0F, then ZWJ, then another emoji.
_EMOJI=$'(\xf0\x9f[\x80-\xab][\x80-\xbf]|\xe2[\x98-\x9e][\x80-\xbf]|\xe2[\xac\xad][\x80-\xbf])(\xef\xb8\x8f)?'
EMOJI_ZWJ="${_EMOJI}"$'\xe2\x80\x8d'"(${_EMOJI})"

# ---------- Scanner ----------

TOTAL_PASS=0
TOTAL_WARN=0
TOTAL_FAIL=0
JSON_RESULTS=""

# scan_tier <file> <pattern>...  — emit one "L<n>: <content> [pattern: <p>]" line
# per grep match across the tier's patterns. Bash 3.2-safe (no namerefs): the
# caller collects stdout into its highs/mediums/lows array. Extracted from three
# byte-identical per-tier loops.
scan_tier() {
  local file="$1"; shift
  local pattern matches match line_num line_content
  for pattern in "$@"; do
    matches=$(grep -nE "$pattern" "$file" 2>/dev/null || true)
    [[ -n "$matches" ]] || continue
    while IFS= read -r match; do
      line_num="${match%%:*}"
      line_content="${match#*:}"
      line_content="${line_content:0:120}"  # truncate
      printf 'L%s: %s [pattern: %s]\n' "$line_num" "$line_content" "$pattern"
    done <<< "$matches"
  done
}

# scan_tier_i <file> <pattern>...  — scan_tier, case-insensitive (CSS is).
scan_tier_i() {
  local file="$1"; shift
  local pattern matches match line_content
  for pattern in "$@"; do
    matches=$(grep -niE "$pattern" "$file" 2>/dev/null || true)
    [[ -n "$matches" ]] || continue
    while IFS= read -r match; do
      line_content="${match#*:}"
      printf 'L%s: %s [pattern: hidden by CSS]\n' "${match%%:*}" "${line_content:0:120}"
    done <<< "$matches"
  done
}

# scan_prose <file> <pattern>...  — like scan_tier, but suppresses a match when
# its line also carries anti-injection framing (DEFENSIVE_CONTEXT). Used for the
# prompt-injection tier so a skill documenting its own defense doesn't FAIL
# itself. Same "L<n>: <content> [pattern: <p>]" output contract as scan_tier.
scan_prose() {
  local file="$1"; shift
  local pattern matches match line_num line_content folded
  # Matched against the look-alike-folded text, so `іgnore` (Cyrillic і) reads as `ignore`.
  if ! folded=$(fold_confusables "$file" 2>/dev/null | LC_ALL=C tr -d '\000'); then
    printf 'L0: could not fold look-alike letters for the injection check [prompt injection]\n'
    return
  fi
  for pattern in "$@"; do
    matches=$(printf '%s\n' "$folded" | grep -niE "$pattern" 2>/dev/null || true)
    [[ -n "$matches" ]] || continue
    while IFS= read -r match; do
      line_num="${match%%:*}"
      line_content="${match#*:}"
      # Defensive framing (keyword) or a cited/quoted phrase → not an attack. Skip.
      if printf '%s' "$line_content" | grep -qiE "$DEFENSIVE_CONTEXT" \
         || printf '%s' "$line_content" | grep -qiE "$INJECTION_CITED"; then
        continue
      fi
      line_content="${line_content:0:120}"  # truncate
      printf 'L%s: %s [pattern: %s]\n' "$line_num" "$line_content" "$pattern"
    done <<< "$matches"
  done
}

# fold_confusables <file>  — the file with Cyrillic and Greek letters that render like
# Latin ones replaced by the Latin letter, byte for byte otherwise, so line numbers hold.
# Only exact look-alikes are folded; real Russian or Greek words stay unreadable as
# English, so they cannot start matching an injection phrase.
fold_confusables() {
  local s="" from to
  local -a pairs=(
    $'\xd0\xb0' a $'\xd0\xb5' e $'\xd0\xbe' o $'\xd1\x80' p $'\xd1\x81' c $'\xd1\x83' y $'\xd1\x85' x
    $'\xd1\x96' i $'\xd1\x98' j $'\xd1\x95' s $'\xd2\xbb' h $'\xd4\x81' d $'\xd4\x9b' q $'\xd4\x9d' w
    $'\xd0\x90' A $'\xd0\x92' B $'\xd0\x95' E $'\xd0\x9a' K $'\xd0\x9c' M $'\xd0\x9d' H $'\xd0\x9e' O
    $'\xd0\xa0' P $'\xd0\xa1' C $'\xd0\xa2' T $'\xd0\xa5' X $'\xd0\x86' I $'\xd0\x88' J $'\xd0\x85' S
    $'\xce\xbf' o $'\xce\xb1' a $'\xce\xb9' i $'\xce\xbd' v $'\xcf\x81' p
    $'\xce\x91' A $'\xce\x92' B $'\xce\x95' E $'\xce\x97' H $'\xce\x99' I $'\xce\x9a' K $'\xce\x9c' M
    $'\xce\x9d' N $'\xce\x9f' O $'\xce\xa1' P $'\xce\xa4' T $'\xce\xa7' X $'\xce\x96' Z
  )
  while [[ ${#pairs[@]} -gt 0 ]]; do
    from="${pairs[0]}"; to="${pairs[1]}"; pairs=("${pairs[@]:2}")
    s+="s/$from/$to/g;"
  done
  LC_ALL=C sed -e "$s" "$1"
}

# strip_allowed <file>  — the file with the allowed invisible sequences removed
# (real subdivision flags, emoji ZWJ joins, a BOM at byte 0), byte for byte otherwise.
strip_allowed() {
  local bom=$'\xef\xbb\xbf'
  LC_ALL=C sed -E -e "1s/^$bom//" -e "s/$TAG_FLAG//g" -e ":z" -e "s/$EMOJI_ZWJ/\\1\\2\\4/g" -e "tz" "$1"
}

# scan_hidden <file> <label> <byte-pattern> [min]: one "L<n>: <label> x<count>" line
# per line with at least <min> matches (default 1). The matched text is never echoed: it is invisible, and for TAG
# smuggling it is the payload itself. Same output contract as scan_tier.
# Fails closed: if the file can't be filtered or searched, that is reported as a finding.
# NUL bytes are dropped before $(...) would drop them with a noisy bash warning.
scan_hidden() {
  local file="$1" label="$2" pattern="$3" min="${4:-1}" stripped hits rc line_num count
  if ! stripped=$(strip_allowed "$file" 2>/dev/null | LC_ALL=C tr -d '\000'); then
    printf 'L0: %s: could not scan file for hidden characters [hidden characters]\n' "$label"
    return
  fi
  hits=$(printf '%s\n' "$stripped" | LC_ALL=C grep -noE "$pattern") && rc=0 || rc=$?
  if [[ $rc -gt 1 ]]; then
    printf 'L0: %s: could not scan file for hidden characters [hidden characters]\n' "$label"
    return
  fi
  [[ -n "$hits" ]] || return 0
  while IFS=: read -r line_num count; do
    printf 'L%s: %s x%s [hidden characters]\n' "$line_num" "$label" "$count"
  done < <(printf '%s\n' "$hits" | LC_ALL=C cut -d: -f1 | LC_ALL=C uniq -c | LC_ALL=C awk -v min="$min" '$1 >= min {print $2":"$1}')
}

scan_file() {
  local file="$1"
  local skill_name
  skill_name=$(basename "$(dirname "$file")")

  if [[ ! -f "$file" ]]; then
    echo -e "${RED}ERROR${NC}: File not found: $file"
    return 1
  fi

  local content
  content=$(cat "$file")

  # Collect matches per tier via scan_tier. Arrays start empty; a tier with no
  # matches stays empty (0 elements) — preserved for the Bash-3.2 ${#arr[@]} gates below.
  local highs=() mediums=() lows=() _line
  # HIGH is two tiers: operational sinks (scan_tier) + prompt injection
  # (scan_prose, which drops defensive framing). Both feed the same highs array.
  while IFS= read -r _line; do highs+=("$_line");   done < <(scan_tier  "$file" "${HIGH_SINK_PATTERNS[@]}")
  while IFS= read -r _line; do highs+=("$_line");   done < <(scan_prose "$file" "${HIGH_INJECTION_PATTERNS[@]}")
  while IFS= read -r _line; do highs+=("$_line");   done < <(scan_hidden "$file" "Unicode TAG chars (hidden ASCII text)" "$HIDDEN_TAG")
  while IFS= read -r _line; do highs+=("$_line");   done < <(scan_hidden "$file" "bidi override chars (text reads differently than shown)" "$HIDDEN_BIDI")
  while IFS= read -r _line; do highs+=("$_line");   done < <(scan_hidden "$file" "variation selector run (hidden encoded payload)" "$HIDDEN_VS_RUN")
  while IFS= read -r _line; do highs+=("$_line");   done < <(scan_hidden "$file" "variation selectors (hidden encoded payload)" "$HIDDEN_VS_RARE" 2)
  while IFS= read -r _line; do mediums+=("$_line"); done < <(scan_tier "$file" "${MEDIUM_PATTERNS[@]}")
  while IFS= read -r _line; do mediums+=("$_line"); done < <(scan_hidden "$file" "invisible chars (zero-width, soft hyphen, variation selector, mid-file BOM)" "$HIDDEN_ZW")
  while IFS= read -r _line; do mediums+=("$_line"); done < <(scan_hidden "$file" "Latin word with Cyrillic letters (look-alike spelling)" "$MIXED_SCRIPT")
  while IFS= read -r _line; do mediums+=("$_line"); done < <(scan_tier_i "$file" "$CSS_HIDDEN")
  while IFS= read -r _line; do lows+=("$_line");    done < <(scan_tier "$file" "${LOW_PATTERNS[@]}")

  # Determine result
  local status="PASS"
  if [[ ${#highs[@]} -gt 0 ]]; then
    status="FAIL"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  elif [[ ${#mediums[@]} -gt 0 ]]; then
    status="WARN"
    TOTAL_WARN=$((TOTAL_WARN + 1))
  else
    TOTAL_PASS=$((TOTAL_PASS + 1))
  fi

  # Output
  if [[ "$JSON_OUTPUT" == "true" ]]; then
    local json_highs="[]" json_mediums="[]" json_lows="[]"
    if [[ ${#highs[@]} -gt 0 ]]; then
      json_highs=$(printf '%s\n' "${highs[@]}" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi
    if [[ ${#mediums[@]} -gt 0 ]]; then
      json_mediums=$(printf '%s\n' "${mediums[@]}" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi
    if [[ ${#lows[@]} -gt 0 ]]; then
      json_lows=$(printf '%s\n' "${lows[@]}" | jq -R -s 'split("\n") | map(select(length > 0))')
    fi
    local entry
    entry=$(jq -n \
      --arg skill "$skill_name" \
      --arg status "$status" \
      --arg file "$file" \
      --argjson high "$json_highs" \
      --argjson medium "$json_mediums" \
      --argjson low "$json_lows" \
      '{skill: $skill, status: $status, file: $file, high: $high, medium: $medium, low: $low}')
    if [[ -n "$JSON_RESULTS" ]]; then
      JSON_RESULTS="${JSON_RESULTS},${entry}"
    else
      JSON_RESULTS="${entry}"
    fi
  else
    case "$status" in
      FAIL) echo -e "${RED}[FAIL]${NC} $skill_name ($file)" ;;
      WARN) echo -e "${YELLOW}[WARN]${NC} $skill_name ($file)" ;;
      PASS) echo -e "${GREEN}[PASS]${NC} $skill_name ($file)" ;;
    esac

    # Bash 3.2 (macOS default) treats `"${arr[@]}"` as unbound under `set -u`
    # when the array has zero elements, so each loop is gated on length first.
    if [[ ${#highs[@]} -gt 0 ]]; then
      for h in "${highs[@]}"; do
        echo -e "  ${RED}HIGH${NC}: $h"
      done
    fi
    if [[ ${#mediums[@]} -gt 0 ]]; then
      for m in "${mediums[@]}"; do
        echo -e "  ${YELLOW}MEDIUM${NC}: $m"
      done
    fi
    if [[ ${#lows[@]} -gt 0 ]]; then
      for l in "${lows[@]}"; do
        echo -e "  ${CYAN}LOW${NC}: $l"
      done
    fi
  fi
}

# Run scans
echo "Aeon Skill Security Scanner"
echo "==========================="
echo "Scanning ${#FILES[@]} file(s)..."
echo ""

for file in "${FILES[@]}"; do
  scan_file "$file"
done

# Summary
echo ""
echo "==========================="
TOTAL=$((TOTAL_PASS + TOTAL_WARN + TOTAL_FAIL))
echo "Scanned: $TOTAL | Pass: $TOTAL_PASS | Warn: $TOTAL_WARN | Fail: $TOTAL_FAIL"

if [[ "$JSON_OUTPUT" == "true" ]]; then
  echo ""
  echo "--- JSON ---"
  echo "[${JSON_RESULTS}]" | jq .
fi

# Exit code reflects worst finding
if [[ $TOTAL_FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
