const fs = require('fs');
const dir = '/home/runner/work/aeon/aeon/.tokenpick-tmp';

const events = JSON.parse(fs.readFileSync(dir + '/poly_events.json', 'utf8'));

// Look at all events with their markets and 24h volumes
console.log('All events with 24h vol > $30k (any topic):');
const sorted = [...events].sort((a,b) => parseFloat(b.volume24hr||0) - parseFloat(a.volume24hr||0));
for (const ev of sorted) {
  const v = parseFloat(ev.volume24hr || 0);
  if (v < 30_000) break;
  console.log(`[$${(v/1000).toFixed(0)}k] ${ev.title}  --  ${ev.slug}`);
}

console.log('\n\n=== Also dump newMarkets file ===');
const newM = JSON.parse(fs.readFileSync(dir + '/poly_markets.json', 'utf8'));
const filt = newM.filter(m => parseFloat(m.volume24hr||0) > 30_000 && !m.closed);
filt.sort((a,b) => parseFloat(b.volume24hr||0) - parseFloat(a.volume24hr||0));
for (const m of filt.slice(0, 30)) {
  let prices = m.outcomePrices;
  if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch {} }
  if (!Array.isArray(prices) || prices.length < 2) continue;
  const yes = parseFloat(prices[0]);
  const v = parseFloat(m.volume24hr || 0);
  console.log(`[$${(v/1000).toFixed(0)}k YES ${(yes*100).toFixed(1)}¢ end ${(m.endDate||'').slice(0,10)}] ${(m.question||'').slice(0,120)}`);
}
