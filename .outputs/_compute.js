#!/usr/bin/env node
// Compute per-asset perps metrics from .coinglass-cache and emit
// .outputs/perps-scan.metrics.json — mirrors the Python _perps_compute.py.

const fs = require('fs');
const path = require('path');

const ROOT = '/home/runner/work/aeon/aeon';
const CACHE = path.join(ROOT, '.coinglass-cache');
const OUT = path.join(ROOT, '.outputs', 'perps-scan.metrics.json');
const TIER1 = new Set(['BTC', 'ETH', 'SOL']);

function load(name) {
  const p = path.join(CACHE, name);
  if (!fs.existsSync(p)) return null;
  try {
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (doc && typeof doc === 'object' && 'data' in doc) return doc.data;
    if (Array.isArray(doc)) return doc;
    return null;
  } catch {
    return null;
  }
}
function f(x) { if (x === null || x === undefined) return null; const v = Number(x); return Number.isFinite(v) ? v : null; }
function last(s, k='close') { if (!s || !s.length) return null; return f(s[s.length-1][k]); }
function at(s, idx, k='close') { if (!s) return null; const i = idx < 0 ? s.length + idx : idx; if (i < 0 || i >= s.length) return null; return f(s[i][k]); }
function pct(now, prev) { if (now == null || prev == null || prev == 0) return null; return (now - prev) / prev * 100; }
function mean(vs) { const v = vs.filter(x => x != null); if (!v.length) return null; return v.reduce((a,b)=>a+b,0) / v.length; }
function p75(vs) {
  const v = vs.filter(x => x != null).sort((a,b)=>a-b);
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  const rank = 0.75 * (v.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(lo + 1, v.length - 1);
  return v[lo] + (v[hi] - v[lo]) * (rank - lo);
}
function fmtUSD(x) { if (x == null) return null; const a = Math.abs(x); if (a >= 1e9) return `$${(x/1e9).toFixed(2)}B`; if (a >= 1e6) return `$${(x/1e6).toFixed(1)}M`; if (a >= 1e3) return `$${(x/1e3).toFixed(0)}K`; return `$${x.toFixed(0)}`; }
function fmtPrice(x) {
  if (x == null) return null;
  const a = Math.abs(x);
  if (a >= 1000) return `$${x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  if (a >= 1) return `$${x.toFixed(3)}`;
  if (a >= 0.01) return `$${x.toFixed(4)}`;
  return `$${x.toFixed(6)}`;
}

function computeCoin(coin, btcPct24, btcPct7) {
  const price = load(`price-${coin}.json`);
  const price1h = load(`price-1h-${coin}.json`);
  const oi = load(`oi-${coin}.json`);
  const funding = load(`funding-${coin}.json`);
  const liq = load(`liq-${coin}.json`);
  const topls = load(`topls-${coin}.json`);
  const basis = load(`basis-${coin}.json`);
  const taker = load(`taker-${coin}.json`);
  if (!price || !oi || !funding) return { asset: coin, dropped: true, reason: 'missing price/oi/funding' };

  const currentPrice = last(price);
  const prevClose = at(price, -2);
  const pct24h = pct(currentPrice, prevClose);
  const sevenDAgo = price.length >= 8 ? f(price[price.length - 8].close) : at(price, 0);
  const pct7d = pct(currentPrice, sevenDAgo);
  const volNow = f(price[price.length-1].volume_usd);
  const priorVols = price.length >= 7 ? price.slice(-7, -1).map(r => f(r.volume_usd)) : price.slice(0, -1).map(r => f(r.volume_usd));
  const volMean = mean(priorVols);
  const volRatio = (volNow != null && volMean) ? (volNow / volMean) : null;
  const last7 = price.length >= 8 ? price.slice(-8, -1) : price.slice(0, -1);
  let range7d = null;
  if (last7.length) {
    const highs = last7.map(r => f(r.high)).filter(x => x != null);
    const lows = last7.map(r => f(r.low)).filter(x => x != null && x > 0);
    if (highs.length && lows.length) {
      const hi = Math.max(...highs);
      const lo = Math.min(...lows);
      range7d = (hi - lo) / lo * 100;
    }
  }

  const oiNow = last(oi);
  const oiPrev = at(oi, -2);
  const oi24h = pct(oiNow, oiPrev);
  const oi7Ago = oi.length >= 8 ? f(oi[oi.length - 8].close) : at(oi, 0);
  const oi7d = pct(oiNow, oi7Ago);

  const fundingNow = last(funding);
  const fundingCloses = funding.map(r => f(r.close));
  const funding7dAvg = mean(fundingCloses);
  const fundingDelta = (fundingNow != null && funding7dAvg != null) ? fundingNow - funding7dAvg : null;

  let longLiqs = null, shortLiqs = null, liqTotal = null, liq7p75 = null, liqs4h = null;
  let shortSeries = [], longSeries = [], totalSeries = [];
  if (liq) {
    for (const r of liq) {
      const l = ('aggregated_long_liquidation_usd' in r) ? f(r.aggregated_long_liquidation_usd) : f(r.long_liquidation_usd);
      const s = ('aggregated_short_liquidation_usd' in r) ? f(r.aggregated_short_liquidation_usd) : f(r.short_liquidation_usd);
      const t = (l != null || s != null) ? ((l||0) + (s||0)) : f(r.close);
      longSeries.push(l); shortSeries.push(s); totalSeries.push(t);
    }
    longLiqs = longSeries[longSeries.length-1];
    shortLiqs = shortSeries[shortSeries.length-1];
    liqTotal = totalSeries[totalSeries.length-1];
    const prior = totalSeries.length > 1 ? totalSeries.slice(0, -1) : totalSeries;
    liq7p75 = p75(prior);
    if (liqTotal != null) liqs4h = liqTotal * (4/24);
  }
  const shortLiqs7p75 = shortSeries.length > 1 ? p75(shortSeries.slice(0, -1).filter(v=>v!=null)) : null;

  let topLsNow = null, topLs7Avg = null, topLsDelta = null;
  if (topls) {
    const ts = topls.map(r => f(r.top_position_long_short_ratio));
    topLsNow = ts[ts.length-1];
    const prior7 = ts.length >= 8 ? ts.slice(-8, -1) : ts.slice(0, -1);
    topLs7Avg = mean(prior7);
    const seven = ts.length >= 8 ? ts[ts.length-8] : ts[0];
    if (topLsNow != null && seven != null) topLsDelta = topLsNow - seven;
  }
  let basisNow = null, basis7Avg = null;
  if (basis) {
    const bc = basis.map(r => f(r.close_basis));
    basisNow = bc[bc.length-1];
    const prior_b = bc.length >= 8 ? bc.slice(-8, -1) : bc.slice(0, -1);
    basis7Avg = mean(prior_b);
  }
  let takerBuy = null;
  if (taker) {
    const row = taker[taker.length-1];
    const b = f(row.taker_buy_volume_usd);
    const s = f(row.taker_sell_volume_usd);
    if (b != null && s != null && (b + s) > 0) takerBuy = b / (b + s) * 100;
  }
  let pct4h = null;
  if (price1h && price1h.length >= 5) {
    const hNow = last(price1h);
    const h4 = at(price1h, -5);
    pct4h = pct(hNow, h4);
  }
  let pct24vBtc = null, pct7vBtc = null;
  if (coin !== 'BTC') {
    if (pct24h != null && btcPct24 != null) pct24vBtc = pct24h - btcPct24;
    if (pct7d != null && btcPct7 != null) pct7vBtc = pct7d - btcPct7;
  } else {
    pct24vBtc = 0; pct7vBtc = 0;
  }

  return {
    asset: coin, dropped: false, tier: TIER1.has(coin) ? 1 : 2,
    current_price: currentPrice, current_price_fmt: fmtPrice(currentPrice),
    pct_24h: pct24h, pct_7d: pct7d, pct_4h: pct4h,
    vol_ratio: volRatio, range_7d_pct: range7d,
    pct_24h_vs_btc: pct24vBtc, pct_7d_vs_btc: pct7vBtc,
    oi_now: oiNow, oi_now_fmt: fmtUSD(oiNow),
    oi_24h_pct: oi24h, oi_7d_pct: oi7d,
    funding_now: fundingNow, funding_7d_avg: funding7dAvg, funding_delta: fundingDelta,
    liq_24h_total: liqTotal, liq_24h_total_fmt: fmtUSD(liqTotal),
    liq_7d_p75: liq7p75, liq_7d_p75_fmt: fmtUSD(liq7p75),
    long_liqs_24h: longLiqs, long_liqs_24h_fmt: fmtUSD(longLiqs),
    short_liqs_24h: shortLiqs, short_liqs_24h_fmt: fmtUSD(shortLiqs),
    liqs_4h: liqs4h, liqs_4h_fmt: fmtUSD(liqs4h),
    short_liqs_7d_p75: shortLiqs7p75,
    top_ls_now: topLsNow, top_ls_7d_avg: topLs7Avg, top_ls_delta_7d: topLsDelta,
    basis_now: basisNow, basis_7d_avg: basis7Avg,
    taker_buy_pct_24h: takerBuy,
  };
}

const manifest = JSON.parse(fs.readFileSync(path.join(CACHE, 'manifest.json'), 'utf8'));
const assets = manifest.asset_list;

const btc = computeCoin('BTC');
const out = { manifest_fetched_at: manifest.fetched_at, assets: [] };
for (const coin of assets) {
  out.assets.push(computeCoin(coin, btc.pct_24h, btc.pct_7d));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT} for ${out.assets.length} assets`);
