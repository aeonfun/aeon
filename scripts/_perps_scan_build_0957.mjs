#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// for the 2026-05-23 09:57Z prefetch. Successor to _build_perps_scan_fresh.mjs,
// which was authored for the earlier 07:02Z cache state.
import fs from 'node:fs';

const TODAY = '2026-05-23';
const PREFETCH_LABEL = '09:57Z';
const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

// Yesterday's universe per memory/logs/2026-05-22.md — 25 assets, 100% NEUTRAL.
const YESTERDAY = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  HYPE: 'NEUTRAL', NEAR: 'NEUTRAL', ZEC: 'NEUTRAL', EDEN: 'NEUTRAL',
  XRP: 'NEUTRAL', DOGE: 'NEUTRAL', BSB: 'NEUTRAL',
  SUI: 'NEUTRAL', ONDO: 'NEUTRAL', WLD: 'NEUTRAL',
  BNB: 'NEUTRAL', BILL: 'NEUTRAL', TON: 'NEUTRAL', ADA: 'NEUTRAL',
  TAO: 'NEUTRAL', LINK: 'NEUTRAL', '1000PEPE': 'NEUTRAL',
};
// New entrants today vs yesterday's universe: BEAT, GENIUS, BCH, INJ, FIL.
// Yesterday's drops not in today's universe: PROVE, FIDA, LIT, ASTER, CL, GRASS.

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
      'Pct_7d +206.29% clears the Tier 2 +15% MOMENTUM floor. OI +48.48% 24h on OI +333.19% 7d clears the OI≥0 gate. ' +
      'Funding +0.0470%/8h sits inside the +0.03 to +0.07 MOMENTUM band — new longs paying a premium but not yet at extreme. ' +
      'Pct_24h +41.64% reaccelerated from the earlier 07:02Z slice (+23.37%) and outran pct_7d/7 of +29.47%. Gains-accelerating now blocks DISTRIBUTION even though funding 7d avg sits at +0.0136%. ' +
      'Top L/S 1.91 down 0.60 over 7d reads as smart money exiting into retail leverage, but the leverage is still building rather than rolling over. ' +
      'Same coin, same setup, a different read against fresher data.'
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

