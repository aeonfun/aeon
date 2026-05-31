#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for the 2026-05-31 evening re-run.
// Treats the morning's .outputs/perps-scan.md (dated 2026-05-31) as the
// prior state so intraday transitions surface. Repeat-day counts are held
// at the morning's values for carry-overs because both runs sit on the
// same calendar day.

import fs from 'node:fs';

const TODAY = '2026-05-31';
const PRIOR = '.outputs/perps-scan.md';
const COMPUTE = '.outputs/_perps_compute.json';
const OUT = '.outputs/perps-scan.data.json';

const compute = JSON.parse(fs.readFileSync(COMPUTE, 'utf8'));
const metrics = compute.metrics;
const assets = Object.keys(metrics);

// Hardcoded snapshot of the morning's 2026-05-31 perps-scan run.
// The build script overwrites .outputs/perps-scan.md, so we cannot parse it
// after the first render. The snapshot is recovered from git show HEAD on
// the morning artifact and pinned here.
const priorRegime = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL', BNB: 'ACCUMULATION',
  HYPE: 'NEUTRAL', LAB: 'NEUTRAL', XLM: 'NEUTRAL', ZEC: 'NEUTRAL',
  WLD: 'NEUTRAL', ALLO: 'NEUTRAL', H: 'MOMENTUM', XRP: 'NEUTRAL',
  PORTAL: 'NEUTRAL', NEAR: 'NEUTRAL', ASTER: 'ACCUMULATION', DOGE: 'NEUTRAL',
  ONDO: 'NEUTRAL', TON: 'NEUTRAL', SUI: 'NEUTRAL', UB: 'NEUTRAL',
  BSB: 'NEUTRAL', HBAR: 'NEUTRAL', ID: 'NEUTRAL', HEI: 'NEUTRAL', BEAT: 'NEUTRAL',
};
const priorRepeat = {
  BTC: 7, ETH: 7, SOL: 7, BNB: 2, HYPE: 1, LAB: 3, XLM: 4, ZEC: 5, WLD: 7,
  ALLO: 4, H: 2, XRP: 7, PORTAL: 2, NEAR: 7, ASTER: 2, DOGE: 7, ONDO: 2,
  TON: 1, SUI: 7, UB: 2, BSB: 7, HBAR: 3, ID: 3, HEI: 1, BEAT: 1,
};

