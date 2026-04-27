import json

d = json.load(open('/home/runner/work/aeon/aeon/.outputs/_pm_trending.json'))
out = [f'count={len(d)}']
for i, m in enumerate(d):
    vol = float(m.get('volume24hr', 0) or 0) / 1e6
    op = m.get('outcomePrices') or '[]'
    try:
        op = json.loads(op) if isinstance(op, str) else op
    except Exception:
        op = []
    yes = float(op[0]) if op else 0.0
    out.append(f"{i}. ${vol:.1f}M  YES={yes*100:.0f}%  | {m.get('question','')[:90]}")
    out.append(f"   slug={m.get('slug','')}")

open('/home/runner/work/aeon/aeon/.outputs/_pm_summary.txt', 'w').write('\n'.join(out))
