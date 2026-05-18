import json

m = json.load(open('.cache/markets.json'))
tr = json.load(open('.cache/trending.json'))

STABLE = {'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd',
          'pyusd','fdusd','paxg','ethena-usde','usds','blackrock-usd',
          'binance-bridged-usdt-bnb-smart-chain','susds','usd1-wlfi',
          'bridged-usdc-polygon-pos-bridge','wrapped-eeth'}

def is_stable(c):
    cid = (c.get('id') or '').lower()
    sym = (c.get('symbol') or '').upper()
    name = (c.get('name') or '').lower()
    if cid in STABLE: return True
    if sym.startswith('USD') or sym.startswith('EUR') or sym.startswith('GBP'): return True
    if 'stablecoin' in name or 'stable coin' in name: return True
    return False

WRAPPED = {'wbtc','weth','steth','wsteth','weeth','wbeth','reth','cbbtc','lbtc',
           'binance-staked-sol','jito-staked-sol','coinbase-wrapped-btc','msol',
           'rocket-pool-eth','wrapped-bitcoin','wrapped-steth','solv-btc',
           'mantle-staked-ether','bedrock-unieth','clbtc','tbtc','renzo-restaked-eth',
           'wrapped-eeth','kelp-dao-restaked-eth','liquid-staked-ethereum'}

filt = []
for c in m:
    if is_stable(c): continue
    if c.get('id','').lower() in WRAPPED: continue
    vol = c.get('total_volume') or 0
    if vol < 1_000_000: continue
    if c.get('price_change_percentage_24h_in_currency') is None: continue
    filt.append(c)

print("filtered:", len(filt))

def g(c,k): return c.get(k) or 0

winners = sorted(filt, key=lambda c: g(c,'price_change_percentage_24h_in_currency'), reverse=True)[:10]
losers = sorted(filt, key=lambda c: g(c,'price_change_percentage_24h_in_currency'))[:10]

def fmt(c):
    return dict(
        sym=(c.get('symbol') or '').upper(),
        name=c.get('name'),
        rank=c.get('market_cap_rank'),
        price=c.get('current_price'),
        h24=g(c,'price_change_percentage_24h_in_currency'),
        d7=g(c,'price_change_percentage_7d_in_currency'),
        h1=g(c,'price_change_percentage_1h_in_currency'),
        vol=g(c,'total_volume'),
        mcap=g(c,'market_cap'),
    )

out = {'winners':[fmt(c) for c in winners], 'losers':[fmt(c) for c in losers]}

# trending
trc = []
for item in tr.get('coins',[])[:7]:
    it = item.get('item',{})
    d = it.get('data',{}) or {}
    trc.append(dict(
        sym=(it.get('symbol') or '').upper(),
        name=it.get('name'),
        rank=it.get('market_cap_rank'),
        price=d.get('price'),
        h24=(d.get('price_change_percentage_24h') or {}).get('usd'),
    ))
out['trending']=trc

# market pulse top100 after filters
top100 = sorted(filt, key=lambda c: c.get('market_cap_rank') or 99999)[:100]
green = sum(1 for c in top100 if g(c,'price_change_percentage_24h_in_currency')>0)
top50 = sorted(filt, key=lambda c: c.get('market_cap_rank') or 99999)[:50]
import statistics
med50 = statistics.median([g(c,'price_change_percentage_24h_in_currency') for c in top50])
out['pulse']=dict(green=green, total=len(top100), med50=round(med50,2))

json.dump(out, open('.cache/out.json','w'), indent=1)
print(json.dumps(out, indent=1))
