# aeon × icp — demo guide

a walkthrough for showing the integration to aaron / dfinity. every beat below has a
real, executed artifact behind it — no "it's configured so it works" claims. pairs
with [`DEMO.md`](DEMO.md) (raw outputs) and the [`docs/icp/`](.) research reports.

## sprint check — what shipped vs the 24h plan

| sprint section | status | evidence |
|---|---|---|
| 1. icp recon | **done** | the 6 reports in `docs/icp/` (= the ICP-RESEARCH deliverable, split by topic) |
| 2. aeon mcp integration | **blocked by design, routed around** | hosted `mcp.internetcomputer.org/mcp` is confirmed to exist but is interactive-only (authorization_code + pkce + internet identity, no refresh/machine grant), so aeon can't drive it headlessly. connectivity goes direct-to-ic over https instead, verified live |
| 3. icp skill pack | **done + verified** | 4 skills (canister-status, cycles-balance, sns-digest, icp-deploy-check), all pass aeon's tests; sns-digest ran a real harness run and delivered to telegram |
| 4. icp security scanning | **done + verified** | `canister-audit` skill; pocketic proof-of-concept executed in ci |
| 5. icskills contribution | **prepared + validated, not submitted** | 4 skills repackaged to dfinity's schema, all pass `skill-validator check`, icp-deploy-check scores 4.17/5 |
| 6. demo + handoff | **this doc** | |

one correction to the recon assessment: it said the official mcp server was "not confirmed." it is confirmed — i probed the endpoint (dns + tls + `POST /mcp` → 401 with oauth metadata). the finding isn't "does it exist", it's "it's interactive-only so a headless agent can't use it."

## the honest buckets (per the definition of done)

- **working + verified:** the canister-audit pocketic poc (ran in ci), sns-digest (live harness run → telegram), 3 live ic reads, the 4 skills' config/test suites, the icskills package (validator pass + 4.17 score)
- **prepared, not shipped:** the icskills external pr (needs a go, public under anu's name), the 4 aeon prs (green, need a maintainer approval since anu authored them), the svectors-lab cleanup pr
- **blocked by design:** the hosted icp mcp connector (interactive-only) — done via direct https reads instead
- **deferred:** motoko (rust-first, as the plan recommends)

---

## demo — 6 beats, strongest first

### beat 1 — aeon runs an icp skill autonomously and delivers (headline)

```bash
gh workflow run aeon.yml --ref test/icp-skills-live -R Svector-anu/svectors-lab -f skill=sns-digest
```

then show telegram. it already fired once (run 41818930776, delivered=telegram, msg 1335). the output:

> **sns-digest — 3 open proposals**
> nns: #144685 internet identity frontend upgrade, #144684 ii backend upgrade — routine. sns ALICE: #125 weekly rewards motion being rejected (33% no vs 7% yes), deadline ~1.4d. nothing closes within 24h.

the pitch: this is aeon, headless, pulling live ic governance on a schedule and delivering to a channel. no human in the loop.

### beat 2 — the security scanner *proves* a canister exploit

show the `ci-canister-audit-fixture` run on pr #1328:

```
running tests/repro.rs
test anonymous_principal_mints_free_balance ... ok
test result: ok. 1 passed; 0 failed
```

the pitch: canister-audit found the flaw (anonymous principal mints a free, withdrawable balance via `claim_bonus`, breaking `sum(balances) <= total_deposited`), then *proved* it — built the canister to wasm, loaded it into pocketic, executed the attack as the anonymous principal. same evidence bar as aeon's existing poc-gate.

### beat 3 — live ic reads, public, no keys

walk `docs/icp/DEMO.md`:
- nns proposals + 5 sns daos (ALICE, CANI DAO, CHAI, Catalyze, Cecil The Lion) — keyless
- internet identity canister `rdmx6-…`: controller `r7inp-…`, module_hash `b09b4dda…`, 241 upgrades tracked
- cycles are controller-gated (no public field) → needs an identity. everything else keyless.

### beat 4 — deploy-check catches a real flaw

`icp-deploy-check` run over `token_vault/src/lib.rs`:

```
[FAIL  ] #2/#8 claim_bonus — credits state with no caller auth
[PASS  ] #7 no mainnet fetch_root_key
[N/A   ] #4 pre_upgrade — state in stable structures
[REVIEW] #5 controller backup — operator confirms multisig at deploy
```

### beat 5 — the ecosystem contribution

`docs/icp/contribution/icskills/` — the 4 skills repackaged to dfinity's icskills schema. all pass their own `skill-validator check` (= `npm run validate`), icp-deploy-check scores 4.17/5 on their llm judge. ready to pr into `dfinity/icskills` (one skill per pr, per their rules).

### beat 6 — the research + the architecture call

the `docs/icp/` reports, and the one real engineering decision worth surfacing to dfinity: the official mcp endpoint is interactive-only, so an autonomous agent can't use it. that's a real ecosystem gap — a headless/machine-grant path (or a canister-based mcp via ic-rmcp) would unblock agent-to-canister automation. good thing to coordinate on.

---

## the asks that need a human

- a maintainer approval on the aeon prs (#1328–#1331) so they can merge — anu authored them so can't self-approve
- a go on the public icskills pr (it's under anu's name on dfinity's repo)
- a review/merge on the svectors-lab cleanup pr (clears the miniaeon breakage)

## repeatability

- security scan: `gh workflow run aeon.yml -f skill=canister-audit -f var=fixture:token_vault` (fixture mode) or `-f var=<owner/repo>` against a real rust canister
- skills: `-f skill=sns-digest` / `-f skill=canister-status -f var=<canister-id>` / `-f skill=icp-deploy-check -f var=<repo>` / `-f skill=cycles-balance -f var=<canister-id>` (needs `ICP_IDENTITY_PEM`)
