import json
d = json.load(open('/home/runner/work/aeon/aeon/secdigest-tmp/kev.json'))
s = '2026-04-25'
recent = [v for v in d['vulnerabilities'] if v.get('dateAdded', '') >= s]
json.dump(recent, open('/home/runner/work/aeon/aeon/secdigest-tmp/kev_recent.json', 'w'))
print('Recent KEV:', len(recent))
for v in recent:
    print(v.get('dateAdded'), v.get('cveID'), '-', v.get('vendorProject'), v.get('product'), '-', v.get('vulnerabilityName')[:80])
