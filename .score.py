import json
data=json.load(open('.cg_markets.json'))
btc=next(c for c in data if c['symbol']=='btc')
eth=next(c for c in data if c['symbol']=='eth')
btc7=btc['price_change_percentage_7d_in_currency']
eth7=eth['price_change_percentage_7d_in_currency']
print('BTC 24h/7d:',round(btc['price_change_percentage_24h'],2),round(btc7,2))
print('ETH 24h/7d:',round(eth['price_change_percentage_24h'],2),round(eth7,2))
print('---')
trend={'ZANO','HYPE'}
dedup={'KAIA','TRAC','BSB'}
rows=[]
for c in data:
    mc=c.get('market_cap') or 0
    if mc<20_000_000: continue
    p24=c.get('price_change_percentage_24h') or 0
    p7=c.get('price_change_percentage_7d_in_currency') or 0
    vol=c.get('total_volume') or 0
    vmc=vol/mc if mc else 0
    s=0
    if p24>0: s+=1
    if p7>0: s+=1
    if p24>5 and p7>5: s+=2
    if c['symbol'].upper() in trend: s+=2
    if vmc>=0.20: s+=3
    elif vmc>=0.10: s+=2
    if p7>btc7 and p7>eth7: s+=2
    sym=c['symbol'].upper()
    rows.append((s,sym,c['current_price'],round(p24,1),round(p7,1),mc,vol,round(vmc,3),sym in dedup))
rows.sort(reverse=True)
for r in rows[:20]:
    print(r)
