#!/usr/bin/env bash
# canister-audit PoC — proves the token_vault planted flaw: the anonymous
# principal mints a free, withdrawable balance via claim_bonus, breaking the
# accounting invariant sum(balances) <= total_deposited.
#
# Shape matches scripts/vuln-poc-gate.sh `command` mode: deterministic, exits 0
# ONLY when the boundary is crossed, and writes nothing into the audited worktree
# (build output and PocketIC state go to $CARGO_TARGET_DIR / $TMPDIR, both outside
# the repo). The gate invokes this as `(cd $REPO && env -i ... bash repro.sh)`, so
# the crate to build is the current directory ($REPO) and the scrubbed env drops
# everything not on the gate's allowlist (PATH/HOME/TMPDIR) - including
# POCKET_IC_BIN. Each var below therefore carries a fallback so the script is
# self-sufficient under that stripped env; it also runs standalone in fixture mode
# (`cd <crate> && bash repro/repro.sh`), where $PWD is the crate.
#
# Requires: a Rust toolchain with the wasm32-unknown-unknown target, and the
# PocketIC server binary (scripts/stage-canister-audit.sh installs it at
# /tmp/bin/pocket-ic, the default below; override with POCKET_IC_BIN).
set -euo pipefail

CRATE_DIR="${CRATE_DIR:-$PWD}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-${TMPDIR:-/tmp}/canister-audit-target}"
export CANISTER_WASM="$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/token_vault.wasm"
export POCKET_IC_BIN="${POCKET_IC_BIN:-/tmp/bin/pocket-ic}"

echo "repro: building canister wasm -> $CANISTER_WASM"
cargo build --manifest-path "$CRATE_DIR/Cargo.toml" \
  --target wasm32-unknown-unknown --release

echo "repro: running PocketIC reproduction"
cargo test --manifest-path "$CRATE_DIR/Cargo.toml" --test repro -- --nocapture

echo "repro: boundary crossed — anonymous principal minted a free balance (invariant broken)"
