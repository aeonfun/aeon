import json, sys

with open('/home/runner/work/aeon/aeon/.tokenpick-tmp/markets.json') as f:
    markets = json.load(f)
with open('/home/runner/work/aeon/aeon/.tokenpick-tmp/trending.json') as f:
    trending = json.load(f)
with open('/home/runner/work/aeon/aeon/.tokenpick-tmp/dex.json') as f:
    dex = json.load(f)

trending_ids = {c['item']['id'] for c in trending.get('coins', [])}
trending_syms = {c['item']['symbol'].upper() for c in trending.get('coins', [])}

# DexScreener: pull symbols of pairs that look "trending" — pick base symbols
dex_syms = set()
for p in dex.get('pairs', [])[:60]:
    base = p.get('baseToken', {}).get('symbol', '').upper()
    if base:
        dex_syms.add(base)

# Find BTC and ETH 7d for relative-strength
btc_7d = None
eth_7d = None
for m in markets:
    if m['symbol'].lower() == 'btc':
        btc_7d = m.get('price_change_percentage_7d_in_currency')
    if m['symbol'].lower() == 'eth':
        eth_7d = m.get('price_change_percentage_7d_in_currency')

DEDUP_RECENT = {'PENGU', 'APE'}  # last 7d

scored = []
for m in markets:
    sym = m['symbol'].upper()
    if sym in DEDUP_RECENT:
        continue
    mcap = m.get('market_cap') or 0
    if mcap < 20_000_000:
        continue
    vol = m.get('total_volume') or 0
    p24 = m.get('price_change_percentage_24h_in_currency')
    p7 = m.get('price_change_percentage_7d_in_currency')
    if p24 is None or p7 is None:
        continue
    score = 0
    breakdown = []
    if p24 > 0:
        score += 1; breakdown.append('24h>0:+1')
    if p7 > 0:
        score += 1; breakdown.append('7d>0:+1')
    if p24 > 5 and p7 > 5:
        score += 2; breakdown.append('both>5%:+2')
    if m['id'] in trending_ids or sym in trending_syms:
        score += 2; breakdown.append('cg-trending:+2')
    vmc = vol / mcap if mcap > 0 else 0
    if vmc >= 0.20:
        score += 3; breakdown.append('vol/mcap>=0.20:+3')
    elif vmc >= 0.10:
        score += 2; breakdown.append('vol/mcap>=0.10:+2')
    if btc_7d is not None and eth_7d is not None and p7 > btc_7d and p7 > eth_7d:
        score += 2; breakdown.append('RS>BTC&ETH:+2')
    if sym in dex_syms:
        score += 1; breakdown.append('dex-confirm:+1')
    scored.append({
        'symbol': sym,
        'name': m['name'],
        'id': m['id'],
        'price': m['current_price'],
        'mcap': mcap,
        'vol': vol,
        'vmc': vmc,
        'p24': p24,
        'p7': p7,
        'score': score,
        'breakdown': breakdown
    })

scored.sort(key=lambda x: -x['score'])
print(f"BTC 7d: {btc_7d:.2f}% | ETH 7d: {eth_7d:.2f}%")
print(f"Trending CG IDs: {len(trending_ids)} | DexScreener bases: {len(dex_syms)}")
print()
print(f"{'rank':>4} {'sym':<8} {'score':>5} {'24h':>7} {'7d':>7} {'vmc':>5} {'mcap':>10} {'breakdown'}")
for i, t in enumerate(scored[:25]):
    print(f"{i+1:>4} {t['symbol']:<8} {t['score']:>5} {t['p24']:>+6.2f}% {t['p7']:>+6.2f}% {t['vmc']:>4.2f} ${t['mcap']/1e9:>8.2f}B {','.join(t['breakdown'])}")
