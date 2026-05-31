#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for today (2026-05-31) from
// .outputs/_perps_compute.json plus yesterday's .outputs/perps-scan.md.
//
// JSON authoring step ONLY. Deterministic render is scripts/render-perps-scan.py
// (python3 blocked in sandbox) — use scripts/_render_perps_scan.mjs port instead.

import fs from 'node:fs';

const TODAY = '2026-05-31';
const PRIOR_BACKUP = '.outputs/.yesterday-perps-scan.md';
const PRIOR_LIVE = '.outputs/perps-scan.md';
// perps-scan.md is dated 2026-05-30 (yesterday), so prefer it over the
// 2026-05-29 backup for correct day-over-day comparison.
function pickPrior() {
  for (const p of [PRIOR_LIVE, PRIOR_BACKUP]) {
    if (!fs.existsSync(p)) continue;
    const head = fs.readFileSync(p, 'utf8').split('\n')[0];
    const d = (head.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
    if (d && d !== TODAY) return { path: p, date: d };
  }
  return null;
}
const PRIOR = pickPrior();
const COMPUTE = '.outputs/_perps_compute.json';
const OUT = '.outputs/perps-scan.data.json';

const compute = JSON.parse(fs.readFileSync(COMPUTE, 'utf8'));
const metrics = compute.metrics;
const assets = Object.keys(metrics);

const priorRegime = {};
const priorRepeatDays = {};

if (PRIOR) {
  const txt = fs.readFileSync(PRIOR.path, 'utf8');
  const re = /^Asset:\s+(\S+)\s+\|\s+Tier:\s+(\d)\s+\|\s+Regime:\s+(\S+)/gm;
  let m;
  while ((m = re.exec(txt))) priorRegime[m[1]] = m[3];
  const rdRe = /^Asset:\s+(\S+)[\s\S]*?repeat_days:\s+(\d+)/gm;
  while ((m = rdRe.exec(txt))) priorRepeatDays[m[1]] = parseInt(m[2], 10);
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

function transitionNote(from, to, asset) {
  const m = metrics[asset];
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

// Hand-authored transition notes that override the generic table when the
// data shape gives us a sharper read.
const overrideNotes = {
  HYPE: 'Range climbed to 25.16% across the day-1 ACCUMULATION print, one tick over the 25% gate. Funding climbed to +0.0062%/8h with vol 0.39x — the print ran out of bid before it could extend.',
  HEI: 'pct_24h -6.98% on OI -16.00% 24h carves the leverage cascade. Funding rolled to +0.0077%/8h, out of the +0.03 band, so MOMENTUM cannot hold.',
  BNB: 'Day 2 holds but the sub-tag flipped to DIVERGENT. Taker buy 49.14% sits under the 50% mark, OI +5.84% 24h builds passively rather than across the spread. Lower conviction than yesterday.',
  ASTER: 'Day 2 with DIVERGENT — taker buy 47.31% well under the 50% mark, pct_4h -4.88% inside the daily marks the day-1 enthusiasm fading. OI keeps building +5.30% 24h.',
  H: 'Day 2 inside the band. Funding +0.0398%/8h sits inside +0.03 to +0.07, OI +8.73% 24h confirms longs adding into the trend. Taker buy 51.64% one tick under the breakout gate keeps it MOMENTUM rather than CATALYST-BREAKOUT.',
};

function firstEntryNote(m, a) {
  if (a === 'TON') return `First appearance, ${pctStr(m.pct_24h)} 24h on OI ${pctStr(m.oi_24h_pct)} 24h with funding ${fmtF(m.funding_now)}. Mid-cap drift inside a ${m.range_7d_pct.toFixed(2)}% range.`;
  if (a === 'BEAT') return `First appearance, ${pctStr(m.pct_24h)} 24h with funding ${fmtF(m.funding_now)} climbing on top L/S +${m.top_ls_delta_7d.toFixed(2)} over 7d. STEALTH-POSITIONING blocked by range ${m.range_7d_pct.toFixed(2)}% over the 5% gate.`;
  return `First appearance, ${pctStr(m.pct_24h)} 24h, OI ${pctStr(m.oi_24h_pct)} 24h, funding ${fmtF(m.funding_now)}.`;
}

let regimeChanges = null;
if (havePrior) {
  regimeChanges = [];
  for (const a of assets) {
    const today = metrics[a].regime;
    const prior = priorRegime[a];
    if (prior && prior !== today) {
      const note = overrideNotes[a] || transitionNote(prior, today, a);
      regimeChanges.push({ asset: a, from: prior, to: today, note });
    } else if (!prior) {
      regimeChanges.push({ asset: a, from: '(new entrant)', to: today, note: firstEntryNote(metrics[a], a) });
    } else if (prior === today && overrideNotes[a]) {
      regimeChanges.push({ asset: a, from: prior, to: today, note: overrideNotes[a] });
    }
  }
  // Surface drops from yesterday's universe.
  const todaySet = new Set(assets);
  for (const a of Object.keys(priorRegime)) {
    if (!todaySet.has(a)) {
      regimeChanges.push({ asset: a, from: priorRegime[a], to: '(dropped)', note: 'Universe rotation, out of today\'s top-25 perp volume.' });
    }
  }
}

const watch = [];

function pushWatch(asset, transitionRead) {
  if (!metrics[asset]) return;
  watch.push({ asset, metrics_line: metricLineFor(asset), transition_read: transitionRead });
}

pushWatch('PORTAL',
  'PORTAL pairs +18.36% 24h with vol 7.54x and OI +34.13% 24h, two points under the tier-2 20% breakout gate and one point under the 52% taker gate at 50.71%. Short liqs $727K against $101K weekly p75 confirm forced cover stacked on top of fresh long flow. CATALYST-BREAKOUT fires on a single hourly print clearing both gates together. The setup invalidates through an OI flush if shorts finish covering and longs unwind in the same candle.'
);

pushWatch('HYPE',
  'HYPE dropped out of ACCUMULATION as range climbed to 25.16%, a single tick over the 25% gate. Funding +0.0062%/8h holds positive and OI +10.53% 7d still tracks the day-1 build. One compression day with range under 25% re-prints the regime. A continuation candle past 25% sustains the drop-out.'
);

pushWatch('LAB',
  'LAB carries pct_4h -13.30% inside a -4.89% daily — the cascade keeps running into the close. Funding -0.1599%/8h pays shorts a quarter percent every eight hours, the deepest negative in the universe. Either the unwind accelerates into a tier-2 -10% capitulation gate or shorts capitulate into a vertical leg. Taker buy 50.46% offers no directional tell yet.'
);

pushWatch('ID',
  'ID prints funding -0.1652%/8h paired with basis +1.3906 and OI -7.93% 24h. Top L/S 1.02 with delta -0.52 over 7d marks smart money de-risking the position. The structural cost of staying short cannot hold through the week — either short capitulation drives a vertical leg or long unwind gives back the +28.45% 7d gain.'
);

pushWatch('UB',
  'UB cleared the tier-2 -10% drawdown gate at -10.48% 24h but OI -6.12% missed the -10% flush gate by half. Liq $300K against $993K weekly p75 marks the move ran without panic. CAPITULATION fires on a continuation candle that pushes OI past the -10% mark. The setup invalidates if OI stabilizes and price rebuilds the day.'
);

const neutralSummary = `Neutral · ${totalAssessed} assessed, ${watch.length} surfaced to WATCH · full data in the tail`;

const regime_empty_notes = {};
for (const r of REGIME_ORDER) {
  if (regimes[r].length > 0) continue;
  if (r === 'CATALYST-BREAKOUT') {
    regime_empty_notes[r] = 'no asset pairs a breakout-grade move with taker buy above 52%. PORTAL holds the closest near-miss at +18.36% 24h on vol 7.54x and OI +34.13% 24h, two points under the tier-2 20% price gate and one point under the 52% taker gate at 50.71%. ALLO funding climbed to +0.0289%/8h with pct_4h +8.24% but vol 0.30x kills the regime gate.';
  } else if (r === 'SHORT-SQUEEZE') {
    regime_empty_notes[r] = 'no asset pairs a >10% rip with OI rolling negative. PORTAL ripped +18.36% on OI +34.13% 24h — fresh longs piling in, not forced cover. UB printed -10.48% (a drawdown, not a rip). XLM +6.45% on OI -2.26% 24h carries the closest squeeze shape, but short liqs $1.3M sit well under the $4.7M weekly p75 mark.';
  } else if (r === 'MOMENTUM') {
    regime_empty_notes[r] = 'only H clears the band today. HEI rolled out as funding +0.0077%/8h dropped under +0.03 with OI -16.00% 24h flushing. LAB carries pct_7d +76.91% but funding -0.1599%/8h sits at the deepest negative print in the universe — the trend is bleeding longs through funding, not riding them.';
  } else if (r === 'COMPRESSION') {
    regime_empty_notes[r] = 'no asset holds sub-5% range with an OI build and flat funding. HYPE prints the tightest range build at 25.16% — five times the tier-2 5% gate. BTC range 7.79% sits comfortably above the tier-1 3% gate. The universe is too dispersed today for a compression print.';
  } else if (r === 'DISTRIBUTION') {
    regime_empty_notes[r] = 'no asset pairs extreme funding with a 5% OI build and slowing gains. BEAT funding +0.0243%/8h is the highest positive in the universe but sits well under the tier-2 +0.08 trigger. ALLO +0.0289%/8h paired with OI +9.51% 24h misses the tier-2 funding gate by a wide margin.';
  } else if (r === 'CAPITULATION') {
    regime_empty_notes[r] = 'no drawdown pairs negative funding with an OI flush past the liquidation 75th percentile. UB cleared the tier-2 -10% drawdown gate at -10.48% but OI -6.12% misses the -10% flush gate by half. LAB pct_24h -4.89% missed the tier-2 drawdown gate by half, even with funding -0.1599%/8h at the deepest negative in the universe.';
  }
}

const cycle =
  'Yesterday\'s leverage build thins from five prints to three. HYPE dropped out of ACCUMULATION as range crossed the 25% gate. HEI dropped out of MOMENTUM on -6.98% 24h with OI -16% flushing. BNB and ASTER hold ACCUMULATION on day 2 but both flip to DIVERGENT — taker buy under 50% on both, OI building passively rather than across the spread. H carries MOMENTUM day 2 with funding +0.0398%/8h inside the band.';
const forward =
  'PORTAL pairs the cleanest near-miss in the universe — pct_24h +18.36% on vol 7.54x, OI +34.13% 24h, taker buy 50.71%. Either a single hourly print clears the tier-2 20% price gate and the 52% taker gate together, or the OI flushes through the day. LAB carries the day-2 cascade with pct_4h -13.30% inside a -4.89% daily. ID structural funding -0.1652%/8h against basis +1.3906 resolves through short capitulation or long unwind by week-end. Watch UB for the OI flush that promotes its -10.48% 24h into CAPITULATION.';

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
console.log(`  prior: ${PRIOR ? PRIOR.path + ' @ ' + PRIOR.date : 'none'}`);
console.log(`  verdict: ${verdictWord}`);
console.log(`  regime counts: ${JSON.stringify(counts)}`);
console.log(`  transitions: ${(regimeChanges || []).length}`);
console.log(`  watch: ${watch.length}`);
console.log(`  tail: ${tail.length}`);
