const fs = require('fs');
const d = JSON.parse(fs.readFileSync('logs_raw.json', 'utf8'));
const logs = d.logs;
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO = '0x0000000000000000000000000000000000000000';

let evs = [];
for (const l of logs) {
  if (l.topics[0].toLowerCase() !== TRANSFER) continue;
  if (l.topics.length < 3) continue;
  const from = '0x' + l.topics[1].slice(26).toLowerCase();
  const to = '0x' + l.topics[2].slice(26).toLowerCase();
  const raw = BigInt(l.data === '0x' ? '0x0' : l.data);
  if (raw === 0n) continue;
  evs.push({ block: parseInt(l.blockNumber, 16), tx: l.transactionHash, from, to, amt: Number(raw) / 1e18 });
}
console.log('transfer events', evs.length);
console.log('unique tx', new Set(evs.map(e => e.tx)).size);

const flow = new Map();
const add = (a, v) => flow.set(a, (flow.get(a) || 0) + v);
for (const e of evs) { add(e.from, -e.amt); add(e.to, e.amt); }

// net flow leaders
const rows = [...flow.entries()].map(([a, v]) => ({ a, v })).filter(r => Math.abs(r.v) > 0.5);
rows.sort((x, y) => y.v - x.v);
console.log('\nTOP NET IN (24h):');
for (const r of rows.slice(0, 15)) console.log(' ', r.a, '+' + r.v.toFixed(2));
console.log('\nTOP NET OUT (24h):');
for (const r of rows.slice(-15).reverse()) console.log(' ', r.a, r.v.toFixed(2));

// mint / burn
let minted = 0, burned = 0;
for (const e of evs) {
  if (e.from === ZERO) minted += e.amt;
  if (e.to === ZERO) burned += e.amt;
}
console.log('\nminted', minted.toFixed(2), 'burned', burned.toFixed(2));

// unique senders/recipients
const s = new Set(evs.map(e => e.from)), r = new Set(evs.map(e => e.to));
console.log('unique senders', s.size, 'unique recipients', r.size);

// tx count per block hour
const byHour = new Map();
for (const e of evs) { const h = Math.floor(e.block / 36000); byHour.set(h, (byHour.get(h) || 0) + 1); }
console.log('\nevents per ~hour bucket:', [...byHour.entries()].sort((a,b)=>a[0]-b[0]).map(([h,c])=>c).join(','));

// biggest transfers
evs.sort((a, b) => b.amt - a.amt);
console.log('\nBIGGEST TRANSFERS (24h):');
for (const e of evs.slice(0, 15)) console.log(' ', e.amt.toFixed(2), e.from, '->', e.to, e.tx);
fs.writeFileSync('evs.json', JSON.stringify(evs));
