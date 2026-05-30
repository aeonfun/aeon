#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for today (2026-05-30) from
// .outputs/_perps_compute.json plus yesterday's .outputs/perps-scan.md.
//
// This script is the JSON authoring step ONLY. The deterministic render is
// scripts/render-perps-scan.py — but python3 is blocked in this sandbox, so
// the workflow's postprocess step runs the render outside the Claude path.
// We invoke it manually as a final step.

import fs from 'node:fs';

const TODAY = '2026-05-30';
// .outputs/perps-scan.md gets overwritten each render with TODAY's date, so
// reading it back to derive yesterday's regimes only works once. We seed a
// backup copy of the prior artifact at .outputs/.yesterday-perps-scan.md
// before the first render and prefer that on subsequent rebuilds.
const PRIOR_BACKUP = '.outputs/.yesterday-perps-scan.md';
const PRIOR_LIVE = '.outputs/perps-scan.md';
const PRIOR = fs.existsSync(PRIOR_BACKUP) ? PRIOR_BACKUP : PRIOR_LIVE;
const COMPUTE = '.outputs/_perps_compute.json';
const OUT = '.outputs/perps-scan.data.json';

const compute = JSON.parse(fs.readFileSync(COMPUTE, 'utf8'));
const metrics = compute.metrics;
const assets = Object.keys(metrics);

const priorRegime = {};
const priorRepeatDays = {};

if (fs.existsSync(PRIOR)) {
  const txt = fs.readFileSync(PRIOR, 'utf8');
  const head = txt.split('\n')[0];
  const headDate = (head.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
  if (headDate && headDate !== TODAY) {
    const re = /^Asset:\s+(\S+)\s+\|\s+Tier:\s+(\d)\s+\|\s+Regime:\s+(\S+)/gm;
    let m;
    while ((m = re.exec(txt))) priorRegime[m[1]] = m[3];
    const rdRe = /^Asset:\s+(\S+)[\s\S]*?repeat_days:\s+(\d+)/gm;
    while ((m = rdRe.exec(txt))) priorRepeatDays[m[1]] = parseInt(m[2], 10);
  }
}

const havePrior = Object.keys(priorRegime).length > 0;

const todayRepeat = {};
for (const a of assets) {
  const r = metrics[a].regime;
  if (priorRegime[a] === r) {
    todayRepeat[a] = (priorRepeatDays[a] || 0) + 1;
  } else {
    todayRepeat[a] = 1;
  }
}

function fmtPrice(p) {
  if (p === null || p === undefined) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(5);
  return '$' + p.toExponential(2);
}
function fmtUsd(v) {
  if (v === null || v === undefined) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}
function sign(n) {
  if (n === null || n === undefined) return '';
  return n >= 0 ? '+' : '';
}
function pctStr(v, d = 2) {
  if (v === null || v === undefined) return '—';
  return sign(v) + Number(v).toFixed(d) + '%';
}
function fmtF(v, d = 4) {
  if (v === null || v === undefined) return '—';
  return sign(v) + Number(v).toFixed(d) + '%/8h';
}
function fmtBasis(v, d = 4) {
  if (v === null || v === undefined) return '—';
  return sign(v) + Number(v).toFixed(d);
}

function metricLineFor(a) {
  const m = metrics[a];
  const parts = [
    pctStr(m.pct_24h) + ' 24h',
    pctStr(m.pct_7d) + ' 7d',
    'OI ' + pctStr(m.oi_24h_pct) + ' 24h',
    'OI ' + pctStr(m.oi_7d_pct) + ' 7d',
    'funding ' + fmtF(m.funding_now) + ' (7d avg ' + fmtF(m.funding_7d_avg) + ', delta ' + fmtF(m.funding_delta) + ')',
    'taker buy ' + (m.taker_buy_pct_24h !== null ? m.taker_buy_pct_24h.toFixed(2) + '%' : '—'),
    'vol ' + (m.vol_ratio !== null ? m.vol_ratio.toFixed(2) + 'x' : '—'),
    'liq ' + fmtUsd(m.liq_24h_total) + ' vs 7d p75 ' + fmtUsd(m.liq_7d_p75),
    'short liqs ' + fmtUsd(m.short_liqs_24h) + ' vs p75 ' + fmtUsd(m.short_liqs_p75),
    'top L/S ' + (m.top_ls_now !== null ? m.top_ls_now.toFixed(2) : '—') + ' (Δ ' + (m.top_ls_delta_7d !== null ? sign(m.top_ls_delta_7d) + m.top_ls_delta_7d.toFixed(2) : '—') + ' 7d)',
    'basis ' + fmtBasis(m.basis_now),
    'pct_4h ' + pctStr(m.pct_4h),
    'range ' + (m.range_7d_pct !== null ? m.range_7d_pct.toFixed(2) + '%' : '—'),
  ];
  return parts.join(', ');
}

const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];
const regimes = {};
for (const r of REGIME_ORDER) regimes[r] = [];

