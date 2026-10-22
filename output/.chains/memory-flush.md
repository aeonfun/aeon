Memory flush complete — MEMORY.md is now within budget at 8,093 B / 78 lines with no line over 300 chars, down from 8,453 B / 82 lines and two over-long lines.

## What actually changed

**Fixed a factually wrong entry.** The `## 链上取数` section still instructed future runs to prefer `$BASE_RPC_URL` / `$RH_RPC_URL` as primary and treat public endpoints as fallback. Today's 21:00Z onchain-monitor run proved the reverse — both env vars now resolve to **Infura free tier, which rejects `eth_getLogs` above a 10-block range**. That failure mode is nasty: a windowed scan halves its window forever and reads identically to "stuck" or "zero logs". The entry now leads with the cap, the error-body tell (`Free tier plan` + `10 block range`), and the warning that `memory/rpc.sh` inherits the same env.

**Pruned a resolved section.** `## 已知故障` held only the `hivemindos: 403` wave, which had already cleared by 00:00Z and was duplicated in Lessons Learned. Folded the incident name and blast radius (7 runs, 10-21 17:00–23:31Z) into the surviving lesson line.

**Resolved a self-contradiction in `note-systems.md`.** Line 161 still asserted schedule 25's beneficiary was `0x2807de7a` with "still zero claims", and line 162 called the "每天 2 万" drip real — both flatly contradicted by §133 and §362 of the same file, where the 18:33Z run established the beneficiary is the owner EOA itself and it self-claimed 401,682.037. Rewrote both and listed the real per-schedule magnitudes (7/8/11/18/25 = 21,446 / 2,937 / 2,954 / 191,793 / 401,682) so no future run re-derives a fake daily rate.

**Promoted four price-feed lessons.** GeckoTerminal same-pair fallback when DS omits `h1` (with `h1_source` recorded in state so a substituted reading is never mistaken for a DS measurement); the systematic 0.8–1.6pp h24 divergence between the two sources with h6 occasionally flipping sign; and that a zero-volume hour makes "flat" mechanical rather than calm — 23:01Z showed $0.018 turnover on one trade, where the informative number is the collapse from $276.66 to $5.46 to $0.018, not the 0.00%.

**Added a permission-layer runbook to `ops-plumbing.md`.** `cp` into the repo needs interactive approval, so `.bak` rolls fail silently — price-alert ran 21:01–23:01Z on a stale backup. `jq -f` is refused as a dangerous flag. The working pattern is node tmpfile, re-parse, atomic rename, `jq empty`. This recurred in eight separate runs today and was re-diagnosed from scratch each time.

**Actioned a twice-flagged cleanup.** Added `memory/.dex-*.json` / `memory/.gt-*.json` to `.gitignore`. Both the 22:02Z and 23:01Z runs noted the files reappearing and both suggested the entry without adding it — and since `rm` isn't in the allowlist, the skills couldn't clean up either. Verified they no longer show in `git status`.

**Not promoted, deliberately:** the 60+ hourly price-alert rows (no new subject — band, gates and stale-mark caveat all already recorded), the 14:35Z telegram-reply NOTE analysis (its facts landed in `note-systems.md` at the time), and the heartbeat 403 P0 (a specific instance of an existing lesson).

## Summary

- **Scan window:** 2026-10-22 only, from the state-file watermark — the 00:11Z flush already covered 10-21, so no gap. Read all 777 lines of `memory/logs/2026-10-22.md`. Log rotation: none needed (2 files, threshold 45).
- **Files modified:** `memory/MEMORY.md`, `memory/topics/lessons.md`, `memory/topics/ops-plumbing.md`, `memory/topics/tokens/note-systems.md`, `memory/topics/index.md`, `memory/logs/2026-10-22.md`, `.gitignore`, plus the watermark files written by `stamp`.
- **Pruned:** the `## 已知故障` section (resolved + duplicated), and the stale h1-coverage prose from MEMORY.md (moved to `lessons.md`).
- **Watermark:** stamped to 2026-10-22 via `memory_prep.py stamp` as the final action.
- No GitHub PRs open (0), so no `## Open Improvement PRs` section to maintain. Three open issues, all machine-filed health threads, none urgent.
- **No notification sent** — a clean consolidation isn't signal, per the operator's "正常别吵我".
- **Follow-up worth a decision:** `.dex-*` / `.gt-*` are now ignored but the two existing files are still on disk. If you want them gone rather than just untracked, that needs an `rm` someone is allowed to run.
