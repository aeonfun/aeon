#!/usr/bin/env node
const fs = require('fs');

const sources = {
  global: '.runners-global.json',
  'solana-trend': '.runners-solana-trend.json',
  'solana-vol': '.runners-solana-vol.json',
  'eth-trend': '.runners-eth-trend.json',
  'eth-vol': '.runners-eth-vol.json',
  'base-trend': '.runners-base-trend.json',
  'base-vol': '.runners-base-vol.json',
  'bsc-trend': '.runners-bsc-trend.json',
  'bsc-vol': '.runners-bsc-vol.json',
  'arbitrum-trend': '.runners-arbitrum-trend.json',
  'arbitrum-vol': '.runners-arbitrum-vol.json',
  new: '.runners-new.json',
};

const status = {};
const allPools = [];
for (const [k, f] of Object.entries(sources)) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const j = JSON.parse(raw);
    if (j.status && j.status.error_code) {
      status[k] = 'fail';
      continue;
    }
    if (Array.isArray(j.data)) {
      status[k] = 'ok';
      for (const p of j.data) allPools.push(p);
    } else {
      status[k] = 'fail';
    }
  } catch (e) {
    status[k] = 'fail';
  }
}

const byToken = new Map();
for (const p of allPools) {
  const tokId = p.relationships && p.relationships.base_token && p.relationships.base_token.data && p.relationships.base_token.data.id;
  if (!tokId) continue;
  const vh24 = parseFloat(p.attributes.volume_usd && p.attributes.volume_usd.h24 || 0);
  const prev = byToken.get(tokId);
  if (!prev || parseFloat(prev.attributes.volume_usd && prev.attributes.volume_usd.h24 || 0) < vh24) {
    byToken.set(tokId, p);
  }
}

const preGate = byToken.size;

