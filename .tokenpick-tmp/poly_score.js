const fs = require('fs');
const events = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.tokenpick-tmp/poly_events.json', 'utf8'));

// Print top 20 by 24h volume
const list = Array.isArray(events) ? events : (events.events || []);
console.log(`Total events: ${list.length}`);
console.log();

const filt = list.filter(e => {
  const v = parseFloat(e.volume24hr || e.volume_24hr || 0);
  return v >= 50000;
}).sort((a, b) => parseFloat(b.volume24hr || 0) - parseFloat(a.volume24hr || 0));

console.log(`Events with vol24h >= $50k: ${filt.length}`);
console.log();

filt.slice(0, 25).forEach((e, i) => {
  const vol24 = parseFloat(e.volume24hr || 0);
  const liq = parseFloat(e.liquidity || 0);
  const end = e.endDate || e.end_date || 'n/a';
  console.log(`[${i+1}] vol24h=$${(vol24/1e6).toFixed(2)}M liq=$${(liq/1e6).toFixed(2)}M ends=${end}`);
  console.log(`    title: ${e.title || e.question || 'unknown'}`);
  // outcomes
  const markets = e.markets || [];
  markets.slice(0, 6).forEach(m => {
    let prices = [];
    try {
      prices = JSON.parse(m.outcomePrices || '[]');
    } catch(e) {}
    let outcomes = [];
    try {
      outcomes = JSON.parse(m.outcomes || '[]');
    } catch(e) {}
    const yesPx = prices[0];
    const noPx = prices[1];
    const mv24 = parseFloat(m.volume24hr || 0);
    console.log(`    - "${m.question || m.groupItemTitle || ''}" YES=${yesPx} NO=${noPx} mv24=$${(mv24/1e3).toFixed(0)}k`);
  });
  console.log();
});
