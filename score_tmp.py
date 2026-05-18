import json

m = json.load(open('/tmp/markets.json'))
trend = json.load(open('/tmp/trending.json'))
dex = json.load(open('/tmp/dex.json'))

trending_syms = set()
for c in trend.get('coins', []):
    i = c['item']
    trending_syms.add((i.get('symbol') or '').upper())

dex_syms = set()
for p in dex.get('pairs', []) or []:
    bt = p.get('baseToken', {})
    dex_syms.add((bt.get('symbol') or '').upper())

btc = next(x for x in m if x['symbol'] == 'btc')
eth = next(x for x in m if x['symbol'] == 'eth')
btc7 = btc['price_change_percentage_7d_in_currency']
eth7 = eth['price_change_percentage_7d_in_currency']
print('BTC 24h/7d:', round(btc['price_change_percentage_24h_in_currency'],2), round(btc7,2))
print('ETH 24h/7d:', round(eth['price_change_percentage_24h_in_currency'],2), round(eth7,2))
print('trending:', sorted(trending_syms))
print('---')

dedup = {'TRAC', 'KAIA'}
rows = []
for x in m:
    sym = (x['symbol'] or '').upper()
    mc = x.get('market_cap') or 0
    vol = x.get('total_volume') or 0
    p24 = x.get('price_change_percentage_24h_in_currency')
    p7 = x.get('price_change_percentage_7d_in_currency')
    if mc < 20_000_000:
        continue
    if p24 is None or p7 is None:
        continue
    s = 0
    if p24 > 0: s += 1
    if p7 > 0: s += 1
    if p24 > 5 and p7 > 5: s += 2
    if sym in trending_syms: s += 2
    vmc = vol / mc if mc else 0
    if vmc >= 0.20: s += 3
    elif vmc >= 0.10: s += 2
    if p7 > btc7 and p7 > eth7: s += 2
    if sym in dex_syms: s += 1
    rows.append((s, sym, x.get('name'), x.get('current_price'), p24, p7, mc, vol, vmc))

rows.sort(reverse=True)
for r in rows[:20]:
    s, sym, name, price, p24, p7, mc, vol, vmc = r
    flag = ' <DEDUP>' if sym in dedup else ''
    print(f"{s:2d} {sym:8s} {(name or '')[:20]:20s} ${price:<12.6g} 24h={p24:7.1f} 7d={p7:7.1f} mc=${mc/1e6:8.0f}m vol=${vol/1e6:8.0f}m vmc={vmc:.3f}{flag}")
