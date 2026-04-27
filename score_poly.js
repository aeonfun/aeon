const ev = require('./poly_events.json');
console.log('Type:', typeof ev, Array.isArray(ev) ? 'array len ' + ev.length : 'object keys ' + Object.keys(ev).slice(0,5));
const events = Array.isArray(ev) ? ev : (ev.events || ev.data || []);
console.log('Events count:', events.length);
console.log('First event keys:', Object.keys(events[0] || {}).slice(0,30));

const out = [];
for (const e of events) {
  const title = e.title || e.question || '';
  const v24 = parseFloat(e.volume24hr || e.volume_24hr || e.volume24Hr || 0);
  const liq = parseFloat(e.liquidity || 0);
  const endDate = e.endDate || e.end_date || e.closeTime || '';
  const slug = e.slug || '';
  const markets = e.markets || [];
  out.push({ title: title.slice(0,80), v24, liq, endDate, slug, mcount: markets.length });
}
out.sort((a,b)=>b.v24-a.v24);
console.log('\nTOP 20 EVENTS BY 24h VOL:');
for (const e of out.slice(0,20)) {
  console.log(`  v24=$${(e.v24/1e3).toFixed(0)}k liq=$${(e.liq/1e3).toFixed(0)}k end=${(e.endDate||'').slice(0,10)} mkts=${e.mcount} | ${e.title}`);
}
