//! token_vault - a minimal Internet Computer ledger canister used ONLY as a
//! canister-audit regression fixture. It is intentionally broken. Do not deploy
//! or reuse.
//!
//! Core accounting invariant that MUST always hold:
//!   sum(balances[*]) <= total_deposited
//! Every legitimate path (deposit / withdraw) preserves it. One path breaks it on
//! purpose so the static ruleset flags it and a PocketIC reproduction proves it.

use candid::Principal;
use ic_cdk::api::msg_caller;
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(Default)]
struct State {
    balances: HashMap<Principal, u64>,
    total_deposited: u64,
    owner: Option<Principal>,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

#[ic_cdk::init]
fn init() {
    STATE.with(|s| s.borrow_mut().owner = Some(msg_caller()));
}

fn require_owner() {
    let caller = msg_caller();
    let is_owner = STATE.with(|s| s.borrow().owner == Some(caller));
    if !is_owner {
        ic_cdk::trap("caller is not the owner");
    }
}

/// Legitimate deposit: credits the caller and the running total together, so the
/// invariant `sum(balances) <= total_deposited` is preserved. The anonymous
/// principal is rejected - a deposit must be attributable to a real identity.
#[ic_cdk::update]
fn deposit(amount: u64) {
    let caller = msg_caller();
    if caller == Principal::anonymous() {
        ic_cdk::trap("anonymous principal cannot deposit");
    }
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        *s.balances.entry(caller).or_default() += amount;
        s.total_deposited += amount;
    });
}

/// Legitimate withdrawal: debits the caller and the running total together.
#[ic_cdk::update]
fn withdraw(amount: u64) {
    let caller = msg_caller();
    STATE.with(|s| {
        let mut s = s.borrow_mut();
        let bal = s.balances.entry(caller).or_default();
        if *bal < amount {
            ic_cdk::trap("insufficient balance");
        }
        *bal -= amount;
        s.total_deposited -= amount;
    });
}

/// Properly guarded admin method (NEGATIVE CONTROL): only the owner may call it,
/// so the static ruleset must NOT flag it. It proves the detector discriminates
/// a guarded admin entrypoint from an unguarded one.
#[ic_cdk::update]
fn admin_set_total(new_total: u64) {
    require_owner();
    STATE.with(|s| s.borrow_mut().total_deposited = new_total);
}

/// INTENTIONAL FLAW (the point of this fixture): credits the caller's balance out
/// of thin air. There is no anonymous-principal rejection, no owner guard, and it
/// never touches `total_deposited`, so it breaks the accounting invariant
/// `sum(balances) <= total_deposited` and lets ANY caller - the anonymous
/// principal included - withdraw funds other users deposited. Pitfalls #2
/// (anonymous principal accepted) and #8 (unguarded state-changing admin method).
#[ic_cdk::update]
fn claim_bonus(amount: u64) {
    let caller = msg_caller();
    STATE.with(|s| {
        *s.borrow_mut().balances.entry(caller).or_default() += amount;
    });
}

#[ic_cdk::query]
fn balance_of(who: Principal) -> u64 {
    STATE.with(|s| *s.borrow().balances.get(&who).unwrap_or(&0))
}

#[ic_cdk::query]
fn total_deposited() -> u64 {
    STATE.with(|s| s.borrow().total_deposited)
}

ic_cdk::export_candid!();
