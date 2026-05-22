#!/usr/bin/env node
// monitor-runners processor — merges all fetched GeckoTerminal data,
// dedupes by base_token, gates on quality, computes Runner Score, tags,
// and emits the top-5 + verdict + counts.

const fs = require('fs');
const path = require('path');

const OUTDIR = '/home/runner/work/aeon/aeon/.outputs';

const FILES = [
  '_gt-global.json',
  '_gt-new.json',
  '_gt-solana-trend.json', '_gt-solana-vol.json',
  '_gt-eth-trend.json',    '_gt-eth-vol.json',
  '_gt-base-trend.json',   '_gt-base-vol.json',
  '_gt-bsc-trend.json',    '_gt-bsc-vol.json',
  '_gt-arbitrum-trend.json','_gt-arbitrum-vol.json',
];

const sources = {};
const allPools = [];

for (const f of FILES) {
  const p = path.join(OUTDIR, f);
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    sources[f] = 'missing';
    continue;
  }
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    sources[f] = 'parse-fail';
    continue;
  }
  if (obj.status && obj.status.error_code) {
    sources[f] = `err-${obj.status.error_code}`;
    continue;
  }
  const data = Array.isArray(obj.data) ? obj.data : [];
  sources[f] = `ok(${data.length})`;
  for (const pool of data) {
    allPools.push(pool);
  }
}

// Dedupe by base_token id — keep highest h24 volume per token
const byToken = new Map();
let rawCount = allPools.length;
for (const p of allPools) {
  const tok = p.relationships && p.relationships.base_token && p.relationships.base_token.data && p.relationships.base_token.data.id;
  if (!tok) continue;
  const vol = parseFloat((p.attributes && p.attributes.volume_usd && p.attributes.volume_usd.h24) || 0);
  const existing = byToken.get(tok);
  if (!existing) {
    byToken.set(tok, p);
  } else {
    const eVol = parseFloat((existing.attributes && existing.attributes.volume_usd && existing.attributes.volume_usd.h24) || 0);
    if (vol > eVol) byToken.set(tok, p);
  }
}
const deduped = Array.from(byToken.values());

// Quality gate
const rejBreakdown = {
  thinVol: 0, downOrFlat: 0, thinLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0,
};
const nowMs = Date.now();
const passed = [];
for (const p of deduped) {
  const a = p.attributes || {};
  const vol24 = parseFloat((a.volume_usd && a.volume_usd.h24) || 0);
  const pct24 = parseFloat((a.price_change_percentage && a.price_change_percentage.h24) || 0);
  const liq = parseFloat(a.reserve_in_usd || 0);
  const tx = (a.transactions && a.transactions.h24) || {};
  const buys = parseInt(tx.buys || 0, 10);
  const sells = parseInt(tx.sells || 0, 10);
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : null;
  const ageH = created ? (nowMs - created) / 3600000 : 9999;

  if (vol24 < 50000) { rejBreakdown.thinVol++; continue; }
  if (pct24 <= 0)    { rejBreakdown.downOrFlat++; continue; }
  if (liq < 10000)   { rejBreakdown.thinLiq++; continue; }
  if (sells > 0 && buys / Math.max(sells, 1) > 50) { rejBreakdown.honeypot++; continue; }
  if (buys > 0  && sells / Math.max(buys, 1)  > 10) { rejBreakdown.dumping++; continue; }
  if (ageH < 1 && vol24 < 100000) { rejBreakdown.tooNew++; continue; }
  if (pct24 > 10000) { rejBreakdown.rugLike++; continue; }
  passed.push({ p, vol24, pct24, liq, buys, sells, ageH, created });
}

// Score each survivor
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
for (const o of passed) {
  const a = o.p.attributes || {};
  const pct_h1 = parseFloat((a.price_change_percentage && a.price_change_percentage.h1) || 0);
  const pct_h6 = parseFloat((a.price_change_percentage && a.price_change_percentage.h6) || 0);
  const pct_pts  = clamp(o.pct24 / 500, 0, 1);
  const vol_pts  = clamp(Math.log10(o.vol24 + 1) / 7, 0, 1);
  const liq_pts  = clamp(Math.log10(o.liq + 1) / 6, 0, 1);
  const mom_pts  = clamp((pct_h1 + 50) / 100, 0, 1);
  const buys_t = o.buys + o.sells;
  const skew_pts = buys_t > 0 ? clamp(o.buys / buys_t, 0, 1) : 0.5;
  o.score = 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts;
  o.pct_h1 = pct_h1;
  o.pct_h6 = pct_h6;
  o.skew = buys_t > 0 ? o.buys / buys_t : 0.5;
}

