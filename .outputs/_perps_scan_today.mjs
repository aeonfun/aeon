#!/usr/bin/env node
// Perps Scan v3 computation for 2026-05-29 — Node port (Python execution gated).
import fs from "node:fs";
import path from "node:path";

const CACHE = "/home/runner/work/aeon/aeon/.coinglass-cache";
const OUT = "/home/runner/work/aeon/aeon/.outputs/_perps_scan_today.json";

const manifest = JSON.parse(fs.readFileSync(path.join(CACHE, "manifest.json"), "utf8"));
const ASSETS = manifest.asset_list;
const TIER1 = new Set(["BTC", "ETH", "SOL"]);

const load = (name) => {
  const p = path.join(CACHE, name);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
};
const toFloat = (x) => {
  if (x === null || x === undefined) return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
};
const mean = (xs) => {
  const f = xs.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null;
};
const percentile = (xs, p) => {
  const f = xs.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!f.length) return null;
  const k = (f.length - 1) * p;
  const lo = Math.floor(k);
  const hi = Math.min(lo + 1, f.length - 1);
  if (lo === hi) return f[lo];
  return f[lo] + (f[hi] - f[lo]) * (k - lo);
};

let btc_pct_24h = null;
let btc_pct_7d = null;
const asset_metrics = {};

for (const asset of ASSETS) {
  const p = load(`price-${asset}.json`);
  const o = load(`oi-${asset}.json`);
  const f = load(`funding-${asset}.json`);
  if (!p?.data || !o?.data || !f?.data) {
    asset_metrics[asset] = null;
    continue;
  }
  const p1h = load(`price-1h-${asset}.json`);
  const liq = load(`liq-${asset}.json`);
  const tls = load(`topls-${asset}.json`);
  const bas = load(`basis-${asset}.json`);
  const tak = load(`taker-${asset}.json`);

  const p_rows = p.data;
  const o_rows = o.data;
  const f_rows = f.data;

  const price_closes = p_rows.map((r) => toFloat(r.close));
  const price_vols = p_rows.map((r) => toFloat(r.volume_usd));
  const price_highs = p_rows.map((r) => toFloat(r.high));
  const price_lows = p_rows.map((r) => toFloat(r.low));

  const n = price_closes.length;
  const current_price = price_closes[n - 1];
  const pct_24h = price_closes[n - 2] ? (price_closes[n - 1] - price_closes[n - 2]) / price_closes[n - 2] * 100 : null;
  const pct_7d = price_closes[0] ? (price_closes[n - 1] - price_closes[0]) / price_closes[0] * 100 : null;
  const vol_today = price_vols[n - 1];
  const vol_prior_mean = mean(price_vols.slice(0, n - 1));
  const vol_ratio = vol_today && vol_prior_mean ? vol_today / vol_prior_mean : null;

  const last7H = price_highs.slice(-7).filter((x) => x !== null);
  const last7L = price_lows.slice(-7).filter((x) => x !== null);
  let range_7d_pct = null;
  if (last7H.length && last7L.length && Math.min(...last7L) > 0) {
    range_7d_pct = (Math.max(...last7H) - Math.min(...last7L)) / Math.min(...last7L) * 100;
  }

  const oi_closes = o_rows.map((r) => toFloat(r.close));
  const on = oi_closes.length;
  const oi_now = oi_closes[on - 1];
  const oi_24h_pct = oi_closes[on - 2] ? (oi_closes[on - 1] - oi_closes[on - 2]) / oi_closes[on - 2] * 100 : null;
  const oi_7d_pct = oi_closes[0] ? (oi_closes[on - 1] - oi_closes[0]) / oi_closes[0] * 100 : null;

  const fund_closes = f_rows.map((r) => toFloat(r.close));
  const funding_now = fund_closes[fund_closes.length - 1];
  const funding_7d_avg = mean(fund_closes);
  const funding_delta = funding_now !== null && funding_7d_avg !== null ? funding_now - funding_7d_avg : null;

  let pct_4h = null;
  if (p1h?.data?.length >= 5) {
    const ph = p1h.data.map((r) => toFloat(r.close));
    const m = ph.length;
    if (ph[m - 5]) pct_4h = (ph[m - 1] - ph[m - 5]) / ph[m - 5] * 100;
  }

  let long_liqs_24h = null;
  let short_liqs_24h = null;
  let liq_24h_total = null;
  let liq_7d_p75 = null;
  let short_liq_7d_p75 = null;
  let long_liq_7d_p75 = null;
  if (liq?.data?.length) {
    const last = liq.data[liq.data.length - 1];
    long_liqs_24h = toFloat(last.aggregated_long_liquidation_usd);
    short_liqs_24h = toFloat(last.aggregated_short_liquidation_usd);
    if (long_liqs_24h !== null && short_liqs_24h !== null) liq_24h_total = long_liqs_24h + short_liqs_24h;
    const totals = [];
    const shorts = [];
    const longs = [];
    for (const r of liq.data) {
      const l = toFloat(r.aggregated_long_liquidation_usd);
      const s = toFloat(r.aggregated_short_liquidation_usd);
      if (l !== null && s !== null) {
        totals.push(l + s);
        shorts.push(s);
        longs.push(l);
      }
    }
    liq_7d_p75 = percentile(totals, 0.75);
    short_liq_7d_p75 = percentile(shorts, 0.75);
    long_liq_7d_p75 = percentile(longs, 0.75);
  }
  const liqs_4h_est = liq_24h_total !== null ? liq_24h_total * (4 / 24) : null;

  let top_ls_now = null, top_ls_7d_avg = null, top_ls_delta_7d = null;
  if (tls?.data?.length) {
    const t = tls.data.map((r) => toFloat(r.top_position_long_short_ratio));
    top_ls_now = t[t.length - 1];
    top_ls_7d_avg = mean(t);
    if (t[0] !== null && t[t.length - 1] !== null) top_ls_delta_7d = t[t.length - 1] - t[0];
  }

  let basis_now = null, basis_7d_avg = null;
  if (bas?.data?.length) {
    const b = bas.data.map((r) => toFloat(r.close_basis));
    basis_now = b[b.length - 1];
    basis_7d_avg = mean(b);
  }

  let taker_buy_pct_24h = null;
  if (tak?.data?.length) {
    const tk = tak.data[tak.data.length - 1];
    const bv = toFloat(tk.taker_buy_volume_usd);
    const sv = toFloat(tk.taker_sell_volume_usd);
    if (bv !== null && sv !== null && bv + sv > 0) taker_buy_pct_24h = bv / (bv + sv) * 100;
  }

  const m = {
    asset, tier: TIER1.has(asset) ? 1 : 2,
    current_price, pct_24h, pct_7d, pct_4h, vol_ratio, range_7d_pct,
    oi_now, oi_24h_pct, oi_7d_pct,
    funding_now, funding_7d_avg, funding_delta,
    liq_24h_total, liq_7d_p75, long_liqs_24h, short_liqs_24h,
    long_liq_7d_p75, short_liq_7d_p75, liqs_4h: liqs_4h_est,
    top_ls_now, top_ls_7d_avg, top_ls_delta_7d,
    basis_now, basis_7d_avg, taker_buy_pct_24h,
  };
  asset_metrics[asset] = m;
  if (asset === "BTC") { btc_pct_24h = pct_24h; btc_pct_7d = pct_7d; }
}

