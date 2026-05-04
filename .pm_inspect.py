import json, sys
path = sys.argv[1] if len(sys.argv) > 1 else '.pm_markets.json'
m = json.load(open(path))
print('count:', len(m))
for x in m[:30]:
    op = x.get('outcomePrices','[]')
    try:
        p = json.loads(op)
        yes = float(p[0]) if p else 0
    except Exception:
        yes = 0
    v24 = x.get('volume24hr', 0)
    print(f"{x.get('id','?'):>7} | YES {yes*100:5.1f}% | 24h ${v24/1e6:6.2f}m | slug={x.get('slug','?')[:55]:<55} | {x.get('question','')[:80]}")
