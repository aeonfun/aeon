#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CACHE = '/home/runner/work/aeon/aeon/.cache';
const FILES = {
  global: 'runners-global.json',
  'solana-trend': 'runners-solana-trend.json',
  'solana-vol': 'runners-solana-vol.json',
  'eth-trend': 'runners-eth-trend.json',
  'eth-vol': 'runners-eth-vol.json',
  'base-trend': 'runners-base-trend.json',
  'base-vol': 'runners-base-vol.json',
  'bsc-trend': 'runners-bsc-trend.json',
  'bsc-vol': 'runners-bsc-vol.json',
  'arbitrum-trend': 'runners-arbitrum-trend.json',
  'arbitrum-vol': 'runners-arbitrum-vol.json',
  new: 'runners-new.json',
};

const sources = {};
const allPools = [];

for (const [name, file] of Object.entries(FILES)) {
  const p = path.join(CACHE, file);
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const j = JSON.parse(raw);
    if (j.status && j.status.error_code) {
      sources[name] = 'fail-' + j.status.error_code;
      continue;
    }
    if (!Array.isArray(j.data)) {
      sources[name] = 'fail-nodata';
      continue;
    }
    sources[name] = 'ok';
    for (const pool of j.data) {
      pool._source = name;
      allPools.push(pool);
    }
  } catch (e) {
    sources[name] = 'fail-' + e.message.slice(0, 40);
  }
}

console.log('SOURCES:', JSON.stringify(sources));
console.log('TOTAL POOLS (with dupes):', allPools.length);

// Dedupe by base_token
const byToken = new Map();
for (const p of allPools) {
  const tokenId = p.relationships?.base_token?.data?.id;
  if (!tokenId) continue;
  const vol = parseFloat(p.attributes?.volume_usd?.h24 || 0);
  const existing = byToken.get(tokenId);
  if (!existing) {
    byToken.set(tokenId, p);
  } else {
    const existingVol = parseFloat(existing.attributes?.volume_usd?.h24 || 0);
    if (vol > existingVol) byToken.set(tokenId, p);
  }
}

const unique = [...byToken.values()];
console.log('UNIQUE POOLS:', unique.length);

// Gate
const rejections = { thinVol: 0, negPct: 0, lowLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0 };
const survivors = [];

for (const p of unique) {
  const a = p.attributes || {};
  const volH24 = parseFloat(a.volume_usd?.h24 || 0);
  const pctH24 = parseFloat(a.price_change_percentage?.h24 || 0);
  const reserve = parseFloat(a.reserve_in_usd || 0);
  const buys = parseInt(a.transactions?.h24?.buys || 0);
  const sells = parseInt(a.transactions?.h24?.sells || 0);
  const created = a.pool_created_at ? new Date(a.pool_created_at).getTime() : 0;
  const ageHr = created ? (Date.now() - created) / 3600000 : 999999;

  if (volH24 < 50000) { rejections.thinVol++; continue; }
  if (pctH24 <= 0) { rejections.negPct++; continue; }
  if (reserve < 10000) { rejections.lowLiq++; continue; }
  if (buys > 0 && sells / Math.max(buys, 1) > 10) { rejections.dumping++; continue; }
  if (sells > 0 && buys / Math.max(sells, 1) > 50) { rejections.honeypot++; continue; }
  if (ageHr < 1 && volH24 < 100000) { rejections.tooNew++; continue; }
  if (pctH24 > 10000) { rejections.rugLike++; continue; }

  survivors.push(p);
}

console.log('REJECTIONS:', JSON.stringify(rejections));
console.log('SURVIVORS:', survivors.length);

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Helper: chain from network rel or id prefix
function chainOf(p) {
  return p.relationships?.network?.data?.id || (p.id ? p.id.split('_')[0] : 'unknown');
}

