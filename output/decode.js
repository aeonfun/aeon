#!/usr/bin/env node
// Decode + filter + categorize scanned events into the skill's event model.
'use strict';
const fs = require('fs');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const wallet = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const PRICES = { NOTE: 0.05897, DEUS: 0.01822, xDEUS: 0.01822 };
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const labels = {};
const knownTxt = fs.readFileSync('memory/known-addresses.yml', 'utf8');
for (const line of knownTxt.split('\n')) {
  const m = line.match(/^\s*"?(0x[0-9a-fA-F]{40})"?\s*:\s*"?([^"#]+)"?\s*$/);
  if (m) labels[m[1].toLowerCase()] = m[2].trim().replace(/"$/, '');
}
const a = (t) => '0x' + t.slice(26).toLowerCase();
const short = (x) => x.slice(0, 6) + '…' + x.slice(-4);

function tokenMeta(w) {
  if (w.label === 'NOTE') return { sym: 'NOTE', dec: 18 };
  if (w.label === 'DEUS escrow') return { sym: 'DEUS', dec: 18 };
  if (w.label === 'xDEUS') return { sym: 'xDEUS', dec: 0 };
  if (w.label === 'NOTE vesting') return { sym: 'NOTE', dec: 18 };
  return { sym: '?', dec: 18 };
}

const events = [];
for (const w of r.watches) {
  const meta = tokenMeta(w);
  for (const l of (w.logs || [])) {
    if (l.topics[0] !== TRANSFER) continue;
    let from, to, amt, isNft = false;
    if (meta.sym === 'xDEUS') {
      // ERC-721: tokenId in topics[3]; amount is always 1 NFT
      from = a(l.topics[1]); to = a(l.topics[2]); amt = 1; isNft = true;
    } else {
      from = a(l.topics[1]); to = a(l.topics[2]);
      amt = Number(BigInt(l.data)) / 10 ** meta.dec;
    }
    const ts = r.ts[w.chain + ':' + l.block] ?? null;
    let usd = PRICES[meta.sym] != null ? amt * PRICES[meta.sym] : null;
    if (isNft) usd = null; // NFT has no per-unit price; never price it
    const other = w.address === from ? to : from;
    events.push({
      watch: w.label, chain: w.chain, sym: meta.sym, tx: l.tx, block: l.block, ts,
      from, to, amount: amt, usd, direction: to === w.address ? 'in' : 'out',
      counterparty: other, cpLabel: labels[other] || null, isNft,
      threshold: w.threshold_usd,
    });
  }
}

// wallet topic-filter results (owner EOA / staging / vesting)
for (const w of wallet.wallets) {
  for (const t of (w.in || [])) events.push({
    watch: w.label, chain: 'robinhood', sym: 'NOTE', tx: t.tx, block: t.block,
    ts: wallet.ts[t.block] ?? null, from: t.from, to: w.address,
    amount: Number(BigInt(t.amt)) / 1e18, usd: Number(BigInt(t.amt)) / 1e18 * PRICES.NOTE,
    direction: 'in', counterparty: t.from, cpLabel: labels[t.from.toLowerCase()] || null,
    threshold: 5000, viaTopic: true,
  });
  for (const t of (w.out || [])) events.push({
    watch: w.label, chain: 'robinhood', sym: 'NOTE', tx: t.tx, block: t.block,
    ts: wallet.ts[t.block] ?? null, from: w.address, to: t.to,
    amount: Number(BigInt(t.amt)) / 1e18, usd: Number(BigInt(t.amt)) / 1e18 * PRICES.NOTE,
    direction: 'out', counterparty: t.to, cpLabel: labels[t.to.toLowerCase()] || null,
    threshold: 5000, viaTopic: true,
  });
}

// dedup by tx+watch+block+from+to+amount
const seen = new Set();
const dedup = [];
for (const e of events) {
  const k = [e.watch, e.tx, e.block, e.from, e.to, e.amount.toFixed(6)].join('|');
  if (seen.has(k)) continue;
  seen.add(k); dedup.push(e);
}

// NOTE token-contract logs also surface in the wallet watches -> collapse
// duplicates across watches: if the same tx appears in both, prefer the
// specific wallet watch (it has the right label + threshold).
const byTx = new Map();
for (const e of dedup) {
  const k = e.tx + '|' + e.amount.toFixed(6) + '|' + e.from + '|' + e.to;
  const prev = byTx.get(k);
  if (!prev || (e.viaTopic && !prev.viaTopic)) byTx.set(k, e);
}
const final = [...byTx.values()];

function tag(e) {
  const l = (e.cpLabel || '').toLowerCase();
  const EX = ['binance', 'coinbase', 'kraken', 'okx', 'bybit', 'bitfinex'];
  const DEX = ['uniswap', '1inch', 'curve', 'sushi', 'aerodrome', 'cowswap'];
  const BR = ['across', 'stargate', 'hop', 'synapse', 'wormhole', 'celer'];
  if (EX.some((x) => l.includes(x))) return e.direction === 'in' ? 'CEX-IN' : 'CEX-OUT';
  if (DEX.some((x) => l.includes(x))) return 'DEX-SWAP';
  if (BR.some((x) => l.includes(x))) return 'BRIDGE';
  if (e.counterparty === '0x0000000000000000000000000000000000000000') return e.direction === 'in' ? 'MINT' : 'BURN';
  return e.direction === 'in' ? 'UNKNOWN-IN' : 'UNKNOWN-OUT';
}

for (const e of final) e.tag = tag(e);
final.sort((x, y) => (y.usd ?? -1) - (x.usd ?? -1));

const kept = [], dropped = [];
for (const e of final) {
  if (e.usd == null) { e.dropReason = 'unpriced'; dropped.push(e); continue; }
  if (e.usd < 0.10) { e.dropReason = 'dust'; dropped.push(e); continue; }
  if (e.usd < (e.threshold ?? 1000)) { e.dropReason = 'below_threshold'; dropped.push(e); continue; }
  kept.push(e);
}

const fmt = (n) => n == null ? 'n/a' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'k' : '$' + n.toFixed(0);
console.log('RAW', final.length, 'KEPT', kept.length, 'DROPPED', dropped.length);
const reasons = {};
for (const d of dropped) reasons[d.dropReason] = (reasons[d.dropReason] || 0) + 1;
console.log('drop reasons', JSON.stringify(reasons));
console.log('\n--- KEPT ---');
for (const e of kept) {
  console.log(`${e.watch} | ${e.ts ? new Date(e.ts * 1000).toISOString() : '?'} | ${e.tag} ${fmt(e.usd)} ${e.amount.toFixed(2)} ${e.sym} ${e.direction === 'in' ? '←' : '→'} ${e.cpLabel || e.counterparty} | blk ${e.block} | ${e.tx}`);
}
console.log('\n--- TOP DROPPED (by usd) ---');
for (const e of dropped.slice(0, 8)) console.log(`${e.watch} | ${e.dropReason} | ${fmt(e.usd)} ${e.amount.toFixed(2)} ${e.sym} ${e.direction} | ${e.cpLabel || e.counterparty}`);
fs.writeFileSync('output/decoded.json', JSON.stringify({ kept, dropped, all: final }, null, 1));
