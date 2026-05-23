#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// + yesterday's regime_yesterday mapping parsed from 2026-05-22's perps-scan.md.
// Verdict prose, WATCH bucket reads, transition notes authored inline for the
// 2026-05-23 06:31Z prefetch.
import fs from 'node:fs';

const TODAY = '2026-05-23';
const REGIMES = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;

// Yesterday's (2026-05-22) regime mapping, sourced from 05-22 perps-scan.md tail.
// All 25 assessed assets classified NEUTRAL yesterday.
const yesterday = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  HYPE: 'NEUTRAL', NEAR: 'NEUTRAL', ZEC: 'NEUTRAL', EDEN: 'NEUTRAL', XRP: 'NEUTRAL',
  BEAT: 'NEUTRAL', DOGE: 'NEUTRAL', BSB: 'NEUTRAL', SUI: 'NEUTRAL', ONDO: 'NEUTRAL',
  FIDA: 'NEUTRAL', WLD: 'NEUTRAL', BNB: 'NEUTRAL', BILL: 'NEUTRAL', TON: 'NEUTRAL',
  ADA: 'NEUTRAL', TAO: 'NEUTRAL', LINK: 'NEUTRAL',
  // Assets in yesterday's universe but dropped from today
  PROVE: 'NEUTRAL', GRASS: 'NEUTRAL', LIT: 'NEUTRAL', CL: 'NEUTRAL',
};

