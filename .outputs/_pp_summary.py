import json
d = json.load(open('.outputs/pp-daily-2026-04-27.json'))
print('count:', len(d))
for p in d:
    pa = p.get('paper', {})
    authors = ', '.join(a.get('name','?') for a in pa.get('authors', [])[:3])
    print(pa.get('id','?'), '| up=', pa.get('upvotes','?'), '|', pa.get('publishedAt','?')[:10], '|', pa.get('title','?')[:100])
    print('   authors:', authors)
