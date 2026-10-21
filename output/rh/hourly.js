const fs = require('fs');
const evs = JSON.parse(fs.readFileSync('evs.json', 'utf8'));
const POOL = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const TL = '0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8';
const OWNER = '0x0b64b35c6dd23944d6d4029864d2ca2aa1b66422';
const ZERO = '0x0000000000000000000000000000000000000000';

// hourly pool flow, block ~ 860000/day => 35833/hr
const base = Math.min(...evs.map(e => e.block));
const buckets = new Map();
for (const e of evs) {
  const h = Math.floor((e.block - base) / 35833);
  if (!buckets.has(h)) buckets.set(h, { sell: 0, buy: 0, n: 0 });
  const b = buckets.get(h);
  if (e.to === POOL) { b.sell += e.amt; b.n++; }
  if (e.from === POOL) { b.buy += e.amt; b.n++; }
}
console.log('hour-index  sell(NOTE in)  buy(NOTE out)  net  events');
for (const [h, b] of [...buckets.entries()].sort((a, c) => a[0] - c[0])) {
  const net = b.sell - b.buy;
  console.log(String(h).padStart(3), b.sell.toFixed(0).padStart(10), b.buy.toFixed(0).padStart(12), (net >= 0 ? '+' : '') + net.toFixed(0).padStart(10), String(b.n).padStart(5));
}

// net per address excluding pool/timelock
const net = new Map();
for (const e of evs) { if (e.from !== POOL && e.from !== ZERO) net.set(e.from, (net.get(e.from) || 0) - e.amt); if (e.to !== POOL && e.to !== ZERO) net.set(e.to, (net.get(e.to) || 0) + e.amt); }
const rows = [...net.entries()].map(([a, v]) => ({ a, v }));
rows.sort((x, y) => x.v - y.v);
console.log('\nlargest net SELLERS (excl pool):');
for (const r of rows.slice(0, 10)) console.log('  ', r.v.toFixed(0).padStart(10), r.a);
console.log('largest net BUYERS (excl pool):');
for (const r of rows.slice(-10).reverse()) console.log('  ', r.v.toFixed(0).padStart(10), r.a);
