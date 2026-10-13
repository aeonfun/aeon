#!/usr/bin/env bash
# secretcurl — generic authenticated curl for aeon skills.
#
# Copied to ./secretcurl at runtime (like ./notify) and allow-listed as
# Bash(./secretcurl:*). Call it exactly like `curl`, except any {ENV_NAME}
# placeholder token in the arguments is replaced — INSIDE this script — with the
# value of that environment variable. Example:
#
#   ./secretcurl -s -X POST https://api.x.ai/v1/responses \
#     -H 'Authorization: Bearer {XAI_API_KEY}' -d "$PAYLOAD"
#
# Why: Claude Code's Bash permission analyzer blocks any command whose text
# contains a secret env-var expansion (`$XAI_API_KEY`, `${XAI_API_KEY}`) because
# it can't statically prove the command is safe. Here the caller's command line
# only ever contains the literal placeholder `{XAI_API_KEY}` (no `$`), so it
# passes; the real secret is substituted in this script and never appears on the
# analyzed command line. Works for any key and any placement (auth header,
# custom header, URL path, query param). The secret is never printed.
set -euo pipefail
# bash 5.2+ expands an unquoted & in a ${a//pat/rep} replacement to the matched
# text, which would corrupt any secret containing &. Quoting the replacement is
# not portable (bash 3.2 keeps the quotes literally), so turn the feature off;
# older bash has no such option, hence the guard.
shopt -u patsub_replacement 2>/dev/null || true

# Substitute {ENV_NAME} placeholders with the env var's value. Only credential-
# shaped, currently-set vars are substituted, so JSON/prose braces (e.g. lower-
# case keys, {HOME}) are left untouched.
# In a workflow run AEON_SECRETCURL_ALLOW lists the secrets the skill declared in
# requires: (space or comma separated). The environment also holds keys the skill
# did not ask for (the model provider's, the engine's), and a placeholder naming
# one of those is refused instead of being sent wherever the URL points. The
# repo token every run gets (GH_TOKEN, GITHUB_TOKEN) stays usable. Without
# AEON_SECRETCURL_ALLOW (local use) every credential-shaped variable is
# substituted, as before.
secret_allowed() {
  case "$1" in GH_TOKEN|GITHUB_TOKEN) return 0 ;; esac
  [ -z "${AEON_SECRETCURL_ALLOW+x}" ] && return 0
  case " ${AEON_SECRETCURL_ALLOW//,/ } " in *" $1 "*) return 0 ;; esac
  return 1
}

subst() {
  local a="$1" name val names
  names=$(printf '%s\n' "$a" | grep -oE '\{[A-Z_][A-Z0-9_]*\}' | tr -d '{}' | sort -u || true)
  for name in $names; do
    case "$name" in
      *_API_KEY|*_KEY|*_TOKEN|*_SECRET|*_PAT|*_WEBHOOK_URL) ;;
      *) continue ;;
    esac
    val="${!name-}"
    [ -z "$val" ] && continue
    if ! secret_allowed "$name"; then
      echo "secretcurl: {$name} is not in this skill's requires: - refusing to send it" >&2
      return 1
    fi
    a="${a//\{$name\}/$val}"
  done
  printf '%s' "$a"
}

# Audit record inputs: credential placeholders named (NAMES only) and the target
# URL, both read from the ORIGINAL placeholder args so no secret value is handled
# here. Only when auditing is on (AEON_AUDIT_LOG set).
_SECS="" _URL=""
if [ -n "${AEON_AUDIT_LOG:-}" ]; then
  for a in "$@"; do
    for n in $(printf '%s\n' "$a" | grep -oE '\{[A-Z_][A-Z0-9_]*\}' | tr -d '{}' | sort -u || true); do
      case "$n" in *_API_KEY|*_KEY|*_TOKEN|*_SECRET|*_PAT|*_WEBHOOK_URL) _SECS="${_SECS}${n}," ;; esac
    done
  done
  for a in "$@"; do case "$a" in http://*|https://*) _URL="$a"; break ;; esac; done
fi
audit() {
  [ -n "${AEON_AUDIT_LOG:-}" ] || return 0
  local here c
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  for c in "scripts/audit.sh" "$here/audit.sh" "$here/scripts/audit.sh"; do
    if [ -f "$c" ]; then bash "$c" "secretcurl" "${_URL%%\?*}" "$1" "${_SECS%,}" || true; break; fi
  done
}
# A refused call is recorded too (exit 1), so a blocked attempt leaves a trace.
refuse() { audit 1; exit 1; }

args=()
for a in "$@"; do args+=("$(subst "$a")") || refuse; done

