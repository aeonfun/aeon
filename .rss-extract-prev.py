import re
with open('/home/runner/work/aeon/aeon/articles/feed.xml') as f:
    text = f.read()
titles = re.findall(r'<title>([^<]+)</title>', text)
entry_titles = sorted(set(titles[1:]))
with open('/tmp/rss-feed-prev-titles.txt', 'w') as f:
    f.write('\n'.join(entry_titles) + '\n')
print(len(entry_titles))