for (const a of assets) {
  const m = metrics[a];
  if (m.regime === 'NEUTRAL') continue;
  const tags = [];
  for (const s of m.sub_tags) tags.push({ tag: m.regime + ' · ' + s });
  for (const p of m.pattern_tags) tags.push({ tag: p });
  const days = todayRepeat[a];
  regimes[m.regime].push({
    asset: a,
    tier: m.tier,
    marker: days >= 3 ? 'star' : 'bullet',
    repeat_days_suffix: days >= 2 ? `(day ${days})` : null,
    metrics_line: metricLineFor(a),
    tags,
  });
}

const counts = {};
for (const a of assets) counts[metrics[a].regime] = (counts[metrics[a].regime] || 0) + 1;
const totalAssessed = assets.length;
const neutralPct = (counts.NEUTRAL || 0) / totalAssessed;
let verdictWord = 'QUIET';
if (neutralPct < 0.8) {
  if ((counts.ACCUMULATION || 0) + (counts.MOMENTUM || 0) >= 4 && (counts.CAPITULATION || 0) === 0) verdictWord = 'LEVERAGE BUILDING';
  else if ((counts.DISTRIBUTION || 0) >= 3) verdictWord = 'CROWDED LONG';
  else if ((counts.CAPITULATION || 0) >= 2) verdictWord = 'DELEVERAGING';
  else if ((counts['CATALYST-BREAKOUT'] || 0) >= 3) verdictWord = 'BREAKOUTS ACTIVE';
  else if ((counts.MOMENTUM || 0) >= 4) verdictWord = 'TRENDING';
  else if ((counts.COMPRESSION || 0) >= 4) verdictWord = 'COILING';
  else verdictWord = 'MIXED';
}

const nonNeutralParts = [];
for (const r of REGIME_ORDER) if (counts[r]) nonNeutralParts.push(`${counts[r]} ${r}`);
let distribution;
if (nonNeutralParts.length === 0) {
  distribution = `all ${totalAssessed} assessed sit in NEUTRAL`;
} else {
  distribution = `${nonNeutralParts.join(', ')} across ${totalAssessed} assessed, ${counts.NEUTRAL || 0} NEUTRAL`;
}

function transitionNote(from, to) {
  const namedReads = {
    'ACCUMULATION→CATALYST-BREAKOUT': 'Patient buyers paid off. High-quality breakout.',
    'ACCUMULATION→COMPRESSION': 'Lost momentum. Accumulation did not deliver.',
    'MOMENTUM→DISTRIBUTION': 'Trend topping. Take profits or fade.',
    'COMPRESSION→CATALYST-BREAKOUT': 'Coil resolved bullish. Ride the break.',
    'COMPRESSION→CAPITULATION': 'Coil resolved bearish. Fade.',
    'DISTRIBUTION→CAPITULATION': 'Top played out. Mean-revert long for the bounce.',
    'CAPITULATION→ACCUMULATION': 'Bottom is in. Quiet long entry.',
    'NEUTRAL→ACCUMULATION': 'Fresh accumulation print. Early entry.',
  };
  const key = `${from}→${to}`;
  if (namedReads[key]) return namedReads[key];
  if (to === 'SHORT-SQUEEZE') return 'Squeeze in progress. Short-term ride only.';
  if (to === 'CAPITULATION') return 'Flush starting.';
  return '';
}

function firstEntryNote(m) {
  return `First appearance, ${pctStr(m.pct_24h)} 24h, OI ${pctStr(m.oi_24h_pct)} 24h, funding ${fmtF(m.funding_now)}.`;
}

let regimeChanges = null;
if (havePrior) {
  regimeChanges = [];
  for (const a of assets) {
    const today = metrics[a].regime;
    const prior = priorRegime[a];
    if (prior && prior !== today) {
      regimeChanges.push({ asset: a, from: prior, to: today, note: transitionNote(prior, today) });
    } else if (!prior) {
      regimeChanges.push({ asset: a, from: '(new entrant)', to: today, note: firstEntryNote(metrics[a]) });
    }
  }
}

