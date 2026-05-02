const fs = require('fs');
const events = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/poly_events.json'));

const dedupQs = [
  /us.*iran.*permanent peace deal.*may 31/i,
  /megaeth.*fdv.*\$2b/i,
];
const isDedup = (q) => dedupQs.some(r => r.test(q));

const seen = new Set();
const eventList = [];
for (const e of events) {
  const v24 = e.volume24hr || 0;
  if (v24 < 50000) continue;
  const title = e.title || '';
  const tags = (e.tags || []).map(t => (t.label || t).toLowerCase()).join(',');
  if (seen.has(title)) continue;
  seen.add(title);
  eventList.push({title, slug: e.slug, v24, tags, end: (e.endDate||'').slice(0,10), nMarkets: (e.markets||[]).length});
}
eventList.sort((a,b) => b.v24 - a.v24);
console.log(`Events with v24 >= $50k: ${eventList.length}\n`);
for (const e of eventList.slice(0, 50)) {
  const isSports = /sports|nba|nfl|nhl|mlb|fifa|world cup|tennis|cricket|champions|premier league|la liga|football|hockey|basketball/i.test(e.tags + ' ' + e.title);
  const tag = isSports ? '[SPORTS] ' : '         ';
  console.log(`[${(e.v24/1e3).toFixed(0).padStart(4)}k] ${tag} ${e.nMarkets}mkts | end ${e.end} | "${e.title.slice(0,90)}"`);
}
