const ev = require('./poly_events.json');

const findEvent = (substr) => ev.find(e => (e.title||'').toLowerCase().includes(substr.toLowerCase()));

const targets = [
  '2026 NBA Champion',
  'MegaETH market cap',
  '2026 NHL Stanley Cup',
  'Starmer out by',
  'GTA VI',
];

for (const tname of targets) {
  const e = findEvent(tname);
  if (!e) { console.log('NO EVENT FOUND:', tname); continue; }
  console.log('\n=====', e.title, '=====');
  console.log('end=', e.endDate, 'v24=$', (parseFloat(e.volume24hr||0)/1e3).toFixed(0)+'k');
  for (const m of e.markets || []) {
    let yes = null;
    try {
      const op = m.outcomePrices ? JSON.parse(m.outcomePrices) : null;
      if (op && op.length >= 1) yes = parseFloat(op[0]);
    } catch (err) {}
    const v24 = parseFloat(m.volume24hr || 0);
    const liq = parseFloat(m.liquidity || 0);
    const q = (m.question || m.groupItemTitle || '').slice(0,80);
    console.log(`  YES=${yes==null?'?':(yes*100).toFixed(1)+'¢'} v24=$${(v24/1e3).toFixed(1)}k liq=$${(liq/1e3).toFixed(1)}k end=${(m.endDate||'').slice(0,10)} | ${q}`);
  }
}
