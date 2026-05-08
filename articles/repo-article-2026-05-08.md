# Eight of Eleven PRs on swarm-fund-mvp Are the Same Class of Bug

After [ADR-095](https://github.com/tomscaria/swarm-fund-mvp/commit/80b1228) shipped at 21:48 UTC on 2026-05-06, swarm-fund-mvp stopped opening new features. Every PR touched in the last 7 days that isn't a doc or eval is a `fix(...)` against code from the prior-week velocity burst. Two of the open PRs explicitly cross-reference five earlier fixes from the same bug-class.

## The claim
> swarm-fund-mvp has shifted from feature-shipping to single-bug-class defect-hardening — 8 of 11 PRs touched in the last 7 days target prior-week ADRs (089-095), and three of the four currently-open PRs share the same one-bad-input-poisons-the-batch failure mode.

## Evidence

The PR ledger from 2026-05-01 to 2026-05-08: 7 merged, 4 open. The four open PRs:

- [#29](https://github.com/tomscaria/swarm-fund-mvp/pull/29) — Phase B eval (draft, blocked on Hyperliquid 403)
- [#30](https://github.com/tomscaria/swarm-fund-mvp/pull/30) — `fix(variant_bandit): fall back past corrupt tail in latest_snapshot_date`
- [#31](https://github.com/tomscaria/swarm-fund-mvp/pull/31) — `fix(aeon_adapter): clear _last_error after successful poll`
- [#32](https://github.com/tomscaria/swarm-fund-mvp/pull/32) — `fix(aeon_adapter): treat null signals/markets like missing keys`

Among the 7 merged PRs, four landed in a single 12-second window on 2026-05-03 21:57 UTC — [#19](https://github.com/tomscaria/swarm-fund-mvp/pull/19), [#20](https://github.com/tomscaria/swarm-fund-mvp/pull/20), [#23](https://github.com/tomscaria/swarm-fund-mvp/pull/23), [#24](https://github.com/tomscaria/swarm-fund-mvp/pull/24) — all `fix(...)` against ADR-091 (variant_bandit) and ADR-093 (aeon_adapter). [#28](https://github.com/tomscaria/swarm-fund-mvp/pull/28) merged in the same window as a regression test for the same `variant_bandit.canonical_regime_label()` path that #30 patches. The remaining two merges (#26 vision doc, #27 grants tracker) aren't code. Net: 5 defect-hardening PRs of 7 merged.

Two PR descriptions name the pattern outright. PR #30 (45 lines, 2 files): "Same bug-class as the earlier counts-dict KeyError fixes (#23/#24) — one bad input shouldn't invalidate an entire batch's worth of work." PR #32 (43 lines, 2 files): "Same bug class as #19 / #20 / #23 / #24 / #30." That's the author cross-referencing five prior fixes from a single PR description. The bug class has been catalogued.

The ADR sequence in [DECISIONS.md](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md) shows the velocity that produced the carry cost: ADR-089/090/091 on 2026-04-28, ADR-093 on 2026-05-03, ADR-094 on 2026-05-03, ADR-095 on 2026-05-06. Five architectural decisions in nine days. Then nothing — the ~36 hours since `80b1228` are silent on new architecture.

The two open `aeon_adapter` PRs are the most diagnostic. ADR-093 wires that adapter as the only ingestion path between `tomscaria/aeon`'s output contract and the swarm-fund tick broker. PR #31 fixes a never-cleared `_last_error` field that left the adapter "looking permanently broken to any downstream observer until the host process restarted." PR #32 fixes a `TypeError` on `{"signals": null}` payloads that "escapes to `_poll_loop` and skips every remaining `(skill, date)` pair in the cycle." Both bugs would have shipped silently to production — the original ADR-093 PR added 19 tests, all scoped to happy paths.

## Counter-evidence / what would change my mind

The bug-class concentration could be illusory if the prior-week features were comparatively mature and the current cleanup is normal post-ship audit churn. The genuine counter-signal is the next 48 hours: if ADR-096 opens before any of #30/#31/#32 merge, the velocity is still there and this is an interleave, not a phase shift. If `tomscaria/aeon` ships its committed `outputs/{skill}/{date}.json` contract this week, the aeon_adapter hardening converts from pre-emptive defense to time-spent-correctly. As of this writing, [`tomscaria/aeon` returns 404 on `/contents/outputs`](https://api.github.com/repos/tomscaria/aeon/contents/outputs) — the producer side hasn't started.

## Why it matters

The aeon_adapter falsifier window closes on 2026-05-17 — 9 days from now. PR #31 and PR #32 are hardening the consumer side *before* the producer locks the shape, which is the correct order. But two of four open PRs are pre-emptive defense for an integration point with no live counterparty, which is a useful tell for any LP or grant reviewer triaging swarm-fund-mvp's shipment claims. The velocity number is real (5 ADRs in 9 days, 144 agents across 47 strategies per the [2026-05-03 CHANGELOG](https://github.com/tomscaria/swarm-fund-mvp/blob/main/CHANGELOG.md)), and so is the carry cost. Both belong in the same paragraph.

---
*Sources*
- [PR #30 — fix(variant_bandit) corrupt-tail fallback](https://github.com/tomscaria/swarm-fund-mvp/pull/30)
- [PR #31 — fix(aeon_adapter) clear _last_error](https://github.com/tomscaria/swarm-fund-mvp/pull/31)
- [PR #32 — fix(aeon_adapter) null payload handling](https://github.com/tomscaria/swarm-fund-mvp/pull/32)
- [Commit `80b1228` — ADR-095 OLLAMA_FULL=1 (2026-05-06 21:48 UTC)](https://github.com/tomscaria/swarm-fund-mvp/commit/80b1228)
- [DECISIONS.md ADR log (089-095)](https://github.com/tomscaria/swarm-fund-mvp/blob/main/DECISIONS.md)
- [CHANGELOG.md — 2026-05-03 Aeon-Narrative unstub entry](https://github.com/tomscaria/swarm-fund-mvp/blob/main/CHANGELOG.md)
- [tomscaria/aeon `/contents/outputs` — 404 as of 2026-05-08](https://api.github.com/repos/tomscaria/aeon/contents/outputs)
