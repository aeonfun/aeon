#!/usr/bin/env node
// perps-scan v3 compute for 2026-05-28 — fresh from .coinglass-cache (node port).
import fs from 'fs';
import path from 'path';

const CACHE = '/home/runner/work/aeon/aeon/.coinglass-cache';
const OUT = '/home/runner/work/aeon/aeon/.outputs';
const ASSETS = JSON.parse(fs.readFileSync(path.join(CACHE, 'manifest.json'), 'utf8')).asset_list;
const TIER1 = new Set(['BTC', 'ETH', 'SOL']);

// (yesterday_regime_on_05-27, consecutive_days_through_05-27)
const YDAY = {
  BTC: ['NEUTRAL', 3], ETH: ['NEUTRAL', 3], SOL: ['NEUTRAL', 3],
  HYPE: ['ACCUMULATION', 1], ZEC: ['NEUTRAL', 1], XRP: ['NEUTRAL', 3],
  DOGE: ['NEUTRAL', 3], NEAR: ['NEUTRAL', 3], WLD: ['NEUTRAL', 3],
  SUI: ['NEUTRAL', 3], BNB: ['NEUTRAL', 3], XAU: ['COMPRESSION', 1],
  BSB: ['NEUTRAL', 3], ADA: ['NEUTRAL', 1], '1000PEPE': ['NEUTRAL', 1],
  FIL: ['NEUTRAL', 1], UB: ['NEUTRAL', 3], ESPORTS: ['NEUTRAL', 2],
  ONDO: ['NEUTRAL', 3],
  XLM: [null, 0], GUA: [null, 0], BEAT: [null, 0],
  ALLO: [null, 0], BCH: [null, 0], H: [null, 0],
};

