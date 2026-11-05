#!/usr/bin/env bash
# Stage the canister-audit skill's IC/Rust toolchain in the WORKFLOW step, before
# `claude -p` starts. Same rationale as scripts/stage-sc-audit.sh:
#
#   1. PATH/env persistence. Claude runs each Bash tool call in a FRESH shell, so an
#      in-run `export PATH=/tmp/bin:$PATH` / `export POCKET_IC_BIN=...` is gone by the
#      next call. Only a workflow step can append to $GITHUB_PATH / $GITHUB_ENV, which
#      makes /tmp/bin and POCKET_IC_BIN visible to every SUBSEQUENT step - including
#      `claude -p` and its per-call subshells - so the bare names and the env var
#      resolve.
#   2. Install vectors. `rustup target add`, `cargo install`, and a release-binary
#      download aren't on the `claude -p` --allowedTools allowlist, so staging here
#      (full capability, no allowlist) is simplest. semgrep DOES install in-run via
#      `python3 -m pip` (the skill keeps that as a fallback).
#
# EXECUTION of the staged tools is a separate concern. The only extra write-tier grant
# canister-audit needs is Bash(./scripts/vuln-poc-gate.sh:*) (see scripts/skill_mode.sh):
# cargo and semgrep run via the base write-tier tools, cargo-audit is the `cargo audit`
# subcommand (not a separate binary), and pocket-ic is launched by the `pocket-ic` crate
# via POCKET_IC_BIN, never as a bare command - so neither takes its own grant. Both halves
# are still needed: staged + on PATH here, allowlisted (or base-tier) there.
#
# The wasm32 target + cargo-audit power the static dependency pass; the PocketIC
# server powers the OPTIONAL PoC proof arm (SKILL.md §C6.5). If any is absent the
# skill runs Semgrep + the agentic source pass and skips the PoC arm cleanly.
#
# Supply chain: the PocketIC server binary is a pinned release asset checked against
# the sha256 digests below (from the 16.1.0 release). A mismatch deletes the download
# and records `fail` (fail closed: the PoC arm then skips). Bumping the version means
# updating POCKETIC_VERSION, BOTH per-arch digests, AND the `pocket-ic` crate pin in
# skills/canister-audit/fixtures/*/Cargo.toml (crate and server share versioning).
#
# No-op for every skill except canister-audit. Best-effort: a tool that fails to install
# is recorded `fail`/`skipped` in the manifest; the skill then treats that tool's step as
# skipped, deciding from what the tool prints (it cannot call `command -v` itself, per the
# SKILL's Shell shape). A non-zero exit here is non-fatal (the step does not gate the run).
set -uo pipefail

SKILL="${1:-}"
[ "$SKILL" = "canister-audit" ] || exit 0

BIN=/tmp/bin
CACHE_BIN="$HOME/.aeon-canister/bin"    # actions/cache-backed store (see aeon.yml)
mkdir -p "$BIN" "$CACHE_BIN" /tmp/canister-audit
MANIFEST=/tmp/canister-audit/prefetch.txt
: > "$MANIFEST"

# Make /tmp/bin resolvable by bare name in every later step + claude -p's subshells.
[ -n "${GITHUB_PATH:-}" ] && echo "$BIN" >> "$GITHUB_PATH"

log()    { echo "stage-canister-audit: $*"; }
record() { echo "$1=$2" >> "$MANIFEST"; }   # tool=installed|fail|skipped

# --- Semgrep (IC Rust ruleset, §C4). Skill calls it bare; symlink into /tmp/bin as
#     belt-and-suspenders in case pip's bin dir isn't on PATH. Also installable in-run. ---
if command -v semgrep >/dev/null 2>&1; then
  ln -sf "$(command -v semgrep)" "$BIN/semgrep" 2>/dev/null || true
  log "semgrep already present"; record semgrep installed
elif pip install --quiet semgrep 2>/dev/null || pip3 install --quiet semgrep 2>/dev/null; then
  command -v semgrep >/dev/null 2>&1 && ln -sf "$(command -v semgrep)" "$BIN/semgrep" 2>/dev/null || true
  log "semgrep installed"; record semgrep installed
else
  log "WARN semgrep install failed (skill retries in-run via python3 -m pip)"; record semgrep fail
fi

# --- Rust wasm32 target + cargo-audit. GHA hosted runners ship stable Rust; add the
#     canister build target and the RustSec dep auditor. cargo-audit is cache-backed. ---
if ! command -v rustup >/dev/null 2>&1; then
  log "WARN rustup absent - cannot add wasm32 target"; record wasm32 fail
elif rustup target add wasm32-unknown-unknown >/dev/null 2>&1; then
  log "wasm32-unknown-unknown target added"; record wasm32 installed
else
  log "WARN wasm32 target add failed"; record wasm32 fail
fi

if command -v cargo-audit >/dev/null 2>&1; then
  log "cargo-audit already present"; record cargo-audit installed