// Score
for (const p of survivors) {
  const a = p.attributes;
  const pctH24 = parseFloat(a.price_change_percentage?.h24 || 0);
  const volH24 = parseFloat(a.volume_usd?.h24 || 0);
  const reserve = parseFloat(a.reserve_in_usd || 0);
  const pctH1 = parseFloat(a.price_change_percentage?.h1 || 0);
  const buys = parseInt(a.transactions?.h24?.buys || 0);
  const sells = parseInt(a.transactions?.h24?.sells || 0);

  const pct_pts = clamp(pctH24 / 500, 0, 1);
  const vol_pts = clamp(Math.log10(volH24 + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(reserve + 1) / 6, 0, 1);
  const mom_pts = clamp((pctH1 + 50) / 100, 0, 1);
  const skew_pts = (buys + sells) > 0 ? clamp(buys / (buys + sells), 0, 1) : 0.5;

  p._score = 40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts;

  // Tag
  const created = a.pool_created_at ? new Date(a.pool_created_at).getTime() : 0;
  const ageHr = created ? (Date.now() - created) / 3600000 : 999999;
  let tag;
  if (reserve >= 1_000_000 && volH24 >= 1_000_000) tag = 'DEEP-LIQ';
  else if (ageHr <= 48 && volH24 >= 250_000) tag = 'BREAKOUT';
  else if (pctH1 > 2 && pctH24 > 50) tag = 'CONTINUATION';
  else if (pctH1 < -5 && pctH24 > 0) tag = 'REVERSAL';
  else tag = 'MICRO-SPEC';
  p._tag = tag;
  p._ageHr = ageHr;
}

survivors.sort((a, b) => b._score - a._score);
const top5 = survivors.slice(0, 5);

// Build summary
const summary = top5.map((p, i) => {
  const a = p.attributes;
  return {
    rank: i + 1,
    tag: p._tag,
    name: a.name,
    chain: chainOf(p),
    pct_h24: parseFloat(a.price_change_percentage?.h24 || 0),
    pct_h1: parseFloat(a.price_change_percentage?.h1 || 0),
    vol_h24: parseFloat(a.volume_usd?.h24 || 0),
    reserve: parseFloat(a.reserve_in_usd || 0),
    fdv: parseFloat(a.fdv_usd || 0),
    mcap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : null,
    buys: parseInt(a.transactions?.h24?.buys || 0),
    sells: parseInt(a.transactions?.h24?.sells || 0),
    age_hr: p._ageHr,
    score: p._score,
    token_id: p.relationships.base_token.data.id,
  };
});

// Tag distribution
const tagDist = { 'DEEP-LIQ': 0, BREAKOUT: 0, CONTINUATION: 0, REVERSAL: 0, 'MICRO-SPEC': 0 };
for (const s of summary) tagDist[s.tag]++;

let verdict;
if (top5.length < 5) verdict = 'SLEEPY';
else if (tagDist['DEEP-LIQ'] >= 2) verdict = 'STRONG';
else if (tagDist['DEEP-LIQ'] === 1 || tagDist['CONTINUATION'] >= 2) verdict = 'MIXED';
else verdict = 'SPECULATIVE';

// Near-misses (slot 6-10)
const nearMisses = survivors.slice(5, 10).map((p, i) => {
  const a = p.attributes;
  return {
    rank: i + 6,
    tag: p._tag,
    name: a.name,
    chain: chainOf(p),
    pct_h24: parseFloat(a.price_change_percentage?.h24 || 0),
    pct_h1: parseFloat(a.price_change_percentage?.h1 || 0),
    vol_h24: parseFloat(a.volume_usd?.h24 || 0),
    reserve: parseFloat(a.reserve_in_usd || 0),
    fdv: parseFloat(a.fdv_usd || 0),
    score: p._score,
    token_id: p.relationships.base_token.data.id,
  };
});

// All DEEP-LIQ in survivors
const deepLiqAll = survivors.filter(p => p._tag === 'DEEP-LIQ').map(p => {
  const a = p.attributes;
  return {
    name: a.name,
    chain: chainOf(p),
    pct_h24: parseFloat(a.price_change_percentage?.h24 || 0),
    vol_h24: parseFloat(a.volume_usd?.h24 || 0),
    reserve: parseFloat(a.reserve_in_usd || 0),
    score: p._score,
    token_id: p.relationships.base_token.data.id,
  };
});

const out = {
  sources,
  pre_gate: unique.length,
  post_gate: survivors.length,
  rejections,
  tag_dist: tagDist,
  verdict,
  top5: summary,
  nearMisses,
  deepLiqAll,
};

fs.writeFileSync(path.join(CACHE, 'runners-output.json'), JSON.stringify(out, null, 2));
console.log('VERDICT:', verdict);
console.log('TAG DIST:', JSON.stringify(tagDist));
console.log('TOP 5:');
for (const s of summary) {
  console.log(`  ${s.rank}. [${s.tag}] ${s.name} (${s.chain}) +${s.pct_h24.toFixed(0)}% | score ${s.score.toFixed(1)} | vol $${(s.vol_h24/1e6).toFixed(2)}m | liq $${(s.reserve/1e3).toFixed(0)}k | h1 ${s.pct_h1.toFixed(1)}% | age ${s.age_hr.toFixed(1)}h | b:s ${s.buys}:${s.sells}`);
  console.log(`     token_id=${s.token_id}`);
}
console.log('NEAR MISSES:');
for (const s of nearMisses) {
  console.log(`  ${s.rank}. [${s.tag}] ${s.name} (${s.chain}) +${s.pct_h24.toFixed(0)}% | score ${s.score.toFixed(1)} | vol $${(s.vol_h24/1e6).toFixed(2)}m | liq $${(s.reserve/1e3).toFixed(0)}k`);
}
console.log('ALL DEEP-LIQ SURVIVORS:');
for (const s of deepLiqAll) {
  console.log(`  [${s.chain}] ${s.name} +${s.pct_h24.toFixed(0)}% | score ${s.score.toFixed(1)} | vol $${(s.vol_h24/1e6).toFixed(2)}m | liq $${(s.reserve/1e6).toFixed(2)}m | id=${s.token_id}`);
}
