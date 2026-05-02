const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/poly_markets_byvol.json'));

const dedupQs = [
  /us.*iran.*permanent peace deal.*may 31/i,
  /megaeth.*fdv.*\$2b/i,
];
const isDedup = (q) => dedupQs.some(r => r.test(q));

const list = [];
for (const m of markets) {
  if (m.closed) continue;
  const v24 = m.volume24hr || 0;
  if (v24 < 50000) continue;
  const endIso = m.endDate || m.end_date;
  if (!endIso) continue;
  const end = new Date(endIso);
  const now = new Date();
  const hoursUntil = (end - now) / 1000 / 3600;
  if (hoursUntil < 24) continue;
  const q = m.question || '';
  if (isDedup(q)) continue;
  let yesPrice = null;
  try {
    const op = JSON.parse(m.outcomePrices || '[]');
    if (op.length >= 1) yesPrice = parseFloat(op[0]);
  } catch {}
  if (yesPrice == null) continue;
  list.push({
    q, yesPrice, v24, hoursUntil: Math.round(hoursUntil), end: endIso.slice(0,10),
    slug: m.slug
  });
}

list.sort((a,b) => b.v24 - a.v24);
console.log(`Markets with v24>=50k, >24h to resolve: ${list.length}\n`);
for (const m of list.slice(0, 40)) {
  const isSports = /nba|nfl|nhl|mlb|fifa|world cup|football|hockey|basketball|champions|champion|finals|gold|playoff|game [0-9]/i.test(m.q);
  const tag = isSports ? '[S]' : '   ';
  console.log(`[${(m.v24/1e3).toFixed(0).padStart(5)}k] ${tag} YES ${(m.yesPrice*100).toFixed(1).padStart(5)}c | end ${m.end} (${m.hoursUntil}h) | "${m.q.slice(0,100)}"`);
}
