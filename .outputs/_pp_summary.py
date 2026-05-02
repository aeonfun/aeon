import json
files = ['pp-q-pmcalib-0502b','pp-q-marl-0502b','pp-q-darwin-0502b','pp-q-regime-0502b','pp-q-fincon-0502b','pp-q-polymarket-0502b']
seen=set()
out=[]
for f in files:
  try:
    d=json.load(open('.outputs/'+f+'.json'))
  except Exception as e:
    print('ERR',f,e); continue
  for entry in d:
    p=entry.get('paper',{})
    pid=p.get('id','')
    if pid in seen: continue
    seen.add(pid)
    out.append({
      'q':f,'id':pid,'title':p.get('title',''),
      'date':p.get('publishedAt','')[:10],
      'up':p.get('upvotes',0),
      'authors':[a.get('name','') for a in p.get('authors',[])][:6]
    })
out.sort(key=lambda x:-x['up'])
for r in out[:80]:
  print('%s u%-3d %-14s [%-12s] %s' % (r['date'], r['up'], r['id'], r['q'][5:-6], r['title'][:95]))
print('---TOTAL---', len(out))
