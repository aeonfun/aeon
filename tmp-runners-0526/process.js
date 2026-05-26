#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const TMPDIR = path.join('tmp-runners-0526');
const NOW = Date.parse('2026-05-26T08:24:00Z');

const FILES = [
  'global.json',
  'solana-trend.json', 'solana-vol.json',
  'eth-trend.json', 'eth-vol.json',
  'base-trend.json', 'base-vol.json',
  'bsc-trend.json', 'bsc-vol.json',
  'arbitrum-trend.json', 'arbitrum-vol.json',
  'new.json'
];

// Load all pools
const raw = [];
for (const f of FILES) {
  const data = JSON.parse(fs.readFileSync(path.join(TMPDIR, f), 'utf8'));
  if (data && Array.isArray(data.data)) {
    for (const p of data.data) {
      raw.push({...p, _src: f});
    }
  }
}

console.log(`Raw pools: ${raw.length}`);

// Dedupe by base_token id, keep highest h24 volume
const byToken = new Map();
for (const p of raw) {
  const tokenId = p.relationships?.base_token?.data?.id;
  if (!tokenId) continue;
  const vol = parseFloat(p.attributes?.volume_usd?.h24 || '0');
  const existing = byToken.get(tokenId);
  if (!existing || vol > parseFloat(existing.attributes.volume_usd?.h24 || '0')) {
    byToken.set(tokenId, p);
  }
}

const deduped = Array.from(byToken.values());
console.log(`Deduped by base_token: ${deduped.length}`);

// Quality gate
const rejections = {
  'thin-vol': 0,
  'down-no-move': 0,
  'thin-liq': 0,
  'dumping': 0,
  'honeypot': 0,
  'too-new': 0,
  'rug-like': 0
};