function load(name) {
  const p = path.join(CACHE, name);
  if (!fs.existsSync(p)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  const rows = d.data;
  if (!rows || !rows.length) return null;
  return [...rows].sort((a, b) => a.time - b.time);
}
const F = (x) => parseFloat(x);
function pct(a, b) {
  if (b === 0 || b == null || a == null) return null;
  return (a - b) / b * 100.0;
}
function percentile(vals, q) {
  vals = [...vals].sort((a, b) => a - b);
  if (!vals.length) return null;
  if (vals.length === 1) return vals[0];
  const pos = q / 100.0 * (vals.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, vals.length - 1);
  return vals[lo] + (vals[hi] - vals[lo]) * (pos - lo);
}
function fmtPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return '$' + p.toFixed(5);
}
function fmtUsd(v) {
  if (v == null) return '—';
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
  const closes = price.map((r) => F(r.close));
  const highs = price.map((r) => F(r.high));
  const vols = price.map((r) => F(r.volume_usd ?? r.volume ?? 0));
  const n = price.length;

  m.current_price = closes[n - 1];
  m.pct_24h = pct(closes[n - 1], closes[n - 2]);
  m.pct_7d = pct(closes[n - 1], closes[0]);
  const priorVols = n > 1 ? vols.slice(0, -1) : vols;
  const meanPrior = priorVols.length ? priorVols.reduce((s, v) => s + v, 0) / priorVols.length : null;
  m.vol_ratio = meanPrior ? vols[n - 1] / meanPrior : null;
  const recent = n >= 7 ? price.slice(-7) : price;
  const rh = Math.max(...recent.map((r) => F(r.high)));
  const rl = Math.min(...recent.map((r) => F(r.low)));
  m.range_7d_pct = rl ? (rh - rl) / rl * 100.0 : null;
  m.broke_7d_high = n > 1 ? closes[n - 1] > Math.max(...highs.slice(0, -1)) : false;

  const ocl = oi.map((r) => F(r.close));
  m.oi_now = ocl[ocl.length - 1];
  m.oi_24h_pct = pct(ocl[ocl.length - 1], ocl[ocl.length - 2]);
  m.oi_7d_pct = pct(ocl[ocl.length - 1], ocl[0]);

  const fcl = funding.map((r) => F(r.close));
  m.funding_now = fcl[fcl.length - 1];
  m.funding_7d_avg = fcl.reduce((s, v) => s + v, 0) / fcl.length;
  m.funding_delta = m.funding_now - m.funding_7d_avg;

  if (p1h && p1h.length >= 5) {
    const c1 = p1h.map((r) => F(r.close));
    m.pct_4h = pct(c1[c1.length - 1], c1[c1.length - 5]);
  } else m.pct_4h = null;

  if (liq) {
    const rows = liq.map((r) => {
      const lo = r.aggregated_long_liquidation_usd ?? r.long_liquidation_usd;
      const sh = r.aggregated_short_liquidation_usd ?? r.short_liquidation_usd;
      return [lo != null ? F(lo) : null, sh != null ? F(sh) : null];
    });
    const last = rows[rows.length - 1];
    m.long_liqs_24h = last[0];
    m.short_liqs_24h = last[1];
    const totals = rows.map(([l, s]) => (l || 0) + (s || 0));
    m.liq_24h_total = totals[totals.length - 1];
    m.liq_7d_p75 = percentile(totals, 75);
    const shorts = rows.filter(([, s]) => s != null).map(([, s]) => s);
    m.short_liqs_7d_p75 = shorts.length ? percentile(shorts, 75) : null;
    m.liqs_4h = m.liq_24h_total * 4.0 / 24.0;
    m.liqs_4h_approx = true;
  } else {
    m.long_liqs_24h = m.short_liqs_24h = m.liq_24h_total = null;
    m.liq_7d_p75 = m.short_liqs_7d_p75 = m.liqs_4h = null;
    m.liqs_4h_approx = false;
  }

  if (topls) {
    const tr = topls.filter((r) => r.top_position_long_short_ratio != null).map((r) => F(r.top_position_long_short_ratio));
    if (tr.length) {
      m.top_ls_now = tr[tr.length - 1];
      const rt = tr.slice(-7);
      m.top_ls_7d_avg = rt.reduce((s, v) => s + v, 0) / rt.length;
      m.top_ls_delta_7d = tr[tr.length - 1] - tr[0];
    } else m.top_ls_now = m.top_ls_7d_avg = m.top_ls_delta_7d = null;
  } else m.top_ls_now = m.top_ls_7d_avg = m.top_ls_delta_7d = null;

  if (basis) {
    const bc = basis.filter((r) => r.close_basis != null).map((r) => F(r.close_basis));
    if (bc.length) {
      m.basis_now = bc[bc.length - 1];
      const rb = bc.slice(-7);
      m.basis_7d_avg = rb.reduce((s, v) => s + v, 0) / rb.length;
    } else m.basis_now = m.basis_7d_avg = null;
  } else m.basis_now = m.basis_7d_avg = null;

  if (taker) {
    const tk = taker[taker.length - 1];
    const bv = F(tk.taker_buy_volume_usd ?? 0);
    const sv = F(tk.taker_sell_volume_usd ?? 0);
    m.taker_buy_pct_24h = (bv + sv) ? bv / (bv + sv) * 100.0 : null;
  } else m.taker_buy_pct_24h = null;

  metrics[a] = m;
}

const btc = metrics.BTC || {};
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  if (m.dropped) continue;
  if (btc && !btc.dropped) {
    m.pct_24h_vs_btc = (m.pct_24h != null && btc.pct_24h != null) ? m.pct_24h - btc.pct_24h : null;
    m.pct_7d_vs_btc = (m.pct_7d != null && btc.pct_7d != null) ? m.pct_7d - btc.pct_7d : null;
  } else m.pct_24h_vs_btc = m.pct_7d_vs_btc = null;
}

function thresholds(tier) {
  return tier === 1
    ? { breakout: 8, squeeze: 5, mom: 8, comp: 3, dist: 0.06, cap_dd: -6, cap_oi: -8 }
    : { breakout: 20, squeeze: 10, mom: 15, comp: 5, dist: 0.08, cap_dd: -10, cap_oi: -10 };
}

