const m = require('/tmp/poly_markets.json');
console.log('TOTAL NEW:', m.length);
for (const x of m) {
  let p = [];
  try { p = JSON.parse(x.outcomePrices || '[]'); } catch(_){}
  const v = x.volume24hr || 0;
  const liq = x.liquidity || 0;
  const yes = (p[0] !== undefined) ? `${(parseFloat(p[0])*100).toFixed(1)}c` : '?';
  console.log(`  vol=$${(v/1e3).toFixed(0)}k liq=$${(liq/1e3).toFixed(0)}k YES=${yes} end=${(x.endDate||'').slice(0,10)} "${(x.question||x.groupItemTitle||'').slice(0,80)}"`);
}