elif [ -x "$CACHE_BIN/cargo-audit" ] && cp -f "$CACHE_BIN/cargo-audit" "$BIN/cargo-audit" 2>/dev/null \
     && chmod +x "$BIN/cargo-audit" && "$BIN/cargo-audit" --version >/dev/null 2>&1; then
  log "cargo-audit restored from cache"; record cargo-audit installed
elif command -v cargo >/dev/null 2>&1 && cargo install cargo-audit --locked >/dev/null 2>&1 \
     && command -v cargo-audit >/dev/null 2>&1; then
  cp -f "$(command -v cargo-audit)" "$CACHE_BIN/cargo-audit" 2>/dev/null || true
  log "cargo-audit installed"; record cargo-audit installed
else
  log "cargo-audit not installed (optional - dep CVEs still covered by osv)"; record cargo-audit skipped
fi

# --- PocketIC server (PoC proof arm, §C6.5). Pinned release asset + sha256. ---
POCKETIC_VERSION=16.1.0
case "$(uname -m)" in
  x86_64 | amd64)  PIC_ARCH=x86_64; PIC_SHA256=131219d90dcf9bf6f3ed8ee02d8f55504ea24a6db382f5680675b7bd6b7ed3bf ;;
  aarch64 | arm64) PIC_ARCH=arm64;  PIC_SHA256=83e16ef92cafab5a0b155b8db868c28191b92915e4fba04c76544cca09081ab1 ;;
  *) PIC_ARCH=""; PIC_SHA256="" ;;
esac
PIC_URL="https://github.com/dfinity/pocketic/releases/download/${POCKETIC_VERSION}/pocket-ic-${PIC_ARCH}-linux.gz"
PIC_GZ=/tmp/canister-audit/pocket-ic.gz
sha256_ok() { [ -n "$2" ] && echo "$2  $1" | sha256sum -c - >/dev/null 2>&1; }
rm -f "$PIC_GZ" "$BIN/pocket-ic"
CACHE_GZ="$CACHE_BIN/pocket-ic-${POCKETIC_VERSION}-${PIC_ARCH}.gz"
# Fetch the pinned .gz (cached or downloaded), then sha256-verify it BEFORE extracting on
# BOTH paths - so a poisoned cache can't install an unverified server (the old code
# trusted the cached binary blind). gunzip consumes the .gz, so re-seed the cache from
# the verified copy first. A cached .gz that fails its sha256 is deleted and fetched
# again from the network, so one bad cache entry does not disable the PoC arm.
if [ -f "$CACHE_GZ" ]; then
  cp -f "$CACHE_GZ" "$PIC_GZ" 2>/dev/null || true
  if ! sha256_ok "$PIC_GZ" "$PIC_SHA256"; then
    log "WARN cached pocket-ic ${POCKETIC_VERSION} failed sha256 - dropping it and downloading again"
    rm -f "$CACHE_GZ" "$PIC_GZ"
  fi
fi
if [ ! -f "$PIC_GZ" ] && [ -n "$PIC_SHA256" ]; then
  curl -sSfL -o "$PIC_GZ" "$PIC_URL" 2>/dev/null || true
fi
if [ -f "$PIC_GZ" ] && sha256_ok "$PIC_GZ" "$PIC_SHA256"; then
  cp -f "$PIC_GZ" "$CACHE_GZ" 2>/dev/null || true
  if gunzip -f "$PIC_GZ" && mv /tmp/canister-audit/pocket-ic "$BIN/pocket-ic" && chmod +x "$BIN/pocket-ic"; then
    log "pocket-ic ${POCKETIC_VERSION} installed -> $BIN/pocket-ic (sha256 ok)"; record pocket-ic installed
  else
    rm -f "$BIN/pocket-ic"
    log "WARN pocket-ic ${POCKETIC_VERSION} extract failed - PoC arm skips"; record pocket-ic fail
  fi
else
  rm -f "$BIN/pocket-ic" "$PIC_GZ"
  log "WARN pocket-ic ${POCKETIC_VERSION} unavailable (arch=${PIC_ARCH:-unsupported}, download or sha256 failed) - PoC arm skips"
  record pocket-ic fail
fi
# The pocket-ic CRATE locates the server via POCKET_IC_BIN; export it for later steps.
if [ -x "$BIN/pocket-ic" ] && [ -n "${GITHUB_ENV:-}" ]; then
  echo "POCKET_IC_BIN=$BIN/pocket-ic" >> "$GITHUB_ENV"
fi
# Point cargo at a scratch target dir so canister builds never touch the tracked tree
# (the SKILL relies on this being set here - `export` is refused in-run). /tmp/canister-audit
# is created above.
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "CARGO_TARGET_DIR=/tmp/canister-audit/target" >> "$GITHUB_ENV"
fi

log "manifest (/tmp/canister-audit/prefetch.txt):"
cat "$MANIFEST"
