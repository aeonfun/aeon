import urllib.request, json, math, os

# Provider selector. The unified compute-resell skill runs this engine once per
# provider (bankr / aws / vertex); RESELL_PROVIDER picks which provider's config
# secret and state file THIS invocation reads. Unset defaults to bankr
# (COMPUTE_RESELL_CONFIG / memory/state/compute-resell.json) so a single-provider
# run stays byte-for-byte compatible with the pre-merge skill.
_PROVIDER = (os.environ.get('RESELL_PROVIDER') or 'bankr').strip().lower()
_CFG_ENV = {
    'bankr': 'COMPUTE_RESELL_CONFIG',
    'aws': 'AWS_COMPUTE_RESELL_CONFIG',
    'vertex': 'VERTEX_COMPUTE_RESELL_CONFIG',
}.get(_PROVIDER, 'COMPUTE_RESELL_CONFIG')
_STATE_SKILL = {
    'bankr': 'compute-resell',
    'aws': 'aws-compute-resell',
    'vertex': 'vertex-compute-resell',
}.get(_PROVIDER, 'compute-resell')

try:
    _cfg = json.loads((os.environ.get(_CFG_ENV) or '').strip() or '{}')
except Exception:
    _cfg = {}
# Fixed internal constants (no longer config knobs).
# Liquidity gate: a rival sets M only with real throughput (trades_24h >= this) or a proven record.
MIN_COMPETITOR_TRADES = 10
# Price probe: only used when a cap-bound offer has NO serviceable competitor to anchor M (sole
# healthy seller, no clearing floor to blackout against) - then climb toward `direct` by this factor.
PROBE_UP_STEP = 1.05
# Undercut margin: list this fraction below the serviceable clearing floor M (0.01 -> 0.99xM, the
# highest price that still wins routing). Pricing ABOVE M stops routing (the offer goes dark).
UNDERCUT_EPSILON = 0.01
UNDERCUT = 1 - UNDERCUT_EPSILON


def adapt_discount(prev_discount, *, saturating, revenue_today, winnable_books,
                   dmin=0.30, dmax=0.90, step=0.05, revenue_deadband=0.0,
                   live_offer_discounts=None):
    """Revenue-max adaptive discount controller (opt-in via config discount_adaptive).

    Bankr credit is FREE, so the only axis is revenue = volume x price. max_discount is
    the USDC-per-token knob, not a loss guard: a DEEPER cap wins more books (more volume)
    at fewer USDC per token; a SHALLOWER cap keeps more per token but wins fewer books.
    This walks the effective cap toward the revenue-max point of that curve, at most one
    `step` per run so it hunts a balance instead of oscillating:

      - saturating  (a live offer sold out its cap => demand exceeds supply AT THE CURRENT
                     PRICE, so price is not the binding constraint) -> TIGHTEN the cap
                     (shallower discount, more USDC/token) - you keep winning up to the
                     cap while earning more; raise the cap, not the discount, for volume.
      - under-selling (revenue ~ 0, or <= 1 winnable book) -> LOOSEN the cap (deeper
                     discount) to open more books and capture idle demand.
      - otherwise (selling, not saturating) -> HOLD (deadband) - a good balance.

    Direction note: "tons selling -> shallower / few selling -> deeper" is expressed on
    the DISCOUNT cap. Read on the price/margin the operator targets it is the mirror:
    few selling -> lower your asking (go deeper), tons selling -> raise it (go shallower).

    Flicker guard (`live_offer_discounts`): pass each currently-live offer's own discount
    (max of its in/out d). Tightening the cap below a live offer's discount prices it out
    on the next reprice, and since a discount-cap miss is an immediate reap, one tighten can
    delete the whole earning lineup in a single run (sold-out
    offers get reaped mid-earning). So a tighten never moves the cap below the DEEPEST live
    offer's discount - it stops exactly at that offer's level, or HOLDS if there is no room
    to tighten without orphaning an earner. Omit (None) when there are no live offers.

    Returns (new_discount, direction, reason). Result clamped to [dmin, dmax].
    """
    prev = max(dmin, min(dmax, float(prev_discount)))
    if saturating:
        new = max(dmin, round(prev - step, 4))
        if live_offer_discounts:
            # never tighten past the deepest live offer (it would be orphaned + reaped)
            new = max(new, round(max(live_offer_discounts), 4))
        if new < prev:
            return new, 'tighten', 'cap-saturated: excess demand at price -> capture more USDC/token'
        return prev, 'hold', 'cap-saturated but tightening would orphan an earning offer -> hold'
    if revenue_today <= revenue_deadband or winnable_books <= 1:
        new = min(dmax, round(prev + step, 4))
        return new, ('loosen' if new > prev else 'hold'), \
            'under-selling: open more books for volume'
    return prev, 'hold', 'selling, not saturated: hold (deadband)'


