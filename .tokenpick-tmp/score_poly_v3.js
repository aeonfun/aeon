const fs = require('fs');
const events = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/poly_events.json'));

const dedupQs = [
  /us.*iran.*permanent peace deal.*may 31/i,
  /megaeth.*fdv.*\$2b/i,
];
const isDedup = (q) => dedupQs.some(r => r.test(q));

const candidates = [];
const seenEvents = new Set();
for (const e of events) {
  const v24 = e.volume24hr || 0;
  if (v24 < 50000) continue;
  const endIso = e.endDate || e.end_date;
  if (!endIso) continue;
  const end = new Date(endIso);
  const now = new Date();
  const hoursUntil = (end - now) / 1000 / 3600;
  if (hoursUntil < 24) continue;
  const title = e.title || '';
  if (isDedup(title)) continue;

  const markets = e.markets || [];
  for (const m of markets) {
    if (m.closed) continue;
    let yesPrice = null;
    try {
      const op = JSON.parse(m.outcomePrices || '[]');
      if (op.length >= 1) yesPrice = parseFloat(op[0]);
    } catch {}
    if (yesPrice == null) continue;
    const mv24 = m.volume24hr || 0;
    if (mv24 < 50000) continue;
    if (isDedup(m.question || '')) continue;

    candidates.push({
      eventTitle: title,
      eventSlug: e.slug,
      question: m.question || title,
      yesPrice: parseFloat(yesPrice.toFixed(3)),
      eventVol24h: v24,
      mktVol24h: mv24,
      hoursUntil: Math.round(hoursUntil),
      endDate: endIso?.slice(0,10),
      slug: m.slug,
      tags: (e.tags || []).map(t => t.label || t).join(','),
    });
  }
}

candidates.sort((a,b) => b.mktVol24h - a.mktVol24h);
console.log(`Total candidates (market vol >= $50k): ${candidates.length}\n`);
console.log('Top 35 by market 24h vol:');
for (const c of candidates.slice(0, 35)) {
  console.log(`[${(c.mktVol24h/1e3).toFixed(0).padStart(5)}k] YES ${(c.yesPrice*100).toFixed(1).padStart(5)}c | end ${c.endDate} (${c.hoursUntil}h) | ${c.eventTitle.slice(0,40).padEnd(40)} | "${c.question.slice(0,80)}"`);
}
