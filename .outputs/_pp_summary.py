import json
with open('/home/runner/work/aeon/aeon/.outputs/pp-daily-2026-05-03.json') as f:
    data = json.load(f)
print(f'Got {len(data)} papers')
for i, p in enumerate(data):
    paper = p.get('paper', p)
    title = paper.get('title','')
    print(f'{i+1}. id={paper.get("id")} up={paper.get("upvotes",0)} pub={paper.get("publishedAt","")[:10]}')
    print(f'   title={title[:140]}')
