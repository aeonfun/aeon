# shellcheck shell=bash
# openrouter-attribution.sh - the app attribution headers every OpenRouter
# inference request aeon makes carries, so the usage lands on aeon's OpenRouter
# app page (openrouter.ai/apps?url=https://www.aeon.fun) instead of going
# unattributed or counting toward the harness vendor's own app.
#
# The single source of the values. Sourced by scripts/llm-gateway.sh (Claude
# Code: ANTHROPIC_CUSTOM_HEADERS), scripts/install-harness.sh (the codex, pi,
# kimi and vibe configs it stages) and adapters/hermes.sh (its scratch-HOME
# config). Sets variables and functions only, no shell options: llm-gateway.sh
# is itself sourced into the caller's shell.
#
# The referer is aeon's site URL. A fork can set its own via
# OPENROUTER_SITE_URL / OPENROUTER_APP_TITLE / OPENROUTER_APP_CATEGORIES.
OR_ATTR_REFERER="${OPENROUTER_SITE_URL:-https://www.aeon.fun}"
OR_ATTR_TITLE="${OPENROUTER_APP_TITLE:-Aeon}"
OR_ATTR_CATEGORIES="${OPENROUTER_APP_CATEGORIES:-personal-agent,cloud-agent}"

# or_attr_pairs -> one "Name<TAB>Value" line per header. X-Title is the legacy
# name of X-OpenRouter-Title; both are sent so either reader picks it up.
or_attr_pairs() {
  printf '%s\t%s\n' \
    HTTP-Referer "$OR_ATTR_REFERER" \
    X-OpenRouter-Title "$OR_ATTR_TITLE" \
    X-Title "$OR_ATTR_TITLE" \
    X-OpenRouter-Categories "$OR_ATTR_CATEGORIES"
}

# or_attr_q STRING -> STRING as a double-quoted string, valid in TOML, JSON and YAML
or_attr_q() {
  local s="${1//\\/\\\\}"
  printf '"%s"' "${s//\"/\\\"}"
}

# or_attr_lines -> "Name: Value" lines (ANTHROPIC_CUSTOM_HEADERS format)
or_attr_lines() {
  local k v
  while IFS=$'\t' read -r k v; do printf '%s: %s\n' "$k" "$v"; done < <(or_attr_pairs)
}

# or_attr_inline FORMAT -> the headers as one inline map:
#   toml  { "Name" = "Value", ... }      json  {"Name":"Value",...}
or_attr_inline() {
  local sep=' = ' open='{ ' close=' }' join=', ' out='' k v
  [ "$1" = json ] && { sep=':' open='{' close='}' join=','; }
  while IFS=$'\t' read -r k v; do
    out="${out:+$out$join}$(or_attr_q "$k")$sep$(or_attr_q "$v")"
  done < <(or_attr_pairs)
  printf '%s%s%s\n' "$open" "$out" "$close"
}

# or_attr_yaml INDENT -> "Name": "Value" lines, each prefixed with INDENT
or_attr_yaml() {
  local k v
  while IFS=$'\t' read -r k v; do
    printf '%s%s: %s\n' "$1" "$(or_attr_q "$k")" "$(or_attr_q "$v")"
  done < <(or_attr_pairs)
}
