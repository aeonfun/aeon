const events = require('/tmp/poly_events.json');
console.log('TOTAL EVENTS:', Array.isArray(events) ? events.length : 'not-array');

const out = [];
for (const e of (Array.isArray(events) ? events : [])) {
  const v = e.volume24hr || e.volume24Hr || 0;
  const liq = e.liquidity || 0;
  const title = e.title || e.question || e.name || '';
  const slug = e.slug || '';
  const endDate = e.endDate || '';
  const markets = e.markets || [];
  // first market simplified
  const m0 = markets[0] || {};
  const q = m0.question || m0.questionId || '';
  let outcomePrices = [];
  try { outcomePrices = JSON.parse(m0.outcomePrices || '[]'); } catch(_){}
  out.push({ title, slug, v, liq, endDate, q, prices: outcomePrices, mcount: markets.length, end: m0.endDate });
}
out.sort((a,b) => b.v - a.v);
console.log('\n===TOP 20 EVENTS BY 24H VOL===');
for (const o of out.slice(0,20)) {
  const end = (o.endDate||'').slice(0,10);
  console.log(`  vol=$${(o.v/1e6).toFixed(2)}M liq=$${(o.liq/1e3).toFixed(0)}k end=${end} m=${o.mcount}  "${o.title}"`);
  console.log(`     slug=${o.slug}`);
}
