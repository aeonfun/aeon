#!/usr/bin/env node
// Node.js port of scripts/_perps_scan_compute.py — same outputs, used when
// python3 is not in the Bash allowedTools list. Writes .outputs/_perps_compute.json.
import fs from 'node:fs';
import path from 'node:path';

const CACHE = '.coinglass-cache';
const TIER1 = new Set(['BTC', 'ETH', 'SOL']);

function load(name) {
  const p = path.join(CACHE, name);
  if (!fs.existsSync(p)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return d && typeof d === 'object' ? d.data ?? null : null;
  } catch {
    return null;
  }
}

function fnum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function mean(xs) {
  const ys = xs.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
}

function pctile(xs, q) {
  const ys = xs.filter((v) => v !== null && v !== undefined && Number.isFinite(v)).sort((a, b) => a - b);
  if (!ys.length) return null;
  if (ys.length === 1) return ys[0];
  const pos = q * (ys.length - 1);
  const lo = Math.floor(pos);
  const frac = pos - lo;
  return lo + 1 < ys.length ? ys[lo] + frac * (ys[lo + 1] - ys[lo]) : ys[lo];
}

const manifest = JSON.parse(fs.readFileSync(path.join(CACHE, 'manifest.json'), 'utf8'));
const assets = manifest.asset_list;
const metrics = {};
const dropped = [];

for (const a of assets) {
  const price = load(`price-${a}.json`);
  const oi = load(`oi-${a}.json`);
  const funding = load(`funding-${a}.json`);
  if (!price || price.length < 2 || !oi || oi.length < 2 || !funding) {
    dropped.push(a);
    continue;
  }
  const liq = load(`liq-${a}.json`);
  const topls = load(`topls-${a}.json`);
  const basis = load(`basis-${a}.json`);
  const taker = load(`taker-${a}.json`);
  const p1h = load(`price-1h-${a}.json`);

  const m = { asset: a, tier: TIER1.has(a) ? 1 : 2 };

  const closes = price.map((r) => fnum(r.close));
  const vols = price.map((r) => fnum(r.volume_usd));
  m.current_price = closes.at(-1);
  m.pct_24h = ((closes.at(-1) - closes.at(-2)) / closes.at(-2)) * 100;
  const p7base = closes.length >= 8 ? closes.at(-8) : closes[0];
  m.pct_7d = ((closes.at(-1) - p7base) / p7base) * 100;
  const priorVols = vols.slice(0, -1).filter((v) => v);
  m.vol_ratio = vols.at(-1) && priorVols.length ? vols.at(-1) / mean(priorVols) : null;
  const win = price.length >= 7 ? price.slice(-7) : price;
  const hi = Math.max(...win.map((r) => fnum(r.high)));
  const lo = Math.min(...win.map((r) => fnum(r.low)));
  m.range_7d_pct = ((hi - lo) / lo) * 100;

  const oic = oi.map((r) => fnum(r.close));
  m.oi_now = oic.at(-1);
  m.oi_24h_pct = ((oic.at(-1) - oic.at(-2)) / oic.at(-2)) * 100;
  const oi7base = oic.length >= 8 ? oic.at(-8) : oic[0];
  m.oi_7d_pct = ((oic.at(-1) - oi7base) / oi7base) * 100;

  const fc = funding.map((r) => fnum(r.close));
  m.funding_now = fc.at(-1);
  m.funding_7d_avg = mean(fc);
  m.funding_delta = m.funding_now - m.funding_7d_avg;

  if (liq) {
    const longs = liq.map((r) => fnum(r.aggregated_long_liquidation_usd));
    const shorts = liq.map((r) => fnum(r.aggregated_short_liquidation_usd));
    const totals = longs.map((l, i) => (l || 0) + (shorts[i] || 0));
    m.liq_24h_total = totals.at(-1);
    m.liq_7d_p75 = pctile(totals, 0.75);
    m.long_liqs_24h = longs.at(-1);
    m.short_liqs_24h = shorts.at(-1);
    m.short_liqs_p75 = pctile(shorts, 0.75);
    m.liqs_4h = (totals.at(-1) * 4.0) / 24.0;
    m.liqs_4h_approx = true;
  } else {
    for (const k of ['liq_24h_total', 'liq_7d_p75', 'long_liqs_24h', 'short_liqs_24h', 'short_liqs_p75', 'liqs_4h']) {
      m[k] = null;
    }
  }

  if (topls) {
    const tlr = topls.map((r) => fnum(r.top_position_long_short_ratio));
    m.top_ls_now = tlr.at(-1);
    m.top_ls_7d_avg = mean(tlr.slice(-7));
    m.top_ls_delta_7d = tlr.at(-1) - (tlr.length >= 8 ? tlr.at(-8) : tlr[0]);
  } else {
    m.top_ls_now = m.top_ls_7d_avg = m.top_ls_delta_7d = null;
  }

  if (basis) {
    const bc = basis.map((r) => fnum(r.close_basis));
    m.basis_now = bc.at(-1);
    m.basis_7d_avg = mean(bc.slice(-7));
  } else {
    m.basis_now = m.basis_7d_avg = null;
  }

  if (taker) {
    const tb = fnum(taker.at(-1).taker_buy_volume_usd);
    const ts = fnum(taker.at(-1).taker_sell_volume_usd);
    m.taker_buy_pct_24h = tb !== null && ts !== null && tb + ts ? (tb / (tb + ts)) * 100 : null;
  } else {
    m.taker_buy_pct_24h = null;
  }

  if (p1h && p1h.length >= 5) {
    const c1 = p1h.map((r) => fnum(r.close));
    m.pct_4h = ((c1.at(-1) - c1.at(-5)) / c1.at(-5)) * 100;
  } else {
    m.pct_4h = null;
  }

  metrics[a] = m;
}