function fmtUsd(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const abs = Math.abs(x);
  if (abs >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(x / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(x / 1e3).toFixed(0)}K`;
  return `$${x.toFixed(0)}`;
}

function fmtPrice(x) {
  if (x === null || !Number.isFinite(x)) return null;
  if (x >= 1000) return `$${x.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  if (x >= 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(5)}`;
}

function r2(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
}
function r4(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000;
}

const assessed = Object.keys(metrics).length;
const counts = { ACCUMULATION: 0, 'CATALYST-BREAKOUT': 0, 'SHORT-SQUEEZE': 0, MOMENTUM: 0, COMPRESSION: 0, DISTRIBUTION: 0, CAPITULATION: 0, NEUTRAL: 0 };
for (const a in metrics) counts[metrics[a].regime] += 1;

// Verdict — 25/25 NEUTRAL on a 06:31Z prefetch (early in the UTC day).
// The leverage tail kept decompressing from yesterday and partly inverted:
// EDEN flipped from +24.05% 24h to -13.76% (CAPITULATION-shaped, liq cascade hasn't fired).
// BEAT cooled from +45.93% to -2.68% with OI still building. BSB exploded into +26.5% 24h
// with funding +0.088%/8h (Tier 2 DIST funding gate cleared) but gains accelerating
// (+26.5% 24h vs +173.6% 7d ÷ 7 = 24.8 floor) — the gains-slowing gate blocks DIST.
// FIDA cash-and-carry unwind continued (funding -0.230% on basis +0.244%). Universe-wide
// vol_ratio sits 0.1-0.55 against the 2.0 CATALYST-BREAKOUT floor — partial-bar prefetch.
const verdict = {
  word: 'QUIET',
  distribution: '25 NEUTRAL across 25 assessed — 100% NEUTRAL on the 06:31Z prefetch.',
  cycle: 'EDEN flipped from +24.05% 24h yesterday to -13.76% today with funding collapsing to -0.363%/8h and OI -19.75% 24h. Liq cleared at $714K against a 7d p75 of $2.13M blocks CAPITULATION. BEAT cooled from +45.93% 24h yesterday to -2.68% with OI still building +5.41%. NEAR continued unwinding from yesterday\'s +14.43% to -1.62% with OI -2.81%. BSB freshly exploded to +26.52% 24h with funding spiking to +0.088%/8h from a +0.013% 7d avg. The leverage tail that decompressed yesterday inverted in spots today.',
  forward: 'BSB carries the cleanest setup risk. Funding +0.088%/8h clears the +0.08% Tier 2 DIST gate, OI +28.69% 24h on +275.45% 7d, top L/S 1.95 with delta -0.56 7d (smart money exiting into retail leverage). Gains-slowing gate blocks DIST today. A flat-or-red 24h with OI holding fires the regime. EDEN reads as the closest CAPITULATION print. A second-day -10% drawdown with liq printing through the 7d p75 fires the regime. ALT carries an extreme cash-and-carry shape — funding -0.190%/8h, basis +0.846%, OI 7d +239.6%, taker buy 52.8% — pattern not regime, but worth watching. Universe vol_ratio sits 0.1-0.55 against the 2.0 breakout floor. The 06:31Z prefetch caught a partial day, breakout signals likely understate.',
};

// Regime transitions — every yesterday's asset that's in today's universe was NEUTRAL
// yesterday and is NEUTRAL today. No transitions fire. Surface new entrants if non-NEUTRAL.
const regime_changes = [];
for (const a of Object.keys(metrics)) {
  const ry = yesterday[a];
  const rt = metrics[a].regime;
  if (ry === undefined) {
    if (rt !== 'NEUTRAL') {
      regime_changes.push({ asset: a, from: '(new entrant)', to: rt, note: '' });
    }
    continue;
  }
  if (ry !== rt) {
    regime_changes.push({ asset: a, from: ry, to: rt, note: '' });
  }
}

const regimes = {};
for (const r of REGIMES) regimes[r] = [];
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  if (m.regime === 'NEUTRAL') continue;
  regimes[m.regime].push({
    asset: a,
    tier: m.tier,
    marker: 'bullet',
    repeat_days_suffix: null,
    metrics_line: '',
    tags: [],
  });
}

// WATCH bucket — the eight near-misses worth flagging on the refresh.
const watch = [
  {
    asset: 'BSB',
    metrics_line: '+26.52% 24h, +173.59% 7d, OI +28.69% 24h on OI +275.45% 7d, funding +0.0878%/8h (7d avg +0.013%, delta +0.075), taker buy 49.86%, short liqs $481K vs 7d p75 $1.71M, top L/S 1.95 down 0.56 7d, pct_4h +3.27%, vol 0.37x (partial bar)',
    transition_read: 'Funding +0.088%/8h clears the +0.08% Tier 2 DIST gate. The gains-slowing gate blocks DIST today. pct_24h +26.52% sits above the pct_7d/7 floor of +24.80%. A flat-to-red 24h tomorrow with OI holding fires DISTRIBUTION. Top L/S down 0.56 over 7d while OI piles in reads as smart money exiting into retail leverage. Vol partial-bar blocks CATALYST-BREAKOUT regardless.',
  },
  {
    asset: 'EDEN',
    metrics_line: '-13.76% 24h, +153.01% 7d, OI -19.75% 24h on OI +703.90% 7d, funding -0.363%/8h (7d avg -0.047%, delta -0.315), liq $715K vs 7d p75 $2.13M, long $415K vs short $300K, top L/S 1.17 down 0.49 7d, basis +0.123%, pct_4h -19.70%',
    transition_read: 'Cleared pct_24h ≤ -10% (-13.76%), funding < 0 (-0.363%), and oi_24h ≤ -10% (-19.75%) for CAPITULATION. Liq $715K sits at one-third the 7d p75 of $2.13M and blocks the regime. pct_4h -19.70% means the entire drawdown ran in the last four hours. The flush is fresh, not cleared. A second-day -10% with liq printing through $2.1M fires CAPITULATION.',
  },
  {
    asset: 'BEAT',
    metrics_line: '-2.68% 24h, +97.83% 7d, OI +5.41% 24h on OI +135.68% 7d, funding +0.024%/8h (7d avg +0.009%), liq $1.23M vs 7d p75 $893K, long $615K vs short $616K, top L/S 1.30 down 0.65 7d, pct_4h -9.89%, vol 1.90x',
    transition_read: 'Yesterday\'s +45.93% 24h near-CATALYST-BREAKOUT print rolled into a red 24h with OI still building. Top L/S 1.30 down 0.65 over 7d reads as smart-money distribution. Funding +0.024% sits below the 0.08% Tier 2 LONG-TRAP floor. A second-day red with funding rising past 0.08% fires the pattern. Liq $1.23M now clears the 7d p75. The cascade has started.',
  },
  {
    asset: 'FIDA',
    metrics_line: '-3.68% 24h, +101.29% 7d, OI -8.30% 24h on OI +858.48% 7d, funding -0.230%/8h (7d avg -0.172%, delta -0.057), basis +0.244%, top L/S 1.11 collapsed 2.62 7d, taker buy 50.06%, liq $97K vs 7d p75 $1.55M',
    transition_read: 'Funding deepened from -0.188%/8h yesterday to -0.230%/8h today. Basis collapsed from +0.311% to +0.244%. The cash-and-carry unwind continues. Top L/S 1.11 collapsed 2.62 over the week as positioning capitulates. pct_24h -3.68% blocks SHORT-SQUEEZE\'s positive-price gate. A green push higher with OI extending negative fires SHORT-SQUEEZE.',
  },
  {
    asset: 'ALT',
    metrics_line: '-1.59% 24h, +18.69% 7d, OI -2.22% 24h on OI +239.58% 7d, funding -0.190%/8h (7d avg -0.067%, delta -0.123), basis +0.846%, top L/S 1.20 down 0.25 7d, taker buy 52.83%',
    transition_read: 'Extreme cash-and-carry shape. Basis +0.846% on funding -0.190%/8h with OI building +239.58% 7d. Taker buy 52.83% clears the upper CASH-AND-CARRY bound of 52 by 0.83pp, blocking the pattern tag (window is 48-52%). The structure reads as institutional arb flow, not bullish positioning. A taker-buy drop back under 52% with basis holding fires the formal CASH-AND-CARRY tag.',
  },
  {
    asset: 'GENIUS',
    metrics_line: '-4.28% 24h, +22.91% 7d, OI +2.72% 24h on OI +146.17% 7d, funding +0.0045%/8h (7d avg +0.0078%), vol 1.28x, liq $315K vs 7d p75 $135K, top L/S 1.30 down 0.43 7d, range_7d 71.93%',
    transition_read: 'New universe entrant. OI +146.17% 7d with range 71.93% means a fresh, volatile setup carrying real leverage build. Vol 1.28x is the second-highest in today\'s universe behind BEAT. Top L/S 1.30 down 0.43 7d reads as smart money fading the entry. A second-day red with OI extending lower fires CAPITULATION-shaped flow.',
  },
  {
    asset: 'NEAR',
    metrics_line: '-1.62% 24h, +38.17% 7d, OI -2.81% 24h on OI +130.02% 7d, funding +0.0004%/8h (7d avg +0.0057%), taker buy 51.10%, top L/S 1.78 down 0.07 7d, range_7d 59.78%',
    transition_read: 'Yesterday\'s +14.43% 24h capped out and rolled into a soft red. OI -2.81% means the late longs unwind without panic. Funding repaired toward zero from yesterday\'s +0.005%. Range 59.78% holds the asset out of ACCUMULATION even though OI 7d +130% would qualify. The setup needs a tighter range. A 2-3 day consolidation under $2.20 with OI holding flat re-arms ACCUMULATION.',
  },
  {
    asset: 'HYPE',
    metrics_line: '+1.03% 24h, +32.00% 7d, OI -0.89% 24h on OI +43.62% 7d, funding +0.0082%/8h (7d avg +0.0007%, delta +0.0075), taker buy 52.19%, top L/S 1.36 up 0.15 7d, range_7d 51.57%, pct_4h -0.41%',
    transition_read: 'Taker buy 52.19% just clears the +52% CATALYST-BREAKOUT gate. pct_24h +1.03% sits 19pp under the +20% Tier 2 trigger. The +32% 7d run on OI +43.62% 7d carries momentum but the range expanded past the 25% ACCUMULATION gate. Funding flipped clean positive. New longs paying premium. A consolidation week with range tightening fires ACCUMULATION CONFIRMED.',
  },
];

const neutral_summary = 'Neutral · 25 assets · see artifact tail for full data';

const tail = [];
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  const t = {
    asset: a,
    tier: m.tier,
    regime: m.regime,
    sub_tags: m.sub_tags || [],
    pattern_tags: m.pattern_tags || [],
    metrics: {
      price: fmtPrice(m.current_price),
      pct_24h: r2(m.pct_24h),
      pct_7d: r2(m.pct_7d),
      pct_4h: r2(m.pct_4h),
      range_7d: `${r2(m.range_7d_pct)}%`,
      pct_24h_vs_btc: r2(m.pct_24h_vs_btc),
      pct_7d_vs_btc: r2(m.pct_7d_vs_btc),
      oi_usd: fmtUsd(m.oi_now),
      oi_24h_pct: r2(m.oi_24h_pct),
      oi_7d_pct: r2(m.oi_7d_pct),
      funding_now: r4(m.funding_now),
      funding_7d_avg: r4(m.funding_7d_avg),
      funding_delta: r4(m.funding_delta),
      liq_24h: fmtUsd(m.liq_24h_total),
      liq_7d_p75: fmtUsd(m.liq_7d_p75),
      long_liqs: fmtUsd(m.long_liqs_24h),
      short_liqs: fmtUsd(m.short_liqs_24h),
      liqs_4h: fmtUsd(m.liqs_4h),
      top_ls: r2(m.top_ls_now),
      top_ls_7d_avg: r2(m.top_ls_7d_avg),
      top_ls_delta_7d: r2(m.top_ls_delta_7d),
      basis: r4(m.basis_now),
      taker_buy: r2(m.taker_buy_pct_24h),
    },
    yesterday_regime: yesterday[a] ?? null,
    repeat_days: yesterday[a] === m.regime ? 2 : 1,
  };
  tail.push(t);
}

const out = {
  date: TODAY,
  edge_case: null,
  verdict,
  regime_changes,
  regimes,
  regime_empty_notes: {
    ACCUMULATION: 'no qualifying assets — HYPE +32.00% 7d / OI +43.62% 7d sits at range 51.57%, blocked by the 25% range gate. NEAR +38.17% 7d / OI +130.02% 7d sits at range 59.78%, same gate.',
    'CATALYST-BREAKOUT': 'no qualifying assets — universe vol_ratio sits 0.10-1.90 against the 2.0 floor on the 06:31Z partial-bar prefetch. BSB carries the highest pct_24h at +26.52% with OI +28.69% but vol 0.37x and taker buy 49.86% both block.',
    'SHORT-SQUEEZE': 'no qualifying assets — FIDA carries funding -0.230%/8h with OI -8.30% but pct_24h -3.68% is the wrong direction. ALT carries funding -0.190%/8h with similar profile but pct_24h -1.59%, also wrong direction.',
    MOMENTUM: 'no qualifying assets — HYPE +32.00% 7d / OI +43.62% 7d sits at funding +0.0082%/8h, below the +0.03% MOMENTUM floor. BEAT +97.83% 7d sits at funding +0.024%/8h, also below the floor.',
    COMPRESSION: 'no qualifying assets — Tier 2 universe has no asset under the 5% range gate today; closest is BNB at 4.81% (clears the gate) but OI 7d -1.99% fails the +5% OI build.',
    DISTRIBUTION: 'no qualifying assets — BSB funding +0.0878%/8h clears the +0.08% Tier 2 gate but pct_24h +26.52% > pct_7d/7 (+24.80%) means gains are accelerating, blocking the gains-slowing gate. LAB funding +0.028%/8h sits well below the gate.',
    CAPITULATION: 'no qualifying assets — EDEN cleared pct_24h -13.76% / oi_24h -19.75% / funding -0.363% gates but liq $715K sits at one-third the 7d p75 of $2.13M. Liq cascade hasn\'t intensified.',
  },
  watch,
  neutral_summary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(out, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — regimes:${REGIMES.map((r) => `${r}=${regimes[r].length}`).join(' ')} watch=${watch.length} tail=${tail.length} transitions=${regime_changes.length}`);
