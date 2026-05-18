import json

m = json.load(open('.tmpdata/markets.json'))
t = json.load(open('.tmpdata/trending.json'))
d = json.load(open('.tmpdata/dex.json'))

trending_syms = set()
for c in t.get('coins', []):
    it = c.get('item', {})
    s = (it.get('symbol') or '').upper()
    if s:
        trending_syms.add(s)
print('TRENDING:', sorted(trending_syms))

dex_syms = set()
for p in d.get('pairs', []):
    bt = p.get('baseToken', {})
    s = (bt.get('symbol') or '').upper()
    if s:
        dex_syms.add(s)
print('DEX count:', len(dex_syms))

btc = next((x for x in m if x['symbol'].lower() == 'btc'), None)
eth = next((x for x in m if x['symbol'].lower() == 'eth'), None)
btc7 = btc.get('price_change_percentage_7d_in_currency') or 0
eth7 = eth.get('price_change_percentage_7d_in_currency') or 0
print('BTC 7d:', round(btc7, 2), 'ETH 7d:', round(eth7, 2))

results = []
for x in m:
    mc = x.get('market_cap') or 0
    if mc < 20_000_000:
        continue
    sym = x['symbol'].upper()
    p24 = x.get('price_change_percentage_24h_in_currency') or 0
    p7 = x.get('price_change_percentage_7d_in_currency') or 0
    vol = x.get('total_volume') or 0
    vmc = vol / mc if mc else 0
    score = 0
    sig = []
    if p24 > 0:
        score += 1
    if p7 > 0:
        score += 1
    if p24 > 5 and p7 > 5:
        score += 2
        sig.append('both24h7d>5%')
    if sym in trending_syms:
        score += 2
        sig.append('trending')
    if vmc >= 0.20:
        score += 3
        sig.append('vol/mcap>=0.20')
    elif vmc >= 0.10:
        score += 2
        sig.append('vol/mcap>=0.10')
    if p7 > btc7 and p7 > eth7:
        score += 2
        sig.append('RS>BTC&ETH7d')
    if sym in dex_syms:
        score += 1
        sig.append('dexconfirm')
    results.append((score, sym, x.get('name'), x.get('current_price'), p24, p7, mc, vol, vmc, sig))

results.sort(key=lambda r: -r[0])
print()
for r in results[:20]:
    score, sym, name, price, p24, p7, mc, vol, vmc, sig = r
    print(f"{score}  {sym:<8} {name[:20]:<20} ${price}  24h={p24:+.1f}%  7d={p7:+.1f}%  mc=${mc/1e6:.0f}m  vol=${vol/1e6:.0f}m  vmc={vmc:.2f}  {sig}")
