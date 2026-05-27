#!/usr/bin/env node
// Compute perps-scan v3 metrics + classifications, write .outputs/perps-scan.data.json

const fs = require("fs");
const path = require("path");

const CACHE = ".coinglass-cache";
const OUTPUTS = ".outputs";
const PRIOR_MD = path.join(OUTPUTS, "perps-scan.md");
const OUT_JSON = path.join(OUTPUTS, "perps-scan.data.json");
const TIER1 = new Set(["BTC", "ETH", "SOL"]);
const REGIME_ORDER = ["ACCUMULATION", "CATALYST-BREAKOUT", "SHORT-SQUEEZE", "MOMENTUM", "COMPRESSION", "DISTRIBUTION", "CAPITULATION"];

function load(name) {
  const p = path.join(CACHE, name);
  if (!fs.existsSync(p)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
  if (d.code !== "0") return null;
  return d.data || null;
}

const fnum = (v) => v === null || v === undefined ? null : (Number.isFinite(+v) ? +v : null);
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

function pctile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const k = (s.length - 1) * (p / 100);
  const f = Math.floor(k);
  const c = Math.min(f + 1, s.length - 1);
  if (f === c) return s[f];
  return s[f] + (s[c] - s[f]) * (k - f);
}

function parseYesterdayTail(mdPath) {
  if (!fs.existsSync(mdPath)) return [{}, {}];
  const text = fs.readFileSync(mdPath, "utf8");
  const regimeMap = {}, repeatMap = {};
  let cur = null;
  const assetRe = /^Asset: (\S+) \| Tier: \d+ \| Regime: (\S+)/;
  const repeatRe = /repeat_days: (-?\d+)/;
  for (const line of text.split("\n")) {
    const m = line.match(assetRe);
    if (m) {
      cur = m[1];
      regimeMap[cur] = m[2];
      repeatMap[cur] = 1;
      continue;
    }
    const r = line.match(repeatRe);
    if (r && cur) repeatMap[cur] = parseInt(r[1], 10);
  }
  return [regimeMap, repeatMap];
}

