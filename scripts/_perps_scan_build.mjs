#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// + the regime_yesterday mapping parsed from the prior .outputs/perps-scan.md.
// The verdict prose lines, WATCH bucket reads, and transition reads are
// authored inline below — this script is the deliverable for today's run.
import fs from 'node:fs';

const TODAY = '2026-05-22';
const REGIMES = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;

// Yesterday's regime mapping, parsed from .outputs/perps-scan.md (2026-05-21 run)
const yesterday = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  ZEC: 'NEUTRAL', HYPE: 'NEUTRAL', BSB: 'NEUTRAL', EDEN: 'NEUTRAL', DOGE: 'NEUTRAL',
  XRP: 'NEUTRAL', FIDA: 'NEUTRAL', SUI: 'NEUTRAL', TON: 'NEUTRAL', LIT: 'NEUTRAL',
  ONDO: 'ACCUMULATION', NEAR: 'ACCUMULATION', CL: 'ACCUMULATION',
  BILL: 'NEUTRAL', BNB: 'NEUTRAL', WLD: 'NEUTRAL', TAO: 'NEUTRAL',
  // Assets not in today's universe but recorded yesterday — used only for transition lookup
  XAU: 'COMPRESSION', LAB: 'NEUTRAL', DASH: 'NEUTRAL', JTO: 'NEUTRAL', PLAY: 'NEUTRAL',
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
function r3(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000;
}
function r4(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000;
}
function fundingPct(x) {
  return x === null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e4;
}

// Verdict — 100% NEUTRAL universe (25/25). Verdict word per step 9: QUIET (≥80% NEUTRAL).
const assessed = Object.keys(metrics).length;
const counts = { ACCUMULATION: 0, 'CATALYST-BREAKOUT': 0, 'SHORT-SQUEEZE': 0, MOMENTUM: 0, COMPRESSION: 0, DISTRIBUTION: 0, CAPITULATION: 0, NEUTRAL: 0 };
for (const a in metrics) counts[metrics[a].regime] += 1;

const verdict = {
  word: 'QUIET',
  distribution: `25 NEUTRAL across 25 assessed, 0 in any regime.`,
  cycle: `Yesterday's three ACCUMULATION prints all rolled out. NEAR ran +16% 24h and broke the 25% range gate. ONDO bled the bid as OI rolled to -3.3% 24h. CL flattened on stalling OI.`,
  forward: `Watch NEAR for funding pushing through +0.03%/8h into MOMENTUM. FIDA carries -0.33%/8h funding into a +8% bounce on OI +1491% 7d, ready to flip SHORT-SQUEEZE if OI 24h turns negative on the next push. PROVE sits 2pp of OI from a CAPITULATION trigger.`,
};

// Regime changes (today vs yesterday)
const regime_changes = [];
for (const a of Object.keys(metrics)) {
  const ry = yesterday[a];
  const rt = metrics[a].regime;
  if (ry !== undefined && ry !== rt) {
    let note = '';
    if (ry === 'ACCUMULATION' && rt === 'NEUTRAL') {
      if (a === 'NEAR') note = 'Range expanded to 53% over 7d on a +16% 24h rip. OI +28% 24h, OI +128% 7d, vol 2.55x. The bid stayed but the structure broke past the 25% accumulation gate.';
      else if (a === 'ONDO') note = 'OI rolled to -3.3% 24h. Funding pushed +0.005%/8h on top L/S down 0.26 7d. Demand thinned out of the structure.';
      else if (a === 'CL') note = 'OI growth slowed to +0.5% 24h. Price -2.4% 7d turned the 7d delta negative, breaking the pct_7d > 0 gate.';
    }
    regime_changes.push({ asset: a, from: ry, to: rt, note });
  }
}

// All NEUTRAL today → no regime sections populated, but spec requires every regime key present
const regimes = {};
for (const r of REGIMES) regimes[r] = [];

