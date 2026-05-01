import re
import sys
import os

mode = sys.argv[1] if len(sys.argv) > 1 else 'prev'
out = sys.argv[2] if len(sys.argv) > 2 else f'rss-feed-{mode}-titles.txt'

with open('articles/feed.xml') as f:
    content = f.read()

titles = re.findall(r'<title>([^<]+)</title>', content)
entry_titles = titles[1:]
unique = sorted(set(entry_titles))

with open(out, 'w') as f:
    for t in unique:
        f.write(t + '\n')

print(f'mode={mode} wrote={len(unique)} file={out}')
