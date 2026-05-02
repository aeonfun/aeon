const fs = require('fs');
const events = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/poly_events.json'));

const dedupQs = [
  /us.*iran.*permanent peace deal.*may 31/i,
  /megaeth.*fdv.*\$2b/i,
];
const isDedup = (q) => dedupQs.some(r => r.test(q));

// list out all events with vol24h >= $200k, with their first market
console.log('Events sorted by 24h vol (>= $200k), excluding sports/futures:\n');
const seen = new Set();
const eventList = [];
for (const e of events) {
  const v24 = e.volume24hr || 0;
  if (v24 < 200000) continue;
  const title = e.title || '';
  const tags = (e.tags || []).map(t => (t.label || t).toLowerCase()).join(',');
  if (seen.has(title)) continue;
  seen.add(title);
  eventList.push({title, slug: e.slug, v24, tags, end: (e.endDate||'').slice(0,10), nMarkets: (e.markets||[]).length, marketCount: (e.markets||[]).length});
}
eventList.sort((a,b) => b.v24 - a.v24);
for (const e of eventList.slice(0, 40)) {
  const isSports = /sports|nba|nfl|nhl|mlb|fifa|world cup|tennis|cricket|champions|premier league|la liga/i.test(e.tags + ' ' + e.title);
  const isFutures = /championship|finals.*\d{4}/i.test(e.title);
  const tag = isSports ? '[SPORTS]' : isFutures ? '[FUTURES]' : '';
  console.log(`[${(e.v24/1e6).toFixed(2)}M] ${tag.padEnd(10)} ${e.nMarkets}mkts | end ${e.end} | "${e.title.slice(0,90)}"`);
}
