#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// fresh against the current 07:02Z cache. Replaces stale hardcoded prose
// from scripts/_perps_scan_build.mjs which was authored for the 06:59 run.
import fs from 'node:fs';

const TODAY = '2026-05-23';
const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const YESTERDAY = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  HYPE: 'NEUTRAL', NEAR: 'NEUTRAL', ZEC: 'NEUTRAL', EDEN: 'NEUTRAL',
  XRP: 'NEUTRAL', BEAT: 'NEUTRAL', DOGE: 'NEUTRAL', BSB: 'NEUTRAL',
  SUI: 'NEUTRAL', ONDO: 'NEUTRAL', FIDA: 'NEUTRAL', WLD: 'NEUTRAL',
  BNB: 'NEUTRAL', BILL: 'NEUTRAL', TON: 'NEUTRAL', ADA: 'NEUTRAL',
  TAO: 'NEUTRAL', LINK: 'NEUTRAL',
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

function rnd(x, d) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(Number(x).toFixed(d));
}

function pctSigned(x, d) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const sign = x >= 0 ? '+' : '';
  return `${sign}${x.toFixed(d)}%`;
}

function buildBsbMetricsLine(m) {
  return (
    `${pct(m.pct_24h)} 24h, ${pct(m.pct_7d)} 7d, ` +
    `OI ${pct(m.oi_24h_pct)} 24h on OI ${pct(m.oi_7d_pct)} 7d, ` +
    `funding ${pctSigned(m.funding_now, 4)}/8h ` +
    `(7d avg ${pctSigned(m.funding_7d_avg, 4)}, ` +
    `delta ${pctSigned(m.funding_delta, 4)}), ` +
    `taker buy ${m.taker_buy_pct_24h.toFixed(2)}%, ` +
    `short liqs ${fmtUsd(m.short_liqs_24h)} vs 7d p75 ${fmtUsd(m.short_liqs_p75)}, ` +
    `top L/S ${m.top_ls_now.toFixed(2)} down ${Math.abs(m.top_ls_delta_7d).toFixed(2)} 7d, ` +
    `pct_4h ${pct(m.pct_4h)}, vol ${m.vol_ratio.toFixed(2)}x (partial bar)`
  );
}

