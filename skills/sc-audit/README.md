# sc-audit

Deep security audit of a Solidity repo or a live verified contract on Ethereum and EVM L2s. It runs in this order:

1. Model the protocol's invariants.
2. Run Slither (best-effort).
3. Run a bounded agentic source review that hunts for a path breaking each invariant.
4. Triage the results and adversarially verify every survivor.
5. Try to prove each confirmed break with a property fuzzer (Echidna or Medusa).
6. Write a professional audit report.

The full procedure is in [`SKILL.md`](SKILL.md). Inside an Aeon instance it runs on a schedule with no setup. This page covers running it in a plain coding agent such as Claude Code, with no Aeon instance.

## Use it in Claude Code (no Aeon)

### 1. Install

Copy the skill, plus `vuln-scanner` (its triage and disclosure sections are referenced from `SKILL.md`), into a git repo you'll run audits from:

```bash
mkdir audits && cd audits && git init
echo ".scan/" >> .gitignore           # clones, build artifacts and fuzz corpora land here
mkdir -p .claude/skills skills
git clone --depth 1 https://github.com/aeonfun/aeon /tmp/aeon
cp -r /tmp/aeon/skills/sc-audit /tmp/aeon/skills/vuln-scanner .claude/skills/
cp -r /tmp/aeon/skills/sc-audit skills/   # fixture mode reads skills/sc-audit/fixtures/
```

Claude Code picks the skill up from `.claude/skills/`. To use it across projects, copy the same folders to `~/.claude/skills/` instead.

Optional tooling. Each tool is skipped cleanly when absent, and the source review needs none of them:

- `pip install slither-analyzer solc-select crytic-compile` (a venv is fine)
- [Foundry](https://getfoundry.sh) (`forge`)
- [Medusa](https://github.com/crytic/medusa) or [Echidna](https://github.com/crytic/echidna) for the fuzz step
- `gh`, authenticated, for repo targets
- `ETHERSCAN_API_KEY` for on-chain targets. Without it, the skill falls back to keyless Sourcify, then Blockscout.

### 2. Run

The skill reads its target from `${var}` and the date from `${today}`. Aeon fills both in; in Claude Code you put them in the prompt:

```text
Use the sc-audit skill. Target (${var}) is: fixture:vault. Today is 2026-10-28.
This is plain Claude Code, not Aeon: create memory/ dirs as needed, skip ./notify,
and use plain curl with $ETHERSCAN_API_KEY wherever the skill says ./secretcurl.
```

Target forms:

- `fixture:vault` audits the bundled deliberately-vulnerable vault. Start here to check your setup.
- `owner/repo` audits a GitHub repo.
- `<chain>:0x<address>` audits a live verified contract, for example `base:0x4200000000000000000000000000000000000006`.

Leaving the target empty means "pick from Aeon's trending feed", which only exists inside Aeon. Always pass a target.

#### Tool permissions

If you restrict Bash with Aeon's allowed-tools list rather than allowing it unrestricted, add `Bash(command -v:*)`. Every toolchain step checks for its tool with `command -v slither` / `forge` / `medusa`. Under Aeon's list those checks are denied, so Slither and the fuzz step get skipped and the coverage manifest reports `partial`. Adding only that one rule fixed it in review: Slither ran, and Medusa falsified the vault invariant with a single `claimBonus` call.

Even with that rule, `cp`, `rm` and chained `cd ... &&` calls are still refused in that mode. Fixture mode copies the fixture with `cp`, so allow `Bash(cp:*)` too, or approve it when prompted in an interactive session.

### 3. Read the output

The report is written to `memory/reports/<slug>-<date>.md`. It has an executive summary, scope, methodology, the threat model and invariants, findings with severity and fix, refuted candidates, and coverage and limitations. Alongside it you get a machine-readable coverage manifest in `memory/coverage/` and a log line in `memory/logs/`.

## What works outside Aeon

These results come from a test run on 2026-10-28: Claude Code headless (`claude -p --allowedTools "Bash Read Write Edit Glob Grep"`, so Bash unrestricted) on macOS, target `fixture:vault`, no Aeon files present apart from the two skill folders.

Tools on that machine:

- Slither, solc-select and crytic-compile: none were preinstalled. The skill installed `slither-analyzer`, `solc-select` and `crytic-compile` into a venv itself, and solc-select fetched solc 0.8.28.
- `forge`: installed but broken, because `libusb` was missing. The compile failed, so Slither reported `compile-fail`.
- Medusa and Echidna: not installed, so the fuzz step was skipped.

A reviewer re-ran the README in a clean repo under Aeon's allowed-tools list plus `Bash(command -v:*)`. There Slither ran and Medusa falsified the vault invariant, so the S4 and S6.5 rows below are confirmed with tools present.

| Step | Outside Aeon | Notes |
|---|---|---|
| S1 target selection (repo, address, fixture) | Works | The empty-target auto-pick needs Aeon's feed; pass a target. |
| S2 clone / copy / fetch | Works | Repo mode runs `gh repo fork` (forks into your account). Swap in `gh repo clone` if you prefer. |
| S2b on-chain source fetch | Works | Replace `./secretcurl` with plain `curl` and your own `ETHERSCAN_API_KEY`. Sourcify and Blockscout need no key. |
| S3 toolchain | Works | Install the tools yourself (above). `FOUNDRY_FFI=false` hardening still applies. |
| S4 Slither | Works when the target compiles | On the test machine, Slither degraded to `compile-fail` because the local `forge` binary was broken, and the skill continued as designed. Confirmed working in review once `Bash(command -v:*)` was allowed. |
| S5.0 threat model, S5 agentic review | Works | The core of the skill; needs no tools. The test run found the planted critical bug. |
| S6 triage and adversarial verification | Works | Follows the triage bar in `vuln-scanner` §A4/§A4.5, so install that folder too. In the test run it refuted 2 false candidates. |
| S6.5 fuzz arm | Works with forge + Medusa/Echidna installed | Skipped in the 2026-10-28 run (not installed). Confirmed in review: Medusa falsified the vault invariant once `Bash(command -v:*)` was allowed. |
| S7 disclosure | Partly | The bounty-platform search and staging a draft in `memory/pending-disclosures/` work. Auto-filing GitHub private advisories and sending email depend on Aeon's `vuln-scanner` routing, `./secretcurl` and Resend keys. Outside Aeon, treat every finding as operator-gated: review the draft and submit it yourself. |
| S8 dedup ledger and coverage manifest | Works | Plain files under `memory/`. |
| S9 report | Works | The `./notify` alert is Aeon-only; skip it. The report itself is the output. |

Responsible disclosure still applies. A fuzz counterexample is a working exploit sequence, so never post a finding against a live contract publicly before it's fixed. Submit it through the project's bug-bounty program or `SECURITY.md` intake.
