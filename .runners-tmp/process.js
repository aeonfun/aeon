#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SOURCES = [
  'global', 'new',
  'solana-trend', 'solana-vol',
  'eth-trend', 'eth-vol',
  'base-trend', 'base-vol',
  'bsc-trend', 'bsc-vol',
  'arbitrum-trend', 'arbitrum-vol',
];

const TMP = '.runners-tmp';

function readSource(name) {
  const fp = path.join(TMP, name + '.json');
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw);
    if (data.status && data.status.error_code) return { ok: false, pools: [] };
    if (!Array.isArray(data.data)) return { ok: false, pools: [] };
    return { ok: true, pools: data.data };
  } catch (e) {
    return { ok: false, pools: [] };
  }
}

const sourceStatus = {};
const allPools = [];
for (const src of SOURCES) {
  const r = readSource(src);
  sourceStatus[src] = r.ok ? 'ok' : 'fail';
  for (const p of r.pools) allPools.push({ ...p, _source: src });
}

const num = (x) => {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return x;
  const n = parseFloat(x);
  return isNaN(n) ? null : n;
};

function tokenId(p) {
  try {
    return p.relationships.base_token.data.id;
  } catch (e) {
    return p.id;
  }
}

function networkId(p) {
  try {
    if (p.relationships && p.relationships.network && p.relationships.network.data && p.relationships.network.data.id) {
      return p.relationships.network.data.id;
    }
  } catch (e) {}
  if (p.id && typeof p.id === 'string' && p.id.includes('_')) {
    return p.id.split('_')[0];
  }
  return 'unknown';
}

function poolAge(p) {
  try {
    const created = p.attributes.pool_created_at;
    if (!created) return null;
    const ms = Date.now() - new Date(created).getTime();
    return ms / 3600000;
  } catch (e) {
    return null;
  }
}

const byToken = new Map();
for (const p of allPools) {
  const tid = tokenId(p);
  const a = p.attributes;
  const vh24 = num(a.volume_usd && a.volume_usd.h24) || 0;
  const existing = byToken.get(tid);
  if (!existing) {
    byToken.set(tid, p);
  } else {
    const eVh24 = num(existing.attributes.volume_usd && existing.attributes.volume_usd.h24) || 0;
    if (vh24 > eVh24) byToken.set(tid, p);
  }
}

const preGate = byToken.size;

const rejections = { thinVol: 0, negPct: 0, lowLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0 };
const survivors = [];

for (const p of byToken.values()) {
  const a = p.attributes;
  const vh24 = num(a.volume_usd && a.volume_usd.h24) || 0;
  const pch24 = num(a.price_change_percentage && a.price_change_percentage.h24);
  const reserve = num(a.reserve_in_usd) || 0;
  const buys = num(a.transactions && a.transactions.h24 && a.transactions.h24.buys) || 0;
  const sells = num(a.transactions && a.transactions.h24 && a.transactions.h24.sells) || 0;
  const age = poolAge(p);

  if (vh24 < 50000) { rejections.thinVol++; continue; }
  if (pch24 === null || pch24 <= 0) { rejections.negPct++; continue; }
  if (reserve < 10000) { rejections.lowLiq++; continue; }
  if (buys > 0 && sells / buys > 10) { rejections.dumping++; continue; }
  if (sells > 0 && buys / sells > 50) { rejections.honeypot++; continue; }
  if (age !== null && age < 1 && vh24 < 100000) { rejections.tooNew++; continue; }
  if (pch24 > 10000) { rejections.rugLike++; continue; }

  survivors.push(p);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const scored = survivors.map(p => {
  const a = p.attributes;
  const pch24 = num(a.price_change_percentage.h24);
  const pch1h = num(a.price_change_percentage.h1) || 0;
  const vh24 = num(a.volume_usd.h24) || 0;
  const reserve = num(a.reserve_in_usd) || 0;
  const buys = num(a.transactions.h24.buys) || 0;
  const sells = num(a.transactions.h24.sells) || 0;
  const age = poolAge(p);

  const pct_pts = clamp(pch24 / 500, 0, 1);
  const vol_pts = clamp(Math.log10(vh24 + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(reserve + 1) / 6, 0, 1);
  const mom_pts = clamp((pch1h + 50) / 100, 0, 1);
  const totalTx = buys + sells;
  const skew_pts = totalTx > 0 ? clamp(buys / totalTx, 0, 1) : 0.5;

  const score = 40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts;

  let tag;
  if (reserve >= 1_000_000 && vh24 >= 1_000_000) tag = 'DEEP-LIQ';
  else if (age !== null && age <= 48 && vh24 >= 250_000) tag = 'BREAKOUT';
  else if (pch1h > 2 && pch24 > 50) tag = 'CONTINUATION';
  else if (pch1h < -5 && pch24 > 0) tag = 'REVERSAL';
  else tag = 'MICRO-SPEC';

  return {
    poolId: p.id,
    tokenId: tokenId(p),
    network: networkId(p),
    name: a.name,
    pch24,
    pch1h,
    vh24,
    reserve,
    fdv: num(a.fdv_usd),
    mcap: num(a.market_cap_usd),
    buys,
    sells,
    age,
    score,
    tag,
    source: p._source,
  };
});

scored.sort((a, b) => b.score - a.score);

const top5 = scored.slice(0, 5);
const deepLiq = scored.filter(s => s.tag === 'DEEP-LIQ');

const tagCounts = { 'DEEP-LIQ': 0, 'BREAKOUT': 0, 'CONTINUATION': 0, 'REVERSAL': 0, 'MICRO-SPEC': 0 };
for (const s of top5) tagCounts[s.tag]++;

let verdict;
if (top5.length < 5) verdict = 'SLEEPY';
else if (tagCounts['DEEP-LIQ'] >= 2) verdict = 'STRONG';
else if (tagCounts['DEEP-LIQ'] === 1 || tagCounts['CONTINUATION'] >= 2) verdict = 'MIXED';
else verdict = 'SPECULATIVE';

const output = {
  sourceStatus,
  preGate,
  postGate: survivors.length,
  rejections,
  top5,
  deepLiq,
  tagCounts,
  verdict,
  totalScored: scored.length,
};

fs.writeFileSync(path.join(TMP, 'result.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  sourceStatus,
  preGate,
  postGate: survivors.length,
  rejections,
  verdict,
  tagCounts,
  top5: top5.map(t => ({
    name: t.name, network: t.network, score: t.score.toFixed(1),
    pch24: t.pch24, pch1h: t.pch1h, vh24: t.vh24, reserve: t.reserve,
    fdv: t.fdv, mcap: t.mcap, buys: t.buys, sells: t.sells, age: t.age,
    tag: t.tag, tokenId: t.tokenId, poolId: t.poolId,
  })),
  deepLiqBelowTop5: deepLiq.filter(d => !top5.some(t => t.poolId === d.poolId)).slice(0, 15).map(t => ({
    name: t.name, network: t.network, score: t.score.toFixed(1),
    pch24: t.pch24, pch1h: t.pch1h, vh24: t.vh24, reserve: t.reserve, tokenId: t.tokenId,
  })),
}, null, 2));