const btc = metrics.BTC;
for (const a in metrics) {
  const m = metrics[a];
  if (btc) {
    m.pct_24h_vs_btc = m.pct_24h - btc.pct_24h;
    m.pct_7d_vs_btc = m.pct_7d - btc.pct_7d;
  } else {
    m.pct_24h_vs_btc = m.pct_7d_vs_btc = null;
  }
}

function thr(m) {
  const t1 = m.tier === 1;
  return {
    breakout_pct: t1 ? 8 : 20,
    squeeze_pct: t1 ? 5 : 10,
    mom_7d: t1 ? 8 : 15,
    comp_range: t1 ? 3 : 5,
    dist_funding: t1 ? 0.06 : 0.08,
    cap_drawdown: t1 ? -6 : -10,
    cap_oi: t1 ? -8 : -10,
  };
}

function classify(m) {
  const t = thr(m);
  const { pct_24h: p24, pct_7d: p7, funding_now: fn, funding_7d_avg: fa } = m;
  const { oi_24h_pct: oi24, oi_7d_pct: oi7, vol_ratio: vr, range_7d_pct: rng, taker_buy_pct_24h: tb } = m;
  const { liq_24h_total: liqt, liq_7d_p75: liqp, short_liqs_24h: sl, short_liqs_p75: slp } = m;

  if (p24 <= t.cap_drawdown && fn < 0 && oi24 <= t.cap_oi && liqt !== null && liqp !== null && liqt >= liqp) return 'CAPITULATION';
  if (sl !== null && slp !== null && tb !== null && p24 > t.squeeze_pct && oi24 < 0 && sl >= slp && tb < 52) return 'SHORT-SQUEEZE';
  if ((fn > t.dist_funding || fa > 0.06) && p24 < p7 / 7 && oi24 > 5) return 'DISTRIBUTION';
  if (p24 > t.breakout_pct && vr !== null && vr > 2.0 && oi24 > 10 && tb !== null && tb > 52) return 'CATALYST-BREAKOUT';
  if (oi7 > 10 && Math.abs(fa) < 0.04 && p7 > 0 && rng < 25) return 'ACCUMULATION';
  if (p7 > t.mom_7d && oi24 >= 0 && fn > 0.03 && fn <= 0.07) return 'MOMENTUM';
  if (rng < t.comp_range && oi7 > 5 && Math.abs(fn) < 0.02 && Math.abs(p24) < 2) return 'COMPRESSION';
  return 'NEUTRAL';
}