// Watch-bucket interpretation prose — composed against the 09:57Z slice.
const READS = {
  EDEN: (
    "Yesterday's -12.79% / OI -19.44% / funding -0.266% setup printed back-to-back: today's pct_24h sits -14.68% but OI dumped harder at -32.48%. " +
    'Funding flipped positive at +0.0281%/8h from -0.266% earlier (7d avg -0.0327%). The short pile cleared during the flush and longs are paying premium again. ' +
    'Pct_4h -0.22% means the cascade ended hours ago and the structure is rebuilding. Liq $822K still sits well under the 7d p75 of $2.13M. ' +
    'Funding sign flip now blocks CAPITULATION (the rule requires funding < 0). A second leg down with funding rolling back negative re-arms the regime.'
  ),
  BEAT: (
    "Yesterday's -6.63% / liq $1.41M setup absorbed: today's pct_24h +1.52% on vol 2.87x — first vol reading clear of the 2.0 CATALYST-BREAKOUT floor in the watch bucket. " +
    'Pct_24h +1.52% sits 18pp below the +20% Tier 2 breakout trigger, blocking the regime. ' +
    'Liq $1.88M still prints past the 7d p75 of $1.06M — the bounce reads distributive, not demand-led. ' +
    'Top L/S 1.33 down 0.62 over 7d holds the smart-money-exit read. ' +
    'A second up-day clearing +20% on taker buy through 52% fires CATALYST-BREAKOUT. Another red day with funding pushing +0.08% fires LONG-TRAP.'
  ),
  GENIUS: (
    'Pct_24h -6.82% on OI -5.35% 24h against OI +126.83% 7d — early signs of the late-longs unwind. ' +
    'Funding cooled to +0.0008%/8h from the +0.0078% 7d avg, so the leverage stack is no longer paying premium. ' +
    'Liq $482K against a thin 7d p75 of $176K already prints heavy on relative terms. ' +
    'Top L/S 1.34 down 0.39 over 7d holds the smart-money-fade read. ' +
    'Another red day with OI extending lower and funding turning negative fires CAPITULATION-shaped flow.'
  ),
  HYPE: (
    'Pct_24h +1.56% on OI +0.10% — coiling at the top of the +32.70% 7d run. ' +
    'Funding repaired to +0.0082%/8h from the +0.0009% 7d avg. New longs are now paying premium. ' +
    'Taker buy 51.21% sits 0.79pp below the 52% CATALYST-BREAKOUT gate. ' +
    'Range 51.57% still blocks ACCUMULATION even though OI +45.05% 7d would qualify. ' +
    'A consolidation week with range tightening under 25% fires ACCUMULATION CONFIRMED.'
  ),
  NEAR: (
    "Yesterday's rip exhaled into a soft -1.29% red. OI -3.99% 24h means the late longs unwound without panic. " +
    'Funding repaired to +0.0089%/8h above the +0.0061% 7d avg — fresh longs paying premium into the consolidation. ' +
    'Range 59.78% holds NEAR out of ACCUMULATION even though OI +127.22% 7d would qualify. ' +
    'A 2-3 day consolidation under $2.10 with range tightening re-arms the regime.'
  ),
  BCH: (
    'Pct_24h -4.48% on pct_7d -17.16% with OI -10.20% 7d — a multi-day bleed without leverage rebuild. ' +
    "Top L/S 1.18 down 1.44 over 7d marks one of the heaviest smart-money exits in today's universe. The entire long-side conviction has rolled off. " +
    'Funding -0.0281%/8h with basis +0.174% — spot premium against a shorted future, an arb shape rather than directional positioning. ' +
    'Liq $886K already sits at the 7d p75 ($897K) and pct_4h -4.80% means the move is still extending. ' +
    'Another -5% day with OI tracking lower fires CAPITULATION on the Tier 2 -10% drawdown gate.'
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

const watchCandidates = ['EDEN', 'BEAT', 'GENIUS', 'NEAR', 'HYPE', 'BCH'];
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

// Verdict word — spec table:
//   QUIET — ≥80% in NEUTRAL
//   TRENDING — many MOMENTUM (≥4)
//   MIXED — no dominant regime
// Today 24/25 = 96% NEUTRAL — QUIET dominates even with the lone MOMENTUM print.
const neutralShare = nNeutral / nTotal;
const word = neutralShare >= 0.8 ? 'QUIET' : (classified > 0 ? 'MIXED' : 'QUIET');

const cycle = (
  'BSB resumed its run. Pct_24h reaccelerated to +41.64% on OI +48.48% 24h with funding cooled to +0.0470%/8h. MOMENTUM fires. ' +
  'Pct_7d +206.29% on OI +333.19% 7d with vol 0.59x on partial-bar data. The leverage stack is still building, not rolling. ' +
  'EDEN traded another -14.68% day with OI -32.48%, but funding flipped positive +0.0281% from negative. The short pile cleared during the flush and CAPITULATION now blocks on the sign requirement. ' +
  'BEAT bounced +1.52% on vol 2.87x but liq $1.88M past the 7d p75 reads as distribution into the bounce, not demand.'
);

const forward = (
  'BSB carries the only regime print today. A funding push back through +0.08%/8h on a flat-to-red day flips MOMENTUM into DISTRIBUTION via the gains-slowing gate. ' +
  'EDEN sits one tick from re-arming CAPITULATION. Funding rolling back negative on continued OI bleed completes the setup. ' +
  "BCH carries the heaviest smart-money exit in the universe (top L/S 1.18 down 1.44 7d) on a -17.16% 7d bleed. Another -5% day fires CAPITULATION on the Tier 2 -10% gate. " +
  'Vol ratios sit 0.32-2.87 against the 2.0 CATALYST-BREAKOUT floor. BEAT alone clears it but lacks the pct trigger.'
);

const regime_empty_notes = {
  'ACCUMULATION': 'HYPE +32.70% 7d / OI +45.05% 7d sits at range 51.57%, blocked by the 25% range gate. NEAR +38.64% 7d / OI +127.22% 7d sits at range 59.78%, same gate.',
  'CATALYST-BREAKOUT': 'BSB carries the highest pct_24h at +41.64% on OI +48.48% but vol 0.59x and taker buy 50.56% both block. BEAT clears vol at 2.87x but pct_24h +1.52% sits 18pp under the +20% Tier 2 trigger.',
  'SHORT-SQUEEZE': 'BSB pct_24h +41.64% clears the +10% Tier 2 squeeze gate but oi_24h +48.48% blocks the oi<0 requirement.',
  'COMPRESSION': "no Tier 2 asset under the 5% range gate today. BNB at 4.81% range clears the Tier 2 gate but OI 7d -4.10% fails the +5% OI build. BTC sits in Tier 1 with a 3% range gate that the 5.88% read fails.",
  'DISTRIBUTION': 'BSB funding +0.0470% cooled below the +0.08% Tier 2 DIST gate (was +0.0893% earlier in the day). Pct_24h +41.64% outran pct_7d/7 of +29.47%, so gains-accelerating blocks the regime.',
  'CAPITULATION': 'EDEN cleared pct_24h -14.68% / oi_24h -32.48% gates but funding flipped positive +0.0281% during the flush, blocking the funding<0 gate. Liq $822K still sits one-third of the 7d p75 $2.13M.',
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
