const fs = require('fs');
const m = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.cg_markets.json'));
const trend = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.cg_trending.json'));

const btc = m.find(c => c.symbol === 'btc');
const eth = m.find(c => c.symbol === 'eth');
const btc24 = btc.price_change_percentage_24h_in_currency;
const btc7 = btc.price_change_percentage_7d_in_currency;
const eth24 = eth.price_change_percentage_24h_in_currency;
const eth7 = eth.price_change_percentage_7d_in_currency;
console.log(`BTC: 24h=${btc24.toFixed(2)}%  7d=${btc7.toFixed(2)}%`);
console.log(`ETH: 24h=${eth24.toFixed(2)}%  7d=${eth7.toFixed(2)}%`);

const trendSyms = new Set();
for (const c of trend.coins || []) {
  const sym = (c.item?.symbol || '').toLowerCase();
  if (sym) trendSyms.add(sym);
}
console.log('Trending:', [...trendSyms].join(','));

const dedup = new Set(['doge', 'ray', 'pengu', 'xcn', 'ape']);

const scored = [];
for (const c of m) {
  const sym = c.symbol;
  const mc = c.market_cap || 0;
  if (mc < 20_000_000) continue;
  if (dedup.has(sym)) continue;
  const p24 = c.price_change_percentage_24h_in_currency;
  const p7 = c.price_change_percentage_7d_in_currency;
  const vol = c.total_volume || 0;
  if (p24 == null || p7 == null) continue;
  const vmc = mc > 0 ? vol / mc : 0;
  let s = 0;
  const br = [];
  if (p24 > 0) { s += 1; br.push('24h+1'); }
  if (p7 > 0) { s += 1; br.push('7d+1'); }
  if (p24 > 5 && p7 > 5) { s += 2; br.push('both>5%+2'); }
  if (trendSyms.has(sym)) { s += 2; br.push('cgtrend+2'); }
  if (vmc >= 0.20) { s += 3; br.push('v/mc>=0.20+3'); }
  else if (vmc >= 0.10) { s += 2; br.push('v/mc>=0.10+2'); }
  if (p7 > btc7 && p7 > eth7) { s += 2; br.push('RSvsBTC/ETH+2'); }
  scored.push({ s, sym: sym.toUpperCase(), name: c.name, price: c.current_price, p24, p7, mc, vol, vmc, br });
}

scored.sort((a, b) => (b.s - a.s) || (b.vmc - a.vmc));

for (const r of scored.slice(0, 25)) {
  const priceStr = r.price < 0.01 ? r.price.toExponential(3) : r.price.toFixed(4);
  console.log(`${String(r.s).padStart(2)}  ${r.sym.padEnd(8)} ${r.name.slice(0, 22).padEnd(22)} $${priceStr.padStart(12)}  24h=${r.p24.toFixed(2).padStart(7)}%  7d=${r.p7.toFixed(2).padStart(7)}%  mc=$${(r.mc/1e9).toFixed(2)}B  vol=$${(r.vol/1e6).toFixed(1)}M  v/mc=${r.vmc.toFixed(2)}  [${r.br.join(',')}]`);
}
