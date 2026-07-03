---
layout: default
title: Skill Capabilities Taxonomy
---

# Skill Capabilities Taxonomy

A **capability** is a self-declared blast-radius hint that a skill carries in its pack manifest. Capabilities surface at install time (`bin/install-skill-pack` and `bin/install-skill-pack --list`) so an operator can glance at what a pack can do — read-only? touches the chain? sends Slack? — before approving a `community` pack on a live agent.

Capabilities are **not** a gate. The trust boundary is still the operator + the security scanner + `trusted-sources.txt`. A skill that omits `capabilities` installs as before. A skill that declares them gets the listing surface for free.

---

## The taxonomy

The set is **locked** to the six values below. Unknown values are rejected by `install-skill-pack` with a clear error pointing back at this file. Adding a new capability requires a separate PR with rationale — this keeps the vocabulary stable so operators learn it once.

| Value | Meaning |
|-------|---------|
| `read_only` | No network writes, no on-chain calls, no notifications. The skill only reads (local files, public HTTP GETs to non-auth'd endpoints, on-chain reads). |
| `external_api` | Reads or writes to non-Aeon HTTP APIs — any auth'd third-party call (OpenAI, Twitter/X API, Discord webhook, Slack bot token, Postgres-as-a-service, etc.). Use this for any call that uses a secret. |
| `writes_external_host` | Modifies state on a non-Aeon host (POST/PUT/DELETE/PATCH against external services). Subset of `external_api` — declare both when the skill writes; declare only `external_api` when the calls are read-only. |
| `onchain_writes` | Signs and broadcasts blockchain transactions. The skill holds or proxies a wallet key and can move funds. |
| `agent_messaging` | Sends DMs, replies, or posts via X / Farcaster / Discord / Slack / Telegram or similar. Subset of `external_api` for the auth call, but called out separately because it speaks for the operator in public. |
| `sends_notifications` | Calls `./notify` (or the equivalent operator-alert path) — pings the operator's own channel, not an external audience. Lower blast radius than `agent_messaging`. |

### How to choose

Pick the **narrowest set** that's still complete. Examples:

- A skill that reads on-chain TVL and writes to `./notify` → `read_only`, `sends_notifications`.
- A skill that posts to X via the v2 API → `external_api`, `writes_external_host`, `agent_messaging`.
- A skill that fetches Coingecko prices and prints them in an article → `external_api` (Coingecko needs an API key for many endpoints; even free ones count as a third-party call).
- A skill that signs a Base txn rebalancing an LP position → `external_api` (RPC), `writes_external_host` (RPC POST), `onchain_writes`.

When in doubt, declare more than less. The listing surface only widens the operator's awareness — it never blocks.

---

## Schema placement

### Per-skill in `skills-pack.json`

```json
"skills": [
  {
    "slug": "vvvkernel-onchain",
    "capabilities": ["external_api", "writes_external_host", "onchain_writes"]
  }
]
```

### Pack-level in `skill-packs.json` (registry)

```json
{
  "repo": "baseddevoloper/aeon-skill-pack-vvvkernel",
  "capabilities": ["external_api", "writes_external_host", "onchain_writes", "agent_messaging", "sends_notifications"]
}
```

The pack-level field is the **union** of every skill's capabilities — kept in sync with the per-skill declarations so `bin/install-skill-pack --list` can summarise without fetching every pack tarball.

See [community-skill-packs.md](community-skill-packs.md) for the full schema reference for both files.

---

## Validation

`bin/install-skill-pack` runs strict allow-list validation when a manifest declares `capabilities`:

- Each value must match one of the six listed above (case-sensitive, exact match).
- Unknown values abort the install with an error message naming the invalid value and pointing at this file.
- An empty array (`"capabilities": []`) is treated as "not declared" — equivalent to omitting the field. A skill that genuinely does nothing externally should declare `["read_only"]` so the surface shows the intent.

No runtime gating — the install proceeds for any allow-listed combination. Capabilities are documentation, not a sandbox.

---

## Runtime enforcement: the `mode:` write tier

`capabilities` (above) is a documentation surface — it never blocks a run. The one capability axis Aeon **does** enforce at runtime is *write* access, declared per skill in SKILL.md frontmatter:

```yaml
mode: read-only   # read repo + fetch web + ./notify; no repo mutation
mode: write       # default — full Write / Edit / git / gh / python3
```

A `read-only` skill runs with a restricted Claude Code `--allowedTools` set (`Write`, `Edit`, `Bash(git:*)`, `Bash(gh:*)` are dropped), so it **physically cannot** commit, push, edit code, or open a PR — the runtime counterpart of declaring `read_only` above. A post-run guard records the skill's run-log on its behalf and reverts any code/config a shell redirection slipped through, while preserving its real output (memory, `output/`). `write` is the default and a strict superset (it adds `python3`). Resolution and the exact tool sets live in [`scripts/skill_mode.sh`](../scripts/skill_mode.sh).

The same `mode:` maps onto the **Grok Build harness** (`harness: grok`) via `scripts/skill_mode.sh grok-args`: `read-only` → a read-only allowlist (no `Edit`, no `git`/`gh`/`python`) under `--sandbox read-only`; `write` adds `Edit` + `Bash(git *)`/`Bash(gh *)`/`python`. Enforcement is that allowlist plus, for `read-only`, the sandbox: grok runs headless (`grok -p`), so any tool that isn't allow-listed and isn't a read-class fast-path has no approval prompt and is refused — the same blast radius as Claude Code's `-p` allowlist. (We pass `--permission-mode dontAsk` too, but grok currently wires that flag only for `bypassPermissions`; the allowlist + sandbox are what actually gate the run.) The post-run guard is harness-agnostic and still applies as defense-in-depth.

Rule of thumb: a skill that declares `capabilities: [read_only, sends_notifications]` should also carry `mode: read-only` — the documentation surface and the runtime gate should agree.

---

## Adding a new capability

The taxonomy is intentionally narrow. New values must:

1. Cover a **distinct** blast radius — something an operator would weigh differently from the existing six.
2. Apply to **multiple** skills, current or planned. One-off cases stay inside `external_api`.
3. Land in **one PR** that updates: this file, the `skills-pack.json` schema reference, and the `install-skill-pack` allow-list constant (both the `ALLOWED_CAPABILITIES` array and the header comment that cites the same values). PRs that add a capability without one of those three pieces will be sent back.

The `ci-capabilities-parity` workflow (`.github/workflows/ci-capabilities-parity.yml`) runs on every PR that touches either file and fails the check when the three places disagree — so a half-PR can't merge silently. Run the same check locally with `bash scripts/check-capabilities-parity.sh`.

Closing a capability (deprecating a value) follows the same protocol in reverse — open a PR that migrates every existing pack first, then removes the value from the allow-list and this file in a follow-up.

---

## What this isn't

- **Not a sandbox.** A skill declaring `read_only` is trusted to be read-only; the runtime doesn't enforce it. The operator-plus-scanner remains the trust boundary.
- **Not a substitute for `trusted-sources.txt`.** Pack-level `trust_level: trusted` still requires the explicit trusted-sources listing — capabilities don't shortcut that.
- **Not an exhaustive permission model.** It's a coarse-grained hint so the install surface is informative. If you need fine-grained policy, that's a different feature.
