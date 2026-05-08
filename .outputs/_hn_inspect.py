import json, os
os.chdir('/home/runner/work/aeon/aeon')
front = json.load(open('.outputs/hn-front-2026-05-08.json'))
hits = front['hits']
print('algolia hits:', len(hits))
for h in hits[:12]:
    print(h.get('points'), h.get('num_comments'), h.get('objectID'), '-', h.get('title',''))
print('---')
best = json.load(open('.outputs/hn-best-2026-05-08.json'))
print('best ids count:', len(best))
print('first 30:', best[:30])
