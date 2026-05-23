#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// for the 2026-05-23 10:43Z prefetch. Successor to _perps_scan_build_0957.mjs.
import fs from 'node:fs';

const TODAY = '2026-05-23';
const PREFETCH_LABEL = '10:43Z';
const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

// Yesterday's universe (2026-05-22 final 15:45Z scan): 25 assets, 100% NEUTRAL
// (per memory/logs/2026-05-22.md line 661). Reuse the morning's mapping; today's
// new entrants vs yesterday's universe: BEAT, GENIUS, BCH, INJ, FIL.
const YESTERDAY = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  HYPE: 'NEUTRAL', NEAR: 'NEUTRAL', ZEC: 'NEUTRAL', EDEN: 'NEUTRAL',
  XRP: 'NEUTRAL', DOGE: 'NEUTRAL', BSB: 'NEUTRAL',
  SUI: 'NEUTRAL', ONDO: 'NEUTRAL', WLD: 'NEUTRAL',
  BNB: 'NEUTRAL', BILL: 'NEUTRAL', TON: 'NEUTRAL', ADA: 'NEUTRAL',
  TAO: 'NEUTRAL', LINK: 'NEUTRAL', '1000PEPE': 'NEUTRAL',
};

function fmtUsd(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(x / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(x / 1e3).toFixed(0)}K`;
  return `$${x.toFixed(0)}`;
}

function fmtPrice(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  if (x >= 1000) return `$${x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  if (x >= 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(4)}`;
}

function pct(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const sign = x >= 0 ? '+' : '';
  return `${sign}${x.toFixed(d)}%`;
}

function pctSigned(x, d) {
  return pct(x, d);
}

function rnd(x, d) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(Number(x).toFixed(d));
}

function buildBsbMetricsLine(m) {
  return (
    `${pct(m.pct_24h)} 24h, ${pct(m.pct_7d)} 7d, ` +
    `OI ${pct(m.oi_24h_pct)} 24h on OI ${pct(m.oi_7d_pct)} 7d, ` +
    `funding ${pctSigned(m.funding_now, 4)}/8h ` +
    `(7d avg ${pctSigned(m.funding_7d_avg, 4)}, ` +
    `delta ${pctSigned(m.funding_delta, 4)}), ` +
    `taker buy ${m.taker_buy_pct_24h.toFixed(2)}%, ` +
    `liq ${fmtUsd(m.liq_24h_total)} vs 7d p75 ${fmtUsd(m.liq_7d_p75)}, ` +
    `top L/S ${m.top_ls_now.toFixed(2)} down ${Math.abs(m.top_ls_delta_7d).toFixed(2)} 7d, ` +
    `pct_4h ${pct(m.pct_4h)}, vol ${m.vol_ratio.toFixed(2)}x (partial bar)`
  );
}

function transitionNote(asset, prior, current, m) {
  if (asset === 'BSB' && prior === 'NEUTRAL' && current === 'MOMENTUM') {
    return (
      'Pct_7d +201.88% clears the Tier 2 +15% MOMENTUM floor. OI +47.15% 24h on OI +329.30% 7d clears the OI≥0 gate. ' +
      'Funding +0.0560%/8h sits inside the +0.03 to +0.07 MOMENTUM band — new longs paying premium but not yet at the +0.08% Tier 2 DIST gate. ' +
      'Pct_24h +39.60% cooled from the 09:57Z +41.64% slice yet still outruns pct_7d/7 of +28.84%. Gains-accelerating blocks DISTRIBUTION even though funding crept +0.009pp closer to the DIST trigger. ' +
      'Top L/S 1.99 down 0.52 over 7d reads as smart money exiting into retail leverage. The leverage stack is repricing higher, not rolling over. ' +
      'Same coin, same setup, third intra-day data point confirms MOMENTUM holds.'
    );
  }
  return '';
}

function buildWatchMetric(m) {
  const parts = [];
  parts.push(`${pct(m.pct_24h)} 24h, ${pct(m.pct_7d)} 7d`);
  parts.push(`OI ${pct(m.oi_24h_pct)} 24h on OI ${pct(m.oi_7d_pct)} 7d`);
  parts.push(`funding ${pctSigned(m.funding_now, 4)}/8h (7d avg ${pctSigned(m.funding_7d_avg, 4)})`);
  if (Number.isFinite(m.taker_buy_pct_24h)) parts.push(`taker buy ${m.taker_buy_pct_24h.toFixed(2)}%`);
  if (Number.isFinite(m.liq_24h_total)) parts.push(`liq ${fmtUsd(m.liq_24h_total)} vs 7d p75 ${fmtUsd(m.liq_7d_p75)}`);
  if (Number.isFinite(m.top_ls_now) && Number.isFinite(m.top_ls_delta_7d)) {
    const dir = m.top_ls_delta_7d < 0 ? 'down' : 'up';
    parts.push(`top L/S ${m.top_ls_now.toFixed(2)} ${dir} ${Math.abs(m.top_ls_delta_7d).toFixed(2)} 7d`);
  }
  if (m.basis_now !== null && m.basis_now !== undefined && Number.isFinite(m.basis_now)) {
    parts.push(`basis ${pctSigned(m.basis_now, 3)}`);
  }
  if (Number.isFinite(m.pct_4h)) parts.push(`pct_4h ${pct(m.pct_4h)}`);
  if (Number.isFinite(m.vol_ratio)) parts.push(`vol ${m.vol_ratio.toFixed(2)}x`);
  return parts.join(', ');
}

// Watch-bucket interpretation prose — composed against the 10:43Z slice.
const READS = {
  EDEN: (
    'Funding rolled back negative this slice. -0.0185%/8h now versus +0.0281% at 09:57Z. The CAPITULATION sign-flip block just lifted. ' +
    'Pct_24h -11.24% clears the Tier 2 -10% drawdown gate and OI -30.10% clears the -10% OI gate. ' +
    'Liq $866K still sits one-third of the 7d p75 $2.13M — the liquidation gate alone now holds EDEN out of CAPITULATION. ' +
    'Pct_4h +1.67% means the structure rebuilt over the last few hours and the cascade ended earlier. ' +
    'A second leg down with liq pushing past $2M completes the setup. Liq trajectory is the key variable.'
  ),
  BEAT: (
    "The morning's bounce extended hard. Pct_24h jumped to +11.72% from +1.52% at 09:57Z and pct_4h prints +19.78% — the move delivered in the last 4 hours. " +
    'Vol 3.22x clears the 2.0 CATALYST-BREAKOUT floor. Taker buy 51.66% sits 0.34pp under the 52% gate. Pct_24h sits 8.28pp under the +20% Tier 2 trigger. ' +
    'OI +17.31% 24h with top L/S 1.30 down 0.65 over 7d reads as retail leverage stacking while smart money distributes. ' +
    'Liq $2.22M past the 7d p75 of $1.14M weighs against the breakout read. ' +
    'Another 4h extending pct_24h through +20% on taker buy clearing 52% fires CATALYST-BREAKOUT. A reversal with funding pushing +0.08% fires LONG-TRAP.'
  ),
  GENIUS: (
    'Funding flipped slightly negative -0.0005%/8h from the +0.0073% 7d avg. The premium-paying stack now pays nothing. ' +
    'Pct_24h -6.93% on OI -6.43% 24h against OI +124.24% 7d extends the late-longs unwind. ' +
    'Liq $498K prints heavy at 2.76x the thin 7d p75 of $180K. Vol 1.93x clears the heavy-day threshold. ' +
    'Top L/S 1.36 down 0.37 over 7d holds the smart-money-fade read. ' +
    'Another red day with OI extending lower and funding pushing further negative fires CAPITULATION-shaped flow.'
  ),
  BCH: (
    'Pct_24h -4.35% on pct_7d -17.04% with OI -9.88% 7d — multi-day bleed without leverage rebuild. ' +
    "Top L/S 1.19 down 1.43 over 7d marks the heaviest smart-money exit in today's universe. The long-side conviction has rolled off entirely. " +
    'Funding -0.0336%/8h with basis +0.122% — spot still premium against a shorted future, an arb shape rather than directional positioning. ' +
    'Liq $887K sits at the 7d p75 of $898K and pct_4h -4.71% means the move is still extending. ' +
    'Another -5% day with OI tracking lower fires CAPITULATION on the Tier 2 -10% drawdown gate.'
  ),
  NEAR: (
    "Yesterday's rip exhaled into a soft -0.86% red, less than the morning's -1.29%. " +
    'Pct_4h +1.12% means the bid returned over the last 4 hours. OI -3.96% 24h means the late longs unwound without panic. ' +
    'Funding repaired to +0.0085%/8h above the +0.0061% 7d avg. Fresh longs are paying premium into the consolidation. ' +
    'Range 59.78% still blocks NEAR out of ACCUMULATION even though OI +127.30% 7d would qualify. ' +
    'A 2-3 day consolidation under $2.10 with range tightening re-arms the regime.'
  ),
  HYPE: (
    'Pct_24h +1.84% on OI +0.67% — coiling at the top of the +33.06% 7d run. ' +
    'Funding repaired to +0.0081%/8h from the +0.0009% 7d avg. New longs are paying premium. ' +
    'Taker buy 51.43% sits 0.57pp below the 52% CATALYST-BREAKOUT gate. ' +
    'Range 51.57% still blocks ACCUMULATION even though OI +45.88% 7d would qualify. ' +
    'A consolidation week with range tightening under 25% fires ACCUMULATION CONFIRMED.'
  ),
};

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;
const assets = Object.keys(metrics);

const byRegime = Object.fromEntries(REGIME_ORDER.map(r => [r, []]));
const neutralAssets = [];
for (const asset of assets) {
  const r = metrics[asset].regime;
  if (r === 'NEUTRAL') neutralAssets.push(asset);
  else if (r in byRegime) byRegime[r].push(asset);
}

const regimes = Object.fromEntries(REGIME_ORDER.map(r => [r, []]));
for (const r of REGIME_ORDER) {
  for (const asset of byRegime[r]) {
    const m = metrics[asset];
    regimes[r].push({
      asset,
      tier: m.tier,
      marker: 'bullet',
      repeat_days_suffix: null,
      metrics_line: asset === 'BSB' ? buildBsbMetricsLine(m) : buildWatchMetric(m),
      tags: [],
    });
  }
}

const transitions = [];
for (const asset of assets) {
  const prior = YESTERDAY[asset];
  const current = metrics[asset].regime;
  if (prior !== undefined && prior !== current) {
    transitions.push({
      asset, from: prior, to: current,
      note: transitionNote(asset, prior, current, metrics[asset]),
    });
  }
}

const watchCandidates = ['EDEN', 'BEAT', 'GENIUS', 'BCH', 'NEAR', 'HYPE'];
const watch = [];
for (const asset of watchCandidates) {
  if (!(asset in metrics)) continue;
  if (metrics[asset].regime !== 'NEUTRAL') continue;
  const m = metrics[asset];
  watch.push({
    asset,
    metrics_line: buildWatchMetric(m),
    transition_read: READS[asset] || '',
  });
}

const tail = [];
for (const asset of assets) {
  const m = metrics[asset];
  tail.push({
    asset,
    tier: m.tier,
    regime: m.regime,
    sub_tags: m.sub_tags || [],
    pattern_tags: m.pattern_tags || [],
    metrics: {
      price: fmtPrice(m.current_price),
      pct_24h: rnd(m.pct_24h, 2),
      pct_7d: rnd(m.pct_7d, 2),
      pct_4h: rnd(m.pct_4h, 2),
      range_7d: Number.isFinite(m.range_7d_pct) ? `${m.range_7d_pct.toFixed(2)}%` : '—',
      pct_24h_vs_btc: rnd(m.pct_24h_vs_btc, 2),
      pct_7d_vs_btc: rnd(m.pct_7d_vs_btc, 2),
      oi_usd: fmtUsd(m.oi_now),
      oi_24h_pct: rnd(m.oi_24h_pct, 2),
      oi_7d_pct: rnd(m.oi_7d_pct, 2),
      funding_now: rnd(m.funding_now, 4),
      funding_7d_avg: rnd(m.funding_7d_avg, 4),
      funding_delta: rnd(m.funding_delta, 4),
      liq_24h: fmtUsd(m.liq_24h_total),
      liq_7d_p75: fmtUsd(m.liq_7d_p75),
      long_liqs: fmtUsd(m.long_liqs_24h),
      short_liqs: fmtUsd(m.short_liqs_24h),
      liqs_4h: fmtUsd(m.liqs_4h),
      top_ls: rnd(m.top_ls_now, 2),
      top_ls_7d_avg: rnd(m.top_ls_7d_avg, 2),
      top_ls_delta_7d: rnd(m.top_ls_delta_7d, 2),
      basis: rnd(m.basis_now, 4),
      taker_buy: rnd(m.taker_buy_pct_24h, 2),
    },
    yesterday_regime: YESTERDAY[asset] ?? null,
    repeat_days: YESTERDAY[asset] === m.regime ? 2 : 1,
  });
}

const nTotal = assets.length;
const nNeutral = neutralAssets.length;
const classified = nTotal - nNeutral;

const distParts = [];
for (const r of REGIME_ORDER) {
  const c = byRegime[r].length;
  if (c > 0) distParts.push(`${c} ${r}`);
}
distParts.push(`${nNeutral} NEUTRAL`);
const distribution = `${distParts.join(', ')} across ${nTotal} assessed on the ${PREFETCH_LABEL} prefetch.`;

const neutralShare = nNeutral / nTotal;
const word = neutralShare >= 0.8 ? 'QUIET' : (classified > 0 ? 'MIXED' : 'QUIET');

const cycle = (
  'BSB extends MOMENTUM on the third intra-day slice. Pct_24h cooled +41.64 to +39.60 while funding crept +0.047 to +0.056%/8h, two ticks below the +0.08% Tier 2 DIST gate. The leverage stack repriced higher without rolling over. ' +
  'BEAT delivered the cleanest fresh-move print of the day. Pct_4h +19.78% on vol 3.22x cleared the 2.0 CATALYST-BREAKOUT floor, but pct_24h +11.72% sits 8.28pp under the +20% Tier 2 trigger and taker buy 51.66% lacks the 52% gate by 0.34pp. ' +
  "EDEN's funding rolled back negative -0.018%, lifting the sign-flip block on CAPITULATION. Liq $866K below the 7d p75 $2.13M now stands as the only gate holding the regime back."
);

const forward = (
  'BSB needs a flat-to-red day with funding pushing through +0.08%/8h to flip MOMENTUM into DISTRIBUTION via the gains-slowing gate. ' +
  'BEAT needs another 4h extending pct_24h through +20% with taker buy clearing 52% to fire CATALYST-BREAKOUT. A reversal here with funding pushing +0.08% fires LONG-TRAP. ' +
  'EDEN needs a $2M+ liq print to complete CAPITULATION. ' +
  "BCH carries the heaviest smart-money exit in the universe (top L/S 1.19 down 1.43 7d). Another -5% day fires CAPITULATION on the Tier 2 -10% drawdown gate. " +
  'GENIUS funding flipped slightly negative this slice. Another red day extends the late-longs unwind into CAPITULATION-shaped flow.'
);

const regime_empty_notes = {
  'ACCUMULATION': 'HYPE +33.06% 7d / OI +45.88% 7d sits at range 51.57%, blocked by the 25% range gate. NEAR +39.24% 7d / OI +127.30% 7d sits at range 59.78%, same gate.',
  'CATALYST-BREAKOUT': 'BEAT prints pct_4h +19.78% on vol 3.22x and OI +17.31% 24h, but pct_24h +11.72% sits 8.28pp under the +20% Tier 2 trigger and taker buy 51.66% lacks the 52% gate by 0.34pp. BSB pct_24h +39.60% has vol 0.74x and taker buy 50.58% — both block.',
  'SHORT-SQUEEZE': 'BSB and BEAT both clear the +10% Tier 2 pct_24h gate, but OI +47.15% / +17.31% blocks the oi<0 requirement on both.',
  'COMPRESSION': "no Tier 2 asset under the 5% range gate today. BNB at 4.81% range clears the Tier 2 gate but OI 7d -4.43% fails the +5% OI build. BTC sits in Tier 1 with a 3% range gate that the 5.88% read fails.",
  'DISTRIBUTION': 'BSB funding +0.0560% sits 0.024pp under the +0.08% Tier 2 DIST gate. Pct_24h +39.60% outran pct_7d/7 of +28.84%, so gains-accelerating blocks the regime even at the funding-trigger threshold.',
  'CAPITULATION': "EDEN cleared pct_24h -11.24% / oi_24h -30.10% / funding<0 gates this slice — only liq $866K below the 7d p75 $2.13M now blocks the regime. The liquidation gate is the lone hold-out.",
};

const data = {
  date: TODAY,
  edge_case: null,
  verdict: { word, distribution, cycle, forward },
  regime_changes: transitions,
  regimes,
  regime_empty_notes,
  watch,
  neutral_summary: `Neutral · ${nNeutral} other assets · see artifact tail for full data`,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(data, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — MOM=${byRegime.MOMENTUM.length} DIST=${byRegime.DISTRIBUTION.length} NEUTRAL=${nNeutral} watch=${watch.length} tail=${tail.length} transitions=${transitions.length}`);
