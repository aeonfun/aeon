import json, sys
d = json.load(open(sys.argv[1]))
for p in d:
    pp = p['paper']
    print(pp['id'], '|', pp['title'][:90], '|', 'pub=' + (pp.get('publishedAt','?')[:10]), '|', 'up=' + str(pp.get('upvotes',0)))
