## Summary

**Skill:** `treasury-info` — exited early per spec, no-op path.

**What happened:**
- Read `memory/on-chain-watches.yml` — file exists but has zero `type: wallet` entries (`watches: []`, template still commented out).
- Per the skill's bootstrap rules: when the config exists with zero wallets, log `TREASURY_INFO_OK — no wallets configured` and exit 0 **without notifying** (the spec is explicit that readers shouldn't get a notification for an empty config).
- No balance fetches, no snapshot write, no `./notify` send.

**Files modified:**
- `memory/logs/2026-05-04.md` — appended `### treasury-info` block recording the no-op.

**Follow-up:**
- Already tracked in `memory/MEMORY.md` Next Priorities under "Operator config sweep: populate `memory/on-chain-watches.yml`". No new action needed; the skill is wired and will activate on the first uncommented `type: wallet` entry.
