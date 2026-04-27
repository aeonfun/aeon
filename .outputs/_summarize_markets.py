import json
with open('.outputs/pm_markets.json') as f:
    data = json.load(f)
print(f'Total: {len(data)}')
for m in data[:15]:
    op = m.get('outcomePrices', '[]')
    try:
        prices = json.loads(op) if isinstance(op, str) else op
        yes_p = float(prices[0]) if prices else 0
    except Exception:
        yes_p = 0
    vol24 = float(m.get('volume24hr', 0))
    liq = float(m.get('liquidityNum', 0))
    print(f'{m["id"]}: ${vol24/1000:.0f}k v24 | YES={yes_p:.2%} | liq=${liq/1000:.0f}k')
    print(f'  Q: {m["question"][:120]}')
    print(f'  S: {m["slug"][:90]}')
