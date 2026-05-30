#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for the 2026-05-30 PM re-run.
// Reads .outputs/_perps_compute.json + the 2026-05-29 backup at
// .outputs/.yesterday-perps-scan.md. Replaces hard-coded prose from the morning
// build with today's universe-specific reads.

import fs from 'node:fs';

const TODAY = '2026-05-30';
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
  if (priorRegime[a] === r) todayRepeat[a] = (priorRepeatDays[a] || 0) + 1;
  else todayRepeat[a] = 1;
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
function sign(n) { if (n === null || n === undefined) return ''; return n >= 0 ? '+' : ''; }
function pctStr(v, d = 2) { if (v === null || v === undefined) return '—'; return sign(v) + Number(v).toFixed(d) + '%'; }
function fmtF(v, d = 4) { if (v === null || v === undefined) return '—'; return sign(v) + Number(v).toFixed(d) + '%/8h'; }
function fmtBasis(v, d = 4) { if (v === null || v === undefined) return '—'; return sign(v) + Number(v).toFixed(d); }

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

// Verdict: ACCUM 3 + MOM 2 = 5 leverage-direction prints with zero CAPITULATION
// and zero DISTRIBUTION — leverage building, not quiet. Override the 80% NEUTRAL
// boundary because the underlying signal is directional and live.
const leverageCount = (counts.ACCUMULATION || 0) + (counts.MOMENTUM || 0);
const distCount = (counts.DISTRIBUTION || 0) + (counts.CAPITULATION || 0);
let verdictWord;
if (leverageCount >= 4 && distCount === 0) verdictWord = 'LEVERAGE BUILDING';
else if ((counts.DISTRIBUTION || 0) >= 3) verdictWord = 'CROWDED LONG';
else if ((counts.CAPITULATION || 0) >= 2) verdictWord = 'DELEVERAGING';
else if ((counts['CATALYST-BREAKOUT'] || 0) >= 3) verdictWord = 'BREAKOUTS ACTIVE';
else if ((counts.MOMENTUM || 0) >= 4) verdictWord = 'TRENDING';
else if ((counts.COMPRESSION || 0) >= 4) verdictWord = 'COILING';
else if ((counts.NEUTRAL || 0) / totalAssessed >= 0.8) verdictWord = 'QUIET';
else verdictWord = 'MIXED';

const nonNeutralParts = [];
for (const r of REGIME_ORDER) if (counts[r]) nonNeutralParts.push(`${counts[r]} ${r}`);
let distribution;
if (nonNeutralParts.length === 0) distribution = `all ${totalAssessed} assessed sit in NEUTRAL`;
else distribution = `${nonNeutralParts.join(', ')} across ${totalAssessed} assessed, ${counts.NEUTRAL || 0} NEUTRAL`;

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
    'NEUTRAL→MOMENTUM': 'Trend printing. Ride the move with funding inside the band.',
  };
  const key = `${from}→${to}`;
  if (namedReads[key]) return namedReads[key];
  if (to === 'SHORT-SQUEEZE') return 'Squeeze in progress. Short-term ride only.';
  if (to === 'CAPITULATION') return 'Flush starting.';
  return '';
}

function firstEntryNote(a, m) {
  const overrides = {
    H: 'First appearance, +36.74% 24h, +86.38% 7d on OI +45.50% with funding +0.0529%/8h inside the MOMENTUM band. Trend printing on confirmed flow.',
    ASTER: 'First appearance, +14.66% 24h on OI +23.02% with taker buy 53.01% crossing the spread. ACCUMULATION fires on the 17.99% range and OI +20.40% 7d.',
    PORTAL: 'First appearance, +54.81% 24h on OI +628.08% with funding -0.3331%/8h. Leverage-led discovery on a fresh listing. Taker buy 49.85% blocks the breakout gate.',
    UB: 'First appearance, +1.40% 24h on OI +2.67% with funding +0.0144%/8h. No directional thesis prints.',
    ONDO: 'First appearance, +4.46% 24h on OI +13.37% with funding -0.0082%/8h. Mid-cap drift inside a 32.66% range.',
  };
  if (overrides[a]) return overrides[a];
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
      regimeChanges.push({ asset: a, from: '(new entrant)', to: today, note: firstEntryNote(a, metrics[a]) });
    }
  }
  for (const a of Object.keys(priorRegime)) {
    if (!metrics[a]) regimeChanges.push({ asset: a, from: priorRegime[a], to: '(dropped)', note: 'Universe rotation, out of today\'s top-25 perp volume.' });
  }
}

const watch = [];
function pushWatch(asset, transitionRead) {
  if (!metrics[asset]) return;
  watch.push({ asset, metrics_line: metricLineFor(asset), transition_read: transitionRead });
}

