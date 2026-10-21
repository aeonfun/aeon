#!/usr/bin/env node
// Correct event model.
// NOTE is a CONTRACT watch: the watch address is the token, so `to == watch`
// is meaningless. Direction must come from the LP counterparty:
//   X -> PoolManager  = SELL (supply into pool)
//   PoolManager -> X  = BUY  (supply out of pool)
// Wallet watches use the topic-filter scan (in/out already correct).
'use strict';
const fs = require('fs');
const scan = JSON.parse(fs.readFileSync('output/scan3.json', 'utf8'));
const wallet = JSON.parse(fs.readFileSync('output/wallet-scan.json', 'utf8'));
const PRICES = { NOTE: 0.05897, DEUS: 0.01822 };
const POOL = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const ZERO = '0x0000000000000000000000000000000000000000';

const labels = {};
for (const line of fs.readFileSync('memory/known-addresses.yml', 'utf8').split('\n')) {
  const m = line.match(/^\s*"?(0x[0-9a-fA-F]{40})"?\s*:\s*"?([^"#]+)"?\s*$/);
  if (m) labels[m[1].toLowerCase()] = m[2].trim().replace(/"$/, '');
}
const a = (t) => '0x' + t.slice(26).toLowerCase();
const amtOf = (d, dec) => (d && d !== '0x' ? Number(BigInt(d)) / 10 ** dec : 0);

const out = { generated_at: new Date().toISOString(), watches: {} };

// ---- NOTE contract watch: pool-level flows ----
{
  const w = scan.watches.find((x) => x.label === 'NOTE');
  const sells = [], buys = [], other = [];
  for (const l of w.logs || []) {
    const from = a(l.topics[1]), to = a(l.topics[2]);
    const amt = amtOf(l.data, 18);
    const ts = scan.ts[w.chain + ':' + l.block] ?? null;
    const e = { tx: l.tx, block: l.block, ts, from, to, amount: amt, usd: amt * PRICES.NOTE };
    if (to === POOL) { e.kind = 'SELL'; sells.push(e); }
    else if (from === POOL) { e.kind = 'BUY'; buys.push(e); }
    else { e.kind = from === ZERO || to === ZERO ? 'MINTBURN' : 'TRANSFER'; other.push(e); }
  }
  const sum = (xs) => xs.reduce((s, x) => s + x.amount, 0);
  const usd = (xs) => xs.reduce((s, x) => s + x.usd, 0);
  out.watches.NOTE = {
    window: [w.from_block, w.to_block], raw_logs: w.raw_logs,
    sells: { n: sells.length, note: sum(sells), usd: usd(sells) },
    buys: { n: buys.length, note: sum(buys), usd: usd(buys) },
    other: { n: other.length, note: sum(other) },
    net_supply_into_pool: sum(sells) - sum(buys),
    largest: [...sells, ...buys].sort((x, y) => y.usd - x.usd).slice(0, 6),
    transfers: other.length,
  };
}

// ---- Base: DEUS escrow (topic scan + self-correcting contract watch) ----
{
  const w = scan.watches.find((x) => x.label === 'DEUS escrow');
  const evts = [];
  for (const l of w.logs || []) {
    if (l.topics[0] !== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') continue;
    const from = a(l.topics[1]), to = a(l.topics[2]);
    const amt = amtOf(l.data, 18);
    evts.push({ tx: l.tx, block: l.block, ts: scan.ts['base:' + l.block] ?? null, from, to, amount: amt, usd: amt * PRICES.DEUS });
  }
  out.watches['DEUS escrow'] = { raw_logs: w.raw_logs, transfer_logs: evts.length, events: evts };
}

// ---- xDEUS ERC-721 ----
{
  const w = scan.watches.find((x) => x.label === 'xDEUS');
  const evts = (w.logs || []).map((l) => ({
    tx: l.tx, block: l.block, ts: scan.ts['base:' + l.block] ?? null,
    from: a(l.topics[1]), to: a(l.topics[2]), tokenId: l.topics[3] ? parseInt(l.topics[3], 16) : null,
    kind: a(l.topics[1]) === ZERO ? 'MINT' : a(l.topics[2]) === ZERO ? 'BURN' : 'MOVE',
  }));
  out.watches['xDEUS'] = { raw_logs: w.raw_logs, mints: evts.filter((e) => e.kind === 'MINT').length, burns: evts.filter((e) => e.kind === 'BURN').length, moves: evts.filter((e) => e.kind === 'MOVE').length, events: evts };
}

// ---- wallet watches ----
for (const w of wallet.wallets) {
  const ins = (w.in || []).map((t) => ({ tx: t.tx, block: t.block, ts: wallet.ts[t.block] ?? null, from: t.from, sec: 'in', amount: amtOf(t.amt, 18), usd: amtOf(t.amt, 18) * PRICES.NOTE }));
  const outs = (w.out || []).map((t) => ({ tx: t.tx, block: t.block, ts: wallet.ts[t.block] ?? null, to: t.to, sec: 'out', amount: amtOf(t.amt, 18), usd: amtOf(t.amt, 18) * PRICES.NOTE }));
  out.watches[w.label] = { window: [w.from_block, w.to_block], ins, outs };
}

// ---- filter threshold ----
const THRESH = { 'DEUS escrow': 200, xDEUS: 250, NOTE: 5000, 'NOTE timelock': 5000, 'NOTE owner EOA': 5000, 'NOTE staging 0x69bb': 5000, 'NOTE vesting': 1500 };
const kept = [], dropped = [];
function consider(watch, e, dir) {
  const t = THRESH[watch] ?? 1000;
  if (e.usd == null) { dropped.push({ ...e, watch, reason: 'unpriced' }); return; }
  if (e.usd < 0.10) { dropped.push({ ...e, watch, reason: 'dust' }); return; }
  if (e.usd < t) { dropped.push({ ...e, watch, reason: 'below_threshold' }); return; }
  kept.push({ ...e, watch, dir });
}
for (const e of out.watches.NOTE.largest) consider('NOTE', e, e.kind === 'SELL' ? 'out' : 'in');
for (const e of out.watches['DEUS escrow'].events) consider('DEUS escrow', e, e.to === '0xa85a38796b951ce87b378538b32b3e6ee3c4c373' ? 'in' : 'out');
for (const e of [...out.watches['NOTE owner EOA'].ins, ...out.watches['NOTE owner EOA'].outs]) consider('NOTE owner EOA', e, e.sec);
for (const e of [...out.watches['NOTE staging 0x69bb'].ins, ...out.watches['NOTE staging 0x69bb'].outs]) consider('NOTE staging 0x69bb', e, e.sec);
for (const e of [...out.watches['NOTE vesting'].ins, ...out.watches['NOTE vesting'].outs]) consider('NOTE vesting', e, e.sec);

kept.sort((x, y) => y.usd - x.usd);
const fmt = (n) => n == null ? 'n/a' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'k' : '$' + n.toFixed(0);

console.log('=== WATCH SUMMARY ===');
for (const [k, v] of Object.entries(out.watches)) {
  if (k === 'NOTE') console.log(`NOTE | blk ${v.window[0]}→${v.window[1]} | raw ${v.raw_logs} | SELL ${v.sells.n} (${v.sells.note.toFixed(0)} NOTE, ${fmt(v.sells.usd)}) | BUY ${v.buys.n} (${v.buys.note.toFixed(0)} NOTE, ${fmt(v.buys.usd)}) | net into pool ${v.net_supply_into_pool.toFixed(0)} NOTE | other transfers ${v.transfers}`);
  else if (k === 'DEUS escrow') console.log(`DEUS escrow | raw ${v.raw_logs} | erc20 transfers ${v.transfer_logs}`);
  else if (k === 'xDEUS') console.log(`xDEUS | raw ${v.raw_logs} | mints ${v.mints} burns ${v.burns} moves ${v.moves}`);
  else console.log(`${k} | blk ${v.window[0]}→${v.window[1]} | in ${v.ins.length} out ${v.outs.length}`);
}

console.log('\n=== KEPT (>= threshold) ===');
for (const e of kept) {
  const cp = e.dir === 'out' ? (e.to || '?') : (e.from || '?');
  console.log(`${new Date((e.ts || 0) * 1000).toISOString()} | ${e.watch} | ${e.dir.toUpperCase()} | ${fmt(e.usd)} ${e.amount.toFixed(2)} | ${labels[cp] || cp} | blk ${e.block} | ${e.tx}`);
}
console.log('\nKEPT', kept.length, 'DROPPED', dropped.length);
const rc = {}; for (const d of dropped) rc[d.reason] = (rc[d.reason] || 0) + 1;
console.log('drop reasons', JSON.stringify(rc));
fs.writeFileSync('output/final.json', JSON.stringify({ ...out, kept, dropped }, null, 1));