const watch = [];

function pushWatch(asset, transitionRead) {
  if (!metrics[asset]) return;
  watch.push({ asset, metrics_line: metricLineFor(asset), transition_read: transitionRead });
}

pushWatch('XLM',
  'XLM gives back -5.97% 24h after a +64.69% 7d run with OI still carrying +274.48% 7d. Top L/S 0.82 leaves shorts crowded into the move, so a deeper unwind squeezes them harder rather than flushes longs. CAPITULATION fires on a continued bleed past the tier-2 -10% gate. A reclaim of the 7d run prints CATALYST-BREAKOUT on a single hour of taker buy above 52%.'
);

pushWatch('LAB',
  'LAB carries the day-3 leg of its breakout with funding at -0.0996%/8h, the deepest short-pay in the assessed universe. Taker buy 50.89% sits one point under the 52% gate. CATALYST-BREAKOUT confirms on a single taker print above 52% with the +9.17% 24h holding into the close.'
);

pushWatch('ID',
  'ID carries basis +2.6514 against funding -0.4242%/8h on OI +447.46% 7d. The structural cost of staying short cannot hold through the week. Resolution arrives either through a short capitulation that drives a vertical leg or a long unwind that gives back the +29.48% 7d gain. Taker buy 49.17% offers no directional tell yet.'
);

pushWatch('LIT',
  'LIT enters the universe on +12.99% 7d, OI +14.43% 24h, top L/S 2.26 holding. Range 35.17% blocks the under-25% ACCUMULATION gate. Two days of price drift with the OI build sticking pulls range under the gate and prints the regime cleanly.'
);

pushWatch('HBAR',
  'HBAR builds OI +45.15% 7d with price +9.49% 7d on top L/S 2.27. Range 34.42% blocks the under-25% gate. A two-day consolidation that compresses range prints ACCUMULATION cleanly. A flush instead invalidates the build.'
);

pushWatch('HEI',
  'HEI prints +33.55% 24h on OI +74.59% 24h, but pct_4h -21.89% inside the same daily candle marks the leverage cascade already underway. CASH-AND-CARRY fires on basis +0.2408 with funding delta near zero, so institutional arb stacks on the wreck. Treat the 24h headline as discharge, not a directional thesis.'
);

const neutralSummary = `Neutral · ${totalAssessed} assessed, ${watch.length} surfaced to WATCH · full data in the tail`;

const regime_empty_notes = {};
for (const r of REGIME_ORDER) {
  if (regimes[r].length > 0) continue;
  if (r === 'CATALYST-BREAKOUT') {
    regime_empty_notes[r] = 'no asset pairs a breakout-grade move with taker buy above 52%. LAB (+9.17%, vol 1.26x, OI +2.93%, taker 50.89%) and LIT (+9.91%, taker 47.87%) both miss the taker gate. HEI ripped +33.55% on vol 7.74x with OI +74.59%, but pct_4h -21.89% inside the same daily marks the move already cracked.';
  } else if (r === 'SHORT-SQUEEZE') {
    regime_empty_notes[r] = 'no asset pairs a >10% 24h rip with OI rolling negative. XLM rallied +64.69% 7d but OI +274.48% 7d confirms long-led discovery, not squeeze. ID +15.82% prints on OI +45.42% 24h — fresh longs, not forced cover.';
  } else if (r === 'MOMENTUM') {
    regime_empty_notes[r] = 'no asset holds a 7d run with funding inside the +0.03 to +0.07 band. HYPE (+13.08% 7d on funding -0.0136) sits under zero, so ACCUMULATION takes the call instead. HBAR (+9.49% 7d) and LIT (+12.99% 7d) miss the tier-2 +15% 7d gate.';
  } else if (r === 'COMPRESSION') {
    regime_empty_notes[r] = 'no asset holds sub-5% range with an OI build and flat funding. XAU prints the tightest range at 5.13% but OI -3.71% 7d misses the +5% build gate.';
  } else if (r === 'DISTRIBUTION') {
    regime_empty_notes[r] = 'no asset pairs extreme funding with a 5% OI build and slowing gains. ALLO funding +0.0116%/8h, BNB +0.0101%/8h and XLM +0.0096%/8h all sit well under the +0.08 tier-2 trigger. No longside funding extreme prints anywhere.';
  } else if (r === 'CAPITULATION') {
    regime_empty_notes[r] = 'no drawdown pairs negative funding with an OI flush past the liquidation 75th percentile. TAO printed -10.05% 7d but today is +0.52% 24h on funding +0.0009%/8h, so no flush. XLM -5.97% 24h missed the tier-2 -10% gate.';
  }
}