const survivors = [];
for (const p of deduped) {
  const a = p.attributes;
  const vol = parseFloat(a.volume_usd?.h24 || '0');
  const pct = parseFloat(a.price_change_percentage?.h24 || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const tx = a.transactions?.h24 || {};
  const buys = tx.buys || 0;
  const sells = tx.sells || 0;
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : 0;
  const ageMs = NOW - created;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (vol < 50000) { rejections['thin-vol']++; continue; }
  if (pct <= 0) { rejections['down-no-move']++; continue; }
  if (liq < 10000) { rejections['thin-liq']++; continue; }
  if (buys > 0 && sells > 0 && sells / buys > 10) { rejections['dumping']++; continue; }
  if (sells > 0 && buys / sells > 50) { rejections['honeypot']++; continue; }
  if (sells === 0 && buys > 50) { rejections['honeypot']++; continue; }
  if (ageHours < 1 && vol < 100000) { rejections['too-new']++; continue; }
  if (pct > 10000) { rejections['rug-like']++; continue; }

  survivors.push(p);
}

console.log('Rejections:', rejections);
console.log(`Survivors: ${survivors.length}`);

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Score
const scored = survivors.map(p => {
  const a = p.attributes;
  const vol = parseFloat(a.volume_usd?.h24 || '0');
  const pct = parseFloat(a.price_change_percentage?.h24 || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const pctH1 = parseFloat(a.price_change_percentage?.h1 || '0');
  const pctH6 = parseFloat(a.price_change_percentage?.h6 || '0');
  const tx = a.transactions?.h24 || {};
  const buys = tx.buys || 0;
  const sells = tx.sells || 0;
  const buyPressure = (buys + sells) > 0 ? buys / (buys + sells) : 0.5;

  const pct_pts = clamp(pct / 500, 0, 1);
  const vol_pts = clamp(Math.log10(vol + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(liq + 1) / 6, 0, 1);
  const mom_pts = clamp((pctH1 + 50) / 100, 0, 1);
  const skew_pts = clamp(buyPressure, 0, 1);

  const score = 40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts;

  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : 0;
  const ageHours = (NOW - created) / (1000 * 60 * 60);

  // Tag (priority order)
  let tag;
  if (liq >= 1_000_000 && vol >= 1_000_000) tag = 'DEEP-LIQ';
  else if (ageHours <= 48 && vol >= 250_000) tag = 'BREAKOUT';
  else if (pctH1 > 2 && pct > 50) tag = 'CONTINUATION';
  else if (pctH1 < -5 && pct > 0) tag = 'REVERSAL';
  else tag = 'MICRO-SPEC';

  return {
    score,
    tag,
    name: a.name,
    network: p.relationships?.network?.data?.id || (p.id || '').split('_')[0],
    base_token: p.relationships?.base_token?.data?.id,
    pool_id: p.id,
    pct_h24: pct,
    pct_h1: pctH1,
    pct_h6: pctH6,
    vol_h24: vol,
    liq,
    buys,
    sells,
    buy_pct: buyPressure,
    age_hours: ageHours,
    pool_created_at: a.pool_created_at,
    src: p._src
  };
});

scored.sort((a, b) => b.score - a.score);

// Top 5 strict base_token
console.log('\n=== TOP 15 STRICT (base_token dedup) ===');
for (let i = 0; i < Math.min(15, scored.length); i++) {
  const r = scored[i];
  console.log(`${(i+1).toString().padStart(2)}. ${r.tag.padEnd(13)} ${r.name.padEnd(40)} ${r.network.padEnd(10)} score=${r.score.toFixed(1)} pct=${r.pct_h24.toFixed(0)}% vol=${(r.vol_h24/1e6).toFixed(2)}m liq=${(r.liq/1e3).toFixed(0)}k h1=${r.pct_h1.toFixed(1)}% h6=${r.pct_h6.toFixed(1)}% buys=${(r.buy_pct*100).toFixed(0)}% age=${r.age_hours.toFixed(1)}h`);
}

// Ticker dedup view
const tickerKey = (name) => (name || '').split('/')[0].trim().toUpperCase();
const seen = new Set();
const tickerTop5 = [];
for (const r of scored) {
  const k = tickerKey(r.name);
  if (seen.has(k)) continue;
  seen.add(k);
  tickerTop5.push(r);
  if (tickerTop5.length >= 5) break;
}

console.log('\n=== TOP 5 TICKER-DEDUP ===');
for (let i = 0; i < tickerTop5.length; i++) {
  const r = tickerTop5[i];
  console.log(`${i+1}. ${r.tag.padEnd(13)} ${r.name.padEnd(40)} ${r.network.padEnd(10)} score=${r.score.toFixed(1)} pct=${r.pct_h24.toFixed(0)}% vol=${(r.vol_h24/1e6).toFixed(2)}m liq=${(r.liq/1e3).toFixed(0)}k h1=${r.pct_h1.toFixed(1)}% h6=${r.pct_h6.toFixed(1)}% buys=${(r.buy_pct*100).toFixed(0)}% age=${r.age_hours.toFixed(1)}h`);
}

// Cluster detection: same ticker, multiple distinct base_tokens
const tickerGroups = {};
for (const r of scored) {
  const k = tickerKey(r.name);
  if (!tickerGroups[k]) tickerGroups[k] = [];
  tickerGroups[k].push(r);
}

console.log('\n=== CLUSTER PATTERNS (>= 2 distinct base_tokens with same ticker in survivor set) ===');
const clusters = [];
for (const [tkr, arr] of Object.entries(tickerGroups)) {
  const tokens = new Set(arr.map(x => x.base_token));
  if (tokens.size >= 2) {
    clusters.push({ ticker: tkr, count: tokens.size, top: arr[0] });
    const networks = new Set(arr.map(x => x.network));
    console.log(`${tkr}: ${tokens.size} distinct contracts across ${[...networks].join('/')} — top score ${arr[0].score.toFixed(1)}`);
  }
}

// Verdict from top 5 ticker-dedup
const tagCounts = { 'DEEP-LIQ': 0, 'BREAKOUT': 0, 'CONTINUATION': 0, 'REVERSAL': 0, 'MICRO-SPEC': 0 };
for (const r of tickerTop5) tagCounts[r.tag]++;
console.log('\n=== TAG COUNTS IN TOP 5 ===', tagCounts);

let verdict;
if (tickerTop5.length < 5) verdict = 'SLEEPY';
else if (tagCounts['DEEP-LIQ'] >= 2) verdict = 'STRONG';
else if (tagCounts['DEEP-LIQ'] >= 1 || tagCounts['CONTINUATION'] >= 2) verdict = 'MIXED';
else verdict = 'SPECULATIVE';

console.log(`\nVERDICT: ${verdict}`);

// Save processed
fs.writeFileSync(path.join(TMPDIR, 'processed.json'), JSON.stringify({
  raw_count: raw.length,
  deduped_count: deduped.length,
  survivors_count: survivors.length,
  rejections,
  scored,
  top5_ticker: tickerTop5,
  top5_strict: scored.slice(0, 5),
  clusters,
  tagCounts,
  verdict
}, null, 2));

console.log(`\nSaved: ${path.join(TMPDIR, 'processed.json')}`);
