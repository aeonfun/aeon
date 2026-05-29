const fs = require('fs');
const path = require('path');

const TMPDIR = '/home/runner/work/aeon/aeon/.gt-tmp';
const NOW = new Date('2026-05-29T22:14:00Z');

const FILES = {
  'gt-global.json': 'global',
  'gt-new.json': 'new',
  'gt-solana-trend.json': 'sol-trend',
  'gt-solana-vol.json': 'sol-vol',
  'gt-eth-trend.json': 'eth-trend',
  'gt-eth-vol.json': 'eth-vol',
  'gt-base-trend.json': 'base-trend',
  'gt-base-vol.json': 'base-vol',
  'gt-bsc-trend.json': 'bsc-trend',
  'gt-bsc-vol.json': 'bsc-vol',
  'gt-arbitrum-trend.json': 'arb-trend',
  'gt-arbitrum-vol.json': 'arb-vol',
};

const allPools = [];
const srcStatus = {};
for (const [fname, label] of Object.entries(FILES)) {
  const p = path.join(TMPDIR, fname);
  if (!fs.existsSync(p)) { srcStatus[label] = 'missing'; continue; }
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data.data) { srcStatus[label] = 'fail'; continue; }
    for (const pool of data.data) {
      pool._source = label;
      allPools.push(pool);
    }
    srcStatus[label] = 'ok';
  } catch (e) {
    srcStatus[label] = 'err';
  }
}

const okSrc = Object.values(srcStatus).filter(s => s === 'ok').length;
console.log(`Loaded ${allPools.length} raw pool entries from ${okSrc}/${Object.keys(FILES).length} sources`);
console.log('Source status:', JSON.stringify(srcStatus));

