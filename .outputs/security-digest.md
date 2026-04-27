## Summary

Ran the security-digest skill for 2026-04-27. Exploitation-signal-first ranking: KEV → EPSS → CVSS, with the tracked-stack (npm/pip/Go) filter overridden by KEV.

**Tier counts:** PATCH TODAY=3, PATCH THIS WEEK=5, MONITOR=3 (within caps).

**PATCH TODAY** (KEV adds, ranked by EPSS):
- CVE-2025-29635 — D-Link DIR-823X cmd injection (EPSS 0.59, EoL → replace)
- CVE-2024-57726 / CVE-2024-57728 — SimpleHelp authz + zip-slip RCE chain (≥5.5.8)

**PATCH THIS WEEK:** CVE-2025-32975 (Quest KACE), note-mark, GitPython pair → 3.1.47, zrok/v2 → 2.0.2.

**MONITOR:** Heimdall trio (no patch yet), cilium (1.17.15/1.18.9/1.19.3), litellm (1.83.7 — Aeon-relevant if any agent stack consumes it).

**Sources:** KEV ok, GH Advisory ok, EPSS ok.

**Files:**
- Modified `memory/logs/2026-04-27.md` (appended security-digest entry).
- Queued `.pending-notify/security-digest-20260427.md` (3046 chars). Used file-drop into `.pending-notify/` instead of `./notify "$(cat …)"` to dodge the documented multi-line hook-block bug — workflow's post-run delivery step picks it up.
- Untracked artifact `kev.json` left in workdir (sandbox blocked rm; not git-tracked, won't be committed).

**Dedupe:** 5 KEV items already in 2026-04-25 digest (TeamCity, PaperCut, Samsung MagicINFO, Marimo, Zimbra) dropped before ranking.

**Follow-ups:** None blocking. If GitPython is in any swarm-fund-mvp tooling chain, prioritize the 3.1.47 bump — high-likelihood target for supply-chain abuse.