// WATCH bucket — top near-misses
const watch = [
  {
    asset: 'NEAR',
    metrics_line: '+15.99% 24h, +44.78% 7d, OI +28.49% 24h on OI +127.73% 7d, vol 2.55x, funding +0.011%/8h, taker buy 50.19%, short liqs $2.4M vs 7d p75 $1.4M, top L/S 1.89 up 0.14 7d',
    transition_read: 'Missed CATALYST-BREAKOUT by 4pp on the +20% Tier 2 pct_24h gate. Vol, OI, short-liq cascade, and taker-buy mix all clear the breakout profile. A push through +20% 24h fires the regime.',
  },
  {
    asset: 'FIDA',
    metrics_line: '+8.14% 24h, +159.56% 7d, OI +12.45% 24h, OI +1491.46% 7d, funding -0.327%/8h (7d avg -0.018%), top L/S 0.95 collapsed 2.26 7d',
    transition_read: 'Funding deep negative -0.33%/8h with price reclaiming green. Classic short pile-in. OI 24h still rising +12% blocks SHORT-SQUEEZE today. An OI flip negative on the next push fires the regime.',
  },
  {
    asset: 'PROVE',
    metrics_line: '-10.24% 24h, +18.14% 7d, OI -8.37% 24h on OI +564.88% 7d, funding -0.10%/8h, vol 1.44x, top L/S 1.07 collapsed 1.39 7d',
    transition_read: 'Missed CAPITULATION by 1.6pp on the -10% Tier 2 OI gate. Negative funding through a -10% drawdown with smart money already gone reads as a flush in progress. Another OI tick down fires CAPITULATION.',
  },
  {
    asset: 'HYPE',
    metrics_line: '-1.50% 24h, +30.70% 7d, OI -2.08% 24h on OI +41.74% 7d, funding +0.008%/8h (7d avg +0.0007%), top L/S 1.43 up 0.19 7d',
    transition_read: 'Funding flipped positive on a +30% 7d run with smart money still adding. Range 55% blocks ACCUMULATION. A funding extension through +0.03%/8h fires MOMENTUM.',
  },
  {
    asset: 'GRASS',
    metrics_line: '+6.33% 24h, +41.37% 7d, OI +27.09% 24h on OI +143.55% 7d, vol 7.39x, funding +0.005%/8h, taker buy 51.59%, top L/S 1.12 down 0.18 7d',
    transition_read: 'OI surge with high-multiple volume reads as fresh leverage. Pct_24h 6.33% sits 14pp under the +20% Tier 2 breakout gate. A push higher with vol holding fires CATALYST-BREAKOUT.',
  },
  {
    asset: 'EDEN',
    metrics_line: '+3.24% 24h, +240.33% 7d, OI -4.79% 24h on OI +1000.06% 7d, funding +0.013%/8h (7d avg +0.005%), top L/S 1.22 down 0.58 7d',
    transition_read: 'OI stacked 10x over 7d while smart money exited 0.58 on the ratio. Funding flipped clean positive on the bounce. The setup reads top-heavy. A negative day with OI dropping fires CAPITULATION.',
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
    ACCUMULATION: 'no qualifying assets — yesterday\'s three prints all rolled out (NEAR range expanded past 25%, ONDO OI rolled -3.3% 24h, CL pct_7d turned negative)',
    'CATALYST-BREAKOUT': 'no qualifying assets — NEAR cleared +16% 24h with vol 2.55x and OI +28% 24h but fell 4pp short of the +20% Tier 2 pct_24h gate',
    'SHORT-SQUEEZE': 'no qualifying assets — FIDA carries funding -0.33%/8h but OI 24h still rising +12% blocks the regime',
    MOMENTUM: 'no qualifying assets — HYPE +30.7% 7d on OI +41.7% 7d sits at funding +0.008%/8h, well under the +0.03% gate',
    COMPRESSION: 'no qualifying assets — Tier 2 universe has no asset under the 5% range gate today',
    DISTRIBUTION: 'no qualifying assets — funding muted universe-wide, no Tier 2 asset over the +0.08%/8h gate',
    CAPITULATION: 'no qualifying assets — PROVE -10.24% 24h with funding negative but OI -8.37% 24h missed the -10% Tier 2 OI gate by 1.6pp',
  },
  watch,
  neutral_summary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(out, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — regimes:${REGIMES.map((r) => `${r}=${regimes[r].length}`).join(' ')} watch=${watch.length} tail=${tail.length} transitions=${regime_changes.length}`);
