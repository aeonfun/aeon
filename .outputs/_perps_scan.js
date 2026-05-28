#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const CACHE = '/home/runner/work/aeon/aeon/.coinglass-cache';
const TODAY = '2026-05-28';
const TIER1 = new Set(['BTC', 'ETH', 'SOL']);

const manifest = JSON.parse(fs.readFileSync(path.join(CACHE, 'manifest.json'), 'utf8'));
const ASSETS = manifest.asset_list;

// Yesterday's regime + consecutive-day count from prior .outputs/perps-scan.data.json tail
const YDAY = {
  BTC: ['NEUTRAL', 3], ETH: ['NEUTRAL', 3], SOL: ['NEUTRAL', 3],
  HYPE: ['ACCUMULATION', 1], ZEC: ['NEUTRAL', 1], WLD: ['NEUTRAL', 3],
  NEAR: ['NEUTRAL', 3], XRP: ['NEUTRAL', 3], BSB: ['NEUTRAL', 3],
  DOGE: ['NEUTRAL', 3], TON: ['NEUTRAL', 3], SUI: ['NEUTRAL', 3],
  FIL: ['NEUTRAL', 1], DRIFT: ['NEUTRAL', 1], BNB: ['NEUTRAL', 3],
  TAO: ['NEUTRAL', 1], UB: ['NEUTRAL', 3], ESPORTS: ['NEUTRAL', 2],
  ONDO: ['NEUTRAL', 3], MU: ['NEUTRAL', 1], XAU: ['COMPRESSION', 1],
  '1000PEPE': ['NEUTRAL', 1], ADA: ['NEUTRAL', 1], LAB: ['NEUTRAL', 1],
  RENDER: ['NEUTRAL', 2],
};

