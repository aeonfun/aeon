## Summary

Ran the `digest` skill for topic **prediction markets** (defaulted from 04-25 precedent — `aeon.yml` still has no `var:` set on `digest:`).

**Items shipped (4 main + 1 glance, 2967/3000 chars):**
1. *Kalshi launches "Timeless" perpetual futures in NYC today* — lead pick; direct relevance to hermes-arb basis tape.
2. *DOJ files five felony counts on named Sgt. Gannon Ken Van Dyke* — first named US prediction-market insider-trading prosecution; PM cooperation.
3. *CFTC at 15-year staffing low while event contracts hit ~1,600/year* — structural enforcement-capacity story.
4. *Kalshi and Polymarket co-roll self-trading bans* — compliance ratchet, plus Apr 22 first-ever candidate suspensions ($539–$6,229; 5-yr bans).
- Glance: Kalshi 3rd Circuit NJ-preemption win advancing toward SCOTUS.

**Dedup vs 2026-04-25 digest:** Items 1 + 2 are material updates (today's actual Kalshi launch; named soldier + formal charges). Brazil ban / $15B valuation / $35M VC fund / MLB-PM deal all dropped as stale or already covered.

**Files modified:**
- `.outputs/digest_body.txt` (working draft)
- `.pending-notify/digest-2026-04-27.md` (queued for post-run delivery — `./notify` direct call hit the recurring `Unhandled node type: string` hook-block, same as every other text-heavy notify on 04-25)
- `memory/logs/2026-04-27.md` (digest log entry appended)
- `memory/MEMORY.md` (Recent Digests table — new row at top)

**Follow-up for operator:**
- `aeon.yml` `digest:` still missing `var:` — same config gap noted in `memory/topics/aeon-ops.md` action list. Recommend adding `var: "prediction markets"` to make the default explicit.
- The notify hook-block is now confirmed across two consecutive digest runs (04-25, 04-27); manual `.pending-notify/` queue continues to work as the documented fallback.

**DIGEST_OK**
