#!/usr/bin/env bash
# Stage the sc-audit skill's smart-contract toolchain in the WORKFLOW step, before
# `claude -p` starts. Same rationale as scripts/stage-vuln-scanner.sh:
#
#   1. PATH persistence. Claude runs each Bash tool call in a FRESH shell, so an in-run
#      `export PATH=/tmp/bin:$PATH` is gone by the next call. Only a workflow step can
#      append to $GITHUB_PATH, which makes /tmp/bin part of PATH for every SUBSEQUENT
#      step — including `claude -p` and its per-call subshells — so bare names
#      (forge/echidna/medusa/slither) resolve.
#   2. Install vectors. forge/echidna/medusa ship as binaries whose installers need
#      bash / tar / unzip — NONE of which are on the `claude -p` --allowedTools allowlist,
#      so they CANNOT install in-run. This step runs with the runner's full shell (no
#      allowlist), so it can. The pip tools (slither/solc-select/crytic-compile) DO install
#      in-run, but staging them here too makes a cache-warm run near-instant.
#
# EXECUTION of the staged tools is a separate concern, gated by the write-tier grant in
# scripts/skill_mode.sh (Bash(forge:*), Bash(echidna:*), Bash(medusa:*), ...). Both halves
# are needed: staged + on PATH here, allowlisted there.
#
# forge/echidna/medusa power the OPTIONAL fuzz arm (SKILL.md §S6.5). If any is absent the
# skill runs Slither + the agentic source pass and skips fuzzing cleanly.
#
# No-op for every skill except sc-audit. Best-effort: a tool that fails to install is
# recorded `fail`/`skipped` and left for the skill to skip via its `command -v` guard; a
# non-zero exit is non-fatal (the workflow step does not gate the run).
set -uo pipefail

SKILL="${1:-}"
[ "$SKILL" = "sc-audit" ] || exit 0

BIN=/tmp/bin
CACHE_BIN="$HOME/.aeon-sc/bin"    # actions/cache-backed store (see aeon.yml "Cache sc-audit tools")
mkdir -p "$BIN" "$CACHE_BIN" /tmp/sc-audit
MANIFEST=/tmp/sc-audit/prefetch.txt
: > "$MANIFEST"

# Make /tmp/bin resolvable by bare name in every later step + claude -p's subshells.
[ -n "${GITHUB_PATH:-}" ] && echo "$BIN" >> "$GITHUB_PATH"

log()    { echo "stage-sc-audit: $*"; }
record() { echo "$1=$2" >> "$MANIFEST"; }   # tool=installed|fail|skipped

# Resolve a global-PATH bin dir (proven on the subshell PATH) so a /tmp/bin-only binary
# can be linked there and resolve by bare name inside claude -p (see stage-vuln-scanner.sh
# ISS-004). Use slither (pip → global bin) or python3 to locate it; fall back to /usr/local/bin.
GLOBAL_BIN=""
resolve_global_bin() {
  [ -n "$GLOBAL_BIN" ] && return 0
  local s; s="$(command -v slither 2>/dev/null || command -v python3 2>/dev/null)"
  s="$(readlink -f "$s" 2>/dev/null || echo "$s")"
  local dir; dir="$(dirname "$s" 2>/dev/null)"
  case ":$PATH:" in *":$dir:"*) GLOBAL_BIN="$dir" ;; *) GLOBAL_BIN=/usr/local/bin ;; esac
  return 0
}
publish_global() {  # /tmp/bin/<tool> → symlink into $GLOBAL_BIN so the bare name resolves in every subshell
  resolve_global_bin
  local src="$1" name; name="$(basename "$src")"
  [ -x "$src" ] || return 1
  [ "$GLOBAL_BIN/$name" = "$src" ] && return 0
  ln -sf "$src" "$GLOBAL_BIN/$name" 2>/dev/null && return 0
  sudo ln -sf "$src" "$GLOBAL_BIN/$name" 2>/dev/null && return 0
  return 1
}

pip_install() { # package
  pip install --quiet "$1" 2>/dev/null \
    || pip3 install --quiet "$1" 2>/dev/null \
    || pip install --quiet --user "$1" 2>/dev/null \
    || pip3 install --quiet --user "$1" 2>/dev/null
}

# Latest release asset URL matching a pattern, with optional GitHub auth to dodge the
# 60/hr unauthenticated API rate limit (a runner token is fine on THIS shell — the
# allowlist only constrains claude -p, not the workflow step).
api_asset() { # repo pattern
  local repo="$1" pat="$2"; local hdr=()
  local tok="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  [ -n "$tok" ] && hdr=(-H "Authorization: Bearer $tok")
  curl -sSfL "${hdr[@]}" "https://api.github.com/repos/$repo/releases/latest" 2>/dev/null \
    | grep -o '"browser_download_url":[ ]*"[^"]*"' \
    | grep -iE "$pat" | head -1 | sed -E 's/.*"(https[^"]+)".*/\1/'
}

# --- pip tools (also installable in-run; staged here so a cache-warm run skips the wheels) ---
stage_pip() { # binary-name pip-package
  local name="$1" pkg="$2"
  if command -v "$name" >/dev/null 2>&1; then
    ln -sf "$(command -v "$name")" "$BIN/$name" 2>/dev/null || true
    record "$name" installed
  elif pip_install "$pkg" && command -v "$name" >/dev/null 2>&1; then
    ln -sf "$(command -v "$name")" "$BIN/$name" 2>/dev/null || true
    log "$name installed"; record "$name" installed
  else
    log "WARN $name install failed"; record "$name" fail
  fi
}
stage_pip slither        slither-analyzer
stage_pip solc-select    solc-select
stage_pip crytic-compile crytic-compile