// Tags — first match wins
function tagOf(o) {
  if (o.liq >= 1_000_000 && o.vol24 >= 1_000_000) return 'DEEP-LIQ';
  if (o.created && (nowMs - o.created) <= 48*3600*1000 && o.vol24 >= 250_000) return 'BREAKOUT';
  if (o.pct_h1 > 2 && o.pct24 > 50) return 'CONTINUATION';
  if (o.pct_h1 < -5 && o.pct24 > 0) return 'REVERSAL';
  return 'MICRO-SPEC';
}
for (const o of passed) o.tag = tagOf(o);

// Sort by score
passed.sort((x, y) => y.score - x.score);

// Output
const top5 = passed.slice(0, 5);
const deepLiqCount = passed.filter(o => o.tag === 'DEEP-LIQ').length;
const top5DeepLiq = top5.filter(o => o.tag === 'DEEP-LIQ').length;
const top5Continuation = top5.filter(o => o.tag === 'CONTINUATION').length;
let verdict;
if (passed.length < 5)          verdict = 'SLEEPY';
else if (top5DeepLiq >= 2)      verdict = 'STRONG';
else if (top5DeepLiq === 1 || top5Continuation >= 2) verdict = 'MIXED';
else                            verdict = 'SPECULATIVE';

// Compact serialized record per pool
function record(o) {
  const a = o.p.attributes || {};
  let net = o.p.relationships && o.p.relationships.network && o.p.relationships.network.data && o.p.relationships.network.data.id;
  if (!net) {
    // Derive from base_token id prefix (e.g. "solana_xxx")
    const bt = o.p.relationships && o.p.relationships.base_token && o.p.relationships.base_token.data && o.p.relationships.base_token.data.id;
    if (bt && bt.includes('_')) net = bt.split('_')[0];
  }
  return {
    name: a.name,
    chain: net,
    address: o.p.attributes && o.p.attributes.address,
    base_token: o.p.relationships && o.p.relationships.base_token && o.p.relationships.base_token.data && o.p.relationships.base_token.data.id,
    pct_h24: o.pct24,
    pct_h1: o.pct_h1,
    pct_h6: o.pct_h6,
    vol_h24: o.vol24,
    liq: o.liq,
    buys: o.buys,
    sells: o.sells,
    skew: o.skew,
    pool_created_at: a.pool_created_at,
    age_hours: Math.round(o.ageH * 10) / 10,
    market_cap_usd: a.market_cap_usd,
    fdv_usd: a.fdv_usd,
    score: Math.round(o.score * 10) / 10,
    tag: o.tag,
  };
}

const out = {
  generated_at: new Date().toISOString(),
  sources,
  raw_pool_count: rawCount,
  deduped_count: deduped.length,
  passed_count: passed.length,
  rejected: rejBreakdown,
  deep_liq_passed: deepLiqCount,
  verdict,
  top5: top5.map(record),
  top10: passed.slice(0, 10).map(record),
  passed_all: passed.map(record),
};

fs.writeFileSync(path.join(OUTDIR, '_runners-processed.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  sources,
  raw: rawCount,
  deduped: deduped.length,
  passed: passed.length,
  rejected: rejBreakdown,
  deep_liq_passed: deepLiqCount,
  verdict,
  top5: out.top5.map(r => ({tag: r.tag, name: r.name, chain: r.chain, pct: r.pct_h24, score: r.score, vol: r.vol_h24, liq: r.liq, h1: r.pct_h1, h6: r.pct_h6, skew: r.skew, age: r.age_hours})),
  ranks_6_to_15: out.passed_all.slice(5, 15).map(r => ({rank: 0, tag: r.tag, name: r.name, chain: r.chain, score: r.score, pct: r.pct_h24, vol: r.vol_h24, liq: r.liq})),
}, null, 2));
