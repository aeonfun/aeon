import json, sys
d = json.load(open(sys.argv[1]))
print(f"Got {len(d)} papers")
for p in d:
    pp = p.get('paper', p)
    pid = pp.get('id', '?')
    title = pp.get('title', '?')[:90].replace('\n', ' ')
    pub = pp.get('publishedAt', '?')[:10] if pp.get('publishedAt') else '?'
    up = pp.get('upvotes', 0)
    print(f"{pid:>10} | up={up:>3} | {pub} | {title}")