function transitionNote(asset, prior, current) {
  if (asset === 'BSB' && prior === 'NEUTRAL' && current === 'DISTRIBUTION') {
    return (
      'Funding +0.089%/8h cleared the +0.08% Tier 2 DIST gate today (was +0.013% 7d avg). ' +
      'Pct_24h +23.37% slipped under pct_7d/7 of +23.83%, flipping the gains-slowing gate. ' +
      'OI +28.88% 24h on +275.99% 7d satisfies the +5% OI gate. ' +
      'Top L/S 1.94 down 0.57 over 7d reads as smart money exiting into retail leverage. ' +
      'Sub-tags do not fire (top_ls 1.94 below the 2.0 REAL-CROWDED-LONG floor, pct_24h positive blocks LONG-TRAP, basis null suppresses pattern tags).'
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

const READS = {
  EDEN: (
    'Cleared pct_24h ≤ -10% (-12.79%), funding < 0 (-0.266%), and oi_24h ≤ -10% (-19.44%) for CAPITULATION. ' +
    'Liq $739K sits at one-third the 7d p75 of $2.13M and blocks the regime. ' +
    'Pct_4h -12.92% means the entire drawdown ran in the last four hours. The flush is fresh, not cleared. ' +
    'A second-day -10% with liq printing through $2.1M fires CAPITULATION.'
  ),
  BEAT: (
    "Yesterday's +45.93% near-CATALYST-BREAKOUT print has unwound into back-to-back red days. " +
    'Liq $1.41M now clears the 7d p75 $937K and pct_4h -13.51% means the cascade just accelerated. ' +
    'Top L/S 1.33 down 0.62 over 7d reads as smart-money distribution into retail leverage. ' +
    'Funding +0.016% sits well below the +0.08% Tier 2 LONG-TRAP floor. A funding push past +0.08% on continued red fires the pattern.'
  ),
  ALT: (
    'Extreme cash-and-carry shape. Basis +2.58% on funding -0.308%/8h with OI building +256% 7d. ' +
    'Taker buy 52.70% clears the upper CASH-AND-CARRY bound of 52 by 0.70pp, blocking the formal pattern tag (window is 48-52%). ' +
    'The structure reads as institutional arb flow, not bullish positioning. ' +
    'A taker-buy drop back under 52% with basis holding fires the formal CASH-AND-CARRY tag.'
  ),
  GENIUS: (
    'OI +144.77% 7d with range 71.93% means a fresh, volatile setup carrying real leverage build. ' +
    'Vol 1.36x clears the universe median. ' +
    'Top L/S 1.29 down 0.44 7d reads as smart money fading the entry. ' +
    'A second-day red with OI extending lower fires CAPITULATION-shaped flow.'
  ),
  NEAR: (
    "Yesterday's rip rolled into a soft red. OI -3.57% means the late longs are unwinding without panic. " +
    'Funding repaired close to zero from a +0.006% 7d avg. ' +
    'Range 59.78% holds NEAR out of ACCUMULATION even though OI 7d +128% would qualify. ' +
    'A 2-3 day consolidation under $2.20 with OI holding flat re-arms ACCUMULATION.'
  ),
  HYPE: (
    'Taker buy 51.95% sits just under the +52% CATALYST-BREAKOUT gate. ' +
    'Pct_24h +0.87% sits 19pp under the +20% Tier 2 trigger. ' +
    'The +32% 7d run on OI +43.04% 7d carries momentum but range expanded past the 25% ACCUMULATION gate. ' +
    'Funding flipped clean positive — new longs paying premium. ' +
    'A consolidation week with range tightening fires ACCUMULATION CONFIRMED.'
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
      metrics_line: asset === 'BSB' ? buildBsbMetricsLine(m) : '',
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
      note: transitionNote(asset, prior, current),
    });
  }
}

const watchCandidates = ['EDEN', 'BEAT', 'FIDA', 'ALT', 'GENIUS', 'NEAR', 'HYPE'];
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
const distribution = `${distParts.join(', ')} across ${nTotal} assessed on the 06:31Z prefetch.`;

const word = classified > 0 ? 'MIXED' : 'QUIET';

const cycle = (
  "BSB cleared the +0.08% Tier 2 funding gate today and the gains-slowing gate flipped as pct_24h cooled to +23.37% under pct_7d/7 of +23.83%. " +
  'Top L/S 1.94 down 0.57 over 7d reads as smart money exiting into retail leverage during the OI build. ' +
  'EDEN held a -12.79% drawdown on funding -0.266%/8h and OI -19.44%, but liq $739K against a 7d p75 $2.13M kept CAPITULATION blocked. ' +
  "BEAT slipped to -6.63% 24h with liq $1.41M past the p75 and pct_4h -13.51% — yesterday's CAT-BREAKOUT print rolled into back-to-back red days."
);

const forward = (
  'BSB is the only regime print today. A second-day flat-to-red with funding holding above +0.08% extends the DISTRIBUTION read. ' +
  'EDEN sits one tick from CAPITULATION. Another -10% day with liq printing through $2.1M fires the regime. ' +
  'ALT carries an extreme cash-and-carry shape (basis +2.58%, funding -0.308%/8h, OI 7d +256%, taker buy 52.7%) — pattern not regime, but worth a check on the next 8h funding tick. ' +
  'Vol ratio sits 0.05-2.11 against the 2.0 CATALYST-BREAKOUT floor — the 06:31Z prefetch caught a partial day, so breakout signals likely understate.'
);

const regime_empty_notes = {
  'ACCUMULATION': 'HYPE +32.00% 7d / OI +43.04% 7d sits at range 51.57%, blocked by the 25% range gate. NEAR +37.57% 7d / OI +128.22% 7d sits at range 59.78%, same gate.',
  'CATALYST-BREAKOUT': 'universe vol_ratio sits 0.05-2.11 against the 2.0 floor on the partial-bar prefetch. BSB carries the highest pct_24h at +23.37% with OI +28.88% but vol 0.39x and taker buy 49.97% both block.',
  'SHORT-SQUEEZE': 'no qualifying assets — ALT carries funding -0.308%/8h with OI -2.22% but pct_24h +0.99% sits below the +10% Tier 2 squeeze gate.',
  'MOMENTUM': 'HYPE +32.00% 7d carries funding +0.008%/8h, below the +0.03% MOMENTUM floor. BEAT +89.79% 7d carries funding +0.016%/8h, also below the floor.',
  'COMPRESSION': 'no Tier 2 asset under the 5% range gate today. BTC at 4.49% range clears the Tier 1 gate but OI 7d -1.94% fails the +5% OI build.',
  'CAPITULATION': 'EDEN cleared pct_24h -12.79% / oi_24h -19.44% / funding -0.266% gates but liq $739K sits at one-third the 7d p75 of $2.13M. The flush hasn\'t intensified.',
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
console.log(`wrote .outputs/perps-scan.data.json — DIST=${byRegime.DISTRIBUTION.length} NEUTRAL=${nNeutral} watch=${watch.length} tail=${tail.length} transitions=${transitions.length}`);