function classify(m) {
  const t = thresholds(m.tier);
  const { funding_now: fNow, funding_7d_avg: fAvg, pct_24h: p24, pct_7d: p7,
    oi_24h_pct: oi24, oi_7d_pct: oi7, range_7d_pct: rng, vol_ratio: vr,
    taker_buy_pct_24h: tb, liq_24h_total: liqT, liq_7d_p75: liqP75,
    short_liqs_24h: sl, short_liqs_7d_p75: slP75 } = m;

  if (p24 != null && p24 <= t.cap_dd && fNow != null && fNow < 0 &&
      oi24 != null && oi24 <= t.cap_oi && liqT != null && liqP75 != null && liqT >= liqP75)
    return 'CAPITULATION';
  if (p24 != null && p24 > t.squeeze && oi24 != null && oi24 < 0 &&
      sl != null && slP75 != null && sl >= slP75 && tb != null && tb < 52)
    return 'SHORT-SQUEEZE';
  if (((fNow != null && fNow > t.dist) || (fAvg != null && fAvg > 0.06)) &&
      p24 != null && p7 != null && p24 < p7 / 7.0 && oi24 != null && oi24 > 5)
    return 'DISTRIBUTION';
  if (((p24 != null && p24 > t.breakout) || m.broke_7d_high) &&
      vr != null && vr > 2.0 && oi24 != null && oi24 > 10 && tb != null && tb > 52)
    return 'CATALYST-BREAKOUT';
  if (oi7 != null && oi7 > 10 && fAvg != null && Math.abs(fAvg) < 0.04 &&
      p7 != null && p7 > 0 && rng != null && rng < 25)
    return 'ACCUMULATION';
  if (p7 != null && p7 > t.mom && oi24 != null && oi24 >= 0 &&
      fNow != null && fNow > 0.03 && fNow <= 0.07)
    return 'MOMENTUM';
  if (rng != null && rng < t.comp && oi7 != null && oi7 > 5 &&
      fNow != null && Math.abs(fNow) < 0.02 && p24 != null && Math.abs(p24) < 2)
    return 'COMPRESSION';
  return 'NEUTRAL';
}

function subtags(m, regime) {
  const tags = [];
  const tb = m.taker_buy_pct_24h;
  if (regime === 'DISTRIBUTION') {
    if (m.top_ls_now != null && m.top_ls_now > 2.0 && m.basis_now != null && m.basis_now > 0) tags.push('REAL-CROWDED-LONG');
    if (m.top_ls_now != null && m.top_ls_now < 1.5) tags.push('RETAIL-ANOMALY');
    if (m.pct_24h != null && m.pct_24h < 0 && m.oi_24h_pct != null && m.oi_24h_pct >= 0) tags.push('LONG-TRAP');
  } else if (regime === 'CAPITULATION') {
    if (m.liqs_4h != null && m.liq_24h_total) {
      const r = m.liqs_4h / m.liq_24h_total;
      if (r > 0.4) tags.push('IN-PROGRESS');
      else if (r < 0.15) tags.push('CLEARED');
    }
  } else if (regime === 'COMPRESSION') {
    if (m.vol_ratio != null && m.vol_ratio > 1.0) tags.push('ACTIVE');
    else if (m.vol_ratio != null && m.vol_ratio < 0.9) tags.push('QUIET');
  } else if (regime === 'ACCUMULATION') {
    if (tb != null && tb > 50 && m.top_ls_delta_7d != null && m.top_ls_delta_7d > 0) tags.push('CONFIRMED');
    else if (tb != null && tb < 50) tags.push('DIVERGENT');
  } else if (regime === 'CATALYST-BREAKOUT') {
    if (m.pct_4h != null && m.pct_24h) {
      const r = m.pct_4h / m.pct_24h;
      if (r > 0.5) tags.push('FRESH');
      else if (r < 0.2) tags.push('STALE');
    }
  }
  return tags;
}