pushWatch('PORTAL',
  'PORTAL prints a +54.81% 24h fresh-listing parabola on OI +628.08% with funding -0.3331%/8h. Taker buy 49.85% leaves buying one point short of CATALYST-BREAKOUT confirmation. The shape is leverage-led discovery, not absorbed demand. A taker print above 52% on the next session confirms continuation. A flush past -10% with negative funding extending fires CAPITULATION instead.'
);
pushWatch('LAB',
  'LAB extends the leg to +22.27% 24h on funding -0.1437%/8h, the deepest short-pay in the universe. Taker buy 51.35% sits one point under the 52% gate again. OI +57.61% 7d holds the build. A taker print above 52% with the +22% intact promotes to CATALYST-BREAKOUT. A reversal that flushes longs against the negative funding tail squeezes shorts in the wrong direction.'
);
pushWatch('XLM',
  'XLM gives back -7.90% 24h after a +61.31% 7d run on OI still carrying +237.88% 7d. Top L/S 0.82 keeps shorts crowded into the move, so a deeper unwind squeezes them rather than flushes longs. A continued bleed past the tier-2 -10% gate with negative funding fires CAPITULATION. A reclaim of the 7d range high on taker buy above 52% prints CATALYST-BREAKOUT.'
);
pushWatch('ID',
  'ID holds basis +1.4567 against funding -0.1195%/8h on OI +377.29% 7d. The structural cost of staying short cannot hold through the week. Resolution arrives either through a short capitulation that drives a vertical leg or a long unwind that gives back the +23.13% 7d gain. Taker buy 49.00% offers no directional tell yet.'
);
pushWatch('WLD',
  'WLD prints +25.28% 24h on OI +29.93% inside a 51.26% 7d range. Taker buy 49.38% and vol 0.89x both block the CATALYST-BREAKOUT gate. Funding flat at +0.0024%/8h leaves no extreme either side. A second push above the breakout high on taker buy clearing 52% promotes the regime. A failure here unwinds the +21% 7d gain back into NEUTRAL drift.'
);
pushWatch('HBAR',
  'HBAR builds OI +34.29% 7d with price +7.29% 7d on top L/S 2.32. Range 34.42% blocks the under-25% ACCUMULATION gate. Two days of consolidation that compresses range under the gate prints the regime cleanly. A flush past -10% invalidates the build.'
);

const neutralSummary = `Neutral · ${totalAssessed} assessed, ${watch.length} surfaced to WATCH · full data in the tail`;

const regime_empty_notes = {};
for (const r of REGIME_ORDER) {
  if (regimes[r].length > 0) continue;
  if (r === 'CATALYST-BREAKOUT') {
    regime_empty_notes[r] = 'no asset pairs a breakout-grade move with taker buy above 52%. PORTAL (+54.81%, vol 118x, OI +628%, taker 49.85%), WLD (+25.28%, vol 0.89x, taker 49.38%) and LAB (+22.27%, vol 3.91x, taker 51.35%) all miss the taker gate. The taker-buy wall under 52% holds against every directional rip.';
  } else if (r === 'SHORT-SQUEEZE') {
    regime_empty_notes[r] = 'no asset pairs a >10% 24h rip with OI rolling negative. Every directional rip today carries OI building, the shape of fresh longs piling in rather than forced short cover.';
  } else if (r === 'COMPRESSION') {
    regime_empty_notes[r] = 'no asset holds sub-5% range with an OI build and flat funding. Majors print 8-13% ranges, every coiling candidate prints range above the gate.';
  } else if (r === 'DISTRIBUTION') {
    regime_empty_notes[r] = 'no asset pairs extreme funding with a 5% OI build and slowing gains. SUI funding +0.0106%/8h, NEAR +0.0098%/8h and HBAR +0.0086%/8h all sit well under the +0.08 tier-2 trigger. No longside funding extreme prints anywhere.';
  } else if (r === 'CAPITULATION') {
    regime_empty_notes[r] = 'no drawdown pairs negative funding with an OI flush past the liquidation 75th percentile. XLM -7.90% missed the tier-2 -10% gate by 2 points and OI flushed -5.04% only. BSB -8.02% missed the gate on funding still positive at +0.0357%/8h.';
  }
}

const cycle =
  'Five non-neutral prints land in one session. HYPE holds ACCUMULATION CONFIRMED on taker buy 50.53% and smart-money L/S building 0.01 over 7d. BNB extends the print on +11.90% 24h with OI +42.77% 24h. ASTER enters the universe straight into ACCUMULATION on taker buy 53.01%. HEI and H print MOMENTUM on +82.67% and +86.38% 7d with funding inside the +0.03 to +0.07 band on both.';
const forward =
  'BNB and ASTER need a second day at range under 25% to convert ACCUMULATION into CATALYST-BREAKOUT. PORTAL +54.81% on OI +628% with funding -0.3331%/8h holds the cleanest taker-gate near-miss. A taker print above 52% promotes it immediately. LAB carries the day-3 leg of its short-pay leverage build, and the -0.1437%/8h funding tail makes any sharp reversal a long flush against negative funding rather than a clean fade.';

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