# The account's own live offer IDs - excluded from the competitor book so the engine
# never treats its own offers as rivals. Derived from state (the offers this skill
# created), so it stays correct per account with nothing hardcoded.
MY_OFFER_IDS = set()

COMPETITORS_STATE = {}
with open('memory/state/%s.json' % _STATE_SKILL) as f:
    state = json.load(f)
    COMPETITORS_STATE = state.get('competitors', {})
    MY_OFFER_IDS = set(state.get('offers', {}).keys())

def get_order_book(model):
    url = f'https://api.surplusintelligence.ai/api/markets/{model}'
    with urllib.request.urlopen(url, timeout=20) as resp:
        return json.loads(resp.read())

def is_flapper(offer_id):
    c = COMPETITORS_STATE.get(offer_id)
    if not c or c.get('obs', 0) < 6:
        return False
    return c.get('unhealthy', 0) >= c.get('obs', 1) / 2

def reduce_book(model, offers):
    survivors = []
    total = len(offers)
    healthy_avail = 0
    after_filters = 0
    for o in offers:
        oid = o.get('id') or o.get('offer_id')
        if oid in MY_OFFER_IDS:
            continue
        if not (o.get('healthy') and o.get('available')):
            continue
        # missing trusted flag => treat as UNTRUSTED (a missing flag is not a trust grant)
        if not o.get('trusted', False):
            continue
        eff_in = (o.get('effective_input_per_1m') or 0) / 1e6
        eff_out = (o.get('effective_output_per_1m') or 0) / 1e6
        if eff_in <= 0:
            continue
        cap_daily = o.get('cap_daily')
        cap_remaining = o.get('cap_remaining')
        if cap_daily and cap_remaining is not None and cap_daily > 0:
            if cap_remaining / cap_daily < 0.05:
                continue
        healthy_avail += 1
        if is_flapper(oid):
            continue
        # liquidity gate: a near-zero-volume newcomer can't absorb routing, so it must not set M.
        # It counts only with real throughput OR a proven track record. is_flapper above already
        # dropped unhealthy-majority offers, so "proven" here reduces to >=6 healthy observations.
        trades = o.get('trades_24h') or 0
        proven = (COMPETITORS_STATE.get(oid) or {}).get('obs', 0) >= 6
        if MIN_COMPETITOR_TRADES and trades < MIN_COMPETITOR_TRADES and not proven:
            continue
        survivors.append({'id': oid, 'eff_in': eff_in, 'eff_out': eff_out})
        after_filters += 1
    print(f'  {model}: {total} total -> {healthy_avail} healthy+avail -> {after_filters} after filters')
    return survivors

