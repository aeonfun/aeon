import json
with open('.hf_daily.json') as f:
    data = json.load(f)
for i, e in enumerate(data):
    p = e.get('paper', e)
    title = p.get('title', '')
    upvotes = p.get('upvotes', 0)
    pid = p.get('id', '')
    authors = ', '.join([a.get('name', '') for a in p.get('authors', [])[:3]])
    if len(p.get('authors', [])) > 3:
        authors += ' et al.'
    print(f'{i+1}. [{pid}] up={upvotes} - {title}')
    print(f'   Authors: {authors}')
    print()