const cycle =
  'Two fresh ACCUMULATION prints land on HYPE and BNB after a fully-neutral 05-29 tape. HYPE rides the perp-DEX bid on taker buy 51.02% and smart-money L/S ticking up 0.04 over 7d. BNB carries the exchange flow on vol 1.18x average, OI building +12.10% 7d inside a 7.84% range.';
const forward =
  'HYPE holding the under-25% range another day puts the regime into a day-2 streak with BNB. A continuation candle that pushes range past 25% drops HYPE out of ACCUMULATION before the print extends. LAB taker buy clearing 52% on a single hour promotes the +9.17% leg to CATALYST-BREAKOUT. Watch ID basis +2.65 against funding -0.42%/8h for either-side capitulation by week-end.';

function tailMetrics(m) {
  return {
    price: fmtPrice(m.current_price),
    pct_24h: Number(m.pct_24h.toFixed(2)),
    pct_7d: Number(m.pct_7d.toFixed(2)),
    pct_4h: m.pct_4h !== null ? Number(m.pct_4h.toFixed(2)) : '—',
    range_7d: (m.range_7d_pct !== null ? m.range_7d_pct.toFixed(2) + '%' : '—'),
    pct_24h_vs_btc: m.pct_24h_vs_btc !== null ? Number(m.pct_24h_vs_btc.toFixed(2)) : '—',
    pct_7d_vs_btc: m.pct_7d_vs_btc !== null ? Number(m.pct_7d_vs_btc.toFixed(2)) : '—',
    oi_usd: fmtUsd(m.oi_now),
    oi_24h_pct: Number(m.oi_24h_pct.toFixed(2)),
    oi_7d_pct: Number(m.oi_7d_pct.toFixed(2)),
    funding_now: m.funding_now !== null ? Number(m.funding_now.toFixed(4)) : '—',
    funding_7d_avg: m.funding_7d_avg !== null ? Number(m.funding_7d_avg.toFixed(4)) : '—',
    funding_delta: m.funding_delta !== null ? Number(m.funding_delta.toFixed(4)) : '—',
    liq_24h: fmtUsd(m.liq_24h_total),
    liq_7d_p75: fmtUsd(m.liq_7d_p75),
    long_liqs: fmtUsd(m.long_liqs_24h),
    short_liqs: fmtUsd(m.short_liqs_24h),
    liqs_4h: fmtUsd(m.liqs_4h),
    top_ls: m.top_ls_now !== null ? Number(m.top_ls_now.toFixed(2)) : '—',
    top_ls_7d_avg: m.top_ls_7d_avg !== null ? Number(m.top_ls_7d_avg.toFixed(2)) : '—',
    top_ls_delta_7d: m.top_ls_delta_7d !== null ? Number(m.top_ls_delta_7d.toFixed(2)) : '—',
    basis: m.basis_now !== null ? Number(m.basis_now.toFixed(4)) : '—',
    taker_buy: m.taker_buy_pct_24h !== null ? Number(m.taker_buy_pct_24h.toFixed(2)) : '—',
  };
}

const tail = assets.map((a) => {
  const m = metrics[a];
  return {
    asset: a,
    tier: m.tier,
    regime: m.regime,
    sub_tags: m.sub_tags,
    pattern_tags: m.pattern_tags,
    metrics: tailMetrics(m),
    yesterday_regime: priorRegime[a] || null,
    repeat_days: todayRepeat[a] || 1,
  };
});

const data = {
  date: TODAY,
  edge_case: null,
  verdict: { word: verdictWord, distribution, cycle, forward },
  regime_changes: regimeChanges,
  regimes,
  regime_empty_notes,
  watch,
  neutral_summary: neutralSummary,
  tail,
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`wrote ${OUT}`);
console.log(`  verdict: ${verdictWord}`);
console.log(`  regime counts: ${JSON.stringify(counts)}`);
console.log(`  transitions: ${(regimeChanges || []).length}`);
console.log(`  watch: ${watch.length}`);
console.log(`  tail: ${tail.length}`);
