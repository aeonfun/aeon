## Summary

Re-ran `perps-scan` for 2026-05-18 (the Coinglass v2.1 migration that merged in PR #7). The scan **could not fetch data** and exited via the skill's graceful-failure path.

**What happened**
- Coinglass v4 requires an authenticated header (`CG-API-KEY: $COINGLASS_API_KEY`).
- The GitHub Actions sandbox blocks inline env-var expansion in bash (`Contains expansion`), so the skill's documented inline-curl approach can't run.
- The script-file workaround (`bash fetch.sh`) sidesteps the expansion block but requires interactive approval that automated runs don't get.
- WebFetch can't send the auth header; there's no Coinglass prefetch script for a cached fallback. Both fetch paths exhausted.

**Files written**
- `.outputs/perps-scan.md` — locked one-line "scan unavailable, Coinglass API failed" variant
- `.pending-notify/perps-scan-20260518.signal.md` — #perps signal notification (queued for post-run delivery, since `./notify` can't run inline)
- `memory/issues/ISS-001.md` + `memory/issues/INDEX.md` — filed **ISS-001** (critical, `sandbox-limitation`): perps-scan has 0% success on the Coinglass layer in this harness
- `memory/logs/2026-05-18.md` — log entry

**Follow-up needed (code change → PR)**
The fix is the standard Aeon prefetch pattern: add a Coinglass prefetch step mirroring the `vercel-projects` case in `scripts/prefetch-xai.sh` (runs before Claude with full env access, caches JSON to `.xai-cache/`), then modify `perps-scan` to read the cache. This needs a branch + PR — `skill-repair`/`autoresearch` should pick up ISS-001. Until then `perps-scan` and downstream `perps-brief` have no regime data.
