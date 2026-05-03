import json, glob, os
rows = []
for f in glob.glob('/home/runner/work/aeon/aeon/.outputs/hn_top_*.json'):
    d = json.load(open(f))
    rows.append((d.get('score',0), d.get('id'), d.get('descendants',0), d.get('title',''), d.get('url','')))
rows.sort(reverse=True)
for s,i,c,t,u in rows[:12]:
    print(f"{i}\t{s}\t{c}\t{t}\t{u}")