# Substituted args still land in curl's OWN process argv (visible to any other
# process on the box via `ps`/`/proc/<pid>/cmdline`) if handed to curl directly
# -- defeating the whole point of substituting inside this script rather than in
# the caller's command line. Route them through curl's -K/--config instead: a
# config file is the one form of curl invocation where secret values never
# appear in argv at all. The config is handed over as a process-substitution
# pipe (curl -K /dev/fd/N), NOT on stdin: with `-K -` a caller's
# `--data-binary @-` would send the config text itself (substituted secret
# included) as the request body, and stdin could not carry a real body.
#
# cfg_quote: -K's double-quoted strings only recognize \\, \", \t, \n, \r, \v as
# real escapes -- backslash before anything else is dropped verbatim -- so a
# literal backslash must become \\ before a value goes in quotes, or arbitrary
# content is corrupted. A raw newline/CR would end the config line and let the
# rest of the value be parsed as a new curl option (e.g. `output = ...`), so
# those are escaped too, plus tab for symmetry.
cfg_quote() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//\"/\\\"}"
  v="${v//$'\n'/\\n}"
  v="${v//$'\r'/\\r}"
  v="${v//$'\t'/\\t}"
  printf '"%s"' "$v"
}
is_url() { case "$1" in http://*|https://*) return 0 ;; *) return 1 ;; esac; }

# reads_proc FLAG VALUE: the value makes curl read a file under /proc, such as
# another process's environ, which would send keys the placeholder check never
# saw. In a short-option cluster (-sF) the value belongs to the last letter.
reads_proc() {
  local flag="$1" val="$2"
  case "$val" in */proc/*) ;; *) return 1 ;; esac
  case "$flag" in --*) ;; *) flag="-${flag: -1}" ;; esac
  case "$flag" in
    -T|--upload-file) return 0 ;;
    -F|--form) [[ "$val" == *=[@\<]* ]] ;;
    --data-urlencode|--url-query) [[ "$val" =~ ^[^=]*@ ]] ;;
    *) [[ "$val" == @* ]] ;;
  esac
}

# build_config: turn a curl-style argv array into -K config-file text. Every
# real call site in this repo is one of: a bare target URL, a boolean flag
# (-s/-fsS/-sS), or a flag with a value (-H/-X/-o/-w/-m/--max-time) -- including
# `-d @file` (curl itself interprets the leading @, unchanged by going through
# -K). No flag in this codebase takes a URL-shaped value, so a bare http(s)://
# token is always the target url, never mistaken for another flag's argument.
build_config() {
  local -a a=("$@")
  local i=0 n=${#a[@]}
  while [ "$i" -lt "$n" ]; do
    local tok="${a[$i]}"
    if is_url "$tok"; then
      printf 'url = %s\n' "$(cfg_quote "$tok")"
      i=$((i + 1))
    elif [[ "$tok" == -* ]]; then
      # The flag itself is written unquoted, so it must be a plain option name:
      # whitespace or a newline in it would inject extra config lines.
      if ! [[ "$tok" =~ ^-[-A-Za-z0-9]+$ ]]; then
        echo "secretcurl: refusing a malformed option (must be a bare -x / --name; not echoed, may hold a secret)" >&2
        return 1
      fi
      # These make curl read environment variables or another config file on its
      # own, which would hand it values the placeholder check above never saw.
      # -[!-]*K* also catches -K inside a short-option cluster (-sK file).
      case "$tok" in
        --variable|--expand-*|--config|-[!-]*K*)
          echo "secretcurl: option $tok is not supported" >&2
          return 1 ;;
      esac
      local next=$((i + 1))
      if [ "$next" -lt "$n" ] && [[ "${a[$next]}" != -* ]] && ! is_url "${a[$next]}"; then
        if reads_proc "$tok" "${a[$next]}"; then
          echo "secretcurl: option $tok reads a file under /proc - refusing" >&2
          return 1
        fi
        printf '%s %s\n' "$tok" "$(cfg_quote "${a[$next]}")"
        i=$((i + 2))
      else
        printf '%s\n' "$tok"
        i=$((i + 1))
      fi
    else
      # Not echoed: it is the post-substitution value and may hold a secret.
      echo "secretcurl: cannot classify argument $((i + 1)) (not a flag, not a URL) -- refusing to guess" >&2
      return 1
    fi
  done
}

CONFIG="$(build_config "${args[@]}")" || refuse

# Every secret curl needs is in CONFIG by now, so curl runs with an environment
# holding none: only what it needs to reach the network (proxy, CA bundle) and
# no credential a `-d @/proc/self/environ` could read back. -q skips ~/.curlrc,
# which the run could have written.
CURL_ENV=("PATH=$PATH" "HOME=${HOME:-/}")
for v in TMPDIR LANG LC_ALL LC_CTYPE http_proxy HTTP_PROXY https_proxy HTTPS_PROXY \
  all_proxy ALL_PROXY no_proxy NO_PROXY CURL_CA_BUNDLE SSL_CERT_FILE SSL_CERT_DIR; do
  [ -n "${!v+x}" ] && CURL_ENV+=("$v=${!v}")
done
run_curl() { env -i "${CURL_ENV[@]}" curl -q -K <(printf '%s' "$CONFIG"); }

# x_search is a live, variable-latency request.  Every skill uses this helper,
# so retry only the X.AI Responses endpoint here instead of duplicating subtly
# different retry loops in eleven SKILL.md files.  Other authenticated requests
# remain a transparent curl passthrough.
is_xai_search() {
  local a
  for a in "$@"; do
    case "$a" in
      https://api.x.ai/v1/responses) return 0 ;;
    esac
  done
  return 1
}

run_xai_search() {
  local -a a=("$@")
  local out_file="" i tok next
  for ((i=0; i<${#a[@]}; i++)); do
    tok="${a[$i]}"
    if [ "$tok" = "-o" ] || [ "$tok" = "--output" ]; then
      next=$((i + 1)); out_file="${a[$next]-}"; i=$next
    fi
  done
  local attempt=1 max_attempts=3 delay=2 rc http bytes reason stdout_file has_write=0
  for tok in "${a[@]}"; do
    [ "$tok" = "-w" ] || [ "$tok" = "--write-out" ] && has_write=1
  done
  while [ "$attempt" -le "$max_attempts" ]; do
    stdout_file="$(mktemp)"
    set +e
    run_curl >"$stdout_file"
    rc=$?
    set -e
    http=""
    if [ "$has_write" -eq 1 ] && [ -s "$stdout_file" ]; then
      http="$(tail -c 4 "$stdout_file" | tr -cd '0-9' || true)"
      [ "${#http}" -eq 3 ] || http=""
    fi
    bytes=0
    [ -n "$out_file" ] && [ -f "$out_file" ] && bytes="$(wc -c <"$out_file" | tr -d ' ')"
    if [ "$rc" -eq 28 ]; then
      reason=timeout
    elif [ "$rc" -ne 0 ]; then
      reason="curl-$rc"
    elif [ -n "$http" ] && { [ "$http" -lt 200 ] || [ "$http" -ge 300 ]; }; then
      reason="http-$http"
    elif [ "$bytes" -eq 0 ] && [ -n "$out_file" ]; then
      reason=empty
    elif [ -n "$out_file" ] && [ "$http" = 200 ] && jq -e -r '
        [ .output[]? | select(.type == "message") | .content[]?
          | select(.type == "output_text") | .text // empty
          | select(length > 0) ] | length > 0
      ' "$out_file" >/dev/null 2>&1; then
      reason=ok
    elif [ -n "$out_file" ] && [ "$http" = 200 ]; then
      reason=empty
    elif [ -z "$out_file" ] && [ ! -s "$stdout_file" ]; then
      reason=empty
    else
      reason=ok
    fi
    printf 'secretcurl xai attempt=%s/%s http=%s bytes=%s reason=%s\n' \
      "$attempt" "$max_attempts" "${http:-000}" "$bytes" "$reason" >&2
    retryable=1
    case "$reason" in
      ok) retryable=0 ;;
      http-429|http-5??) retryable=1 ;;
      http-*) retryable=0 ;;
    esac
    if [ "$reason" = ok ] || [ "$attempt" -eq "$max_attempts" ] || [ "$retryable" -eq 0 ]; then
      cat "$stdout_file"
      rm -f "$stdout_file"
      return "$([ "$reason" = ok ] && echo 0 || echo "$rc")"
    fi
    rm -f "$stdout_file"
    sleep "$delay"
    delay=$((delay * 2)); attempt=$((attempt + 1))
  done
}

# When auditing is off (AEON_AUDIT_LOG unset), stay a transparent passthrough --
# byte-identical output/exit behaviour to a plain curl call. When on, run curl in
# the foreground (stdout/stderr/exit all pass through unchanged) so we can record
# the call after.
if [ -n "${AEON_AUDIT_LOG:-}" ]; then
  set +e
  if is_xai_search "${args[@]}"; then
    run_xai_search "${args[@]}"
  else
    run_curl
  fi
  _RC=$?
  set -e
  audit "$_RC"
  exit "$_RC"
fi
if is_xai_search "${args[@]}"; then
  run_xai_search "${args[@]}"
  exit $?
fi
run_curl
