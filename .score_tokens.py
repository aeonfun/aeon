import json

m = json.load(open('/home/runner/work/aeon/aeon/.cg_markets.json'))
trending = json.load(open('/home/runner/.claude/projects/-home-runner-work-aeon-aeon/tool-results/bsz1hnriu.txt' if False else '/home/runner/work/aeon/aeon/.cg_trending.json'))

btc = next((c for c in m if c['symbol'] == 'btc'), None)
eth = next((c for c in m if c['symbol'] == 'eth'), None)
btc24 = btc['price_change_percentage_24h_in_currency']
btc7 = btc['price_change_percentage_7d_in_currency']
eth24 = eth['price_change_percentage_24h_in_currency']
eth7 = eth['price_change_percentage_7d_in_currency']
print(f"BTC: 24h={btc24:.2f}%  7d={btc7:.2f}%")
print(f"ETH: 24h={eth24:.2f}%  7d={eth7:.2f}%")

trend_syms = set()
for c in trending.get('coins', []):
    item = c.get('item', {})
    sym = item.get('symbol', '').lower()
    if sym:
        trend_syms.add(sym)
print(f"Trending: {trend_syms}")

dedup = {'doge', 'ray', 'pengu', 'xcn', 'ape'}

scored = []
for c in m:
    sym = c['symbol']
    mc = c.get('market_cap') or 0
    if mc < 20_000_000:
        continue
    if sym in dedup:
        continue
    p24 = c.get('price_change_percentage_24h_in_currency')
    p7 = c.get('price_change_percentage_7d_in_currency')
    vol = c.get('total_volume') or 0
    if p24 is None or p7 is None:
        continue
    vmc = vol / mc if mc > 0 else 0
    s = 0
    breakdown = []
    if p24 > 0:
        s += 1; breakdown.append('24h+1')
    if p7 > 0:
        s += 1; breakdown.append('7d+1')
    if p24 > 5 and p7 > 5:
        s += 2; breakdown.append('both>5%+2')
    if sym in trend_syms:
        s += 2; breakdown.append('cgtrend+2')
    if vmc >= 0.20:
        s += 3; breakdown.append('vol/mc>=0.20+3')
    elif vmc >= 0.10:
        s += 2; breakdown.append('vol/mc>=0.10+2')
    if p7 > btc7 and p7 > eth7:
        s += 2; breakdown.append('RSvsBTC/ETH+2')
    scored.append((s, sym.upper(), c['name'], c['current_price'], p24, p7, mc, vol, vmc, breakdown))

scored.sort(key=lambda x: (-x[0], -x[8]))
for row in scored[:25]:
    s, sym, name, price, p24, p7, mc, vol, vmc, br = row
    print(f"{s:2d}  {sym:8s} {name[:22]:22s} ${price:>11.6g}  24h={p24:+6.2f}%  7d={p7:+7.2f}%  mc=${mc/1e9:.2f}B  vol=${vol/1e6:.1f}M  v/mc={vmc:.2f}  [{','.join(br)}]")
