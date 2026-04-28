#!/usr/bin/env node
const fs = require('fs');

const SOURCE_FILES = [
  ['global', '.runners-global.json'],
  ['solana-trend', '.runners-solana-trend.json'],
  ['solana-vol', '.runners-solana-vol.json'],
  ['eth-trend', '.runners-eth-trend.json'],
  ['eth-vol', '.runners-eth-vol.json'],
  ['base-trend', '.runners-base-trend.json'],
  ['base-vol', '.runners-base-vol.json'],
  ['bsc-trend', '.runners-bsc-trend.json'],
  ['bsc-vol', '.runners-bsc-vol.json'],
  ['arbitrum-trend', '.runners-arbitrum-trend.json'],
  ['arbitrum-vol', '.runners-arbitrum-vol.json'],
  ['new', '.runners-new.json'],
];

const sourceStatus = {};
const allPools = [];

for (const [name, path] of SOURCE_FILES) {
  let raw;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (e) {
    sourceStatus[name] = 'fail';
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    sourceStatus[name] = 'fail';
    continue;
  }
  if (parsed.status && parsed.status.error_code) {
    sourceStatus[name] = 'fail';
    continue;
  }
  if (!parsed.data || !Array.isArray(parsed.data)) {
    sourceStatus[name] = 'fail';
    continue;
  }
  sourceStatus[name] = 'ok';
  for (const pool of parsed.data) {
    pool._source = name;
    allPools.push(pool);
  }
}

// Dedupe by base_token id, keep highest h24 volume
const tokenMap = new Map();
for (const p of allPools) {
  const a = p.attributes || {};
  const bt = (((p.relationships || {}).base_token || {}).data || {}).id;
  if (!bt) continue;
  const v = parseFloat(((a.volume_usd || {}).h24) || '0');
  const existing = tokenMap.get(bt);
  if (!existing || v > existing._vol) {
    p._vol = v;
    tokenMap.set(bt, p);
  }
}

const dedupPools = [...tokenMap.values()];

// Gate
const rejections = { thin_vol: 0, neg_pct: 0, low_liq: 0, dumping: 0, honeypot: 0, too_new: 0, rug_like: 0 };
const survivors = [];

