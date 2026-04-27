import json

with open('trending.json') as f:
    trending = json.load(f)
with open('markets.json') as f:
    markets = json.load(f)
with open('dex.json') as f:
    dex = json.load(f)

trending_syms = set()
trending_names = []
for c in trending.get('coins', []):
    item = c.get('item', {})
    sym = (item.get('symbol') or '').lower()
    if sym:
        trending_syms.add(sym)
        trending_names.append(f"{sym} ({item.get('name')})")
print('TRENDING:', trending_names)

# DEX trending tickers
dex_syms = set()
for p in dex.get('pairs', []) or []:
    bt = p.get('baseToken') or {}
    s = (bt.get('symbol') or '').lower()
    if s:
        dex_syms.add(s)
print(f'DEX symbols sample: {list(dex_syms)[:30]}')

btc = next((c for c in markets if c.get('symbol') == 'btc'), None)
eth = next((c for c in markets if c.get('symbol') == 'eth'), None)
btc_24 = btc.get('price_change_percentage_24h_in_currency') or 0
btc_7 = btc.get('price_change_percentage_7d_in_currency') or 0
eth_24 = eth.get('price_change_percentage_24h_in_currency') or 0
eth_7 = eth.get('price_change_percentage_7d_in_currency') or 0
print(f'BTC: 24h={btc_24:.2f}% 7d={btc_7:.2f}%')
print(f'ETH: 24h={eth_24:.2f}% 7d={eth_7:.2f}%')

# Score
scored = []
for c in markets:
    sym = (c.get('symbol') or '').lower()
    name = c.get('name')
    mcap = c.get('market_cap') or 0
    vol = c.get('total_volume') or 0
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    price = c.get('current_price') or 0
    if mcap < 20_000_000:
        continue
    if sym == 'ape':  # dedup gate
        continue
    score = 0
    breakdown = []
    if p24 > 0:
        score += 1
        breakdown.append('24h+1')
    if p7 > 0:
        score += 1
        breakdown.append('7d+1')
    if p24 > 5 and p7 > 5:
        score += 2
        breakdown.append('both>5%+2')
    if sym in trending_syms:
        score += 2
        breakdown.append('trending+2')
    vmratio = vol / mcap if mcap else 0
    if vmratio >= 0.20:
        score += 3
        breakdown.append(f'vmratio({vmratio:.2f})+3')
    elif vmratio >= 0.10:
        score += 2
        breakdown.append(f'vmratio({vmratio:.2f})+2')
    if p7 > btc_7 and p7 > eth_7:
        score += 2
        breakdown.append('RS_vs_BTC/ETH+2')
    if sym in dex_syms:
        score += 1
        breakdown.append('dex_confirmed+1')
    scored.append((score, sym, name, price, p24, p7, mcap, vol, vmratio, breakdown))

scored.sort(reverse=True, key=lambda x: (x[0], x[8]))
print('\nTOP 15 BY SCORE:')
for s in scored[:15]:
    score, sym, name, price, p24, p7, mcap, vol, vmratio, bd = s
    print(f"  {sym.upper():10} {name[:25]:25} score={score} px=${price:.4g} 24h={p24:+.1f}% 7d={p7:+.1f}% mcap=${mcap/1e6:.0f}M vol=${vol/1e6:.0f}M vm={vmratio:.2f} | {','.join(bd)}")
