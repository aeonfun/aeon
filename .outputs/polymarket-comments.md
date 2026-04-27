## Summary

Ran `polymarket-comments` skill (second slot today; first ran 02:17 UTC). Five-market sweep with `var=narrative-shift politics+crypto info-asymmetry alpha`.

**Markets covered** (all distinct from AM run):
1. US x Iran ceasefire ext by Apr 22 — $27.4M v24 (#1, UMA dispute live)
2. Israel x Hezbollah ceasefire ext by Apr 26 — $0.8M, UMA vote in 12h
3. Kharg Island no longer under Iranian control by Apr 30 — $0.9M
4. Iranian regime fall by Apr 30 — $2.4M (thin book, headline trade)
5. BTC $150k by Jun 30 — $5.8M (only crypto thread with non-spam content; weak)

**Highest-leverage finding**: Iran-ceasefire-ext UMA-dispute playbook is replicating line-for-line on Hezbollah-ext market. UMA voting opens ~02:00 UTC Apr 28. Same arguments (OR-vs-AND clause logic, "overwhelming media consensus" cite, hostile-oracle whale callouts, conflation fallacy). CalibrationGap concentration risk if holding both books. **@Car** spans both books — single counterparty.

**New track-list handles**: Clear-Corridor (Hezbollah hostile-oracle, $36k YES), b4k9xj2wh (Kharg NO whale, +$18.9k PnL), anoin123 (Kharg NO whale, +$57.1k PnL).

**Fresh citation chains**: Al Jazeera Apr 27 piece, Iran-Saudi FM call Araghchi/bin Farhan, Reuters/CBS Hezbollah rejection, IDF Apr 27 Hezbollah-drone report, CSIS THAAD-depletion (50–80%), LindseyGrahamSC Kharg tweet, Crypto Briefing regime-strain piece.

**Files written**:
- `.pending-notify/1777300315.md` — notification (3433 chars, queued for post-run delivery)
- `memory/logs/2026-04-27.md` — appended `## Polymarket Comments` log block (~POLYMARKET_COMMENTS_OK)
- `.outputs/_cmt_*.json`, `.outputs/_pm_*.json`, `.outputs/_pm_summarize.py` — scratch fetch caches

**Mishap**: I clobbered the workflow-generated `./notify` script with a curl-output JSON dump while writing trending-markets data (used `notify` as filename instead of a `.outputs/` path). Recovered by writing the message directly to `.pending-notify/{ts}.md` — same path the script itself writes to, so post-run delivery is unaffected. Logged in the log entry.

**Follow-ups**:
- Confirm post-run delivery picks up `.pending-notify/1777300315.md` on workflow tail.
- Add Clear-Corridor / b4k9xj2wh / anoin123 to `memory/topics/polymarket.md` recurring-handles list on next reflect/memory-flush.
- Hezbollah UMA vote 02:00 UTC Apr 28 is a near-deterministic NO read per comment-side evidence (Hezbollah Al-Manar TV rejection, IDF drone-attack today, Reuters Fayyad "meaningless"). Useful as a fade signal if CalibrationGap quant scanner sees YES drift in the next 12h.
