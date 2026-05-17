import json

with open('.cg-cache/markets.json') as f:
    data = json.load(f)

stable_ids = {'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','ethena-usde','binance-usd','frax','blackrock-usd-institutional-digital-liquidity-fund'}

def is_stable(c):
    cid = (c.get('id') or '').lower()
    sym = (c.get('symbol') or '').upper()
    name = (c.get('name') or '').lower()
    if cid in stable_ids:
        return True
    if sym.startswith('USD') or sym.startswith('EUR') or sym.startswith('GBP'):
        return True
    if 'stablecoin' in name:
        return True
    return False

filtered = []
for c in data:
    if is_stable(c):
        continue
    vol = c.get('total_volume') or 0
    if vol < 1_000_000:
        continue
    if c.get('price_change_percentage_24h_in_currency') is None:
        continue
    filtered.append(c)

print("total:", len(data), "filtered:", len(filtered))

def fmt(c):
    return {
        'sym': (c.get('symbol') or '').upper(),
        'name': c.get('name'),
        'rank': c.get('market_cap_rank'),
        'price': c.get('current_price'),
        'c24': c.get('price_change_percentage_24h_in_currency'),
        'c7d': c.get('price_change_percentage_7d_in_currency'),
        'c1h': c.get('price_change_percentage_1h_in_currency'),
        'vol': c.get('total_volume'),
        'mcap': c.get('market_cap'),
        'id': c.get('id'),
    }

bys = sorted(filtered, key=lambda c: c.get('price_change_percentage_24h_in_currency') or 0)
losers = [fmt(c) for c in bys[:10]]
winners = [fmt(c) for c in bys[::-1][:10]]

top100 = sorted(filtered, key=lambda c: c.get('market_cap_rank') or 9999)[:100]
green = sum(1 for c in top100 if (c.get('price_change_percentage_24h_in_currency') or 0) > 0)
top50 = top100[:50]
ch50 = sorted([c.get('price_change_percentage_24h_in_currency') or 0 for c in top50])
median50 = ch50[len(ch50)//2]
print("green/top100:", green, "median top50:", round(median50,2))

print("=== WINNERS ===")
for c in winners:
    print(c['sym'], '|', c['name'], '| rank',c['rank'], '| price',c['price'], '| 24h',round(c['c24'],1),'| 7d',round(c['c7d'] or 0,1),'| 1h',round(c['c1h'] or 0,1),'| vol',c['vol'],'| mcap',c['mcap'])
print("=== LOSERS ===")
for c in losers:
    print(c['sym'], '|', c['name'], '| rank',c['rank'], '| price',c['price'], '| 24h',round(c['c24'],1),'| 7d',round(c['c7d'] or 0,1),'| 1h',round(c['c1h'] or 0,1),'| vol',c['vol'],'| mcap',c['mcap'])

with open('.cg-cache/trending.json') as f:
    tr = json.load(f)
print("=== TRENDING ===")
for item in tr.get('coins', [])[:7]:
    it = item['item']
    d = it.get('data', {})
    pc = d.get('price_change_percentage_24h') or {}
    print(it.get('symbol'), '|', it.get('name'), '| rank',it.get('market_cap_rank'), '| price',d.get('price'), '| 24h', pc.get('usd'))