const rejections = { thinVol: 0, negPct: 0, lowLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0 };
const survivors = [];
const now = Date.now();
for (const p of byToken.values()) {
  const a = p.attributes;
  const vh24 = parseFloat(a.volume_usd && a.volume_usd.h24 || 0);
  const ph24 = parseFloat(a.price_change_percentage && a.price_change_percentage.h24 || 0);
  const ph1 = parseFloat(a.price_change_percentage && a.price_change_percentage.h1 || 0);
  const liq = parseFloat(a.reserve_in_usd || 0);
  const tx = a.transactions && a.transactions.h24 || { buys: 0, sells: 0 };
  const buys = parseFloat(tx.buys || 0);
  const sells = parseFloat(tx.sells || 0);
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : null;
  const ageH = created ? (now - created) / 3600000 : null;

  if (vh24 < 50000) { rejections.thinVol++; continue; }
  if (ph24 <= 0) { rejections.negPct++; continue; }
  if (liq < 10000) { rejections.lowLiq++; continue; }
  if (buys > 0 && sells / Math.max(buys, 1) > 10) { rejections.dumping++; continue; }
  if (sells > 0 && buys / Math.max(sells, 1) > 50) { rejections.honeypot++; continue; }
  if (ageH !== null && ageH < 1 && vh24 < 100000) { rejections.tooNew++; continue; }
  if (ph24 > 10000) { rejections.rugLike++; continue; }

  survivors.push({ pool: p, vh24, ph24, ph1, liq, buys, sells, ageH, created });
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
for (const s of survivors) {
  const pct_pts = clamp(s.ph24 / 500, 0, 1);
  const vol_pts = clamp(Math.log10(s.vh24 + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(s.liq + 1) / 6, 0, 1);
  const mom_pts = clamp((s.ph1 + 50) / 100, 0, 1);
  const skew_pts = (s.buys + s.sells) > 0 ? clamp(s.buys / (s.buys + s.sells), 0, 1) : 0.5;
  s.score = 40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts;

  let tag = 'MICRO-SPEC';
  if (s.liq >= 1_000_000 && s.vh24 >= 1_000_000) tag = 'DEEP-LIQ';
  else if (s.created && s.ageH !== null && s.ageH <= 48 && s.vh24 >= 250_000) tag = 'BREAKOUT';
  else if (s.ph1 > 2 && s.ph24 > 50) tag = 'CONTINUATION';
  else if (s.ph1 < -5 && s.ph24 > 0) tag = 'REVERSAL';
  s.tag = tag;
}

survivors.sort((a, b) => b.score - a.score);

const top5 = survivors.slice(0, 5);

const tagCounts = top5.reduce((acc, s) => { acc[s.tag] = (acc[s.tag] || 0) + 1; return acc; }, {});
let verdict;
if (top5.length < 5) verdict = 'SLEEPY';
else if ((tagCounts['DEEP-LIQ'] || 0) >= 2) verdict = 'STRONG';
else if ((tagCounts['DEEP-LIQ'] || 0) === 1 || (tagCounts['CONTINUATION'] || 0) >= 2) verdict = 'MIXED';
else if (((tagCounts['MICRO-SPEC'] || 0) + (tagCounts['BREAKOUT'] || 0)) >= 3) verdict = 'SPECULATIVE';
else verdict = 'MIXED';

function fmtMoney(n) {
  if (n == null || isNaN(n)) return 'n/a';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}b`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(p) {
  if (Math.abs(p) < 10) return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
  return `${p >= 0 ? '+' : ''}${Math.round(p)}%`;
}

const nearMiss = survivors.slice(5, 10);
const deepLiqSurv = survivors.filter(s => s.tag === 'DEEP-LIQ').slice(0, 8);

function chainOf(p) {
  return p.relationships.network && p.relationships.network.data && p.relationships.network.data.id || p.id.split('_')[0];
}

const result = {
  preGate,
  postGate: survivors.length,
  rejections,
  status,
  verdict,
  tagCounts,
  top5: top5.map(s => ({
    name: s.pool.attributes.name,
    chain: chainOf(s.pool),
    base_token_id: s.pool.relationships.base_token.data.id,
    pool_id: s.pool.id,
    score: Math.round(s.score * 10) / 10,
    tag: s.tag,
    vh24: s.vh24, ph24: s.ph24, ph1: s.ph1, liq: s.liq,
    buys: s.buys, sells: s.sells,
    fdv: parseFloat(s.pool.attributes.fdv_usd || 0),
    mcap: s.pool.attributes.market_cap_usd ? parseFloat(s.pool.attributes.market_cap_usd) : null,
    ageH: s.ageH,
    fmtVol: fmtMoney(s.vh24),
    fmtLiq: fmtMoney(s.liq),
    fmtFdv: fmtMoney(parseFloat(s.pool.attributes.fdv_usd || 0)),
    fmtMcap: s.pool.attributes.market_cap_usd && parseFloat(s.pool.attributes.market_cap_usd) > 0 ? fmtMoney(parseFloat(s.pool.attributes.market_cap_usd)) : null,
    fmtH24: fmtPct(s.ph24),
    fmtH1: fmtPct(s.ph1),
  })),
  nearMiss: nearMiss.map(s => ({
    name: s.pool.attributes.name,
    chain: chainOf(s.pool),
    base_token_id: s.pool.relationships.base_token.data.id,
    score: Math.round(s.score * 10) / 10,
    tag: s.tag,
    vh24: s.vh24, ph24: s.ph24, liq: s.liq,
    fmtVol: fmtMoney(s.vh24),
    fmtLiq: fmtMoney(s.liq),
    fmtH24: fmtPct(s.ph24),
  })),
  deepLiqSurv: deepLiqSurv.map(s => ({
    name: s.pool.attributes.name,
    chain: chainOf(s.pool),
    base_token_id: s.pool.relationships.base_token.data.id,
    score: Math.round(s.score * 10) / 10,
    fmtVol: fmtMoney(s.vh24),
    fmtLiq: fmtMoney(s.liq),
    fmtH24: fmtPct(s.ph24),
  })),
};

fs.writeFileSync('.runners-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  preGate, postGate: survivors.length, verdict, tagCounts,
  top5_names: top5.map(s => `[${s.tag}] ${s.pool.attributes.name} (${chainOf(s.pool)}) ${fmtPct(s.ph24)} score=${Math.round(s.score*10)/10} liq=${fmtMoney(s.liq)} vol=${fmtMoney(s.vh24)} h1=${fmtPct(s.ph1)} buys=${s.buys} sells=${s.sells} age=${s.ageH ? s.ageH.toFixed(1) + 'h' : 'n/a'}`),
  rejections, status,
  deepLiq_count: deepLiqSurv.length,
  deepLiq_list: deepLiqSurv.map(s => `${s.pool.attributes.name} (${chainOf(s.pool)}) ${fmtPct(s.ph24)} score=${Math.round(s.score*10)/10} liq=${fmtMoney(s.liq)} vol=${fmtMoney(s.vh24)}`),
  nearMiss_top: nearMiss.slice(0, 5).map(s => `${s.pool.attributes.name} (${chainOf(s.pool)}) ${fmtPct(s.ph24)} score=${Math.round(s.score*10)/10} tag=${s.tag} liq=${fmtMoney(s.liq)} vol=${fmtMoney(s.vh24)}`),
}, null, 2));