const classify = (m) => {
  const t = m.tier;
  const breakout = t === 1 ? 8 : 20;
  const squeeze = t === 1 ? 5 : 10;
  const mom_7d = t === 1 ? 8 : 15;
  const comp_range = t === 1 ? 3 : 5;
  const dist_funding = t === 1 ? 0.06 : 0.08;
  const cap_dd = t === 1 ? -6 : -10;
  const cap_oi = t === 1 ? -8 : -10;
  const { pct_24h, pct_7d, funding_now, funding_7d_avg, oi_24h_pct, oi_7d_pct,
          liq_24h_total, liq_7d_p75, short_liqs_24h, short_liq_7d_p75,
          taker_buy_pct_24h: tb, vol_ratio, range_7d_pct } = m;
  // CAP
  if (pct_24h != null && pct_24h <= cap_dd && funding_now != null && funding_now < 0 &&
      oi_24h_pct != null && oi_24h_pct <= cap_oi &&
      liq_24h_total != null && liq_7d_p75 != null && liq_24h_total >= liq_7d_p75) return "CAPITULATION";
  // SHORT-SQUEEZE
  if (pct_24h != null && pct_24h > squeeze && oi_24h_pct != null && oi_24h_pct < 0 &&
      short_liqs_24h != null && short_liq_7d_p75 != null && short_liqs_24h >= short_liq_7d_p75 &&
      tb != null && tb < 52) return "SHORT-SQUEEZE";
  // DIST
  const fcond = (funding_now != null && funding_now > dist_funding) || (funding_7d_avg != null && funding_7d_avg > 0.06);
  if (fcond && pct_24h != null && pct_7d != null && pct_24h < pct_7d / 7 &&
      oi_24h_pct != null && oi_24h_pct > 5) return "DISTRIBUTION";
  // CAT-BREAK
  if (pct_24h != null && pct_24h > breakout && vol_ratio != null && vol_ratio > 2.0 &&
      oi_24h_pct != null && oi_24h_pct > 10 && tb != null && tb > 52) return "CATALYST-BREAKOUT";
  // ACCUM
  if (oi_7d_pct != null && oi_7d_pct > 10 && funding_7d_avg != null && Math.abs(funding_7d_avg) < 0.04 &&
      pct_7d != null && pct_7d > 0 && range_7d_pct != null && range_7d_pct < 25) return "ACCUMULATION";
  // MOM
  if (pct_7d != null && pct_7d > mom_7d && oi_24h_pct != null && oi_24h_pct >= 0 &&
      funding_now != null && funding_now > 0.03 && funding_now <= 0.07) return "MOMENTUM";
  // COMP
  if (range_7d_pct != null && range_7d_pct < comp_range && oi_7d_pct != null && oi_7d_pct > 5 &&
      funding_now != null && Math.abs(funding_now) < 0.02 && pct_24h != null && Math.abs(pct_24h) < 2) return "COMPRESSION";
  return "NEUTRAL";
};

