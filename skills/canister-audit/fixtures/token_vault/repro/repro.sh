#!/usr/bin/env bash
# canister-audit PoC — proves the token_vault planted flaw: the anonymous
# principal mints a free, withdrawable balance via claim_bonus, breaking the
# accounting invariant sum(balances) <= total_deposited.
#
# Shape matches scripts/vuln-poc-gate.sh `command` mode: deterministic, exits 0
# ONLY when the boundary is crossed, and writes nothing into the audited worktree
# (build output and PocketIC state go to $CARGO_TARGET_DIR / $TMPDIR, both outside
# the repo). On a real target the gate invokes this as `(cd $REPO && bash repro.sh)`
# with a credential-scrubbed env; here it also runs standalone in fixture mode.
#
# Requires: a Rust toolchain with the wasm32-unknown-unknown target, and the
# PocketIC server binary on $POCKET_IC_BIN (scripts/stage-canister-audit.sh
# provisions both in the runner).
set -euo pipefail

CRATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-${TMPDIR:-/tmp}/canister-audit-target}"
export CANISTER_WASM="$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/token_vault.wasm"

echo "repro: building canister wasm -> $CANISTER_WASM"
cargo build --manifest-path "$CRATE_DIR/Cargo.toml" \
  --target wasm32-unknown-unknown --release

echo "repro: running PocketIC reproduction"
cargo test --manifest-path "$CRATE_DIR/Cargo.toml" --test repro -- --nocapture

echo "repro: boundary crossed — anonymous principal minted a free balance (invariant broken)"