# --- solc: warm a recent default via solc-select. ~/.solc-select is cached, so the
#     skill's on-demand `solc-select install <pragma version>` is instant on a warm run. ---
if command -v solc-select >/dev/null 2>&1 \
   && solc-select install 0.8.28 >/dev/null 2>&1 && solc-select use 0.8.28 >/dev/null 2>&1; then
  log "solc 0.8.28 warmed (skill selects the target pragma version on demand)"
  record solc installed
else
  log "solc warm skipped (skill installs the exact pragma version in-run)"
  record solc skipped
fi

# Generic release-binary installer: cache-first, else resolve the latest release asset
# matching $2, download, extract (.zip or .tar.gz by URL suffix), find the binary named
# $3 anywhere in the archive, install to $BIN, seed the cache, publish onto the global
# PATH. Authenticated via GH_TOKEN (set on the workflow step) — the FIRST live run got
# `echidna=skipped`/`medusa=skipped` because the UNauthenticated GitHub API (60/hr, shared
# hosted-runner IP) 403'd and api_asset returned empty. With a token it's 1000/hr.
fetch_bin() {  # repo  url-grep-pattern  binary-name
  local repo="$1" pat="$2" name="$3" url tmp found
  if [ -x "$CACHE_BIN/$name" ] && cp -f "$CACHE_BIN/$name" "$BIN/$name" 2>/dev/null \
       && chmod +x "$BIN/$name" 2>/dev/null && [ -x "$BIN/$name" ]; then
    publish_global "$BIN/$name" || true
    log "$name restored from cache -> $BIN/$name"; record "$name" installed; return 0
  fi
  url="$(api_asset "$repo" "$pat")"
  if [ -z "$url" ]; then
    log "$name: no matching release asset for '$pat' (API empty — check GH_TOKEN / rate limit)"
    record "$name" skipped; return 1
  fi
  tmp="$(mktemp -d)"
  case "$url" in
    *.zip) curl -sSfL -o "$tmp/a" "$url" 2>/dev/null && unzip -o -q "$tmp/a" -d "$tmp" 2>/dev/null ;;
    *)     curl -sSfL -o "$tmp/a" "$url" 2>/dev/null && tar -xzf "$tmp/a" -C "$tmp" 2>/dev/null ;;
  esac
  found="$(find "$tmp" -type f -name "$name" 2>/dev/null | head -1)"
  if [ -n "$found" ] && cp -f "$found" "$BIN/$name" && chmod +x "$BIN/$name" && [ -x "$BIN/$name" ]; then
    cp -f "$BIN/$name" "$CACHE_BIN/$name" 2>/dev/null || true
    publish_global "$BIN/$name" || true
    rm -rf "$tmp"
    log "$name installed -> $BIN/$name + cached ($url)"; record "$name" installed; return 0
  fi
  rm -rf "$tmp"
  log "$name: download/extract failed ($url)"; record "$name" fail; return 1
}

# --- Foundry (forge + cast + anvil) — build foundry repos + the fuzz arm. cache-backed.
#     Direct release tarball; foundryup's `curl | bash` was unreliable headless (the first
#     live run recorded forge=fail). The tarball carries forge/cast/anvil/chisel together. ---
if [ -x "$CACHE_BIN/forge" ] && cp -f "$CACHE_BIN/forge" "$BIN/forge" 2>/dev/null && chmod +x "$BIN/forge" && "$BIN/forge" --version >/dev/null 2>&1; then
  for t in anvil cast; do [ -x "$CACHE_BIN/$t" ] && cp -f "$CACHE_BIN/$t" "$BIN/$t" 2>/dev/null && chmod +x "$BIN/$t" && publish_global "$BIN/$t"; done
  publish_global "$BIN/forge" || true
  log "foundry restored from cache -> $BIN/forge"; record forge installed
else
  FURL="$(api_asset foundry-rs/foundry 'linux_amd64\.tar\.gz')"
  if [ -n "$FURL" ] && curl -sSfL -o /tmp/foundry.tgz "$FURL" 2>/dev/null && tar -xzf /tmp/foundry.tgz -C "$BIN" 2>/dev/null && [ -x "$BIN/forge" ]; then
    for t in forge cast anvil; do [ -x "$BIN/$t" ] && chmod +x "$BIN/$t" && cp -f "$BIN/$t" "$CACHE_BIN/$t" 2>/dev/null && publish_global "$BIN/$t"; done
    log "foundry installed -> $BIN/forge + cached ($("$BIN/forge" --version 2>/dev/null | head -1))"; record forge installed
  else
    log "foundry install failed (fuzz arm on foundry repos degrades) [$FURL]"; record forge fail
  fi
fi

# --- Echidna (property fuzzer) + Medusa (parallel fuzzer) — fuzz arm ---
fetch_bin crytic/echidna 'x86_64-linux'  echidna || true
fetch_bin crytic/medusa  'linux'         medusa  || true

log "manifest (/tmp/sc-audit/prefetch.txt):"
cat "$MANIFEST"
