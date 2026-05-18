const fs = require('fs');
const m = JSON.parse(fs.readFileSync('/tmp/markets.json'));
const trend = JSON.parse(fs.readFileSync('/tmp/trending.json'));
const dex = JSON.parse(fs.readFileSync('/tmp/dex.json'));

const trendingSyms = new Set((trend.coins || []).map(c => (c.item.symbol || '').toUpperCase()));
const dexSyms = new Set((dex.pairs || []).map(p => ((p.baseToken || {}).symbol || '').toUpperCase()));

const btc = m.find(x => x.symbol === 'btc');
const eth = m.find(x => x.symbol === 'eth');
const btc7 = btc.price_change_percentage_7d_in_currency;
const eth7 = eth.price_change_percentage_7d_in_currency;
console.log('BTC 24h/7d:', btc.price_change_percentage_24h_in_currency.toFixed(2), btc7.toFixed(2));
console.log('ETH 24h/7d:', eth.price_change_percentage_24h_in_currency.toFixed(2), eth7.toFixed(2));
console.log('trending:', [...trendingSyms].sort().join(' '));
console.log('---');

const dedup = new Set(['TRAC', 'KAIA']);
const rows = [];
for (const x of m) {
  const sym = (x.symbol || '').toUpperCase();
  const mc = x.market_cap || 0;
  const vol = x.total_volume || 0;
  const p24 = x.price_change_percentage_24h_in_currency;
  const p7 = x.price_change_percentage_7d_in_currency;
  if (mc < 20e6) continue;
  if (p24 == null || p7 == null) continue;
  let s = 0;
  if (p24 > 0) s += 1;
  if (p7 > 0) s += 1;
  if (p24 > 5 && p7 > 5) s += 2;
  if (trendingSyms.has(sym)) s += 2;
  const vmc = mc ? vol / mc : 0;
  if (vmc >= 0.20) s += 3;
  else if (vmc >= 0.10) s += 2;
  if (p7 > btc7 && p7 > eth7) s += 2;
  if (dexSyms.has(sym)) s += 1;
  rows.push({ s, sym, name: x.name, price: x.current_price, p24, p7, mc, vol, vmc });
}
rows.sort((a, b) => b.s - a.s || b.vmc - a.vmc);
for (const r of rows.slice(0, 22)) {
  const flag = dedup.has(r.sym) ? ' <DEDUP>' : '';
  console.log(
    `${String(r.s).padStart(2)} ${r.sym.padEnd(9)} ${(r.name || '').slice(0, 20).padEnd(20)} ` +
    `$${String(r.price).padEnd(12)} 24h=${r.p24.toFixed(1).padStart(7)} 7d=${r.p7.toFixed(1).padStart(7)} ` +
    `mc=$${(r.mc / 1e6).toFixed(0).padStart(7)}m vol=$${(r.vol / 1e6).toFixed(0).padStart(7)}m vmc=${r.vmc.toFixed(3)}${flag}`
  );
}
