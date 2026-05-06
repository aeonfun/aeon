import sys, json
d = json.load(sys.stdin)
print('top-level keys:', sorted(d.keys()))
print('num agents:', len(d.get('agents', [])))
cg = [a for a in d.get('agents', []) if 'calibration-gap' in a.get('agent_id','')]
print('cg agents:', len(cg))
print('cg max closed_trades:', max((a.get('closed_trades',0) for a in cg), default=0))
apex = [a for a in d.get('agents', []) if a.get('lifecycle')=='apex']
canary = [a for a in d.get('agents', []) if a.get('lifecycle')=='canary']
revenant = [a for a in d.get('agents', []) if 'revenant' in (a.get('lifecycle') or '').lower() or 'revenant' in a.get('agent_id','').lower()]
print('apex:', len(apex), 'canary:', len(canary), 'revenant:', len(revenant))
# closed_trades histogram
buckets = {'0':0, '1-9':0, '10-29':0, '30-99':0, '100+':0}
for a in d.get('agents', []):
    c = a.get('closed_trades', 0)
    if c == 0: buckets['0'] += 1
    elif c <= 9: buckets['1-9'] += 1
    elif c <= 29: buckets['10-29'] += 1
    elif c <= 99: buckets['30-99'] += 1
    else: buckets['100+'] += 1
print('closed_trades buckets:', buckets)
# Top agents by closed_trades
top = sorted(d.get('agents', []), key=lambda a: a.get('closed_trades',0), reverse=True)[:8]
for a in top:
    print(f"  {a.get('lifecycle','?'):10s} {a.get('closed_trades',0):4d} trades  pnl=${a.get('total_pnl_usd',0):.2f}  wr={a.get('win_rate',0):.2f}  sharpe={a.get('sharpe',0):.2f}  {a.get('agent_id','?')}")
