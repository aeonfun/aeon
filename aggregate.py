import json, sys
files = ['hf-pmcalib.json','hf-polymarket.json','hf-llmforecast.json','hf-marl.json','hf-selfevolve.json','hf-daily.json']
seen = {}
for f in files:
    try:
        data = json.load(open(f))
    except Exception as e:
        print(f"{f}: ERR {e}"); continue
    for p in data:
        paper = p.get('paper', p)
        pid = paper.get('id') or p.get('id')
        if not pid: continue
        if pid not in seen:
            seen[pid] = {
                'id': pid,
                'title': paper.get('title','')[:140],
                'summary': paper.get('summary','')[:1500],
                'upvotes': paper.get('upvotes',0),
                'pub': paper.get('publishedAt',''),
                'src': [f]
            }
        else:
            seen[pid]['src'].append(f)
print(f'Unique papers: {len(seen)}')
arr = sorted(seen.values(), key=lambda x: -x['upvotes'])
for p in arr:
    s = ','.join([x.replace('hf-','').replace('.json','') for x in p['src']])
    print(f"{p['id']:12s} u{p['upvotes']:3d} {p['pub'][:10]} [{s}]  {p['title'][:90]}")
