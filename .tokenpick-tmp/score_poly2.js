const fs = require('fs');
const dir = '/home/runner/work/aeon/aeon/.tokenpick-tmp';

const events = JSON.parse(fs.readFileSync(dir + '/poly_events.json', 'utf8'));
const newMarkets = JSON.parse(fs.readFileSync(dir + '/poly_markets.json', 'utf8'));

const excludedKeywords = [
  'megaeth', 'us x iran permanent peace', 'strait of hormuz',
];
const sportsKeywords = ['nba finals', 'world cup', 'stanley cup', 'nhl', 'super bowl', 'mlb', 'champions league', 'nba champion'];

const now = Date.now();
const minResolveMs = 24 * 3600 * 1000;

console.log('=== Non-sports markets sorted by event 24h vol ===');
const sorted = [...events].sort((a,b) => parseFloat(b.volume24hr||0) - parseFloat(a.volume24hr||0));
for (const ev of sorted.slice(0, 30)) {
  const title = ev.title || '';
  if (sportsKeywords.some(k => title.toLowerCase().includes(k))) continue;
  console.log(`\n[$${(parseFloat(ev.volume24hr||0)/1000).toFixed(0)}k 24h] ${title}`);
  if (!ev.markets) continue;
  // sort markets within event by 24h vol
  const ms = ev.markets.filter(m => !m.closed && !m.archived).sort((a,b) => parseFloat(b.volume24hr||0) - parseFloat(a.volume24hr||0));
  for (const m of ms.slice(0, 5)) {
    const q = (m.question || '');
    if (excludedKeywords.some(k => q.toLowerCase().includes(k))) continue;
    let prices = m.outcomePrices;
    if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch {} }
    if (!Array.isArray(prices) || prices.length < 2) continue;
    const yes = parseFloat(prices[0]);
    const v24 = parseFloat(m.volume24hr || 0);
    const end = (m.endDate || '').slice(0,10);
    console.log(`    $${(v24/1000).toFixed(0)}k YES ${(yes*100).toFixed(1)}¢ end ${end} | ${q.slice(0,100)}`);
  }
}
