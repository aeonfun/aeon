const fs = require('fs');
const dir = '/home/runner/work/aeon/aeon/.tokenpick-tmp';

const events = JSON.parse(fs.readFileSync(dir + '/poly_events.json', 'utf8'));

// Excluded markets (last 7d)
const excludedKeywords = [
  'megaeth', 'us x iran permanent peace', 'strait of hormuz',
];

const now = Date.now();
const minResolveMs = 24 * 3600 * 1000; // 24h gate

const candidates = [];

for (const ev of events) {
  if (!ev.markets) continue;
  for (const m of ev.markets) {
    if (m.closed || m.archived) continue;
    const q = (m.question || '').toLowerCase();
    if (excludedKeywords.some(k => q.includes(k))) continue;
    if (!m.endDate) continue;
    const endMs = new Date(m.endDate).getTime();
    if (endMs - now < minResolveMs) continue;
    const vol24 = parseFloat(m.volume24hr || ev.volume24hr || 0);
    if (vol24 < 50_000) continue;

    let prices = m.outcomePrices;
    if (typeof prices === 'string') {
      try { prices = JSON.parse(prices); } catch {}
    }
    if (!Array.isArray(prices) || prices.length < 2) continue;
    const yes = parseFloat(prices[0]);
    if (!isFinite(yes) || yes <= 0 || yes >= 1) continue;

    candidates.push({
      question: m.question,
      eventTitle: ev.title,
      yesPrice: yes,
      noPrice: 1 - yes,
      vol24: vol24,
      vol_total: parseFloat(m.volume || 0),
      endDate: m.endDate,
      slug: m.slug,
      conditionId: m.conditionId,
    });
  }
}

candidates.sort((a, b) => b.vol24 - a.vol24);
console.log(`Found ${candidates.length} candidate markets passing gate`);
console.log('\nTop 25 by 24h vol:');
for (const c of candidates.slice(0, 25)) {
  console.log(`  $${(c.vol24/1000).toFixed(0)}k | YES ${(c.yesPrice*100).toFixed(1)}¢ | end ${c.endDate.slice(0,10)} | ${c.question.slice(0,90)}`);
}

fs.writeFileSync(dir + '/poly_candidates.json', JSON.stringify(candidates.slice(0, 25), null, 2));
