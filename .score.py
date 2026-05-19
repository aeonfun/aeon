import json

markets = json.load(open('.cg_markets.json'))
trending = json.load(open('.cg_trending.json'))

trend_syms = set()
for c in trending.get('coins', []):
    it = c.get('item', {})
    trend_syms.add(it.get('symbol', '').upper())
print("TRENDING:", sorted(trend_syms))

btc = next(c for c in markets if c['symbol'] == 'btc')
eth = next(c for c in markets if c['symbol'] == 'eth')
btc7 = btc.get('price_change_percentage_7d_in_currency') or 0
eth7 = eth.get('price_change_percentage_7d_in_currency') or 0
print(f"BTC 7d {btc7:.2f}  ETH 7d {eth7:.2f}")

dedup = {'INJ', 'TRAC', 'BSB', 'KAIA'}

results = []
for c in markets:
    sym = c['symbol'].upper()
    mc = c.get('market_cap') or 0
    if mc < 20_000_000:
        continue
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    vol = c.get('total_volume') or 0
    vmc = vol / mc if mc else 0
    score = 0
    sig = []
    if p24 > 0:
        score += 1
    if p7 > 0:
        score += 1
    if p24 > 5 and p7 > 5:
        score += 2
        sig.append('strong 24h+7d')
    if sym in trend_syms:
        score += 2
        sig.append('trending')
    if vmc >= 0.20:
        score += 3
        sig.append('very high turnover')
    elif vmc >= 0.10:
        score += 2
        sig.append('high turnover')
    if p7 > btc7 and p7 > eth7:
        score += 2
        sig.append('outpacing BTC+ETH 7d')
    results.append((score, sym, c['name'], c['current_price'], p24, p7, mc, vol, vmc, sig, sym in dedup))

results.sort(key=lambda x: -x[0])
print("\nTOP 25 (* = dedup-excluded):")
for r in results[:25]:
    flag = ' *DEDUP*' if r[10] else ''
    print(f"{r[0]:2d} {r[1]:8s} ${r[3]:<12.5g} 24h{r[4]:+6.1f}% 7d{r[5]:+7.1f}% mc${r[6]/1e6:8.0f}m vol${r[7]/1e6:7.0f}m vmc{r[8]:.3f} [{','.join(r[9])}]{flag}")
