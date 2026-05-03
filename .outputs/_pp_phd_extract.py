import json, glob, os
seen = set()
already = set([
    '2604.03888','2602.04837','2604.01658','2603.19461','2511.07678','2506.00723',
    '2510.25779','2604.24005','2509.22638','2511.03628','2601.13545','2604.22748',
    '2604.17295','2602.19520','2601.01706','2512.25070','2602.07048','2602.00133',
    '2604.27351','2604.22436','2603.08127','2509.26354','2502.11433','2602.16928',
    '2510.15612','2604.27083','2604.28181','2604.25135','2604.15674','2603.27771',
    '2509.09995','2510.11695','2512.16301','2508.03474','2511.20606','2512.02436',
])
out = []
for f in sorted(glob.glob('.outputs/pp-phd-*-0503.json')):
    topic = os.path.basename(f).replace('pp-phd-','').replace('-0503.json','')
    try:
        data = json.load(open(f))
    except Exception as e:
        print('parse fail', f, e); continue
    for entry in data:
        p = entry.get('paper', entry)
        pid = p.get('id','')
        if not pid: continue
        if pid in seen: continue
        seen.add(pid)
        title = p.get('title','')
        pub = p.get('publishedAt','')[:10]
        ups = p.get('upvotes',0)
        authors = ', '.join([a.get('name','') for a in p.get('authors',[])][:3])
        flag = ' [DUP]' if pid in already else ''
        out.append((topic, pid, pub, ups, title[:90], authors[:60], flag))
out.sort(key=lambda x: (x[2], -x[3]), reverse=True)
for r in out[:80]:
    print(' | '.join(str(x) for x in r))
