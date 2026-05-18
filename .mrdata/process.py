import json, glob, math, time

files = glob.glob('/home/runner/work/aeon/aeon/.mrdata/*.json')
pools = {}  # base_token_id -> pool dict

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

for fn in files:
    try:
        data = json.load(open(fn))
    except Exception:
        continue
    if not isinstance(data, dict) or 'data' not in data:
        continue
    for p in data['data']:
        a = p.get('attributes', {})
        rel = p.get('relationships', {})
        bt = rel.get('base_token', {}).get('data') or {}
        net = rel.get('network', {}).get('data') or {}
        btid = bt.get('id')
        if not btid:
            continue
        vol24 = num((a.get('volume_usd') or {}).get('h24')) or 0
        rec = {
            'name': a.get('name', '?'),
            'net': net.get('id', '?'),
            'btid': btid,
            'pc': a.get('price_change_percentage') or {},
            'vol': a.get('volume_usd') or {},
            'vol24': vol24,
            'mcap': num(a.get('market_cap_usd')),
            'fdv': num(a.get('fdv_usd')),
            'tx': (a.get('transactions') or {}).get('h24') or {},
            'created': a.get('pool_created_at'),
            'liq': num(a.get('reserve_in_usd')) or 0,
        }
        prev = pools.get(btid)
        if prev is None or vol24 > prev['vol24']:
            pools[btid] = rec

pre = len(pools)

now = time.time()
def created_age_h(s):
    if not s:
        return None
    try:
        t = time.strptime(s.replace('Z','UTC'), '%Y-%m-%dT%H:%M:%S%Z')
        return (now - time.mktime(t) + time.timezone) / 3600.0
    except Exception:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(s.replace('Z','+00:00'))
            return (time.time() - dt.timestamp())/3600.0
        except Exception:
            return None

rej = {'thin-vol':0,'down':0,'thin-liq':0,'dumping':0,'honeypot':0,'too-new':0,'rug-like':0}
survivors = []
for r in pools.values():
    pc24 = num(r['pc'].get('h24'))
    buys = num(r['tx'].get('buys')) or 0
    sells = num(r['tx'].get('sells')) or 0
    age = created_age_h(r['created'])
    r['age'] = age
    if r['vol24'] < 50000:
        rej['thin-vol'] += 1; continue
    if pc24 is None or pc24 <= 0:
        rej['down'] += 1; continue
    if r['liq'] < 10000:
        rej['thin-liq'] += 1; continue
    if buys > 0 and sells/buys > 10:
        rej['dumping'] += 1; continue
    if sells > 0 and buys/sells > 50:
        rej['honeypot'] += 1; continue
    if sells == 0 and buys > 0:
        rej['honeypot'] += 1; continue
    if age is not None and age < 1 and r['vol24'] < 100000:
        rej['too-new'] += 1; continue
    if pc24 > 10000:
        rej['rug-like'] += 1; continue
    survivors.append(r)

def clamp(x,lo,hi):
    return max(lo,min(hi,x))

for r in survivors:
    pc24 = num(r['pc'].get('h24')) or 0
    pc1 = num(r['pc'].get('h1')) or 0
    buys = num(r['tx'].get('buys')) or 0
    sells = num(r['tx'].get('sells')) or 0
    pct_pts = clamp(pc24/500,0,1)
    vol_pts = clamp(math.log10(r['vol24']+1)/7,0,1)
    liq_pts = clamp(math.log10(r['liq']+1)/6,0,1)
    mom_pts = clamp((pc1+50)/100,0,1)
    skew_pts = clamp(buys/(buys+sells),0,1) if (buys+sells)>0 else 0.5
    r['score'] = 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts
    r['skew'] = skew_pts
    # tag
    if r['liq'] >= 1_000_000 and r['vol24'] >= 1_000_000:
        r['tag'] = 'DEEP-LIQ'
    elif r['age'] is not None and r['age'] <= 48 and r['vol24'] >= 250_000:
        r['tag'] = 'BREAKOUT'
    elif pc1 > 2 and pc24 > 50:
        r['tag'] = 'CONTINUATION'
    elif pc1 < -5 and pc24 > 0:
        r['tag'] = 'REVERSAL'
    else:
        r['tag'] = 'MICRO-SPEC'

survivors.sort(key=lambda r: r['score'], reverse=True)
top5 = survivors[:5]

print('PRE', pre, 'POST', len(survivors))
print('REJ', rej)
for r in survivors[:15]:
    pc1 = num(r['pc'].get('h1')) or 0
    pc6 = num(r['pc'].get('h6')) or 0
    pc24 = num(r['pc'].get('h24')) or 0
    print(f"{r['score']:.1f} [{r['tag']}] {r['name']} ({r['net']}) h24={pc24:.0f}% h6={pc6:.0f}% h1={pc1:.1f}% vol={r['vol24']:.0f} liq={r['liq']:.0f} skew={r['skew']:.2f} age={r['age']} mcap={r['mcap']}")
