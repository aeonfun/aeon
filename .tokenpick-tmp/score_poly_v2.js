const fs = require('fs');
const events = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/poly_events.json'));

// dedup: skip these markets/questions
const dedupQs = [
  /us.*iran.*permanent peace deal.*may 31/i,
  /megaeth.*fdv.*\$2b/i,
];

const isDedup = (q) => dedupQs.some(r => r.test(q));

const candidates = [];
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

  // each event has nested markets
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
    if (isDedup(m.question || '')) continue;

    candidates.push({
      eventTitle: title,
      question: m.question || title,
      yesPrice: yesPrice.toFixed(3),
      eventVol24h: v24,
      mktVol24h: mv24,
      hoursUntil: hoursUntil.toFixed(0),
      endDate: endIso?.slice(0,10),
      slug: m.slug,
    });
  }
}

candidates.sort((a,b) => b.eventVol24h - a.eventVol24h);
console.log(`Total candidates: ${candidates.length}\n`);
console.log('Top 25 by event 24h vol:');
for (const c of candidates.slice(0, 25)) {
  console.log(`[${(c.eventVol24h/1e6).toFixed(2)}M evt / ${(c.mktVol24h/1e3).toFixed(0)}k mkt] YES ${c.yesPrice} | end ${c.endDate} (${c.hoursUntil}h) | "${c.question.slice(0,90)}"`);
}
