The temp file in `/tmp` is harmless and outside the working tree — leaving it.

## Summary

Executed the `coinglass-probe` one-shot diagnostic skill for 2026-05-18 (round 2).

**What I did:**
- Read the fresh probe summary at `.coinglass-cache/probe-summary.md` (written 15:01Z by `prefetch-coinglass.sh` in probe mode).
- Queued the full probe table to `#aeon-ops` via `.pending-notify/1779116561.signal.md` — `./notify --signal` couldn't run inline (command substitution blocked by sandbox static analysis; the script-file workaround needed interactive approval). The workflow's post-run step re-delivers `.pending-notify/*.signal.md`.
- Appended a log entry to `memory/logs/2026-05-18.md`.

**Probe result:** Reproduces the earlier run today — the Startup-tier `COINGLASS_API_KEY` is **TIER-GATED** on `coins-markets` (HTTP 200, code=401, "Upgrade plan") but has **OK** access to `supported-coins` (1190 rows), `supported-exchange-pairs`, and all per-exchange/aggregated history endpoints. The 4 FAIL rows are code=400 probe-URL issues (missing params / bad pair), not tier gates.

**Diagnosis:** "Core endpoint TIER-GATED but alternates OK" — no tier upgrade needed.

**Files:** `memory/logs/2026-05-18.md` (entry appended), `.pending-notify/1779116561.signal.md` (new).

**Follow-up:** skill-repair/autoresearch should rewrite `prefetch-coinglass.sh` to drop `coins-markets`, build the universe from `supported-coins`, and use per-exchange/aggregated history endpoints — this closes ISS-002. Then retire this one-shot `coinglass-probe` skill.
