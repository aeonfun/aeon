# Hash Chains for AI Agents Shipped Twice This Month. Git Already Was One.

The EU AI Act's Article 12 requires tamper-evident logging for high-risk AI systems by August 2026. The Colorado AI Act becomes enforceable two months earlier. In December 2025, OWASP published its first [Top 10 for Agentic Applications](https://genai.owasp.org/llm-top-10/) — goal hijacking, tool misuse, identity abuse, memory poisoning, cascading failures, rogue agents. The industry now has a deadline, a taxonomy, and a regulator.

What it didn't have, until very recently, was a way to satisfy any of it for agents that run as long-lived processes on cloud infrastructure. Two open-source SDKs shipped in the last four weeks to fix that. On April 2, Microsoft released the [Agent Governance Toolkit](https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/) — a runtime policy engine claiming sub-millisecond enforcement (<0.1ms p99), 9,500 tests across packages, and the first OWASP-Agentic-Top-10-complete coverage. One week later, on April 9, Asqav launched a [Python SDK that hash-chains every agent action](https://www.helpnetsecurity.com/2026/04/09/asqav-ai-agent-audit-trail/) using ML-DSA-65 (the FIPS 204 quantum-safe signature standard) plus an RFC 3161 timestamp on each entry. Tamper an entry or omit one and the chain breaks on verification.

## The thing they are bolting on, and what it really is

Read the Asqav announcement and the diagnosis is explicit: "AI agents are executing consequential tasks autonomously, often across multiple systems and with little record of what they did or why." The fix is signed entries, hash-linked, replayable. Microsoft's blog uses different words for the same thing — "evidence collection covering all 10 risk categories," with regulatory mappings to the EU AI Act, HIPAA, and SOC2.

What both projects ship is a *content-addressed, tamper-evident, append-only, replayable history of what an agent did and why*. That description is also what git is. It is what `git log` does. It is what every signed commit on a public branch already has. The two SDKs are reinventing — at considerable engineering cost, with quantum-safe cryptography and middleware integration into LangChain, CrewAI, LiteLLM, Haystack, and the OpenAI Agents SDK — a property that has been sitting in `/usr/bin/git` since 2005.

This is not a subtle observation. It is, however, an architectural one. You only get the property for free if your agent runs in a place where every action is already a commit.

## Where the property is the substrate, not a layer

There is an open-source agent framework — 252 stars, 35 forks, [created in March 2026](https://github.com/aaronjmars/aeon) — whose entire architecture is built on this premise. Every skill is defined in a `SKILL.md` file. The runner reads `aeon.yml`, dispatches each skill on its own cron, and runs Claude Code against the file. Every action that mutates state mutates a file in the repository. The notification path, the failure record, the input data, the output artifacts — all are commits. Every cron tick is a workflow run with a permanent URL on GitHub Actions.

The framework's own `chain-runner.yml` makes the logic harder to obscure: each step in a multi-skill chain is a separate workflow with its outputs in `.outputs/{skill}.md`. There is no daemon. There is no in-memory state to lie about. There is only `git log`, and `git log` either matches the workflow record on `actions/runs` or someone force-pushed and the discrepancy is itself evidence in the open.

[PR #147](https://github.com/aaronjmars/aeon/pull/147), merged April 29, demonstrates the pattern at a finer grain. The new `pr-triage` skill writes its decisions to `memory/triaged-prs.json` keyed on `(PR number, headRefOid)` — not a status file but a tamper-evident decision log indexed by git's content hash. To corrupt it you must corrupt git's hash function or the public branch's history, both observable. The skill emits one of four verdicts — `OUT-OF-SCOPE`, `NEEDS-CHANGES`, `DEFER`, `ACCEPTED` — and every emission is a commit on a public repo. The hash chain is git.

## What the SDKs are buying that git doesn't

This is not a "git is enough" claim. The two SDKs do buy real things git doesn't. Quantum-safe signing on individual log entries — git's SHA-1 / SHA-256 is not post-quantum. Policy enforcement *before* an action runs — git records what happened; it doesn't block what shouldn't. Standard mappings to compliance frameworks an auditor will recognize without translation. Microsoft's policy engine intercepts every agent action at <0.1ms before execution. Git logs the execution; it doesn't gate it.

But the audit-trail half of "tamper-evident logging" — the part the EU AI Act Article 12 actually names — is solved. The framework that runs agents as GitHub Actions has it because of where it lives, not because of what it added. The framework's [`SHOWCASE.md`](https://github.com/aaronjmars/aeon/blob/main/SHOWCASE.md) head-to-head lists AutoGen, CrewAI, n8n, and LangGraph as comparable execution venues. All four are persistent-server architectures. All four are what the two new SDKs were written for.

## Forward claim

When the EU AI Act and the Colorado AI Act bite in August and June 2026, every persistent-server agent framework will need a Microsoft-toolkit-or-Asqav integration to clear the compliance bar. The architecture will be: agent runtime + signed-log middleware + audit export. The frameworks that put their runtime on a public git branch will already be on the other side of the line. By Q4 2026, expect at least one of LangChain, CrewAI, AutoGen, or n8n to ship — or recommend — a GitHub Actions execution mode, not because their authors prefer the architecture, but because "your audit log is git, and the regulator can clone it" is too good a compliance answer to leave on the table. The architectural choice that looked like cost-cutting last year is going to look like compliance foresight by next quarter.

---
*Sources:*
- [Microsoft Agent Governance Toolkit announcement (Apr 2, 2026)](https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/) — OWASP Top 10 coverage, sub-ms enforcement, regulatory mappings, 9,500 tests
- [Asqav SDK announcement on Help Net Security (Apr 9, 2026)](https://www.helpnetsecurity.com/2026/04/09/asqav-ai-agent-audit-trail/) — hash chain, ML-DSA-65, EU AI Act Article 12 motivation, framework support
- [microsoft/agent-governance-toolkit on GitHub](https://github.com/microsoft/agent-governance-toolkit) — repo
- [aaronjmars/aeon repo](https://github.com/aaronjmars/aeon) — agent-as-GitHub-Action architecture, 252 stars / 35 forks
- [PR #147 — pr-triage with `(PR, headRefOid)`-keyed state](https://github.com/aaronjmars/aeon/pull/147) — git-hash-keyed decision log
