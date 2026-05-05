const fs = require('fs');

const dedupQuestions = [
  'Strait of Hormuz traffic returns to normal by end of June',
  'US x Iran permanent peace deal by May 31, 2026',
  'MegaETH FDV >$2B one day after launch',
];

const events = JSON.parse(fs.readFileSync('.outputs/poly-events-0505.json','utf8'));

console.log('Total events:', events.length);
console.log('\nTop events by 24h volume:');
const items = [];
for (const e of events.slice(0,30)) {
  const v24 = parseFloat(e.volume24hr ?? e.volume_24hr ?? 0);
  if (v24 < 50000) continue;
  // event has multiple markets typically; gather some info
  const markets = (e.markets||[]);
  for (const m of markets) {
    if (m.closed || m.archived) continue;
    let prices = [];
    try { prices = JSON.parse(m.outcomePrices || '[]'); } catch(_) {}
    const yesp = prices.length ? parseFloat(prices[0]) : null;
    const mv24 = parseFloat(m.volume24hr ?? 0);
    if (mv24 < 50000) continue;
    const endDate = m.endDate || m.endDateIso;
    const daysLeft = endDate ? (new Date(endDate) - new Date()) / (1000*60*60*24) : null;
    if (daysLeft !== null && daysLeft < 1) continue;
    const q = m.question || e.title;
    if (dedupQuestions.some(d => q.toLowerCase().includes(d.toLowerCase()))) continue;
    items.push({event:e.title, q, yesp, mv24, ev24:v24, endDate, daysLeft});
  }
}
items.sort((a,b) => b.mv24 - a.mv24);
const seen = new Set();
const out = [];
for (const x of items) {
  if (seen.has(x.q)) continue;
  seen.add(x.q);
  out.push(x);
  if (out.length >= 25) break;
}
for (const x of out) {
  console.log(`[v24=$${(x.mv24/1e3).toFixed(0)}k yes=${x.yesp != null ? (x.yesp*100).toFixed(1)+'¢' : '?'} ${x.daysLeft != null ? x.daysLeft.toFixed(1)+'d' : ''}] ${x.q.substring(0,140)}`);
}
fs.writeFileSync('.outputs/poly-candidates-0505.json', JSON.stringify(out, null, 2));