function compute(asset) {
  const price = load(`price-${asset}.json`);
  const oi = load(`oi-${asset}.json`);
  const funding = load(`funding-${asset}.json`);
  if (!price || !oi || !funding || price.length < 8 || oi.length < 8 || funding.length < 21) return null;

  const liq = load(`liq-${asset}.json`);
  const topls = load(`topls-${asset}.json`);
  const basis = load(`basis-${asset}.json`);
  const taker = load(`taker-${asset}.json`);
  const price1h = load(`price-1h-${asset}.json`);

  const m = { asset };

  const p0 = fnum(price[0].close);
  const p1 = fnum(price[1].close);
  const p7 = price.length > 7 ? fnum(price[7].close) : null;
  m.current_price = p0;
  m.pct_24h = (p0 !== null && p1) ? (p0 - p1) / p1 * 100 : null;
  m.pct_7d = (p0 !== null && p7) ? (p0 - p7) / p7 * 100 : null;
  const vol0 = fnum(price[0].volume_usd);
  const volHist = [];
  for (let i = 1; i < Math.min(8, price.length); i++) {
    const v = fnum(price[i].volume_usd);
    if (v !== null) volHist.push(v);
  }
  const volAvg = mean(volHist);
  m.vol_ratio = vol0 !== null && volAvg ? vol0 / volAvg : null;

  const highs = [], lows = [];
  for (let i = 0; i < Math.min(7, price.length); i++) {
    const h = fnum(price[i].high); if (h !== null) highs.push(h);
    const l = fnum(price[i].low); if (l !== null) lows.push(l);
  }
  m.range_7d_pct = highs.length && lows.length && Math.min(...lows)
    ? (Math.max(...highs) - Math.min(...lows)) / Math.min(...lows) * 100
    : null;

  const oi0 = fnum(oi[0].close), oi1 = fnum(oi[1].close);
  const oi7 = oi.length > 7 ? fnum(oi[7].close) : null;
  m.oi_now = oi0;
  m.oi_24h_pct = oi0 !== null && oi1 ? (oi0 - oi1) / oi1 * 100 : null;
  m.oi_7d_pct = oi0 !== null && oi7 ? (oi0 - oi7) / oi7 * 100 : null;

  const fnow = fnum(funding[0].close);
  const f7 = [];
  for (let i = 0; i < Math.min(21, funding.length); i++) {
    const v = fnum(funding[i].close);
    if (v !== null) f7.push(v);
  }
  m.funding_now = fnow;
  m.funding_7d_avg = mean(f7);
  m.funding_delta = (fnow !== null && m.funding_7d_avg !== null) ? fnow - m.funding_7d_avg : null;

  if (liq && liq.length >= 8) {
    const longNow = fnum(liq[0].aggregated_long_liquidation_usd);
    const shortNow = fnum(liq[0].aggregated_short_liquidation_usd);
    m.long_liqs_24h = longNow;
    m.short_liqs_24h = shortNow;
    m.liq_24h_total = (longNow !== null || shortNow !== null) ? (longNow || 0) + (shortNow || 0) : fnum(liq[0].close);
    const liqHist = [];
    for (let i = 0; i < Math.min(8, liq.length); i++) {
      const lo = fnum(liq[i].aggregated_long_liquidation_usd);
      const sh = fnum(liq[i].aggregated_short_liquidation_usd);
      const tot = (lo || 0) + (sh || 0);
      if (tot) liqHist.push(tot);
    }
    m.liq_7d_p75 = pctile(liqHist, 75);
    const shortHist = [];
    for (let i = 0; i < Math.min(8, liq.length); i++) {
      const v = fnum(liq[i].aggregated_short_liquidation_usd);
      if (v !== null) shortHist.push(v);
    }
    m.short_liqs_7d_p75 = pctile(shortHist, 75);
    m.liqs_4h = m.liq_24h_total ? m.liq_24h_total * (4 / 24) : null;
  } else {
    m.long_liqs_24h = m.short_liqs_24h = m.liq_24h_total = m.liq_7d_p75 = m.short_liqs_7d_p75 = m.liqs_4h = null;
  }

  if (topls && topls.length >= 7) {
    m.top_ls_now = fnum(topls[0].top_position_long_short_ratio);
    const tls7 = [];
    for (let i = 0; i < Math.min(7, topls.length); i++) {
      const v = fnum(topls[i].top_position_long_short_ratio);
      if (v !== null) tls7.push(v);
    }
    m.top_ls_7d_avg = mean(tls7);
    const ls7 = topls.length > 7 ? fnum(topls[7].top_position_long_short_ratio) : null;
    m.top_ls_delta_7d = (ls7 !== null && m.top_ls_now !== null) ? m.top_ls_now - ls7 : null;
  } else {
    m.top_ls_now = m.top_ls_7d_avg = m.top_ls_delta_7d = null;
  }

  if (basis && basis.length >= 7) {
    m.basis_now = fnum(basis[0].close_basis);
    const b7 = [];
    for (let i = 0; i < Math.min(7, basis.length); i++) {
      const v = fnum(basis[i].close_basis);
      if (v !== null) b7.push(v);
    }
    m.basis_7d_avg = mean(b7);
  } else {
    m.basis_now = m.basis_7d_avg = null;
  }

  if (taker && taker.length >= 1) {
    const tb = fnum(taker[0].taker_buy_volume_usd);
    const ts = fnum(taker[0].taker_sell_volume_usd);
    m.taker_buy_pct_24h = (tb !== null && ts !== null && (tb + ts) > 0) ? tb / (tb + ts) * 100 : null;
  } else {
    m.taker_buy_pct_24h = null;
  }

  if (price1h && price1h.length >= 5) {
    const p1h0 = fnum(price1h[0].close);
    const p1h4 = fnum(price1h[4].close);
    m.pct_4h = p1h0 !== null && p1h4 ? (p1h0 - p1h4) / p1h4 * 100 : null;
  } else {
    m.pct_4h = null;
  }

  m.pct_24h_vs_btc = null;
  m.pct_7d_vs_btc = null;
  return m;
}

function thresholds(tier) {
  if (tier === 1) return {
    cat_breakout_pct: 8, short_sq_pct: 5, momentum_7d: 8, compression_range: 3,
    dist_funding: 0.06, cap_dd: -6, cap_oi: -8,
  };
  return {
    cat_breakout_pct: 20, short_sq_pct: 10, momentum_7d: 15, compression_range: 5,
    dist_funding: 0.08, cap_dd: -10, cap_oi: -10,
  };
}

