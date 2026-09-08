import urllib.request, json, math

# Auto-discover: score every non-denied model on Surplus (no hardcoded allowlist).
# `denied` is auto-learned by the live skill (a provider that can't serve a model
# returns an error on create and the id is remembered in state `denied`) and may be
# seeded from config `denied_models`. Nothing is hand-listed here; leave this empty
# and let discovery + the create probe find what the provider can actually serve.
denied_models = set([])

with urllib.request.urlopen('https://api.surplusintelligence.ai/api/markets', timeout=20) as resp:
    markets = json.loads(resp.read())['markets']

# Selection has ONE liquidity gate: 24h marketplace $-volume. (There is no separate
# request-count `demand_min` knob any more - demand already rides in the score via
# (1 + ln(requests_24h)), and a count gate let a market clear on a handful of tiny
# probe requests while trading ~$0. roster volume_24h is microdollars (/ 1e6 = USD).)
min_market_volume_usd = 1.0
# max_discount is the per-provider rate cap (catalog quality); the live skill reads it
# from config. This demo default only drives the winnable/CAP display below.
max_discount = 0.80

scored = []
for m in markets:
    model = m['model']
    if model in denied_models:
        continue
    req24 = m.get('requests_24h', 0) or 0
    vol_usd = (m.get('volume_24h', 0) or 0) / 1e6
    if vol_usd < min_market_volume_usd:
        continue
    best_in = (m.get('best_input_per_1m') or 0) / 1e6
    best_out = (m.get('best_output_per_1m') or 0) / 1e6
    direct_in = (m.get('direct_input_per_1m') or 0) / 1e6
    direct_out = (m.get('direct_output_per_1m') or 0) / 1e6
    if direct_in <= 0 or direct_out <= 0:
        continue
    # NOTE: this uses the roster's `best`, which counts offers that can't serve
    # (unhealthy/cap-exhausted/untrusted), so `disc` can read fake-deep - a rough
    # roster-level approximation only. The live skill scores on the reduced-book M
    # (per SKILL.md "Who actually competes"); reduce each model's book there.
    disc = 1 - (best_in + 3*best_out) / (direct_in + 3*direct_out)
    direct_blended = direct_in + 3*direct_out
    # price-level-weighted: (1-disc)*direct_blended == best_blended, so the score tracks
    # revenue-per-won-token x demand (via ln req24), not the discount rate alone.
    score = (1 - disc) * direct_blended * (1 + math.log(req24)) if req24 > 0 else 0.0
    d_M_in = 1 - best_in/direct_in if direct_in > 0 else 0
    d_M_out = 1 - best_out/direct_out if direct_out > 0 else 0
    winnable = (max_discount >= d_M_in) and (max_discount >= d_M_out)
    scored.append({
        'model': model,
        'req24': req24,
        'disc': round(disc, 4),
        'score': round(score, 3),
        'd_M_in': round(d_M_in, 4),
        'd_M_out': round(d_M_out, 4),
        'best_in': best_in,
        'best_out': best_out,
        'direct_in': direct_in,
        'direct_out': direct_out,
        'winnable': winnable,
    })

scored.sort(key=lambda x: -x['score'])
print('Score-ranked liquidity-gated models:')
for s in scored[:25]:
    tag = 'WIN' if s['winnable'] else f'CAP(in={s["d_M_in"]:.1%} out={s["d_M_out"]:.1%})'
    print(f'  {s["model"]:30s} score={s["score"]:6.3f} req={s["req24"]:6} d_M={s["d_M_in"]:.1%}/{s["d_M_out"]:.1%} [{tag}]')
print()
print('Winnable top models (in score order):')
win_count = 0
for s in scored:
    if s['winnable']:
        print(f'  {s["model"]:30s} score={s["score"]:6.3f} req={s["req24"]:6} best_in=${s["best_in"]} best_out=${s["best_out"]} direct_in=${s["direct_in"]} direct_out=${s["direct_out"]}')
        win_count += 1
        if win_count >= 5:
            break

print()
capped = [s for s in scored if not s['winnable']]
print(f'Discount-capped (d_M > {max_discount:.0%}):')
for s in capped[:20]:
    print(f'  {s["model"]:30s} d_M_in={s["d_M_in"]:.1%} d_M_out={s["d_M_out"]:.1%}')
