# Subsystem: External Integrations

The third-party surfaces Aeon plugs into: Bankr LLM gateway, Smithery / MCP Registry, x402, Fleet Watcher, the ecosystem.

---

## Bankr LLM Gateway (cost optimization)

[Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) is an optional routing layer that swaps the LLM provider behind your skill runs without changing skill prose. Aeon supports it as a first-class gateway.

### How to enable

1. Get a key at [bankr.bot/api](https://bankr.bot/api) and top up credits.
2. Add `BANKR_LLM_KEY` as a repo secret.
3. Set in `aeon.yml`:
   ```yaml
   gateway:
     provider: bankr
   ```

### What it changes

- **Default routing** — skill runs hit `https://llm.bankr.bot` instead of `https://api.anthropic.com` ([`aeon.yml:292-310`](../../../.github/workflows/aeon.yml#L292-L310)).
- **Available models** — Bankr unlocks Gemini (3-pro, 3-flash), GPT-5.2, Kimi K2.5, Qwen3-coder in addition to Claude. The model dropdown in `workflow_dispatch` lists these alongside the native Claude options ([`aeon.yml:11-24`](../../../.github/workflows/aeon.yml#L11-L24)).
- **Cost** — Bankr-routed Opus is ~67% cheaper (via Vertex AI). Cache hits behave differently; verify by reading `memory/token-usage.csv` for a week before/after the switch.
- **Skill-level overrides** still apply. A skill with `model: "claude-sonnet-4-6"` will route via Bankr if `gateway.provider == bankr`.

### Where Bankr is touched in code

| File | What it does |
|---|---|
| [`.github/workflows/aeon.yml:292-310`](../../../.github/workflows/aeon.yml#L292-L310) | Routes `claude -p -` invocations through `https://llm.bankr.bot` when configured |
| `dashboard/lib/config.ts` | Parses the `gateway:` block; type is `{ provider: 'direct' \| 'bankr' }` |
| `dashboard/lib/constants.ts` | `BANKR_EXTRA_MODELS` — model list that becomes available only via Bankr |
| `skills/distribute-tokens/SKILL.md` | Uses `BANKR_API_KEY` (different key, wallet-API enabled) to drive on-chain operations |
| `skills/treasury-info/SKILL.md` | Optional PnL enrichment via Bankr if `BANKR_API_KEY` set |

### Two different Bankr keys

This trips people up. Bankr has two products:

- **`BANKR_LLM_KEY`** — LLM gateway (replaces Anthropic API key).
- **`BANKR_API_KEY`** — Wallet / agent API (used by `distribute-tokens`, `treasury-info`).

They are not interchangeable. The LLM key cannot make wallet calls; the wallet key cannot drive completion.

## Smithery / MCP Registry

[Smithery.ai](https://smithery.ai/) is a discovery surface for MCP servers; the MCP Registry is the canonical catalog. The [`smithery-manifest`](../../../skills/smithery-manifest/SKILL.md) skill automates publication of three artifacts:

| Artifact | What it is |
|---|---|
| [`docs/smithery-manifest.json`](../../../docs/smithery-manifest.json) | MCP Registry server metadata. Name `io.github.aaronjmars/aeon-mcp` (reverse-DNS per MCP convention). Tools array auto-derived from `skills.json`, alphabetized. |
| [`docs/smithery.yaml`](../../../docs/smithery.yaml) | Smithery's execution spec. Declares `startCommand.type: stdio`, accepts optional `repoPath`, returns the node command via a `commandFunction` template. |
| [`docs/smithery-submission.md`](../../../docs/smithery-submission.md) | Paste-ready form data for the Smithery / MCP Registry submission UI. |

### Publication flow

1. Run the `smithery-manifest` skill (manually or via cron).
2. It reads `skills.json`, `mcp-server/package.json`, `aeon.yml`, `README.md`.
3. Regenerates the three files (alphabetically sorted tools to keep diffs clean).
4. Flags npm publication status (the package is referenced by the manifest but is not currently published to npm — captured in [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md)).
5. Commit the changes; submission to Smithery / MCP Registry is manual via the form.

The skill includes `--dry-run` mode to suppress notifications during validation.

## x402 (HTTP-native micropayments)

x402 appears in three places:

1. **`x402-monitor` skill** ([`skills/x402-monitor/SKILL.md`](../../../skills/x402-monitor/SKILL.md)) — tracks ecosystem velocity for the x402 protocol (or any configured protocol). Reads `memory/topics/tracked-protocol.md` for search queries, npm packages, and notable accounts. Outputs a composite momentum score to `memory/topics/protocol-state-<protocol>.md`. **This is monitoring, not a payment primitive.**
2. **`aixbt-pulse`** — notes that paid AIXBT endpoints require `$10/day via x402` upgrade. Doesn't actually pay; just documents.
3. **`deal-flow`** — tracks "agentic payments" and "x402" as deal-flow verticals.

**There are no payment-gating primitives in Aeon today.** No skill charges, no MCP/A2A tool requires payment, no fork-to-fork settlement. This is a wide-open expansion surface (see [`../09-EXPANSION-OPTIONS.md`](../09-EXPANSION-OPTIONS.md) #3).

## Fleet Watcher (optional authorization layer)

Fleet Watcher is an out-of-tree control plane that adds inline ALLOW/BLOCK authorization in front of every skill run. The integration is two `if:`-conditional steps in [`.github/workflows/aeon.yml`](../../../.github/workflows/aeon.yml):

| Step | Lines | Behavior |
|---|---|---|
| Fleet Watcher preflight | [`aeon.yml:204-240`](../../../.github/workflows/aeon.yml#L204-L240) | POST to `$FLEET_ENDPOINT/api/aeon/preflight` with skill, target, source, opId. Expects `{ allow, reason, auditRef, ref }`. **Fails closed** on non-200 — skill does not run. |
| Fleet Watcher postflight | [`aeon.yml:518-555`](../../../.github/workflows/aeon.yml#L518-L555) | Always runs (`if: always()`). Maps outcome to `ok / error / blocked`, POSTs to `$FLEET_ENDPOINT/api/aeon/postflight` with auditRef. Logs `chainsDetected` count (taint analysis). |

If `FLEET_ENDPOINT` and `FLEET_TOKEN` are not set, both steps no-op. Fully backward compatible.

### What it's for

Fleet Watcher is meant to enforce operator red lines: per-skill rate caps, counterparty allowlists, dangerous-string patterns, source-to-sink chain detection. Useful when an Aeon instance has on-chain or financial side-effects (treasury operations, token distribution, paid API calls).

### Open question

The README points at `github.com/yourorg/fleet-watcher` — that's a placeholder org. The canonical Fleet Watcher repo does not appear to be published yet. Captured in [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md).

## The ecosystem

`ECOSYSTEM.md` lists ~50 projects that build on top of Aeon. They are not integrated into the codebase — they are *downstream consumers*. The relationship is:

- They depend on Aeon's runtime behavior (skill format, MCP/A2A protocol, `./notify`, memory shape).
- They contribute back occasionally via PR.
- They feed signal via the fork-fleet analytics (`fork-skill-digest`, `fork-contributor-leaderboard`).

The implications for a contributor:

- **Breaking changes to the skill format propagate to every fork on next `sync-upstream`.** Treat them as breaking ABI changes.
- **The MCP and A2A wire shapes are part of the public contract.** Changing them silently breaks downstream agent frameworks.
- **Memory layout (`memory/MEMORY.md` index → `topics/`, `logs/`, `issues/`) is also de facto public** — ecosystem projects read it.

We do not have a written compatibility policy. Captured in [`../08-OPEN-QUESTIONS.md`](../08-OPEN-QUESTIONS.md).

## Community skill packs

Six packs are listed in `README.md` and registered in `skill-packs.json`. The installation flow is:

```bash
./install-skill-pack <owner>/<pack-repo>
```

Behavior:

1. Read the pack's `skills-pack.json` manifest from its repo root (or scan `skills/` if absent).
2. For each declared skill, run `skill-security-scan` on the `SKILL.md`.
3. Approved skills are copied into local `skills/`, with rows added to `skills.json`, entries added to `aeon.yml` (disabled), and provenance recorded in `skills.lock`.

Trust model is **scan-on-install**. The security implications are covered in [`../05-SECURITY.md`](../05-SECURITY.md) § Supply-chain.

## Related docs

- [`mcp-server.md`](mcp-server.md) — what Smithery publishes.
- [`runtime.md`](runtime.md) — where Bankr and Fleet Watcher get invoked.
- [`../04-GOVERNANCE.md`](../04-GOVERNANCE.md) — ecosystem stewardship rules.
- [`../05-SECURITY.md`](../05-SECURITY.md) — supply-chain and authorization model.
