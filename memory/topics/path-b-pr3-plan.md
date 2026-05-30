# Path B PR3 — Claude-confirmation execution loop

**Status:** Deferred, pending PR2 soak.
**Resume after:** ~5-7 days of poller cron firing OR ~50 fire events captured, whichever comes first.
**Estimated effort:** 1.5-2 days focused work, single PR.

---

## Where we are

- **PR1 (#59) — merged.** Schema extensions: structured `trigger_conditions` and `invalidation_conditions` on watchlist entries, `action` field (`alert` / `exit` / `enter` / `drop`) on watch conditions, audit fields `opened_by` / `closed_by` / `triggered_condition_index` on ledger entries.
- **PR2 (#60) — merged.** Read-only poller. Hourly cron evaluates conditions, posts summary embed to `#aeon-ops`. No actions.
- **PR3 — this doc.** Closes the loop. Poller dispatches a focused Claude skill on fire. Claude confirms or defers or dismisses per trigger. Confirmed triggers write ledger ops, which flow through standard apply-ledger-ops + Stage 3 embed delivery to the existing channels.

## Confirmed design decisions (from earlier planning)

- **Batch review (Q1):** Multiple fires in one poll cycle → single Claude run sees all of them. Better regime-pattern recognition.
- **Cooldown 4h on DEFER (Q2):** When Claude defers, the condition is skipped for 4 hours. Operator-tunable per condition via `cooldown_minutes` set at write time.
- **`match_mode: "all"` default (Q3):** Watchlist condition groups default to AND. Explicit `"any"` available for OR semantics.
- **Same channels (no separate alerts channel):** Poller-initiated actions land in `#perps-positions` / `#perps-watchlist` / `#perps-outcomes` via the existing Stage 3 embed pipeline. The audit trail for poller decisions goes to `#aeon-ops`.
- **Audit-tracking via authorship fields:** Future judgement-audit (PR #52) can stratify by `opened_by="poller"` vs `claude` and `closed_by="poller"` vs `claude` to compare win rates.
- **Single PR for execution loop:** Don't split — the dispatch chain is one logical unit.

## Pre-requisites before starting PR3

- [ ] PR2 has been firing hourly for ~5-7 days without infrastructure failures
- [ ] Accumulated at least ~30 real fire events for pattern analysis
- [ ] Coinglass cache populating cleanly (low `missing_data` counts in poll summaries)
- [ ] Verified Claude has written structured conditions on recent open[] entries and watchlist entries (inspect ledger)
- [ ] Reviewed fire patterns for false positives / threshold-calibration issues
- [ ] No outstanding bugs from PR1/PR2

## Open questions to answer from PR2 fire data

These shape PR3 safety guards:

1. **Fire rate per day.** Target: 1-10 fires/day across the book. Lower = thresholds too loose. Higher = too tight.
2. **Margin distribution.** When a condition fires, how far is current_value from threshold? Big margin (e.g., funding 0.05 vs threshold 0.001) suggests the threshold isn't meaningful.
3. **Fire-happy condition types.** If `funding_above` fires 50× more than `lsr_below`, threshold guidance in SKILL.md needs tightening for that type specifically.
4. **Same condition re-firing without operator intervention?** Cooldown isn't being respected, OR the condition is genuinely true and the threshold is wrong.
5. **Missing-data asset patterns.** Specific assets showing high `missing_data` → Coinglass coverage gap, may need universe-inclusion fix.

## Implementation plan

### New files

```
skills/engine-trigger-review/
  SKILL.md           Claude's contract: read triggers, decide CONFIRM /
                     DEFER / DISMISS per trigger, emit ledger_ops +
                     condition state updates

scripts/prefetch-engine-trigger-review.sh
  Runs before Claude. Re-evaluates conditions against fresh cache.
  Writes .outputs/engine-trigger-review.context.json with current
  trigger details + recent market context.

scripts/postprocess-engine-trigger-review.sh
  Runs after Claude. Applies ledger_ops via apply-ledger-ops.py.
  Updates last_fired_at_utc / last_defer_at_utc on conditions.
  Triggers Stage 3 embed delivery for any state changes.
  Posts an audit-trail embed to #aeon-ops showing per-trigger decisions.

scripts/lib/condition_state.py
  New module. Updates last_fired_at_utc and last_defer_at_utc on
  watch conditions based on Claude's decisions. Atomic ledger write
  via lib/ledger.py.
```

### Modified files

```
scripts/poll-engine-conditions.py
  Add --dispatch-on-fire flag. When set + fires exist, writes
  .outputs/poller-triggers.json with fire details AND dispatches:
    gh workflow run aeon.yml -f skill=engine-trigger-review
  via workflow_dispatch from inside the GHA runner.

scripts/apply-ledger-ops.py
  May need a new op type for marking conditions as DEFERed / DISMISSED
  (cooldown timestamp update only, no ledger transition). Alternatively,
  condition_state.py handles this independently.

.github/workflows/poll-engine.yml
  Pass GITHUB_TOKEN with workflow_dispatch permission so the poller
  can fire the engine-trigger-review skill via the standard aeon.yml
  dispatch.

scripts/lib/embeds.py
  compose_trigger_review_summary() — shows Claude's CONFIRM/DEFER/DISMISS
  decisions per trigger. Posts to #aeon-ops.
```

### Workflow integration

```
poll-engine.yml (hourly cron)
  ├─ Prefetch coinglass cache
  ├─ Run poll-engine-conditions.py --live --dispatch-on-fire
  ├─ If fires: writes triggers JSON + gh workflow run aeon.yml
  │            -f skill=engine-trigger-review
  └─ Else: posts quiet-hour embed and exits

aeon.yml (dispatched on fire, skill=engine-trigger-review)
  ├─ Run prefetch-engine-trigger-review.sh
  ├─ Claude executes skill:
  │     - reads .outputs/engine-trigger-review.context.json
  │     - reads ledger + market-context
  │     - decides per trigger: CONFIRM / DEFER / DISMISS
  │     - writes .outputs/engine-trigger-review.data.json
  ├─ Run postprocess-engine-trigger-review.sh:
  │     - apply-ledger-ops processes CONFIRM ops
  │     - condition_state updates DEFER / DISMISS timestamps
  │     - Stage 3 embed delivery for state changes
  │     - Audit embed to #aeon-ops
  └─ Auto-commit ledger + condition state
```

### SKILL.md contract for engine-trigger-review

**Inputs**
- `.outputs/engine-trigger-review.context.json` — array of fires with `{asset, direction, entity, entity_id, condition_index, condition, current_value}`
- `memory/topics/state/active-setups.json` — full ledger
- `memory/topics/market-context.md` — canonical regime view
- `.outputs/perps-brief.md` (latest) for context

**Per-trigger decision**

| Decision | Action |
|---|---|
| `CONFIRM` | Write the implied ledger op. `closed_by="poller"` / `opened_by="poller"` set automatically. `triggered_condition_index` set to the fired index. Standard pipeline delivers embeds. |
| `DEFER` | Cooldown only. `last_defer_at_utc = now`. No ledger transition. Trigger skipped on next polls until cooldown expires. |
| `DISMISS` | Permanent skip for this specific firing. `last_fired_at_utc = now`, very long cooldown. Or Claude can mark the condition itself as bad and recommend removal. |

**Output: `.outputs/engine-trigger-review.data.json`**

```json
{
  "schema_version": "v1",
  "decisions": [
    {
      "trigger_index": 0,
      "asset": "EIGEN",
      "decision": "CONFIRM",
      "rationale": "Funding has now crossed the +0.05% threshold for the third consecutive 8h cycle...",
      "ledger_op": {
        "type": "close",
        "open_id": "EIGEN-2026-05-24-001",
        "closed_price": 0.23,
        "close_reason": "Poller exit trigger: ...",
        ...
      },
      "cooldown_minutes_override": null
    },
    {
      "trigger_index": 1,
      "asset": "ICP",
      "decision": "DEFER",
      "rationale": "LSR collapse but only 0.02 below threshold and on a 24h move...",
      "cooldown_minutes_override": 60
    }
  ],
  "narrative": "Two fires this cycle...",
  "regime_context": "BTC in chop tape, sector rotation absent..."
}
```

## Testing approach

1. **Unit tests:** condition_state.py round-trip (set/clear timestamps), evaluator interaction with cooldown fields after update
2. **Dry-run integration:** Synthesise a trigger, dispatch engine-trigger-review with `--dry-run` flag, verify Claude review proposes the right op without applying
3. **Live integration:** Manual workflow_dispatch with a real fire context, verify the apply pipeline executes and embeds land
4. **Concurrency test:** Trigger poller while morning-review chain is running — verify queue/lock prevents race
5. **Cooldown test:** DEFERed condition skipped in subsequent polls, re-evaluated after cooldown expires
6. **Audit trail:** `closed_by="poller"` + `triggered_condition_index` set correctly on the closed entry
7. **End-to-end:** First real fire after rollout produces correct embeds + audit visibility

## Rollout sequence after PR3 merges

1. Merge PR3
2. Manual dispatch of engine-poller workflow: verify the dispatch chain works
3. Wait for natural fire on next hourly cron
4. Verify first poller-initiated transition appears in channels with correct attribution
5. Monitor for ~1 week
6. Run judgement-audit (#52) — first comparable data on poller vs Claude action win rates
7. (Optional follow-up) Audit extension to surface poller-vs-chain authorship in the embed

## What to inspect on PR3 resume day

Before starting code:
- `ls .outputs/poller-*` and recent #aeon-ops embeds → fire rate, missing-data trend
- Spot-check current ledger entries' `engine_watch_conditions` — are `action` fields set? Are thresholds reasonable?
- Review any operator notes added below

## Operator notes / observations from PR2 soak

_(Add observations here as PR2 runs. Patterns, anomalies, threshold-calibration thoughts, etc.)_

- **2026-05-30, first dry-run after PR2 merge:** Pipeline works end-to-end. Single fire on XLM LONG (`price_close_below: $0.148 vs $0.152`, action=alert, severity=critical). Real invalidation-level breach. PR3 would CONFIRM-close this.

- **Pre-PR1 conditions have `action` defaulting to absent/alert.** XLM's invalidation condition was written before PR1 (it predates the SKILL.md requirement that critical invalidation conditions use `action: "exit"`). PR3 needs to handle the case where a critical-severity condition fires with `action: "alert"` — probably treat alert+critical as a soft-exit candidate and let Claude decide. New positions opened after PR1 will have `action: "exit"` set correctly per the SKILL.md contract.

- **First-run missing_data rate: 13/19 (68%).** Causes to investigate after a few more polls: (a) cache field name mismatches in lib/condition_evaluator.py vs Coinglass v4 response shapes, (b) Coinglass universe ("Tier 1 + top 25 by volume") may not include all current ledger assets — need to expand universe to also include open[] + watchlist[] assets specifically, or fail gracefully when an asset is outside the universe. Defer fix until we have 3-5 polls of data to spot patterns.

---

**Resume signal:** When PR2 has been running cleanly and you want to start PR3, ping me with "let's start PR3" or similar. I'll re-read this doc, check PR2 fire data, and propose the implementation order.