for (const a in metrics) metrics[a].regime = classify(metrics[a]);

for (const a in metrics) {
  const m = metrics[a];
  const subs = [];
  const r = m.regime;
  if (r === 'DISTRIBUTION') {
    if (m.top_ls_now !== null && m.basis_now !== null && m.top_ls_now > 2.0 && m.basis_now > 0) subs.push('REAL-CROWDED-LONG');
    if (m.top_ls_now !== null && m.top_ls_now < 1.5) subs.push('RETAIL-ANOMALY');
    if (m.pct_24h < 0 && m.oi_24h_pct >= 0) subs.push('LONG-TRAP');
  } else if (r === 'CAPITULATION') {
    if (m.liqs_4h !== null && m.liq_24h_total) {
      const ratio = m.liqs_4h / m.liq_24h_total;
      if (ratio > 0.4) subs.push('IN-PROGRESS');
      else if (ratio < 0.15) subs.push('CLEARED');
    }
  } else if (r === 'COMPRESSION') {
    if (m.vol_ratio !== null) {
      if (m.vol_ratio > 1.0) subs.push('ACTIVE');
      else if (m.vol_ratio < 0.9) subs.push('QUIET');
    }
  } else if (r === 'ACCUMULATION') {
    if (m.taker_buy_pct_24h !== null && m.top_ls_delta_7d !== null && m.taker_buy_pct_24h > 50 && m.top_ls_delta_7d > 0) subs.push('CONFIRMED');
    else if (m.taker_buy_pct_24h !== null && m.taker_buy_pct_24h < 50) subs.push('DIVERGENT');
  } else if (r === 'CATALYST-BREAKOUT') {
    if (m.pct_4h !== null && m.pct_24h) {
      const rr = m.pct_4h / m.pct_24h;
      if (rr > 0.5) subs.push('FRESH');
      else if (rr < 0.2) subs.push('STALE');
    }
  }
  m.sub_tags = subs;
}

for (const a in metrics) {
  const m = metrics[a];
  const t = thr(m);
  const tags = [];
  const fn = m.funding_now;
  const tln = m.top_ls_now;
  const bn = m.basis_now;
  let rcl = false;
  if (fn > t.dist_funding && tln !== null && tln > 2.0 && bn !== null && bn > 0.3) { tags.push('REAL-CROWDED-LONG'); rcl = true; }
  if (!rcl && fn > t.dist_funding && tln !== null && tln < 1.5) tags.push('RETAIL-ANOMALY');
  const lt = m.tier === 1 ? 0.06 : 0.08;
  if (fn > lt && m.pct_24h < 0 && m.oi_24h_pct >= -3) tags.push('LONG-TRAP');
  if (m.top_ls_delta_7d !== null && m.top_ls_delta_7d > 0.4 && m.range_7d_pct < 5 && m.oi_7d_pct < 5) tags.push('STEALTH-POSITIONING');
  if (bn !== null && bn > 0.2 && Math.abs(m.funding_delta) < 0.01 && m.oi_7d_pct > 5 && m.taker_buy_pct_24h !== null && m.taker_buy_pct_24h > 48 && m.taker_buy_pct_24h < 52) tags.push('CASH-AND-CARRY');
  if (m.tier === 2 && m.short_liqs_24h !== null && m.short_liqs_p75 !== null && m.pct_24h > 10 && m.oi_24h_pct < 0 && m.short_liqs_24h >= m.short_liqs_p75 && m.regime !== 'SHORT-SQUEEZE') tags.push('SHORT-SQUEEZE');
  m.pattern_tags = tags;
}

const out = { dropped, metrics };
fs.mkdirSync('.outputs', { recursive: true });
fs.writeFileSync('.outputs/_perps_compute.json', JSON.stringify(out, null, 1));
console.log(`wrote .outputs/_perps_compute.json; dropped=${JSON.stringify(dropped)} assessed=${Object.keys(metrics).length}`);
