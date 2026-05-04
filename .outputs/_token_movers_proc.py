import json, statistics

with open('/tmp/cg_markets.json') as f:
    markets = json.load(f)
with open('/tmp/cg_trending.json') as f:
    trending = json.load(f)

print(f"Markets count: {len(markets)}")
print(f"Trending count: {len(trending.get('coins', []))}")

STABLE_IDS = {'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','staked-ether','wrapped-bitcoin','wrapped-steth','weth','susds','blackrock-usd-institutional-digital-liquidity-fund','ethena-usde','ethena-staked-usde','sky-dollar','dai-savings-rate-token','usds','sky-savings-rate','wrapped-eeth','wrapped-beacon-eth','renzo-restaked-eth','rocket-pool-eth','mantle-staked-ether','jito-staked-sol','liquid-staked-ethereum','cbeth','wbeth','solv-protocol-solvbtc','lombard-staked-btc','susde','usual-usd','origin-dollar','bridged-usd-coin-polygon-pos-bridge','sky-stablecoin','ondo-us-dollar-yield','frax','frax-share','liquid-collective-eth'}
WRAPPED_SYMS = {'WBTC','WETH','STETH','WBETH','CBETH','RETH','METH','LSETH','EZETH','WEETH','SOLVBTC','LBTC','JITOSOL','MSOL','BSOL','SUSDE','OUSD','TBTC','RENZO','SUSDS','USDS','SKY','PAXG','XAUT','XAUM','BUIDL','BENJI','OUSG','USDM'}

def is_stable_or_wrap(c):
    cid = c.get('id','').lower()
    sym = c.get('symbol','').upper()
    name = (c.get('name') or '').lower()
    if cid in STABLE_IDS: return True
    if 'stablecoin' in name: return True
    if 'wrapped' in name: return True
    if 'staked ' in name: return True
    if name.startswith('wrapped'): return True
    if sym.startswith('USD') or sym.startswith('EUR') or sym.startswith('GBP'): return True
    if sym in WRAPPED_SYMS: return True
    return False

filtered = []
for c in markets:
    if c.get('total_volume') is None or c.get('total_volume', 0) < 1_000_000:
        continue
    if c.get('price_change_percentage_24h_in_currency') is None:
        continue
    if is_stable_or_wrap(c):
        continue
    filtered.append(c)

print(f"After filter: {len(filtered)}")

by_24h = sorted(filtered, key=lambda x: x.get('price_change_percentage_24h_in_currency', 0), reverse=True)
winners = by_24h[:10]
losers = by_24h[-10:][::-1]

trending_coins = trending.get('coins', [])[:7]
trending_ids = {tc['item']['id'] for tc in trending.get('coins', [])}
trending_syms = {tc['item']['symbol'].upper() for tc in trending.get('coins', [])}

top100 = filtered[:100]
green = sum(1 for c in top100 if c.get('price_change_percentage_24h_in_currency', 0) > 0)
top50 = filtered[:50]
median_50 = statistics.median([c.get('price_change_percentage_24h_in_currency', 0) for c in top50])

print(f"\nPulse: {green}/100 green; median top50 24h: {median_50:.2f}%")

for c in markets[:30]:
    if c['symbol'].lower() in ('btc','eth','sol','xrp','bnb','ada','doge','hype','tao'):
        print(f"{c['symbol'].upper()}: ${c['current_price']:,.4g}  24h {c.get('price_change_percentage_24h_in_currency',0):.2f}%  7d {c.get('price_change_percentage_7d_in_currency',0) or 0:.2f}%  1h {c.get('price_change_percentage_1h_in_currency',0) or 0:.2f}%  mc${c['market_cap']/1e9:.1f}B")

print("\nWINNERS (top 10 by 24h):")
for c in winners:
    pct24 = c.get('price_change_percentage_24h_in_currency', 0)
    pct7d = c.get('price_change_percentage_7d_in_currency', 0) or 0
    pct1h = c.get('price_change_percentage_1h_in_currency', 0) or 0
    vol = c.get('total_volume', 0)
    mc = c.get('market_cap', 0)
    rank = c.get('market_cap_rank', '?')
    in_trend = c['id'] in trending_ids
    print(f"  {c['symbol'].upper():10s} ({c['name'][:25]}) #{rank}  ${c['current_price']:.4g}  24h {pct24:+.1f}% / 7d {pct7d:+.1f}% / 1h {pct1h:+.1f}%  vol ${vol/1e6:.1f}M  mc ${mc/1e6:.1f}M  trend={in_trend}")

print("\nLOSERS (bottom 10 by 24h):")
for c in losers:
    pct24 = c.get('price_change_percentage_24h_in_currency', 0)
    pct7d = c.get('price_change_percentage_7d_in_currency', 0) or 0
    pct1h = c.get('price_change_percentage_1h_in_currency', 0) or 0
    vol = c.get('total_volume', 0)
    mc = c.get('market_cap', 0)
    rank = c.get('market_cap_rank', '?')
    in_trend = c['id'] in trending_ids
    print(f"  {c['symbol'].upper():10s} ({c['name'][:25]}) #{rank}  ${c['current_price']:.4g}  24h {pct24:+.1f}% / 7d {pct7d:+.1f}% / 1h {pct1h:+.1f}%  vol ${vol/1e6:.1f}M  mc ${mc/1e6:.1f}M  trend={in_trend}")

print("\nTRENDING (top 7):")
mkt_by_id = {c['id']: c for c in markets}
for tc in trending_coins:
    item = tc['item']
    sym = item['symbol'].upper()
    name = item['name']
    rank = item.get('market_cap_rank') or '?'
    cid = item['id']
    mdata = mkt_by_id.get(cid)
    if mdata:
        price = mdata['current_price']
        pct24 = mdata.get('price_change_percentage_24h_in_currency', 0) or 0
        vol = mdata.get('total_volume', 0)
        mc = mdata.get('market_cap', 0)
        print(f"  {sym:10s} ({name[:25]}) #{rank}  ${price:.4g}  24h {pct24:+.1f}%  vol ${vol/1e6:.1f}M  mc ${mc/1e6:.1f}M")
    else:
        data = item.get('data') or {}
        price_usd = data.get('price', 0) or 0
        pct_obj = data.get('price_change_percentage_24h') or {}
        pct = pct_obj.get('usd', 0) if isinstance(pct_obj, dict) else 0
        mc_str = data.get('market_cap', '?')
        vol_str = data.get('total_volume', '?')
        print(f"  {sym:10s} ({name[:25]}) #{rank}  ${price_usd:.4g}  24h {pct:+.1f}%  vol {vol_str}  mc {mc_str}  [outside top-250]")
