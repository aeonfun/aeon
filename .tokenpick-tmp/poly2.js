const events = require('/tmp/poly_events.json');
const slugs = ['2026-nba-champion', 'megaeth-market-cap-fdv-one-day-after-launch', '2026-nhl-stanley-cup-champion', 'starmer-out-in-2025', 'gta-vi-released-before-june-2026'];
for (const e of events) {
  if (!slugs.includes(e.slug)) continue;
  console.log('\n===', e.title, 'end:', (e.endDate||'').slice(0,10), 'vol24h:', e.volume24hr, '===');
  for (const m of (e.markets || [])) {
    let p = [];
    try { p = JSON.parse(m.outcomePrices || '[]'); } catch(_){}
    let o = [];
    try { o = JSON.parse(m.outcomes || '[]'); } catch(_){}
    const title = m.groupItemTitle || m.question || '';
    const yes = (p[0] !== undefined) ? `${(parseFloat(p[0])*100).toFixed(1)}c` : '?';
    const v24 = m.volume24hr || 0;
    const liq = m.liquidity || 0;
    console.log(`  ${title.padEnd(45)} YES=${yes} vol24h=$${(v24/1e3).toFixed(0)}k liq=$${(liq/1e3).toFixed(0)}k end=${(m.endDate||'').slice(0,10)} outcomes=[${o.join(', ')}]`);
  }
}