const now = Date.now();
for (const p of dedupPools) {
  const a = p.attributes || {};
  const v24 = parseFloat(((a.volume_usd || {}).h24) || '0');
  const pct24 = parseFloat(((a.price_change_percentage || {}).h24) || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const tx24 = ((a.transactions || {}).h24) || {};
  const buys = parseInt(tx24.buys || 0);
  const sells = parseInt(tx24.sells || 0);
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : null;
  const ageMs = created ? (now - created) : null;

  if (v24 < 50000) { rejections.thin_vol++; continue; }
  if (pct24 <= 0) { rejections.neg_pct++; continue; }
  if (liq < 10000) { rejections.low_liq++; continue; }
  if (buys > 0 && sells / Math.max(buys, 1) > 10) { rejections.dumping++; continue; }
  if (sells > 0 && buys / Math.max(sells, 1) > 50) { rejections.honeypot++; continue; }
  if (ageMs !== null && ageMs < 3600 * 1000 && v24 < 100000) { rejections.too_new++; continue; }
  if (pct24 > 10000) { rejections.rug_like++; continue; }
  survivors.push(p);
}

// Score
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const log10 = Math.log10;

for (const p of survivors) {
  const a = p.attributes;
  const pct24 = parseFloat(((a.price_change_percentage || {}).h24) || '0');
  const v24 = parseFloat(((a.volume_usd || {}).h24) || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const pct1 = parseFloat(((a.price_change_percentage || {}).h1) || '0');
  const tx24 = ((a.transactions || {}).h24) || {};
  const buys = parseInt(tx24.buys || 0);
  const sells = parseInt(tx24.sells || 0);

  const pct_pts = clamp(pct24 / 500, 0, 1);
  const vol_pts = clamp(log10(v24 + 1) / 7, 0, 1);
  const liq_pts = clamp(log10(liq + 1) / 6, 0, 1);
  const mom_pts = clamp((pct1 + 50) / 100, 0, 1);
  const skew_pts = (buys + sells) > 0 ? clamp(buys / (buys + sells), 0, 1) : 0.5;

  p._score = 40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts;
  p._pct24 = pct24;
  p._pct1 = pct1;
  p._v24 = v24;
  p._liq = liq;
  p._buys = buys;
  p._sells = sells;
}

// Tag
function tagOf(p) {
  const a = p.attributes;
  const v24 = p._v24, liq = p._liq, pct24 = p._pct24, pct1 = p._pct1;
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : null;
  const ageMs = created ? (now - created) : null;

  if (liq >= 1_000_000 && v24 >= 1_000_000) return 'DEEP-LIQ';
  if (ageMs !== null && ageMs < 48 * 3600 * 1000 && v24 >= 250_000) return 'BREAKOUT';
  if (pct1 > 2 && pct24 > 50) return 'CONTINUATION';
  if (pct1 < -5 && pct24 > 0) return 'REVERSAL';
  return 'MICRO-SPEC';
}
for (const p of survivors) p._tag = tagOf(p);

// Sort by score, take top 5
survivors.sort((a, b) => b._score - a._score);
const top5 = survivors.slice(0, 5);

// Verdict
const tagCounts = top5.reduce((m, p) => { m[p._tag] = (m[p._tag] || 0) + 1; return m; }, {});
let verdict;
if (survivors.length < 5) {
  verdict = 'SLEEPY';
} else if ((tagCounts['DEEP-LIQ'] || 0) >= 2) {
  verdict = 'STRONG';
} else if ((tagCounts['DEEP-LIQ'] || 0) >= 1 || (tagCounts['CONTINUATION'] || 0) >= 2) {
  verdict = 'MIXED';
} else {
  verdict = 'SPECULATIVE';
}

// Helpers
function fmtDollar(n) {
  if (!isFinite(n) || n === 0) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtPct(n) {
  if (!isFinite(n)) return '0%';
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) < 10) return `${sign}${n.toFixed(1)}%`;
  return `${sign}${Math.round(n)}%`;
}

const out = {
  sourceStatus,
  preGate: dedupPools.length,
  postGate: survivors.length,
  rejections,
  verdict,
  tagCounts,
  top5: top5.map(p => {
    const a = p.attributes;
    const network = (((p.relationships || {}).network || {}).data || {}).id || p._source.split('-')[0];
    const created = a.pool_created_at;
    const ageH = created ? Math.round((now - Date.parse(created)) / 3600000) : null;
    return {
      tag: p._tag,
      name: a.name,
      network,
      pct24: p._pct24,
      pct1: p._pct1,
      v24: p._v24,
      liq: p._liq,
      mcap: parseFloat(a.market_cap_usd || '0'),
      fdv: parseFloat(a.fdv_usd || '0'),
      buys: p._buys,
      sells: p._sells,
      score: p._score,
      ageH,
      pct24_str: fmtPct(p._pct24),
      pct1_str: fmtPct(p._pct1),
      v24_str: fmtDollar(p._v24),
      liq_str: fmtDollar(p._liq),
      mcap_str: fmtDollar(parseFloat(a.market_cap_usd || '0')),
      fdv_str: fmtDollar(parseFloat(a.fdv_usd || '0')),
    };
  }),
  nearMiss: survivors.slice(5, 8).map(p => ({
    tag: p._tag,
    name: p.attributes.name,
    network: (((p.relationships || {}).network || {}).data || {}).id || p._source.split('-')[0],
    pct24: p._pct24,
    pct1: p._pct1,
    score: p._score,
    v24: p._v24,
    liq: p._liq,
    pct24_str: fmtPct(p._pct24),
    v24_str: fmtDollar(p._v24),
    liq_str: fmtDollar(p._liq),
  })),
};

fs.writeFileSync('.runners-result.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  preGate: out.preGate, postGate: out.postGate, verdict: out.verdict,
  tagCounts: out.tagCounts, rejections: out.rejections,
  top5_summary: out.top5.map(t => `${t.tag} ${t.name} (${t.network}) ${t.pct24_str} score=${t.score.toFixed(1)} v=${t.v24_str} liq=${t.liq_str} h1=${t.pct1_str} buys/sells=${t.buys}/${t.sells} ageH=${t.ageH}`),
  nearMiss: out.nearMiss.map(t => `${t.tag} ${t.name} (${t.network}) ${t.pct24_str} score=${t.score.toFixed(1)} v=${t.v24_str} liq=${t.liq_str}`),
  sourceStatus: out.sourceStatus,
}, null, 2));