function patternTags(m, regime) {
  const tags = [];
  const t = thresholds(m.tier);
  const { funding_now: fNow, top_ls_now: tls, basis_now: basis, pct_24h: p24,
    oi_24h_pct: oi24, oi_7d_pct: oi7, range_7d_pct: rng, funding_delta: fd,
    taker_buy_pct_24h: tb, top_ls_delta_7d: dls, short_liqs_24h: sl, short_liqs_7d_p75: slP75 } = m;

  const rcl = fNow != null && fNow > t.dist && tls != null && tls > 2.0 && basis != null && basis > 0.3;
  if (rcl) tags.push('REAL-CROWDED-LONG');
  else if (fNow != null && fNow > t.dist && tls != null && tls < 1.5) tags.push('RETAIL-ANOMALY');

  const ltf = (m.tier === 2 && fNow != null && fNow > 0.08) || (m.tier === 1 && fNow != null && fNow > 0.06);
  if (ltf && p24 != null && p24 < 0 && oi24 != null && oi24 >= -3) tags.push('LONG-TRAP');

  if (dls != null && dls > 0.4 && rng != null && rng < 5 && oi7 != null && oi7 < 5) tags.push('STEALTH-POSITIONING');

  if (basis != null && basis > 0.2 && fd != null && Math.abs(fd) < 0.01 && oi7 != null && oi7 > 5 && tb != null && tb > 48 && tb < 52)
    tags.push('CASH-AND-CARRY');

  if (regime !== 'SHORT-SQUEEZE' && m.tier === 2 && p24 != null && p24 > 10 &&
      oi24 != null && oi24 < 0 && sl != null && slP75 != null && sl >= slP75)
    tags.push('SHORT-SQUEEZE');
  return tags;
}

const results = {};
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  if (m.dropped) { results[a] = { dropped: true, reason: m.reason }; continue; }
  const regime = classify(m);
  const st = subtags(m, regime);
  const pt = patternTags(m, regime);
  const [yreg, yrep] = YDAY[a] || [null, 0];
  const repeat_days = (yreg === regime && yreg != null) ? yrep + 1 : 1;
  results[a] = { asset: a, tier: m.tier, regime, sub_tags: st, pattern_tags: pt, yesterday_regime: yreg, repeat_days, m };
}

const cnt = {};
for (const a of Object.keys(results)) {
  if (results[a].dropped) continue;
  cnt[results[a].regime] = (cnt[results[a].regime] || 0) + 1;
}
console.log('=== CLASSIFICATION SUMMARY ===');
console.log(cnt);
const dropped = Object.keys(results).filter((a) => results[a].dropped);
console.log(`assessed=${Object.keys(results).length - dropped.length} dropped=${JSON.stringify(dropped)}`);
console.log();

const order = ['CAPITULATION', 'SHORT-SQUEEZE', 'DISTRIBUTION', 'CATALYST-BREAKOUT', 'ACCUMULATION', 'MOMENTUM', 'COMPRESSION', 'NEUTRAL'];
for (const reg of order) {
  for (const a of Object.keys(results)) {
    const r = results[a];
    if (r.dropped || r.regime !== reg) continue;
    const m = r.m;
    const g = (k, nd = 2) => { const v = m[k]; return v == null ? 'NA' : Number(v.toFixed(nd)); };
    console.log(
      `${reg.padEnd(16)} ${a.padEnd(9)} T${r.tier} | 24h=${g('pct_24h')} 7d=${g('pct_7d')} 4h=${g('pct_4h')} ` +
      `oi24=${g('oi_24h_pct')} oi7=${g('oi_7d_pct')} rng=${g('range_7d_pct')} vr=${g('vol_ratio')} ` +
      `fnow=${g('funding_now', 4)} favg=${g('funding_7d_avg', 4)} fd=${g('funding_delta', 4)} tls=${g('top_ls_now')} dls=${g('top_ls_delta_7d')} ` +
      `tb=${g('taker_buy_pct_24h')} basis=${g('basis_now', 4)} liqT=${fmtUsd(m.liq_24h_total)} liqP75=${fmtUsd(m.liq_7d_p75)} ` +
      `shortL=${fmtUsd(m.short_liqs_24h)} shortP75=${fmtUsd(m.short_liqs_7d_p75)} ` +
      `| sub=${JSON.stringify(r.sub_tags)} pat=${JSON.stringify(r.pattern_tags)} y=${r.yesterday_regime} rep=${r.repeat_days}`
    );
  }
}

fs.writeFileSync(path.join(OUT, '_ps_results_0528.json'), JSON.stringify(results, null, 2));
console.log('\nwrote .outputs/_ps_results_0528.json');
