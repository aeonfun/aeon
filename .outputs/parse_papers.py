import json, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
for p in data:
    pp = p['paper']
    print('ID:', pp['id'])
    print('Title:', pp['title'])
    print('Date:', pp.get('publishedAt','')[:10], 'Upvotes:', pp.get('upvotes',0))
    print('Summary:', pp.get('summary','')[:500].replace('\n',' '))
    print('---')
