# Aeon Compute — foundation (library)

Provider-agnostic contracts and read-only discovery for Aeon Compute: the layer
that will let agents discover, select, provision, execute on, and manage compute
resources. This PR is the **foundation + read-only discovery** slice only. It
provisions nothing, spends nothing, and connects to no machine.

## Why this directory has no `SKILL.md` yet

These are tested library modules, not an agent-facing skill. Registering a skill
(adding `SKILL.md`) triggers `ci-skill-integrity`, which requires an
`eyebrowlock.json` entry produced by `eyebrow scan` — a tool that cannot run in
the sandbox this was built in. The agent-facing `SKILL.md` and its registration
are the next step (see **Registration follow-up**), kept out of this commit so
the foundation lands CI-clean and independently reviewable.

## Modules

| File | Responsibility |
|------|----------------|
| `contracts.py` | `Resource`, `WorkloadSpec`, `ResourceCapabilities`, `GpuSpec`, `Pricing`, `Availability`, `ResourceKind`, `Architecture`. Validation + JSON round-trip. Unknown values are `None`, never fabricated; omissions are recorded in `Resource.missing_fields`. |
| `failures.py` | `FailureCategory` taxonomy (provider / availability / machine / workload / auth / budget / timeout) + `ComputeError` + `classify_http_status`. Distinguishes infrastructure failures (may justify failover) from workload/app failures (never do). |
| `lifecycle.py` | `ResourceState` machine. A discovered offer is not a running machine: discovery reaches only `DISCOVERED`/`AVAILABLE`; `RUNNING` is only reachable through `PROVISIONING`. |
| `state.py` | Crash-safe (atomic `os.replace`), idempotent JSON state at `memory/state/compute/resources.json`. Re-discovery updates in place and preserves lifecycle state. |
| `matching.py` | Explainable `WorkloadSpec` → `Resource` matcher. A requirement that cannot be *verified* (missing/unknown) blocks the match; every criterion carries an ok/fail/unverifiable verdict. |
| `provider_base.py` | `ProviderAdapter` interface. `discover()` is read-only and implemented; provisioning/execute/terminate are declared but raise `NotImplementedError` in the foundation layer. |
| `mock_provider.py` | Deterministic provider for tests; can simulate classified failures. |
| `vastai_provider.py` | **Real** Vast.ai read-only discovery. `normalize_offer()` maps the documented `/api/v0/bundles` response (MB→GB units, verbatim `raw`) and is fully tested; the live HTTP path is implemented to the verified contract but needs `VAST_API_KEY` to verify end-to-end. |

## Tests

```
for t in contracts failures lifecycle state matching providers vastai; do
  python3 scripts/tests/test_compute_$t.py
done
```

55 tests, stdlib `unittest` (no third-party deps), registered in
`scripts/tests/ci-lanes.txt`. The Vast fixture
(`scripts/tests/fixtures/compute/vastai_offers.json`) is **synthetic but
schema-faithful** — Vast's search endpoint requires an API key, so no live
sample was captured and no prices/specs there are real.

## Registration follow-up (needs a tool-equipped run)

1. Add `skills/compute/SKILL.md` (agent-facing: `discover` / `match`, read-only).
2. `eyebrow scan --path . --lockfile eyebrowlock.json` and commit (ci-skill-integrity).
3. Add `VAST_API_KEY` to `ALL_SECRETS` in `.github/workflows/aeon.yml` and `messages.yml`.
4. Regenerate `catalog/skills.json` + `catalog/packs.json` (`bin/generate-skills-json`, `bin/generate-packs-json`) and bump the first-party skill count in `.github/README.md`, `docs/skill-packs.md`, `docs/aeon-setup.md`, `docs/examples/README.md`.

## Not in this slice (later PRs)

Provisioning, remote execution, a first real sandbox provider, multi-provider
selection, health/recovery, budgets/alerts, and the Connect "give your agent a
computer" surface.