const subTags = (regime, m) => {
  const t = [];
  if (regime === "DISTRIBUTION") {
    if (m.top_ls_now > 2.0 && m.basis_now != null && m.basis_now > 0) t.push("REAL-CROWDED-LONG");
    if (m.top_ls_now < 1.5) t.push("RETAIL-ANOMALY");
    if (m.pct_24h < 0 && m.oi_24h_pct >= 0) t.push("LONG-TRAP");
  }
  if (regime === "CAPITULATION") {
    if (m.liqs_4h && m.liq_24h_total) {
      const r = m.liqs_4h / m.liq_24h_total;
      if (r > 0.4) t.push("IN-PROGRESS");
      else if (r < 0.15) t.push("CLEARED");
    }
  }
  if (regime === "COMPRESSION") {
    if (m.vol_ratio > 1.0) t.push("ACTIVE");
    else if (m.vol_ratio < 0.9) t.push("QUIET");
  }
  if (regime === "ACCUMULATION") {
    if (m.taker_buy_pct_24h > 50 && m.top_ls_delta_7d > 0) t.push("CONFIRMED");
    else if (m.taker_buy_pct_24h < 50) t.push("DIVERGENT");
  }
  if (regime === "CATALYST-BREAKOUT") {
    if (m.pct_4h != null && m.pct_24h) {
      const r = m.pct_4h / m.pct_24h;
      if (r > 0.5) t.push("FRESH");
      else if (r < 0.2) t.push("STALE");
    }
  }
  return t;
};

const patternTags = (regime, m) => {
  const out = [];
  const dist_funding = m.tier === 1 ? 0.06 : 0.08;
  const long_trap = m.tier === 1 ? 0.06 : 0.08;
  const rcl = m.funding_now > dist_funding && m.top_ls_now > 2.0 && m.basis_now != null && m.basis_now > 0.3;
  const ra = m.funding_now > dist_funding && m.top_ls_now < 1.5;
  if (rcl) out.push("REAL-CROWDED-LONG");
  else if (ra) out.push("RETAIL-ANOMALY");
  if (m.funding_now > long_trap && m.pct_24h != null && m.pct_24h < 0 && m.oi_24h_pct >= -3) out.push("LONG-TRAP");
  if (m.top_ls_delta_7d > 0.4 && m.range_7d_pct < 5 && m.oi_7d_pct < 5) out.push("STEALTH-POSITIONING");
  if (m.basis_now > 0.2 && Math.abs(m.funding_delta) < 0.01 && m.oi_7d_pct > 5 && m.taker_buy_pct_24h > 48 && m.taker_buy_pct_24h < 52) out.push("CASH-AND-CARRY");
  if (regime !== "SHORT-SQUEEZE" && m.pct_24h > 10 && m.oi_24h_pct < 0 && m.short_liqs_24h >= m.short_liq_7d_p75) out.push("SHORT-SQUEEZE");
  return out;
};

const regimeCounts = {};
for (const [a, m] of Object.entries(asset_metrics)) {
  if (!m) continue;
  m.pct_24h_vs_btc = (btc_pct_24h != null && m.pct_24h != null) ? m.pct_24h - btc_pct_24h : null;
  m.pct_7d_vs_btc = (btc_pct_7d != null && m.pct_7d != null) ? m.pct_7d - btc_pct_7d : null;
  m.regime = classify(m);
  m.sub_tags = subTags(m.regime, m);
  m.pattern_tags = patternTags(m.regime, m);
  regimeCounts[m.regime] = (regimeCounts[m.regime] || 0) + 1;
}

fs.writeFileSync(OUT, JSON.stringify({ btc_pct_24h, btc_pct_7d, regime_counts: regimeCounts, assets: asset_metrics }, null, 2));
console.log("Wrote", OUT);
console.log("Regime counts:", regimeCounts);
