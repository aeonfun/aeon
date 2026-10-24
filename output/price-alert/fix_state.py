import json

p = 'memory/topics/price-alert-state.json'
s = json.load(open(p))
u = s['unstake_and_dump']

u['price_impact_pct'] = -1.98
u['price_impact_method'] = 'pool-reserve constant-product mark: VIRTUAL/DEUS 0.02769675 -> 0.02714852 = -1.979%'
u['exec_price_usd'] = 0.0171737950710244
u['prior_print_usd'] = 0.0179584527229686
u['impact_note'] = (
    'TWO numbers, do not conflate them. (a) The POOL MARK fell 0.02769675 -> 0.02714852 VIRTUAL per DEUS '
    '= -1.979%, measured straight off the reserves (DEUS 18,961,647.3772 -> 19,152,146.2397, VIRTUAL '
    '525,176.0739 -> 519,952.3541) at blocks 0x328cee6 -> 0x328cee7. This is the true depth cost. '
    '(b) The PRINTED USD tape went $0.0179585 -> $0.0171738 = -4.37%, but that gap is inflated by VIRTUAL '
    'itself moving and by the stale prior print. Use (a) for depth math. RECALIBRATION: 319,562 DEUS '
    'cost the pool 1.98%, i.e. ~$2.9k of notional per 1% of price - NOT the ~$1.7k/1% inferred from the '
    '91.5k dump on 2026-10-23. The book is deeper than the earlier estimate. A RECORD-SIZED unstake '
    'does not collapse this pool.'
)
u['absorbed_in_block'] = (
    'The dump did NOT sit on the book. SIX buys printed in the SAME block 0x328cee7 (53006055) '
    'totalling 125,867.74 DEUS ($1,771), led by 0x6011b76b (62,825 DEUS / $1,093) and 0x6abea499 '
    '(29,739 DEUS / $514); a seventh buy of 11,529.69 DEUS ($201) landed in the very next block '
    '(0x328ceee). Same-block + next-block absorption = 137,397.44 DEUS. Net DEUS left in the pool after '
    'the event = 319,562.23 - 137,397.44 - 3,195.62 (fee to 0x205db642) = 178,969.17. That same-block '
    'bid is why -1.98% did not become a -10% cascade.'
)
u['distance_math'] = (
    'Constant product, price = k/D^2, so reaching $0.012 from $0.01809 needs D -> D*sqrt(0.01809/0.012) '
    '= D*1.2278, i.e. ~4.36M DEUS of NET pool inflow with zero offsetting bids. That is 13.6x this '
    'record dump, or 15.4 days of the ENTIRE CLAIM drip (283,140/day) sold at market in one go. The '
    '$0.012 gate remains a deliberate-whale event, not an emission drift.'
)

json.dump(s, open(p, 'w'), indent=2, ensure_ascii=False)
print('ok')