function classify(m, tier) {
  const T = thresholds(tier);
  const sub = [];
  const { pct_24h: p24, pct_7d: p7, pct_4h: p4, oi_24h_pct: o24, oi_7d_pct: o7,
    funding_now: fn, funding_7d_avg: fa, liq_24h_total: lt, liq_7d_p75: lp,
    short_liqs_24h: sl, short_liqs_7d_p75: slp, range_7d_pct: rng,
    top_ls_now: tls, top_ls_delta_7d: tld, basis_now: bn,
    taker_buy_pct_24h: tb, vol_ratio: vr } = m;

  if (p24 !== null && p24 <= T.cap_dd && fn !== null && fn < 0 &&
      o24 !== null && o24 <= T.cap_oi && lt !== null && lp !== null && lt >= lp) {
    if (lt && m.liqs_4h !== null) {
      const r = m.liqs_4h / lt;
      if (r > 0.40) sub.push("IN-PROGRESS");
      else if (r < 0.15) sub.push("CLEARED");
    }
    return ["CAPITULATION", sub];
  }
  if (p24 !== null && p24 > T.short_sq_pct && o24 !== null && o24 < 0 &&
      sl !== null && slp !== null && sl >= slp && tb !== null && tb < 52) {
    return ["SHORT-SQUEEZE", []];
  }
  const fundingTrig = (fn !== null && fn > T.dist_funding) || (fa !== null && fa > 0.06);
  const gainsSlow = (p24 !== null && p7 !== null && p24 < (p7 / 7));
  const oiUp = (o24 !== null && o24 > 5);
  if (fundingTrig && gainsSlow && oiUp) {
    if (tls !== null && tls > 2.0 && bn !== null && bn > 0) sub.push("REAL-CROWDED-LONG");
    if (tls !== null && tls < 1.5) sub.push("RETAIL-ANOMALY");
    if (p24 !== null && p24 < 0 && o24 !== null && o24 >= 0) sub.push("LONG-TRAP");
    return ["DISTRIBUTION", sub];
  }
  if (p24 !== null && p24 > T.cat_breakout_pct && vr !== null && vr > 2.0 &&
      o24 !== null && o24 > 10 && tb !== null && tb > 52) {
    if (p4 !== null && p24 !== null && p24 !== 0) {
      const r = p4 / p24;
      if (r > 0.5) sub.push("FRESH");
      else if (r < 0.2) sub.push("STALE");
    }
    return ["CATALYST-BREAKOUT", sub];
  }
  if (o7 !== null && o7 > 10 && fa !== null && Math.abs(fa) < 0.04 &&
      p7 !== null && p7 > 0 && rng !== null && rng < 25) {
    if (tb !== null && tb > 50 && tld !== null && tld > 0) sub.push("CONFIRMED");
    else if (tb !== null && tb < 50) sub.push("DIVERGENT");
    return ["ACCUMULATION", sub];
  }
  if (p7 !== null && p7 > T.momentum_7d && o24 !== null && o24 >= 0 &&
      fn !== null && fn > 0.03 && fn <= 0.07) {
    return ["MOMENTUM", []];
  }
  if (rng !== null && rng < T.compression_range && o7 !== null && o7 > 5 &&
      fn !== null && Math.abs(fn) < 0.02 && p24 !== null && Math.abs(p24) < 2) {
    if (vr !== null && vr > 1.0) sub.push("ACTIVE");
    else if (vr !== null && vr < 0.9) sub.push("QUIET");
    return ["COMPRESSION", sub];
  }
  return ["NEUTRAL", []];
}

