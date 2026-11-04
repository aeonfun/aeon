#!/usr/bin/env bash
# canister-audit PoC: proves the token_vault planted flaw - the anonymous principal
# mints a free, withdrawable balance via claim_bonus, breaking the accounting invariant
# sum(balances) <= total_deposited.
#
# Shape matches scripts/vuln-poc-gate.sh `command` mode: deterministic, exits 0 ONLY
# when the boundary is crossed, and writes NOTHING into the audited target worktree.
# The reproduction is a SEPARATE crate (this repro/ dir, its own Cargo.toml with the
# pocket-ic dev-dep); the audited token_vault crate is never edited, so the gate's
# dirty-worktree check stays clean. Build output and PocketIC state go to
# $CARGO_TARGET_DIR / $TMPDIR, both outside the repo. The gate invokes this as
# `(cd $REPO && env -i ... bash repro.sh)`, so $PWD is the audited target crate and
# repro/ sits beside it; the scrubbed env drops everything off the gate's allowlist
# (PATH/HOME/TMPDIR) - including POCKET_IC_BIN - so each var below carries a fallback.
# It also runs standalone (`cd <target> && bash repro/repro.sh`), same $PWD.
#
# Requires: a Rust toolchain with the wasm32-unknown-unknown target, and the PocketIC
# server binary (scripts/stage-canister-audit.sh installs it at /tmp/bin/pocket-ic, the
# default below; override with POCKET_IC_BIN).
set -euo pipefail

TARGET_DIR="${TARGET_DIR:-$PWD}"        # the audited canister crate (what the gate binds)
REPRO_DIR="${REPRO_DIR:-$PWD/repro}"    # the separate reproduction crate (this dir)
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-${TMPDIR:-/tmp}/canister-audit-target}"
export CANISTER_WASM="$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/token_vault.wasm"
export POCKET_IC_BIN="${POCKET_IC_BIN:-/tmp/bin/pocket-ic}"

echo "repro: building audited canister wasm -> $CANISTER_WASM"
cargo build --locked --manifest-path "$TARGET_DIR/Cargo.toml" \
  --target wasm32-unknown-unknown --release

echo "repro: running PocketIC reproduction (separate crate)"
cargo test --locked --manifest-path "$REPRO_DIR/Cargo.toml" --test repro -- --nocapture

echo "repro: boundary crossed - anonymous principal minted a free balance (invariant broken)"
