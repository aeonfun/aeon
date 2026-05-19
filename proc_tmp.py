import json, statistics
m=json.load(open('markets.json'))
stable_ids={'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','ethena-usde','binance-usd','frax','true-usd','staked-ether','wrapped-steth','coinbase-wrapped-btc','wrapped-bitcoin','wrapped-eeth','susds','blackrock-usd-institutional-digital-liquidity-fund'}
def is_stable(c):
    s=(c.get('symbol') or '').upper(); n=(c.get('name') or '').lower(); i=c.get('id','')
    if i in stable_ids: return True
    if s.startswith('USD') or s.startswith('EUR') or s.startswith('GBP'): return True
    if 'stablecoin' in n: return True
    p=c.get('current_price') or 0
    h=c.get('price_change_percentage_24h_in_currency')
    if 0.97<p<1.03 and h is not None and abs(h)<0.5: return True
    return False
filt=[]
for c in m:
    if is_stable(c): continue
    if (c.get('total_volume') or 0) < 1_000_000: continue
    if c.get('price_change_percentage_24h_in_currency') is None: continue
    filt.append(c)
print("filtered count:", len(filt))
top100=filt[:100]
green=sum(1 for c in top100 if (c.get('price_change_percentage_24h_in_currency') or 0)>0)
top50=[c.get('price_change_percentage_24h_in_currency') or 0 for c in filt[:50]]
print("green/top100:", green, "of", len(top100), "median top50:", round(statistics.median(top50),2))
btc=next((c for c in m if c['id']=='bitcoin'),None)
eth=next((c for c in m if c['id']=='ethereum'),None)
print("BTC 24h:", round(btc['price_change_percentage_24h_in_currency'],2), "7d", round(btc['price_change_percentage_7d_in_currency'],2))
print("ETH 24h:", round(eth['price_change_percentage_24h_in_currency'],2), "7d", round(eth['price_change_percentage_7d_in_currency'],2))
def fmt(v):
    if v is None: return "?"
    if v>=1e9: return "$%.1fB"%(v/1e9)
    if v>=1e6: return "$%.0fM"%(v/1e6)
    return "$%.0fK"%(v/1e3)
def row(c):
    return dict(sym=(c['symbol'] or '').upper(),name=c['name'],rank=c.get('market_cap_rank'),
        price=c.get('current_price'),h24=c.get('price_change_percentage_24h_in_currency') or 0,
        d7=c.get('price_change_percentage_7d_in_currency') or 0,h1=c.get('price_change_percentage_1h_in_currency') or 0,
        vol=c.get('total_volume') or 0,mcap=c.get('market_cap') or 0)
win=sorted(filt,key=lambda c:c.get('price_change_percentage_24h_in_currency') or 0,reverse=True)[:10]
los=sorted(filt,key=lambda c:c.get('price_change_percentage_24h_in_currency') or 0)[:10]
def show(label,lst):
    print("\n=== "+label+" ===")
    for c in lst:
        r=row(c)
        print("%-9s %-24s #%-5s p=%-13s 24h%+.1f 7d%+.1f 1h%+.1f vol=%s mcap=%s vmr=%.2f"%(
            r['sym'],r['name'][:24],r['rank'],r['price'],r['h24'],r['d7'],r['h1'],
            fmt(r['vol']),fmt(r['mcap']),(r['vol']/r['mcap'] if r['mcap'] else 0)))
show("WINNERS",win)
show("LOSERS",los)
t=json.load(open('trending.json'))
print("\n=== TRENDING ===")
for x in t['coins'][:7]:
    it=x['item']; d=it.get('data',{})
    pc=(d.get('price_change_percentage_24h',{}) or {}).get('usd',0)
    print("%-10s %-24s rank#%s price=%s 24h%+.1f"%((it['symbol'] or '').upper(),it['name'][:24],it.get('market_cap_rank'),d.get('price'),round(pc,1)))
