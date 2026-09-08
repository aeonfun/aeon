"""Per-offer daily-cap allocation for compute-resell.

One rule: flat even split. Every live offer gets
`max(floor, daily_budget_usd / n)`, optionally clamped by a hard per-offer
ceiling (`cap_daily_usd`, if set). `n` (how many offers to list) is chosen
upstream in selection so the split stays at or above `floor` within the budget
(see *Target models & budget split* in SKILL.md) - the engine auto-derives it as
`min(winnable_serviceable_count, floor(daily_budget_usd / floor), MAX_OFFERS)`,
so there is no `max_models` knob to hand-tune.

There is deliberately no `cap_mode`/proportional reallocation. The old
proportional path front-loaded a proven earner by yesterday's earnings or today's
spend, but it pinned fresh offers at the `$1` floor and - paired with the
adaptive-discount tighten - could reap a whole lineup the instant one offer
saturated. Even split gives every
offer real cap headroom, so a single saturation no longer prices the lineup out.
Concentrate credit by lowering `daily_budget_usd`, not by reshaping the split.

`allocate_caps` is a pure function (no I/O) so it's testable; the `__main__`
block demos it.
"""

# Safety ceiling on offer count so a run never tries to POST hundreds of dust
# offers. The winnable + liquidity gates almost always bind first; this is just a
# backstop. n is otherwise auto-derived from the budget (see module docstring).
MAX_OFFERS = 50


def allocate_caps(offers, daily_budget_usd, floor=1.0, cap_ceiling=None):
    """Return {offer_id: cap_usd} (rounded to cents) - flat even split.

    offers: list of dicts with an `id` key (str). Only the count matters here;
      other keys (cap_daily/cap_remaining/is_fresh) are ignored under even split.
    daily_budget_usd: total throughput budget to deploy across the set.
    floor: minimum cap every offer gets.
    cap_ceiling: hard per-offer ceiling (config cap_daily_usd), or None.
    """
    n = len(offers)
    if n == 0:
        return {}
    share = max(floor, daily_budget_usd / n)
    if cap_ceiling is not None:
        share = min(share, cap_ceiling)
    return {o["id"]: round(share, 2) for o in offers}


def auto_offer_count(winnable_serviceable, daily_budget_usd, floor=1.0):
    """How many offers to list this run - fully automatic, no `max_models` knob.

    List as many winnable-and-serviceable models as the budget can fund at at
    least `floor` each, bounded by the safety ceiling. Selection walks the
    score-ranked winnable set and admits the top `auto_offer_count(...)` of them.

    winnable_serviceable: count of models that passed the liquidity gate AND are
      winnable-within-cap AND the provider can serve (not in `denied`).
    """
    by_budget = int(daily_budget_usd // max(floor, 1e-9))
    return max(0, min(winnable_serviceable, by_budget, MAX_OFFERS))


if __name__ == "__main__":
    # 5 live offers sharing a $20 budget -> $4.00 each (even split, the only mode).
    lineup = [
        {"id": "opus-4.6"}, {"id": "sonnet-4.6"}, {"id": "sonnet-4.5"},
        {"id": "opus-4.5"}, {"id": "opus-4.7"},
    ]
    budget = 20.0

    print("=== even split ===")
    caps = allocate_caps(lineup, budget)
    for oid, cap in caps.items():
        print(f"  {oid:12s} ${cap:.2f}/day")
    print(f"  total ${sum(caps.values()):.2f}")

    print("\n=== with a $3 per-offer ceiling ===")
    caps = allocate_caps(lineup, budget, cap_ceiling=3.0)
    for oid, cap in caps.items():
        print(f"  {oid:12s} ${cap:.2f}/day")
    print(f"  total ${sum(caps.values()):.2f}  (ceiling clamps below the even share)")

    print("\n=== auto_offer_count (no max_models knob) ===")
    for wc, bud in ((3, 10.0), (30, 10.0), (30, 100.0), (200, 100.0)):
        print(f"  winnable={wc:3d} budget=${bud:6.1f} -> list {auto_offer_count(wc, bud)} offers")