function patternTags(m, tier, regime) {
  const T = thresholds(tier);
  const tags = [];
  const { funding_now: fn, top_ls_now: tls, top_ls_delta_7d: tld, basis_now: bn,
    funding_delta: fd, pct_24h: p24, oi_24h_pct: o24, oi_7d_pct: o7,
    range_7d_pct: rng, taker_buy_pct_24h: tb,
    short_liqs_24h: sl, short_liqs_7d_p75: slp } = m;
  let rcl = false;
  if (fn !== null && fn > T.dist_funding && tls !== null && tls > 2.0 && bn !== null && bn > 0.3) {
    tags.push("REAL-CROWDED-LONG"); rcl = true;
  }
  if (!rcl && fn !== null && fn > T.dist_funding && tls !== null && tls < 1.5) tags.push("RETAIL-ANOMALY");
  const longTrapFunding = (tier === 2 && fn !== null && fn > 0.08) || (tier === 1 && fn !== null && fn > 0.06);
  if (longTrapFunding && p24 !== null && p24 < 0 && o24 !== null && o24 >= -3) tags.push("LONG-TRAP");
  if (tld !== null && tld > 0.4 && rng !== null && rng < 5 && o7 !== null && o7 < 5) tags.push("STEALTH-POSITIONING");
  if (bn !== null && bn > 0.2 && fd !== null && Math.abs(fd) < 0.01 && o7 !== null && o7 > 5 &&
      tb !== null && tb > 48 && tb < 52) tags.push("CASH-AND-CARRY");
  if (regime !== "SHORT-SQUEEZE" && p24 !== null && p24 > 10 && o24 !== null && o24 < 0 &&
      sl !== null && slp !== null && sl >= slp) tags.push("SHORT-SQUEEZE");
  return tags;
}