// Repeat days: same-day re-run, so carry-overs keep their morning count.
const todayRepeat = {};
for (const a of assets) {
  const r = metrics[a].regime;
  if (priorRegime[a] === r && priorRepeat[a]) todayRepeat[a] = priorRepeat[a];
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

// Build regime_changes — assets whose regime today differs from morning,
// plus entrants and assets dropped from the morning universe.
const regimeChanges = [];

// Hand-authored notes for the meaningful transitions today.
const customNotes = {
  H: 'Funding dropped to +0.0249%/8h, below the +0.03 band. OI still adds +8.59% 24h with taker buy 51.61% one tick under the breakout gate. The print loses MOMENTUM on the funding cool-off alone.',
  PLAY: 'First appearance, +56.77% 24h on OI +116.45% 24h with funding +0.0437%/8h inside the +0.03 to +0.07 band. Taker buy 50.64% one point under the breakout gate routes the print to MOMENTUM rather than CATALYST-BREAKOUT.',
  HOME: 'First appearance, +37.99% 24h on vol 10.31x, OI +57.41% 24h, basis +1.218. Taker buy 51.58% half a point under the 52% gate keeps the CATALYST-BREAKOUT print pending.',
  '币安人生': 'First appearance, +19.93% 24h on vol 8.16x, OI +26.47% 24h. Taker buy 50.17% and the pct_24h sits 0.07 points under the tier-2 20% breakout gate.',
  STG: 'First appearance, +72.02% 24h on vol 27.94x, OI +261.98% 24h, funding -0.3847%/8h, basis +0.4758. Taker buy 51.39% half a point under the 52% gate keeps the print out of CATALYST-BREAKOUT.',
  ICP: 'First appearance, +2.90% 24h on funding -0.0113%/8h with top L/S 3.17 reading crowded long against the shallow move.',
  SEI: 'First appearance, +1.92% 24h on funding -0.0166%/8h. Mid-cap drift on no directional pull.',
  ADA: 'Re-enters the universe at NEUTRAL after the morning drop. -0.81% 24h with OI -0.49% — quiet carry.',
};

// Carry-overs: assets present in both morning and today
const morningAssets = new Set(Object.keys(priorRegime));
const todaySet = new Set(assets);

for (const a of assets) {
  const today = metrics[a].regime;
  const prior = priorRegime[a];
  if (prior && prior !== today) {
    regimeChanges.push({ asset: a, from: prior, to: today, note: customNotes[a] || transitionNote(prior, today) });
  } else if (!prior) {
    regimeChanges.push({ asset: a, from: '(new entrant)', to: today, note: customNotes[a] || `First appearance, ${pctStr(metrics[a].pct_24h)} 24h, OI ${pctStr(metrics[a].oi_24h_pct)} 24h.` });
  }
}

// Surface assets dropped from morning universe
const dropNotes = {
  HEI: 'Universe rotation, out of today\'s top-25 perp volume.',
  ID: 'Universe rotation, out of today\'s top-25 perp volume. The structural funding -0.4242%/8h paired with basis +2.6514 no longer surfaces in the scan.',
  BEAT: 'Universe rotation, out of today\'s top-25 perp volume.',
  BSB: 'Universe rotation, out of today\'s top-25 perp volume.',
  HBAR: 'Universe rotation, out of today\'s top-25 perp volume.',
};
for (const a of morningAssets) {
  if (!todaySet.has(a)) {
    regimeChanges.push({ asset: a, from: priorRegime[a], to: '(dropped)', note: dropNotes[a] || 'Universe rotation, out of today\'s top-25 perp volume.' });
  }
}

// Watch picks — hand-authored for today's near-miss assets
const watch = [];
function pushWatch(asset, transitionRead) {
  if (!metrics[asset]) return;
  watch.push({ asset, metrics_line: metricLineFor(asset), transition_read: transitionRead });
}

pushWatch('STG',
  'STG ripped +72.02% 24h on vol 27.94x with OI +261.98% 24h and funding -0.3847%/8h, the deepest short-pay across the assessed universe. Taker buy 51.39% sits half a point under the 52% CATALYST-BREAKOUT gate. A single hour clearing 52% promotes the print. The setup invalidates on an OI flush back through the +10% 24h gate while funding holds negative. The leg resolves through long unwind rather than continuation.'
);

pushWatch('HOME',
  'HOME prints +37.99% 24h on vol 10.31x, OI +57.41% 24h, basis +1.218, taker buy 51.58% half a point under the 52% gate. Funding -0.235%/8h confirms shorts pay through every funding window. CATALYST-BREAKOUT fires when taker buy clears 52% on a single hour. The setup invalidates if pct_4h cracks negative with OI rolling back.'
);

pushWatch('PORTAL',
  'PORTAL holds the morning watch position with +48.68% 24h on vol 11.45x and OI +61.22% 24h. Taker buy 50.60% sits 1.4 points under the 52% gate. Short liqs $1.0M against $101K weekly p75 confirm forced cover stacked on top of fresh long flow. CATALYST-BREAKOUT fires on a single hourly print clearing both the price and taker gates together.'
);

pushWatch('LAB',
  'LAB carries the day-3 cascade with funding at -0.872%/8h, the most aggressive short-pay in the universe. pct_4h +8.63% inside a +14.57% daily shows the move rebuilding intraday. Taker buy 50.85% sits one point under the 52% breakout gate. The leg promotes on a taker print above 52% with OI building past +10% 24h. Funding mean-reversion through zero invalidates the squeeze thesis.'
);

pushWatch('币安人生',
  'BinanceLife enters the universe at +19.93% 24h on vol 8.16x, OI +26.47% 24h, top L/S 1.96. The pct_24h sits 0.07 points under the tier-2 20% gate and taker buy 50.17% misses 52% by nearly two points. A continuation candle that clears both gates together prints CATALYST-BREAKOUT cleanly.'
);

pushWatch('ALLO',
  'ALLO holds +210.18% 7d with funding climbing to +0.0288%/8h on OI +14.49% 24h. The 7d run extends but pct_24h +15.94% falls under the tier-2 20% breakout gate and funding sits well under the +0.08 distribution trigger. Top L/S 0.92 with a -0.63 delta over 7d marks smart money reducing into the rip — a structural fade signal underneath the ongoing extension.'
);

const neutralSummary = `Neutral · ${totalAssessed} assessed, ${watch.length} surfaced to WATCH · full data in the tail`;

const regime_empty_notes = {};
for (const r of REGIME_ORDER) {
  if (regimes[r].length > 0) continue;
  if (r === 'CATALYST-BREAKOUT') {
    regime_empty_notes[r] = 'no asset pairs a breakout-grade move with taker buy above 52%. STG (+72.02%, vol 27.94x, OI +262%, taker 51.39%), HOME (+37.99%, vol 10.31x, taker 51.58%), PORTAL (+48.68%, vol 11.45x, taker 50.60%) and BinanceLife (+19.93%, vol 8.16x, taker 50.17%) all stack into the taker gate without clearing it.';
  } else if (r === 'SHORT-SQUEEZE') {
    regime_empty_notes[r] = 'no asset pairs a >10% 24h rip with OI rolling negative. STG (+72% on OI +262% 24h), HOME (+38% on OI +57% 24h), PORTAL (+48.68% on OI +61.22% 24h) and BinanceLife (+19.93% on OI +26.47% 24h) all carry long-led OI builds rather than forced short cover.';
  } else if (r === 'COMPRESSION') {
    regime_empty_notes[r] = 'no asset holds sub-5% range with an OI build and flat funding. DOGE prints the tightest range at 7.70% with XRP at 7.78% and BTC at 7.79%, each above the tier-1 3% gate and the tier-2 5% gate. The universe sits too dispersed for a compression print.';
  } else if (r === 'DISTRIBUTION') {
    regime_empty_notes[r] = 'no asset pairs a positive funding extreme with a 5% OI build and slowing gains. ALLO funding +0.0288%/8h, PLAY +0.0437%/8h and UB +0.0204%/8h all sit well under the tier-2 +0.08 trigger. No positive-side funding extreme prints anywhere.';
  } else if (r === 'CAPITULATION') {
    regime_empty_notes[r] = 'no drawdown pairs negative funding with an OI flush past the liquidation 75th percentile. ONDO carries the deepest 7d red at -17.83% but pct_24h -3.86% misses the tier-2 -10% gate and OI -1.45% 24h leaves nothing flushing. SUI -14.20% 7d sits in a similar shape, drawdown without flush.';
  }
}

const cycle =
  'The 27-asset universe holds three regime prints across BNB, ASTER and PLAY. BNB and ASTER carry ACCUMULATION DIVERGENT into day 2 with taker buy under 50% on both, and BNB OI has rolled to -2.24% 24h after the morning +5.84% build. PLAY prints the only MOMENTUM regime, funding +0.0437%/8h inside the band with OI ripping +116.45% 24h. H drops out of MOMENTUM as funding cooled to +0.0249%/8h below the band low.';
const forward =
  'Four near-miss CATALYST-BREAKOUT candidates stack into the 52% taker gate together. STG +72% 24h on vol 27.94x leads the queue at taker 51.39%, with HOME at 51.58%, PORTAL at 50.60% and BinanceLife at 50.17% trailing. A single hour clearing 52% promotes any of them. LAB carries the deepest negative funding at -0.872%/8h on a +14.57% daily. A taker-gate clear here resolves the squeeze through forced short cover.';

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
console.log(`  transitions: ${regimeChanges.length}`);
console.log(`  watch: ${watch.length}`);
console.log(`  tail: ${tail.length}`);
