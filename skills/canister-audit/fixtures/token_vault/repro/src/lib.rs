//! Repro harness crate for the token_vault fixture.
//!
//! Deliberately empty: the proof is the integration test in `tests/repro.rs`, which
//! loads the audited canister's built wasm into PocketIC. This crate exists only so the
//! reproduction (and its pocket-ic dev-dependency) live OUTSIDE the audited token_vault
//! crate, keeping that target's worktree pristine for the PoC gate.
