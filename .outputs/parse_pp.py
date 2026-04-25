import json, sys, os

files = {
    'PREDICTION_MARKET_MICROSTRUCTURE': '/home/runner/.claude/projects/-home-runner-work-aeon-aeon/ff4da9c5-287a-480c-971e-13a2c0531c13/tool-results/b7qb8b49n.txt',
    'BINARY_OPTION_ARBITRAGE': '/home/runner/.claude/projects/-home-runner-work-aeon-aeon/ff4da9c5-287a-480c-971e-13a2c0531c13/tool-results/b7vr2jpuo.txt',
    'CROSS_VENUE_LATENCY': '/home/runner/.claude/projects/-home-runner-work-aeon-aeon/ff4da9c5-287a-480c-971e-13a2c0531c13/tool-results/bqy5v3eoc.txt',
}

for label, path in files.items():
    if not os.path.exists(path):
        print(f"--- {label}: MISSING")
        continue
    print(f"=== {label} ===")
    with open(path) as f:
        d = json.load(f)
    for p in d:
        pp = p['paper']
        print(f"[{pp.get('upvotes',0):>3}up] {pp['id']} ({pp.get('publishedAt','?')[:10]}) {pp['title'][:150]}")
    print()
