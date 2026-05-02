import json
data = json.load(open('.outputs/pp-daily-2026-05-02.json'))
print(f'Total: {len(data)}')
print()
for i, item in enumerate(data):
    p = item.get('paper', {})
    pid = p.get('id', '?')
    title = p.get('title', '?').replace('\n', ' ')
    upvotes = p.get('upvotes', 0)
    pub = p.get('publishedAt', '?')[:10]
    authors = p.get('authors', [])
    auth_names = ', '.join(a.get('name', '?') for a in authors[:4])
    if len(authors) > 4:
        auth_names += f' +{len(authors)-4}'
    print(f'{i+1:2d}. [{pid}] up{upvotes:3d} {pub} - {title}')
    print(f'    Authors: {auth_names}')
    print()