const fnum = (v) => {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const inum = (v) => Math.floor(fnum(v));

// Dedup by base_token
const byToken = new Map();
for (const p of allPools) {
  const bt = p.relationships?.base_token?.data?.id;
  if (!bt) continue;
  const vol = fnum(p.attributes?.volume_usd?.h24);
  const existing = byToken.get(bt);
  if (!existing || vol > fnum(existing.attributes?.volume_usd?.h24)) {
    byToken.set(bt, p);
  }
}
console.log(`After dedup: ${byToken.size} unique tokens`);
const preGate = byToken.size;

// Gate
const gateRej = { 'thin-vol': 0, negative: 0, 'thin-liq': 0, dumping: 0, honeypot: 0, 'too-new': 0, 'rug-like': 0 };
const survivors = [];
for (const p of byToken.values()) {
  const a = p.attributes || {};
  const vol = fnum(a.volume_usd?.h24);
  const pct = fnum(a.price_change_percentage?.h24);
  const liq = fnum(a.reserve_in_usd);
  const buys = inum(a.transactions?.h24?.buys);
  const sells = inum(a.transactions?.h24?.sells);
  let ageH = 9999;
  if (a.pool_created_at) {
    const dt = new Date(a.pool_created_at);
    ageH = (NOW - dt) / 3600000;
  }
  if (vol < 50000) { gateRej['thin-vol']++; continue; }
  if (pct <= 0) { gateRej.negative++; continue; }
  if (liq < 10000) { gateRej['thin-liq']++; continue; }
  if (buys > 0 && sells / Math.max(buys, 1) > 10) { gateRej.dumping++; continue; }
  if (sells > 0 && buys / Math.max(sells, 1) > 50) { gateRej.honeypot++; continue; }
  if (ageH < 1.0 && vol < 100000) { gateRej['too-new']++; continue; }
  if (pct > 10000) { gateRej['rug-like']++; continue; }

  p._meta = { vol, pct, liq, buys, sells, ageH };
  p._meta.pctH1 = fnum(a.price_change_percentage?.h1);
  p._meta.pctH6 = fnum(a.price_change_percentage?.h6);
  survivors.push(p);
}

console.log(`Post-gate: ${survivors.length} pools`);
console.log('Gate rejections:', JSON.stringify(gateRej));

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
for (const p of survivors) {
  const m = p._meta;
  const pctPts = clamp(m.pct / 500, 0, 1);
  const volPts = clamp(Math.log10(m.vol + 1) / 7, 0, 1);
  const liqPts = clamp(Math.log10(m.liq + 1) / 6, 0, 1);
  const momPts = clamp((m.pctH1 + 50) / 100, 0, 1);
  const skewPts = clamp(m.buys / Math.max(m.buys + m.sells, 1), 0, 1);
  m.score = 40 * pctPts + 25 * volPts + 15 * liqPts + 10 * momPts + 10 * skewPts;
}

for (const p of survivors) {
  const m = p._meta;
  if (m.liq >= 1_000_000 && m.vol >= 1_000_000) m.tag = 'DEEP-LIQ';
  else if (m.ageH <= 48 && m.vol >= 250_000) m.tag = 'BREAKOUT';
  else if (m.pctH1 > 2 && m.pct > 50) m.tag = 'CONTINUATION';
  else if (m.pctH1 < -5 && m.pct > 0) m.tag = 'REVERSAL';
  else m.tag = 'MICRO-SPEC';
}

survivors.sort((a, b) => b._meta.score - a._meta.score);

const top5 = survivors.slice(0, 5);
const deepCount = top5.filter(p => p._meta.tag === 'DEEP-LIQ').length;
const contCount = top5.filter(p => p._meta.tag === 'CONTINUATION').length;
let verdict;
if (survivors.length < 5) verdict = 'SLEEPY';
else if (deepCount >= 2) verdict = 'STRONG';
else if (deepCount === 1 || contCount >= 2) verdict = 'MIXED';
else verdict = 'SPECULATIVE';

console.log(`\n=== VERDICT: ${verdict} ===`);
console.log(`Top 5 distribution: DEEP-LIQ=${deepCount}, CONTINUATION=${contCount}, BREAKOUT+MICRO=${top5.filter(p => p._meta.tag === 'BREAKOUT' || p._meta.tag === 'MICRO-SPEC').length}, REVERSAL=${top5.filter(p => p._meta.tag === 'REVERSAL').length}`);

console.log('\n=== TOP 20 ===');
for (let i = 0; i < Math.min(20, survivors.length); i++) {
  const p = survivors[i];
  const m = p._meta;
  const name = p.attributes?.name || '?';
  const pid = p.id || '?';
  const network = pid.split('_')[0];
  const buyPct = Math.round(100 * m.buys / Math.max(m.buys + m.sells, 1));
  console.log(
    `${(i + 1).toString().padStart(2)}. [${m.tag.padEnd(12)}] ${name.padEnd(35)} (${network.padEnd(9)}) ` +
    `+${m.pct.toFixed(0).padStart(5)}% — score ${m.score.toFixed(1).padStart(5)}, ` +
    `vol $${(m.vol / 1e6).toFixed(1)}m, liq $${(m.liq / 1000).toFixed(0)}k, ` +
    `h1 ${m.pctH1.toFixed(1).padStart(6)}%, h6 ${m.pctH6.toFixed(1).padStart(6)}%, ` +
    `buys ${buyPct}%, age ${m.ageH.toFixed(1)}h, pool ${pid}`
  );
}

const out = {
  verdict,
  preGate,
  postGate: survivors.length,
  gateRejections: gateRej,
  srcStatus,
  top20: survivors.slice(0, 20).map((p, i) => ({
    rank: i + 1,
    name: p.attributes?.name,
    network: (p.id || '').split('_')[0],
    poolId: p.id,
    tag: p._meta.tag,
    score: Math.round(p._meta.score * 100) / 100,
    pctH24: Math.round(p._meta.pct * 10) / 10,
    pctH1: Math.round(p._meta.pctH1 * 10) / 10,
    pctH6: Math.round(p._meta.pctH6 * 10) / 10,
    volH24: Math.floor(p._meta.vol),
    liq: Math.floor(p._meta.liq),
    buys: p._meta.buys,
    sells: p._meta.sells,
    ageH: Math.round(p._meta.ageH * 10) / 10,
  })),
};
fs.writeFileSync(path.join(TMPDIR, 'summary.json'), JSON.stringify(out, null, 2));
console.log('\nWrote summary.json');
