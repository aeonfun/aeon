import json
data = json.load(open('.tmp_token_pick/cg_markets.json'))
btc = next(d for d in data if d['symbol'] == 'btc')
eth = next(d for d in data if d['symbol'] == 'eth')
print('BTC:', btc['current_price'], '24h:', round(btc['price_change_percentage_24h_in_currency'],2), '7d:', round(btc['price_change_percentage_7d_in_currency'],2))
print('ETH:', eth['current_price'], '24h:', round(eth['price_change_percentage_24h_in_currency'],2), '7d:', round(eth['price_change_percentage_7d_in_currency'],2))
print()
print('TOP 24h gainers (mcap >= $20M):')
top24 = sorted([d for d in data if d.get('market_cap',0) >= 20e6 and d.get('price_change_percentage_24h_in_currency') is not None], key=lambda d: -d['price_change_percentage_24h_in_currency'])[:30]
for d in top24:
    p24 = d['price_change_percentage_24h_in_currency']
    p7 = d.get('price_change_percentage_7d_in_currency') or 0
    mc = d['market_cap']/1e6
    vol = d.get('total_volume',0)/1e6
    vmc = vol/mc if mc>0 else 0
    print(f"{d['symbol'].upper():>10s} 24h={p24:+6.1f}% 7d={p7:+6.1f}% mc=${mc:.0f}M vol=${vol:.0f}M v/mc={vmc:.2f} rank={d['market_cap_rank']}")

print()
print('TOP by 7d (mcap >= $20M, both 24h and 7d positive):')
top7 = sorted([d for d in data if d.get('market_cap',0) >= 20e6 and (d.get('price_change_percentage_7d_in_currency') or 0) > 0 and (d.get('price_change_percentage_24h_in_currency') or 0) > 0], key=lambda d: -d['price_change_percentage_7d_in_currency'])[:25]
for d in top7:
    p24 = d['price_change_percentage_24h_in_currency']
    p7 = d.get('price_change_percentage_7d_in_currency') or 0
    mc = d['market_cap']/1e6
    vol = d.get('total_volume',0)/1e6
    vmc = vol/mc if mc>0 else 0
    print(f"{d['symbol'].upper():>10s} 24h={p24:+6.1f}% 7d={p7:+6.1f}% mc=${mc:.0f}M vol=${vol:.0f}M v/mc={vmc:.2f} rank={d['market_cap_rank']}")

print()
print('HIGH volume/mcap ratio (>= 0.10, mcap >= $20M):')
highv = sorted([d for d in data if d.get('market_cap',0) >= 20e6 and d.get('total_volume',0)/d.get('market_cap',1) >= 0.10], key=lambda d: -d.get('total_volume',0)/d.get('market_cap',1))[:25]
for d in highv:
    p24 = d.get('price_change_percentage_24h_in_currency') or 0
    p7 = d.get('price_change_percentage_7d_in_currency') or 0
    mc = d['market_cap']/1e6
    vol = d.get('total_volume',0)/1e6
    vmc = vol/mc if mc>0 else 0
    print(f"{d['symbol'].upper():>10s} 24h={p24:+6.1f}% 7d={p7:+6.1f}% mc=${mc:.0f}M vol=${vol:.0f}M v/mc={vmc:.2f} rank={d['market_cap_rank']}")