def price_model(model, current_price_in, current_price_out, direct_in, direct_out,
                max_discount=0.80, cap_daily=None, cap_remaining=None, is_fresh=False,
                last_move=None):
    data = get_order_book(model)
    offers = data.get('offers', [])
    survivors = reduce_book(model, offers)

    if survivors:
        M_in = min(s['eff_in'] for s in survivors)
        M_out = min(s['eff_out'] for s in survivors)
    else:
        M_in = None
        M_out = None

    # Cap-bound: a saturated live offer is supply-constrained (the cap binds before price does),
    # so a lower price wins NO extra volume. Price only sets the margin - and thus the credit burned
    # per USDC earned. Priced ABOVE the serviceable
    # clearing floor M the offer stops being routed and goes dark; at/just under M it sells out. So
    # pin a cap-bound offer at the TOP of the routing band - (1-ε)xM, the highest price that still
    # routes - never above M, never the old crawl toward `direct` that caused the 15-30h dark
    # windows. Only when no serviceable competitor exists (M is None - sole healthy seller, no wall
    # to hit) do we probe up toward the sticker as before. A fresh offer skips this (no serving
    # window yet).
    saturated = (
        not is_fresh
        and cap_daily and cap_remaining is not None and cap_daily > 0
        and (cap_remaining / cap_daily) < 0.10
    )
    if saturated and current_price_in > 0:
        if M_in is not None and M_out is not None:
            P_in = round(min(UNDERCUT * M_in, direct_in), 4)
            P_out = round(min(UNDERCUT * M_out, direct_out), 4)
            tag = f'pin {UNDERCUT:.2f}xM'
        else:
            P_in = round(min(current_price_in * PROBE_UP_STEP, direct_in), 4)
            P_out = round(min(current_price_out * PROBE_UP_STEP, direct_out), 4)
            tag = 'no-M probe-up'
        if max_discount:
            P_in = round(max(P_in, direct_in * (1 - max_discount)), 4)
            P_out = round(max(P_out, direct_out * (1 - max_discount)), 4)
        print(f'  {model}: cap-bound {(1-cap_remaining/cap_daily):.0%} used -> {tag} {current_price_in}->{P_in} / {current_price_out}->{P_out}')
        return P_in, P_out, survivors

    if M_in is None:
        print(f'  {model}: no competitors - fallback to current price')
        return current_price_in, current_price_out, survivors

    P_in = round(UNDERCUT * M_in, 6)
    P_out = round(UNDERCUT * M_out, 6)

    if max_discount:
        P_cap_in = direct_in * (1 - max_discount)
        P_cap_out = direct_out * (1 - max_discount)
        P_in = max(P_in, P_cap_in)
        P_out = max(P_out, P_cap_out)

    P_in = round(P_in, 4)
    P_out = round(P_out, 4)

    d_in = round(1 - P_in / direct_in, 4) if direct_in > 0 else 0
    d_out = round(1 - P_out / direct_out, 4) if direct_out > 0 else 0

    M_in_f = round(M_in, 6)
    M_out_f = round(M_out, 6)

    print(f'  {model}: M_in=${M_in_f} M_out=${M_out_f}; P={P_in}/{P_out}/1M; d_in={d_in:.1%} d_out={d_out:.1%}')

    return P_in, P_out, survivors

models = [
    ('gemini-3.1-flash-lite', 0.2019, 1.2112, 0.25, 1.5),
    ('gemini-2.5-flash', 0.2422, 2.0188, 0.3, 2.5),
]

results = {}
for (model, cur_in, cur_out, dir_in, dir_out) in models:
    print(f'--- {model} ---')
    new_in, new_out, survivors = price_model(model, cur_in, cur_out, dir_in, dir_out)
    results[model] = {
        'cur_in': cur_in, 'cur_out': cur_out,
        'new_in': new_in, 'new_out': new_out,
        'changed_in': abs(new_in - cur_in) >= 0.01,
        'changed_out': abs(new_out - cur_out) >= 0.01,
        'survivors': survivors,
    }

print()
print('=== DIFF SUMMARY ===')
for model, r in results.items():
    if r['changed_in'] or r['changed_out']:
        print(f'PATCH {model}: ${r["cur_in"]}/{r["cur_out"]} -> ${r["new_in"]}/{r["new_out"]}/1M')
    else:
        print(f'HOLD {model}: ${r["cur_in"]}/{r["cur_out"]}/1M (no change >= $0.01)')
