import json, os, sys

files = ['hf_pred_market.json', 'hf_polymarket.json', 'hf_llm_forecast.json',
         'hf_mas.json', 'hf_calib.json', 'hf_selfevolve.json', 'hf_daily.json']

base = '/home/runner/work/aeon/aeon/.paper-digest-cache/'
seen = {}
for f in files:
    p = base + f
    try:
        with open(p) as fh:
            data = json.load(fh)
    except Exception as e:
        print('ERR', f, e, file=sys.stderr)
        continue
    for entry in data:
        paper = entry.get('paper', entry)
        pid = paper.get('id', '?')
        if pid in seen:
            seen[pid]['sources'].append(f)
            continue
        seen[pid] = {
            'id': pid,
            'title': paper.get('title', '').strip(),
            'summary': paper.get('summary', '').strip(),
            'authors': [a['name'] for a in paper.get('authors', [])][:6],
            'pub': (paper.get('publishedAt') or '')[:10],
            'upvotes': paper.get('upvotes', 0),
            'sources': [f],
        }

print('TOTAL UNIQUE:', len(seen))
print()
sl = sorted(seen.values(), key=lambda x: (x['pub'], x['upvotes']), reverse=True)
for s in sl:
    print(f"{s['pub']} | up{s['upvotes']:>3} | {s['id']:14s} | {s['title'][:90]}")