function load(name) {
  const p = path.join(CACHE, name);
  if (!fs.existsSync(p)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  if (!d.data || !d.data.length) return null;
  return d.data.slice().sort((a, b) => a.time - b.time);
}
const num = (x) => (x === null || x === undefined ? null : parseFloat(x));
const pct = (a, b) => (b === 0 || b === null || a === null ? null : (a - b) / b * 100);
function percentile(vals, q) {
  const v = vals.slice().sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  const pos = (q / 100) * (v.length - 1);
  const lo = Math.floor(pos), hi = Math.min(lo + 1, v.length - 1), frac = pos - lo;
  return v[lo] + (v[hi] - v[lo]) * frac;
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r2 = (x) => (x === null ? null : Math.round(x * 100) / 100);
const r4 = (x) => (x === null ? null : Math.round(x * 10000) / 10000);

function fmtPrice(p) {
  if (p === null) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return '$' + p.toPrecision(4);
}
function fmtUsd(v) {
  if (v === null) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

const metrics = {};
for (const a of ASSETS) {
  const price = load(`price-${a}.json`);
  const oi = load(`oi-${a}.json`);
  const funding = load(`funding-${a}.json`);
  if (!price || !oi || !funding || price.length < 2 || oi.length < 2) {
    metrics[a] = { dropped: true, reason: 'missing price/oi/funding' };
    continue;
  }
  const p1h = load(`price-1h-${a}.json`);
  const liq = load(`liq-${a}.json`);
  const topls = load(`topls-${a}.json`);
  const basis = load(`basis-${a}.json`);
  const taker = load(`taker-${a}.json`);

  const m = { asset: a, tier: TIER1.has(a) ? 1 : 2, dropped: false };
  const closes = price.map((r) => num(r.close));
  const highs = price.map((r) => num(r.high));
  const lows = price.map((r) => num(r.low));
  const vols = price.map((r) => num(r.volume_usd != null ? r.volume_usd : r.volume));
  const n = price.length;

  m.current_price = closes[n - 1];
  m.pct_24h = pct(closes[n - 1], closes[n - 2]);
  m.pct_7d = pct(closes[n - 1], closes[0]);
  const priorVols = vols.slice(0, n - 1);
  m.vol_ratio = priorVols.length ? vols[n - 1] / mean(priorVols) : null;
  const recent = price.slice(Math.max(0, n - 7));
  const rh = Math.max(...recent.map((r) => num(r.high)));
  const rl = Math.min(...recent.map((r) => num(r.low)));
  m.range_7d_pct = rl ? (rh - rl) / rl * 100 : null;
  m.broke_7d_high = closes[n - 1] > Math.max(...highs.slice(0, n - 1));

  const ocl = oi.map((r) => num(r.close));
  m.oi_now = ocl[ocl.length - 1];
  m.oi_24h_pct = pct(ocl[ocl.length - 1], ocl[ocl.length - 2]);
  m.oi_7d_pct = pct(ocl[ocl.length - 1], ocl[0]);

  const fcl = funding.map((r) => num(r.close));
  m.funding_now = fcl[fcl.length - 1];
  m.funding_7d_avg = mean(fcl);
  m.funding_delta = m.funding_now - m.funding_7d_avg;

  if (p1h && p1h.length >= 5) {
    const c1 = p1h.map((r) => num(r.close));
    m.pct_4h = pct(c1[c1.length - 1], c1[c1.length - 5]);
  } else m.pct_4h = null;

  if (liq) {
    const rows = liq.map((r) => {
      const lo = r.aggregated_long_liquidation_usd != null ? r.aggregated_long_liquidation_usd : r.long_liquidation_usd;
      const sh = r.aggregated_short_liquidation_usd != null ? r.aggregated_short_liquidation_usd : r.short_liquidation_usd;
      return [lo != null ? Number(lo) : null, sh != null ? Number(sh) : null];
    });
    const last = rows[rows.length - 1];
    m.long_liqs_24h = last[0];
    m.short_liqs_24h = last[1];
    const totals = rows.map(([l, s]) => (l || 0) + (s || 0));
    m.liq_24h_total = totals[totals.length - 1];
    m.liq_7d_p75 = percentile(totals, 75);
    const shorts = rows.map(([l, s]) => s).filter((s) => s !== null);
    m.short_liqs_7d_p75 = shorts.length ? percentile(shorts, 75) : null;
    m.liqs_4h = m.liq_24h_total * 4 / 24; // approx, no hourly liq feed
    m.liqs_4h_approx = true;
  } else {
    m.long_liqs_24h = m.short_liqs_24h = m.liq_24h_total = null;
    m.liq_7d_p75 = m.short_liqs_7d_p75 = m.liqs_4h = null;
    m.liqs_4h_approx = false;
  }

  if (topls) {
    const tr = topls.map((r) => num(r.top_position_long_short_ratio)).filter((x) => x !== null);
    if (tr.length) {
      m.top_ls_now = tr[tr.length - 1];
      m.top_ls_7d_avg = mean(tr.slice(Math.max(0, tr.length - 7)));
      m.top_ls_delta_7d = tr[tr.length - 1] - tr[0];
    } else { m.top_ls_now = m.top_ls_7d_avg = m.top_ls_delta_7d = null; }
  } else { m.top_ls_now = m.top_ls_7d_avg = m.top_ls_delta_7d = null; }

  if (basis) {
    const bc = basis.map((r) => num(r.close_basis)).filter((x) => x !== null);
    if (bc.length) {
      m.basis_now = bc[bc.length - 1];
      m.basis_7d_avg = mean(bc.slice(Math.max(0, bc.length - 7)));
    } else { m.basis_now = m.basis_7d_avg = null; }
  } else { m.basis_now = m.basis_7d_avg = null; }

  if (taker) {
    const tk = taker[taker.length - 1];
    const bv = num(tk.taker_buy_volume_usd) || 0;
    const sv = num(tk.taker_sell_volume_usd) || 0;
    m.taker_buy_pct_24h = (bv + sv) ? bv / (bv + sv) * 100 : null;
  } else m.taker_buy_pct_24h = null;

  metrics[a] = m;
}

const btc = metrics.BTC;
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  if (m.dropped) continue;
  if (btc && !btc.dropped) {
    m.pct_24h_vs_btc = (m.pct_24h !== null && btc.pct_24h !== null) ? m.pct_24h - btc.pct_24h : null;
    m.pct_7d_vs_btc = (m.pct_7d !== null && btc.pct_7d !== null) ? m.pct_7d - btc.pct_7d : null;
  } else { m.pct_24h_vs_btc = m.pct_7d_vs_btc = null; }
}

function thresholds(tier) {
  return tier === 1
    ? { breakout: 8, squeeze: 5, mom: 8, comp: 3, dist: 0.06, cap_dd: -6, cap_oi: -8 }
    : { breakout: 20, squeeze: 10, mom: 15, comp: 5, dist: 0.08, cap_dd: -10, cap_oi: -10 };
}

function classify(m) {
  const t = thresholds(m.tier);
  const { funding_now: f, funding_7d_avg: fa, pct_24h: p24, pct_7d: p7, oi_24h_pct: oi24, oi_7d_pct: oi7,
    range_7d_pct: rng, vol_ratio: vr, taker_buy_pct_24h: tb, liq_24h_total: lt, liq_7d_p75: lp,
    short_liqs_24h: sl, short_liqs_7d_p75: slp } = m;
  if (p24 !== null && p24 <= t.cap_dd && f !== null && f < 0 && oi24 !== null && oi24 <= t.cap_oi && lt !== null && lp !== null && lt >= lp) return 'CAPITULATION';
  if (p24 !== null && p24 > t.squeeze && oi24 !== null && oi24 < 0 && sl !== null && slp !== null && sl >= slp && tb !== null && tb < 52) return 'SHORT-SQUEEZE';
  if (((f !== null && f > t.dist) || (fa !== null && fa > 0.06)) && p24 !== null && p7 !== null && p24 < p7 / 7 && oi24 !== null && oi24 > 5) return 'DISTRIBUTION';
  if (((p24 !== null && p24 > t.breakout) || m.broke_7d_high) && vr !== null && vr > 2.0 && oi24 !== null && oi24 > 10 && tb !== null && tb > 52) return 'CATALYST-BREAKOUT';
  if (oi7 !== null && oi7 > 10 && fa !== null && Math.abs(fa) < 0.04 && p7 !== null && p7 > 0 && rng !== null && rng < 25) return 'ACCUMULATION';
  if (p7 !== null && p7 > t.mom && oi24 !== null && oi24 >= 0 && f !== null && f > 0.03 && f <= 0.07) return 'MOMENTUM';
  if (rng !== null && rng < t.comp && oi7 !== null && oi7 > 5 && f !== null && Math.abs(f) < 0.02 && p24 !== null && Math.abs(p24) < 2) return 'COMPRESSION';
  return 'NEUTRAL';
}

function subtags(m, reg) {
  const tags = [];
  const tb = m.taker_buy_pct_24h;
  if (reg === 'DISTRIBUTION') {
    if (m.top_ls_now !== null && m.top_ls_now > 2.0 && m.basis_now !== null && m.basis_now > 0) tags.push('REAL-CROWDED-LONG');
    if (m.top_ls_now !== null && m.top_ls_now < 1.5) tags.push('RETAIL-ANOMALY');
    if (m.pct_24h !== null && m.pct_24h < 0 && m.oi_24h_pct !== null && m.oi_24h_pct >= 0) tags.push('LONG-TRAP');
  } else if (reg === 'CAPITULATION') {
    if (m.liqs_4h !== null && m.liq_24h_total) {
      const r = m.liqs_4h / m.liq_24h_total;
      if (r > 0.4) tags.push('IN-PROGRESS'); else if (r < 0.15) tags.push('CLEARED');
    }
  } else if (reg === 'COMPRESSION') {
    if (m.vol_ratio !== null && m.vol_ratio > 1.0) tags.push('ACTIVE');
    else if (m.vol_ratio !== null && m.vol_ratio < 0.9) tags.push('QUIET');
  } else if (reg === 'ACCUMULATION') {
    if (tb !== null && tb > 50 && m.top_ls_delta_7d !== null && m.top_ls_delta_7d > 0) tags.push('CONFIRMED');
    else if (tb !== null && tb < 50) tags.push('DIVERGENT');
  } else if (reg === 'CATALYST-BREAKOUT') {
    if (m.pct_4h !== null && m.pct_24h) {
      const r = m.pct_4h / m.pct_24h;
      if (r > 0.5) tags.push('FRESH'); else if (r < 0.2) tags.push('STALE');
    }
  }
  return tags;
}

function patternTags(m, reg) {
  const tags = [];
  const t = thresholds(m.tier);
  const { funding_now: f, top_ls_now: tls, basis_now: basis, pct_24h: p24, oi_24h_pct: oi24,
    oi_7d_pct: oi7, range_7d_pct: rng, funding_delta: fd, taker_buy_pct_24h: tb,
    top_ls_delta_7d: dls, short_liqs_24h: sl, short_liqs_7d_p75: slp } = m;
  const rcl = f !== null && f > t.dist && tls !== null && tls > 2.0 && basis !== null && basis > 0.3;
  if (rcl) tags.push('REAL-CROWDED-LONG');
  else if (f !== null && f > t.dist && tls !== null && tls < 1.5) tags.push('RETAIL-ANOMALY');
  const ltf = (m.tier === 2 && f !== null && f > 0.08) || (m.tier === 1 && f !== null && f > 0.06);
  if (ltf && p24 !== null && p24 < 0 && oi24 !== null && oi24 >= -3) tags.push('LONG-TRAP');
  if (dls !== null && dls > 0.4 && rng !== null && rng < 5 && oi7 !== null && oi7 < 5) tags.push('STEALTH-POSITIONING');
  if (basis !== null && basis > 0.2 && fd !== null && Math.abs(fd) < 0.01 && oi7 !== null && oi7 > 5 && tb !== null && tb > 48 && tb < 52) tags.push('CASH-AND-CARRY');
  if (reg !== 'SHORT-SQUEEZE' && m.tier === 2 && p24 !== null && p24 > 10 && oi24 !== null && oi24 < 0 && sl !== null && slp !== null && sl >= slp) tags.push('SHORT-SQUEEZE');
  return tags;
}

const results = {};
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  if (m.dropped) { results[a] = { dropped: true, reason: m.reason }; continue; }
  const reg = classify(m);
  const st = subtags(m, reg);
  const pt = patternTags(m, reg);
  const [yreg, yrep] = YDAY[a] || [null, 0];
  const repeat = (yreg === reg) ? yrep + 1 : 1;
  results[a] = { asset: a, tier: m.tier, regime: reg, sub_tags: st, pattern_tags: pt, yesterday_regime: yreg, repeat_days: repeat, m };
}

// ---- Report ----
const order = ['CAPITULATION', 'SHORT-SQUEEZE', 'DISTRIBUTION', 'CATALYST-BREAKOUT', 'ACCUMULATION', 'MOMENTUM', 'COMPRESSION', 'NEUTRAL'];
const counts = {};
for (const a of Object.keys(results)) { if (results[a].dropped) continue; const r = results[a].regime; counts[r] = (counts[r] || 0) + 1; }
console.log('=== COUNTS ===');
console.log(JSON.stringify(counts));
const dropped = Object.keys(results).filter((a) => results[a].dropped);
console.log('assessed=' + Object.keys(results).filter((a) => !results[a].dropped).length + ' dropped=' + JSON.stringify(dropped));
console.log('\n=== PER-ASSET ===');
const g = (m, k, nd) => { const v = m[k]; return v === null || v === undefined ? 'NA' : (nd === 0 ? Math.round(v) : (Math.round(v * 10 ** nd) / 10 ** nd)); };
for (const reg of order) {
  for (const a of Object.keys(results)) {
    const r = results[a];
    if (r.dropped || r.regime !== reg) continue;
    const m = r.m;
    console.log(`${reg.padEnd(16)} ${a.padEnd(9)} T${r.tier} | 24h=${g(m, 'pct_24h', 2)} 7d=${g(m, 'pct_7d', 2)} 4h=${g(m, 'pct_4h', 2)} oi24=${g(m, 'oi_24h_pct', 2)} oi7=${g(m, 'oi_7d_pct', 2)} rng=${g(m, 'range_7d_pct', 2)} vr=${g(m, 'vol_ratio', 2)} fnow=${g(m, 'funding_now', 4)} favg=${g(m, 'funding_7d_avg', 4)} fd=${g(m, 'funding_delta', 4)} tls=${g(m, 'top_ls_now', 2)} dls=${g(m, 'top_ls_delta_7d', 2)} tb=${g(m, 'taker_buy_pct_24h', 2)} basis=${g(m, 'basis_now', 4)} liqT=${fmtUsd(m.liq_24h_total)} liqP75=${fmtUsd(m.liq_7d_p75)} sl=${fmtUsd(m.short_liqs_24h)} slP75=${fmtUsd(m.short_liqs_7d_p75)} | sub=[${r.sub_tags}] pat=[${r.pattern_tags}] y=${r.yesterday_regime} rep=${r.repeat_days}`);
  }
}

// notable NEUTRAL (watch candidates): big oi_7d, funding extremes, deep negative funding
console.log('\n=== NEUTRAL NOTABLES (oi_7d>30 OR |funding_now|>0.05 OR oi_24h<-8 OR pct_24h<=-8) ===');
for (const a of Object.keys(results)) {
  const r = results[a];
  if (r.dropped || r.regime !== 'NEUTRAL') continue;
  const m = r.m;
  const notable = (m.oi_7d_pct !== null && m.oi_7d_pct > 30) || (m.funding_now !== null && Math.abs(m.funding_now) > 0.05) || (m.oi_24h_pct !== null && m.oi_24h_pct < -8) || (m.pct_24h !== null && m.pct_24h <= -8) || (m.vol_ratio !== null && m.vol_ratio > 2);
  if (!notable) continue;
  console.log(`${a.padEnd(9)} 24h=${g(m, 'pct_24h', 2)} 7d=${g(m, 'pct_7d', 2)} oi24=${g(m, 'oi_24h_pct', 2)} oi7=${g(m, 'oi_7d_pct', 2)} rng=${g(m, 'range_7d_pct', 2)} vr=${g(m, 'vol_ratio', 2)} fnow=${g(m, 'funding_now', 4)} favg=${g(m, 'funding_7d_avg', 4)} tls=${g(m, 'top_ls_now', 2)} dls=${g(m, 'top_ls_delta_7d', 2)} tb=${g(m, 'taker_buy_pct_24h', 2)} basis=${g(m, 'basis_now', 4)}`);
}

fs.writeFileSync('.outputs/_perps_scan_results.json', JSON.stringify(results, null, 2));
console.log('\nwrote .outputs/_perps_scan_results.json');
