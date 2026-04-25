import json
trending = json.load(open('/tmp/trending.json'))
print('TRENDING_SYMBOLS:', [c['item']['symbol'] for c in trending.get('coins', [])])
markets = json.load(open('/tmp/markets.json'))
print('MARKETS_LEN:', len(markets))
