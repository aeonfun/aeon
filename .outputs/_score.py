import json, sys

DEDUP = {
    "KAIA","TRAC","BSB","INJ","NEAR","HYPE","CHZ","LIT","VVV","DASH",
    "ZEC","PENGU","GRASS","ONDO","WLD","BEAT","GENIUS","SKYAI","TAG",
    "EIGEN","RAIL"
}

m = json.load(open('.outputs/_markets.json'))
t = json.load(open('.outputs/_trending.json'))
d = json.load(open('.outputs/_dex.json'))

btc = next(c for c in m if c['symbol']=='btc')
eth = next(c for c in m if c['symbol']=='eth')
btc_7d = btc.get('price_change_percentage_7d_in_currency') or 0
eth_7d = eth.get('price_change_percentage_7d_in_currency') or 0
btc_24h = btc.get('price_change_percentage_24h_in_currency') or 0
eth_24h = eth.get('price_change_percentage_24h_in_currency') or 0

print(f"BENCHMARK: BTC ${btc['current_price']} 24h={btc_24h:+.2f}% 7d={btc_7d:+.2f}%")
print(f"BENCHMARK: ETH ${eth['current_price']} 24h={eth_24h:+.2f}% 7d={eth_7d:+.2f}%")
print()

trending_syms = set()
trending_list = []
for c in t.get('coins', []):
    item = c.get('item', {})
    sym = (item.get('symbol') or '').upper()
    trending_syms.add(sym)
    trending_list.append((sym, item.get('name'), item.get('market_cap_rank')))

print("TRENDING (CG):")
for s,n,r in trending_list[:15]:
    print(f"  {s} - {n} (mcap_rank {r})")
print()

# DexScreener trending symbols
dex_syms = set()
for p in d.get('pairs', []):
    bt = p.get('baseToken', {})
    s = (bt.get('symbol') or '').upper()
    if s: dex_syms.add(s)
print(f"DEX trending symbols count: {len(dex_syms)}")
print()

scored = []
for c in m:
    sym = (c.get('symbol') or '').upper()
    if sym in DEDUP: continue
    mcap = c.get('market_cap') or 0
    if mcap < 20_000_000: continue
    vol = c.get('total_volume') or 0
    price = c.get('current_price') or 0
    p24 = c.get('price_change_percentage_24h_in_currency') or 0
    p7 = c.get('price_change_percentage_7d_in_currency') or 0
    vmc = vol / mcap if mcap else 0

    score = 0
    if p24 > 0: score += 1
    if p7 > 0: score += 1
    if p24 > 5 and p7 > 5: score += 2
    if sym in trending_syms: score += 2
    if vmc >= 0.20: score += 3
    elif vmc >= 0.10: score += 2
    if p7 > btc_7d and p7 > eth_7d: score += 2
    if sym in dex_syms: score += 1

    scored.append((score, sym, c.get('name'), price, p24, p7, mcap, vol, vmc,
                   sym in trending_syms, sym in dex_syms))

scored.sort(reverse=True)
print("TOP 20 CANDIDATES:")
print(f"{'sym':<10} {'score':<5} {'24h%':<8} {'7d%':<8} {'vmc':<6} {'mcap':<14} {'trend':<5} {'dex':<5} name")
for s,sym,name,price,p24,p7,mcap,vol,vmc,tr,dx in scored[:20]:
    print(f"{sym:<10} {s:<5} {p24:+7.2f} {p7:+7.2f} {vmc:5.2f} ${mcap/1e9:>9.2f}b   {'Y' if tr else '-':<5} {'Y' if dx else '-':<5} {name}")