const fmtMoney = (v) => {
  if (v === null || v === undefined) return "—";
  const av = Math.abs(v);
  if (av >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (av >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (av >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtPrice = (v) => {
  if (v === null || v === undefined) return "—";
  const av = Math.abs(v);
  if (av >= 10000) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  if (av >= 100) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (av >= 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(5)}`;
};

const rnum = (v, p = 2) => v === null || v === undefined ? null : Math.round(v * 10 ** p) / 10 ** p;
const fmtFunding = (v) => v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(4)}%/8h`;
const fmtBasis = (v) => v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`;
const fmtPct = (v, p = 2) => v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(p)}%`;

function buildMetricsLine(a, m, regime) {
  if (regime === "ACCUMULATION") {
    return `OI ${fmtPct(m.oi_7d_pct)} 7d on ${fmtPct(m.pct_7d)} price, funding ${fmtFunding(m.funding_now)} (7d avg ${fmtFunding(m.funding_7d_avg)}), top L/S ${m.top_ls_now.toFixed(2)} (Δ ${fmtPct(m.top_ls_delta_7d)} 7d), range ${m.range_7d_pct.toFixed(2)}%, taker buy ${m.taker_buy_pct_24h.toFixed(2)}%, basis ${fmtBasis(m.basis_now)}`;
  }
  if (regime === "CATALYST-BREAKOUT" || regime === "SHORT-SQUEEZE") {
    return `${fmtPct(m.pct_24h)} 24h on ${fmtPct(m.pct_4h)} 4h, OI ${fmtPct(m.oi_24h_pct)} 24h, vol ${m.vol_ratio.toFixed(2)}x, taker buy ${m.taker_buy_pct_24h.toFixed(2)}%, funding ${fmtFunding(m.funding_now)}`;
  }
  if (regime === "MOMENTUM") {
    return `${fmtPct(m.pct_7d)} 7d, funding ${fmtFunding(m.funding_now)}, OI ${fmtPct(m.oi_24h_pct)} 24h, top L/S ${m.top_ls_now.toFixed(2)}`;
  }
  if (regime === "COMPRESSION") {
    return `range ${m.range_7d_pct.toFixed(2)}% 7d, OI ${fmtPct(m.oi_7d_pct)} 7d, funding ${fmtFunding(m.funding_now)}, vol ${m.vol_ratio.toFixed(2)}x`;
  }
  if (regime === "DISTRIBUTION") {
    return `funding ${fmtFunding(m.funding_now)} (7d avg ${fmtFunding(m.funding_7d_avg)}), OI ${fmtPct(m.oi_24h_pct)} 24h on ${fmtPct(m.pct_24h)} 24h, top L/S ${m.top_ls_now.toFixed(2)}, basis ${fmtBasis(m.basis_now)}`;
  }
  if (regime === "CAPITULATION") {
    return `${fmtPct(m.pct_24h)} 24h on ${fmtPct(m.pct_4h)} 4h, OI ${fmtPct(m.oi_24h_pct)} 24h, liq ${fmtMoney(m.liq_24h_total)} vs 7d p75 ${fmtMoney(m.liq_7d_p75)}, funding ${fmtFunding(m.funding_now)}`;
  }
  return "";
}

function metricsWatchLine(m) {
  const parts = [];
  parts.push(`${fmtPct(m.pct_24h)} 24h`);
  parts.push(`${fmtPct(m.pct_7d)} 7d`);
  parts.push(`OI ${fmtPct(m.oi_24h_pct)} 24h on OI ${fmtPct(m.oi_7d_pct)} 7d`);
  parts.push(`funding ${fmtFunding(m.funding_now)} (7d avg ${fmtFunding(m.funding_7d_avg)}, delta ${fmtFunding(m.funding_delta)})`);
  if (m.taker_buy_pct_24h !== null) parts.push(`taker buy ${m.taker_buy_pct_24h.toFixed(2)}%`);
  parts.push(`liq ${fmtMoney(m.liq_24h_total)} vs 7d p75 ${fmtMoney(m.liq_7d_p75)}`);
  if (m.top_ls_now !== null && m.top_ls_delta_7d !== null) parts.push(`top L/S ${m.top_ls_now.toFixed(2)} (Δ ${fmtPct(m.top_ls_delta_7d)} 7d)`);
  if (m.basis_now !== null) parts.push(`basis ${fmtBasis(m.basis_now)}`);
  if (m.pct_4h !== null) parts.push(`pct_4h ${fmtPct(m.pct_4h)}`);
  if (m.vol_ratio !== null) parts.push(`vol ${m.vol_ratio.toFixed(2)}x`);
  return parts.join(", ");
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(CACHE, "manifest.json"), "utf8"));
  if (!manifest.universe_ok) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({
      date: (manifest.fetched_at || "").slice(0, 10) || "unknown",
      edge_case: "prefetch_failed",
    }, null, 2));
    return 0;
  }
  const assetList = manifest.asset_list;
  const today = manifest.fetched_at.slice(0, 10);
  const [yestRegime, yestRepeat] = parseYesterdayTail(PRIOR_MD);

  const btcM = compute("BTC");
  if (!btcM) { console.error("BTC compute failed"); return 2; }

  const assets = {};
  const dropped = [];
  for (const a of assetList) {
    const m = compute(a);
    if (m === null) { dropped.push(a); continue; }
    if (btcM.pct_24h !== null && m.pct_24h !== null) m.pct_24h_vs_btc = m.pct_24h - btcM.pct_24h;
    if (btcM.pct_7d !== null && m.pct_7d !== null) m.pct_7d_vs_btc = m.pct_7d - btcM.pct_7d;
    assets[a] = m;
  }

  const regimeToday = {}, subToday = {}, patToday = {};
  for (const [a, m] of Object.entries(assets)) {
    const tier = TIER1.has(a) ? 1 : 2;
    const [r, sub] = classify(m, tier);
    regimeToday[a] = r;
    subToday[a] = sub;
    patToday[a] = patternTags(m, tier, r);
  }

  const counts = {};
  for (const r of Object.values(regimeToday)) counts[r] = (counts[r] || 0) + 1;
  const acc = counts.ACCUMULATION || 0, mom = counts.MOMENTUM || 0, dist = counts.DISTRIBUTION || 0,
    cap = counts.CAPITULATION || 0, cat = counts["CATALYST-BREAKOUT"] || 0, comp = counts.COMPRESSION || 0,
    neu = counts.NEUTRAL || 0;
  const total = Object.keys(assets).length;
  const rclCount = Object.keys(patToday).filter(a => patToday[a].includes("REAL-CROWDED-LONG")).length;

  let word;
  if (neu >= 0.8 * total) word = "QUIET";
  else if (cap >= 2) word = "DELEVERAGING";
  else if (dist >= 3 && rclCount >= 3) word = "CROWDED TOPPING";
  else if (dist >= 3) word = "CROWDED LONG";
  else if (cat >= 3) word = "BREAKOUTS ACTIVE";
  else if (mom >= 4) word = "TRENDING";
  else if (comp >= 4) word = "COILING";
  else if ((acc + mom) >= 4 && dist === 0 && cap === 0) word = "LEVERAGE BUILDING";
  else word = "MIXED";

  let regimeChanges = null;
  if (Object.keys(yestRegime).length) {
    regimeChanges = [];
    for (const a of Object.keys(assets)) {
      if (a in yestRegime && yestRegime[a] !== regimeToday[a]) {
        regimeChanges.push({ asset: a, from: yestRegime[a], to: regimeToday[a], note: null });
      } else if (!(a in yestRegime)) {
        regimeChanges.push({ asset: a, from: "(new entrant)", to: regimeToday[a], note: null });
      }
    }
  }

  const repeatDays = {};
  for (const a of Object.keys(assets)) {
    repeatDays[a] = (a in yestRegime && yestRegime[a] === regimeToday[a]) ? (yestRepeat[a] || 1) + 1 : 1;
  }

  const regimesOut = Object.fromEntries(REGIME_ORDER.map(r => [r, []]));
  for (const [a, m] of Object.entries(assets)) {
    const r = regimeToday[a];
    if (r === "NEUTRAL") continue;
    const tier = TIER1.has(a) ? 1 : 2;
    const days = repeatDays[a];
    const marker = days >= 3 ? "star" : "bullet";
    const suffix = days >= 2 ? `(day ${days})` : null;
    const tags = [];
    for (const s of subToday[a]) tags.push({ tag: `${r} · ${s}` });
    for (const p of patToday[a]) tags.push({ tag: p });
    regimesOut[r].push({
      asset: a, tier, marker, repeat_days_suffix: suffix,
      metrics_line: buildMetricsLine(a, m, r), tags,
    });
  }

  const nonzero = [];
  for (const r of REGIME_ORDER) if ((counts[r] || 0) > 0) nonzero.push(`${counts[r]} ${r}`);
  const distSent = nonzero.length ? `${nonzero.join(", ")} across ${total} assessed, ${neu} NEUTRAL.` : `All ${total} assessed sit NEUTRAL.`;

  const accumAssets = Object.keys(regimeToday).filter(a => regimeToday[a] === "ACCUMULATION");
  const capAssets = Object.keys(regimeToday).filter(a => regimeToday[a] === "CAPITULATION");

  // Watch candidates
  const watchCandidates = [];
  for (const [a, m] of Object.entries(assets)) {
    if (regimeToday[a] !== "NEUTRAL") continue;
    const tier = TIER1.has(a) ? 1 : 2;
    const T = thresholds(tier);
    let score = 0; const reasons = [];
    if (m.pct_24h !== null && m.oi_24h_pct !== null && m.pct_24h > T.cat_breakout_pct * 0.6 && m.oi_24h_pct > 5) { score++; reasons.push("cat-breakout-near"); }
    if (m.pct_24h !== null && m.pct_24h > T.short_sq_pct) { score++; reasons.push("squeeze-price-near"); }
    if (m.pct_24h !== null && m.pct_24h <= T.cap_dd) { score++; reasons.push("cap-dd-near"); }
    if (m.pct_7d !== null && m.pct_7d > T.momentum_7d) { score++; reasons.push("momentum-near"); }
    if (m.funding_now !== null && m.funding_now > T.dist_funding * 0.7) { score++; reasons.push("dist-funding-near"); }
    if (m.oi_7d_pct !== null && m.oi_7d_pct > 10 && m.pct_7d !== null && m.pct_7d > 0) { score++; reasons.push("accum-near"); }
    if (score) watchCandidates.push([score, a, m, reasons]);
  }
  watchCandidates.sort((a, b) => b[0] - a[0] || (b[2].oi_7d_pct || 0) - (a[2].oi_7d_pct || 0));

  const watch = [];
  for (const [sc, a, m, reasons] of watchCandidates.slice(0, 5)) {
    const tier = TIER1.has(a) ? 1 : 2;
    const T = thresholds(tier);
    const parts = [];
    if (reasons.includes("cap-dd-near")) {
      const blockers = [];
      if (m.funding_now !== null && m.funding_now >= 0) blockers.push(`funding ${fmtFunding(m.funding_now)} fails the funding < 0 gate`);
      if (m.oi_24h_pct !== null && m.oi_24h_pct > T.cap_oi) blockers.push(`OI ${fmtPct(m.oi_24h_pct)} 24h fails the ${T.cap_oi}% OI gate`);
      if (m.liq_24h_total !== null && m.liq_7d_p75 !== null && m.liq_24h_total < m.liq_7d_p75) {
        const ratio = m.liq_24h_total / m.liq_7d_p75 * 100;
        blockers.push(`liq ${fmtMoney(m.liq_24h_total)} sits at ${ratio.toFixed(0)}% of the 7d p75 flush threshold`);
      }
      if (blockers.length) parts.push(`Pct_24h ${fmtPct(m.pct_24h)} clears the ${T.cap_dd}% drawdown gate, but ${blockers.join(", and ")}.`);
      parts.push("A second leg past the drawdown gate with funding flipping negative fires CAPITULATION.");
    }
    if (reasons.includes("squeeze-price-near")) {
      if (m.oi_24h_pct !== null && m.oi_24h_pct >= 0) parts.push(`Pct_24h ${fmtPct(m.pct_24h)} clears the SHORT-SQUEEZE price gate, but OI ${fmtPct(m.oi_24h_pct)} 24h fails the OI < 0 requirement.`);
      if (m.vol_ratio !== null && m.vol_ratio < 2.0) {
        const gap = 2.0 - m.vol_ratio;
        parts.push(`Vol ${m.vol_ratio.toFixed(2)}x sits ${gap.toFixed(2)}x under the 2.0x CATALYST-BREAKOUT floor.`);
      }
    }
    if (reasons.includes("cat-breakout-near")) {
      const blockers = [];
      if (m.pct_24h !== null && m.pct_24h <= T.cat_breakout_pct) {
        const gap = T.cat_breakout_pct - m.pct_24h;
        blockers.push(`pct_24h ${fmtPct(m.pct_24h)} sits ${gap.toFixed(2)}pp under the Tier ${tier} +${T.cat_breakout_pct}% gate`);
      }
      if (m.vol_ratio !== null && m.vol_ratio <= 2.0) blockers.push(`vol ${m.vol_ratio.toFixed(2)}x sits under the 2.0x floor`);
      if (m.taker_buy_pct_24h !== null && m.taker_buy_pct_24h <= 52) blockers.push(`taker buy ${m.taker_buy_pct_24h.toFixed(2)}% sits under the 52% floor`);
      if (blockers.length) parts.push(`Breakout setup forming with ${blockers.join(", and ")}.`);
    }
    if (reasons.includes("momentum-near")) {
      const bandLow = 0.03, bandHigh = 0.07;
      if (m.funding_now !== null && !(m.funding_now > bandLow && m.funding_now <= bandHigh)) {
        parts.push(`Pct_7d ${fmtPct(m.pct_7d)} clears the trend gate, but funding ${fmtFunding(m.funding_now)} sits outside the +${bandLow.toFixed(2)} to +${bandHigh.toFixed(2)}%/8h band.`);
      }
    }
    if (reasons.includes("dist-funding-near")) {
      if (m.funding_now !== null && m.funding_now <= T.dist_funding) {
        const gap = T.dist_funding - m.funding_now;
        parts.push(`Funding ${fmtFunding(m.funding_now)} sits ${gap.toFixed(4)}pp short of the Tier ${tier} +${T.dist_funding}% DISTRIBUTION trigger.`);
      }
    }
    if (reasons.includes("accum-near")) {
      const blockers = [];
      if (m.range_7d_pct !== null && m.range_7d_pct >= 25) blockers.push(`range ${m.range_7d_pct.toFixed(2)}% over the 25% cap`);
      if (m.funding_7d_avg !== null && Math.abs(m.funding_7d_avg) >= 0.04) blockers.push(`funding 7d avg ${fmtFunding(m.funding_7d_avg)} over the 0.04% band`);
      if (blockers.length) parts.push(`OI ${fmtPct(m.oi_7d_pct)} 7d on ${fmtPct(m.pct_7d)} 7d sits inside the ACCUMULATION OI gate, blocked on ${blockers.join(", and ")}.`);
    }
    if (!parts.length) parts.push("Edge case near regime thresholds with no clean single read.");
    watch.push({ asset: a, metrics_line: metricsWatchLine(m), transition_read: parts.join(" ") });
  }

  // Verdict cycle prose
  const cycleSentences = [];
  if (accumAssets.length) {
    const allDiv = accumAssets.every(a => subToday[a].includes("DIVERGENT"));
    if (allDiv) {
      cycleSentences.push(`${accumAssets.length} ACCUMULATION prints carry the DIVERGENT sub-tag across ${accumAssets.join(", ")}.`);
      cycleSentences.push("Taker buy under 50% on every print means passive OI build, not buyers crossing the spread.");
    } else {
      cycleSentences.push(`${accumAssets.length} ACCUMULATION prints across ${accumAssets.join(", ")}, sub-tags split between DIVERGENT and CONFIRMED.`);
    }
  }
  if (capAssets.length) cycleSentences.push(`CAPITULATION fires on ${capAssets.join(", ")}.`);
  if (!cycleSentences.length) {
    cycleSentences.push("Chop phase holds across the universe.");
    cycleSentences.push("No leverage building, no flush in progress, no narrative coiling into a setup.");
  }
  const cycle = cycleSentences.join(" ");

  const fwdParts = [];
  for (const a of accumAssets) {
    if (subToday[a].includes("DIVERGENT")) fwdParts.push(`${a} ACCUMULATION advances to CONFIRMED if taker buy clears 50% with top L/S rotating up.`);
  }
  for (const [sc, asset_a, ma, rea] of watchCandidates.slice(0, 3)) {
    if (rea.includes("squeeze-price-near") && ma.oi_24h_pct !== null && ma.oi_24h_pct >= 0) fwdParts.push(`${asset_a} SHORT-SQUEEZE fires if OI rolls negative against the price gate already clear.`);
    if (rea.includes("cat-breakout-near")) fwdParts.push(`${asset_a} CATALYST-BREAKOUT fires if vol clears 2.0x with taker buy past 52% on continued pct_24h strength.`);
    if (rea.includes("cap-dd-near")) fwdParts.push(`${asset_a} CAPITULATION fires on a second leg past the drawdown gate with funding flipping negative.`);
  }
  const forward = fwdParts.length ? fwdParts.slice(0, 4).join(" ") : "Watch funding shifts on majors and rotation through the ACCUMULATION OI gate.";

  const neutralSummary = neu ? `Neutral · ${neu} other assets · see artifact tail for full data` : null;

  const tail = [];
  for (const [a, m] of Object.entries(assets)) {
    const tier = TIER1.has(a) ? 1 : 2;
    const ms = {
      price: fmtPrice(m.current_price),
      pct_24h: rnum(m.pct_24h), pct_7d: rnum(m.pct_7d), pct_4h: rnum(m.pct_4h),
      range_7d: m.range_7d_pct !== null ? `${m.range_7d_pct.toFixed(2)}%` : "—",
      pct_24h_vs_btc: rnum(m.pct_24h_vs_btc), pct_7d_vs_btc: rnum(m.pct_7d_vs_btc),
      oi_usd: fmtMoney(m.oi_now), oi_24h_pct: rnum(m.oi_24h_pct), oi_7d_pct: rnum(m.oi_7d_pct),
      funding_now: rnum(m.funding_now, 4), funding_7d_avg: rnum(m.funding_7d_avg, 4),
      funding_delta: rnum(m.funding_delta, 4),
      liq_24h: fmtMoney(m.liq_24h_total), liq_7d_p75: fmtMoney(m.liq_7d_p75),
      long_liqs: fmtMoney(m.long_liqs_24h), short_liqs: fmtMoney(m.short_liqs_24h),
      liqs_4h: fmtMoney(m.liqs_4h),
      top_ls: rnum(m.top_ls_now), top_ls_7d_avg: rnum(m.top_ls_7d_avg),
      top_ls_delta_7d: rnum(m.top_ls_delta_7d),
      basis: rnum(m.basis_now, 4), taker_buy: rnum(m.taker_buy_pct_24h),
    };
    tail.push({
      asset: a, tier, regime: regimeToday[a],
      sub_tags: subToday[a], pattern_tags: patToday[a], metrics: ms,
      yesterday_regime: yestRegime[a] || null,
      repeat_days: repeatDays[a],
    });
  }

  const data = {
    date: today, edge_case: null,
    verdict: { word, distribution: distSent, cycle, forward },
    regime_changes: regimeChanges, regimes: regimesOut, regime_empty_notes: {},
    watch, neutral_summary: neutralSummary, tail,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2));
  console.log(`Wrote ${OUT_JSON} — ${total} assessed, dropped [${dropped.join(", ")}]`);
  console.log(`Counts: ${JSON.stringify(counts)}`);
  console.log(`Verdict: ${word}`);
  return 0;
}

process.exit(main());
