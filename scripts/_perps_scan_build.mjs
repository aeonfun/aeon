#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// + the regime_yesterday mapping parsed from 2026-05-21's perps-scan log entry.
// Verdict prose, WATCH bucket reads, and transition notes are authored inline
// for the 2026-05-22 15:45Z prefetch snapshot.
import fs from 'node:fs';

const TODAY = '2026-05-22';
const REGIMES = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;

// Yesterday's (2026-05-21) regime mapping, sourced from 05-21 perps-scan log.
// Three ACCUMULATION (NEAR/ONDO/CL), XAU in COMPRESSION (dropped from today's universe).
const yesterday = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  ZEC: 'NEUTRAL', HYPE: 'NEUTRAL', BSB: 'NEUTRAL', EDEN: 'NEUTRAL', DOGE: 'NEUTRAL',
  XRP: 'NEUTRAL', FIDA: 'NEUTRAL', SUI: 'NEUTRAL', TON: 'NEUTRAL', LIT: 'NEUTRAL',
  ONDO: 'ACCUMULATION', NEAR: 'ACCUMULATION', CL: 'ACCUMULATION',
  BILL: 'NEUTRAL', BNB: 'NEUTRAL', WLD: 'NEUTRAL', TAO: 'NEUTRAL',
  // Assets not in today's universe but recorded yesterday — preserved for completeness
  XAU: 'COMPRESSION', JTO: 'NEUTRAL', DASH: 'NEUTRAL', PLAY: 'NEUTRAL', LAB: 'NEUTRAL',
  BCH: 'NEUTRAL', RONIN: 'NEUTRAL', PROMPT: 'NEUTRAL',
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

const assessed = Object.keys(metrics).length;
const counts = { ACCUMULATION: 0, 'CATALYST-BREAKOUT': 0, 'SHORT-SQUEEZE': 0, MOMENTUM: 0, COMPRESSION: 0, DISTRIBUTION: 0, CAPITULATION: 0, NEUTRAL: 0 };
for (const a in metrics) counts[metrics[a].regime] += 1;

// Verdict — 25/25 NEUTRAL on the 15:45Z prefetch refresh.
// PROVE funding flipped from -0.037 to +0.000167 between the morning prefetch and this one,
// pulling it out of CAPITULATION. NEAR/HYPE both softened materially. The character of the
// read changed: the flush narrative paused as funding repaired across the leveraged tail.
const verdict = {
  word: 'QUIET',
  distribution: '25 NEUTRAL across 25 assessed — 100% NEUTRAL on the 15:45Z prefetch refresh.',
  cycle: 'PROVE funding repaired from -0.037%/8h to +0.0002%/8h between the morning prefetch and this one, pulling the asset out of CAPITULATION even as price held -11.52% and OI -17.01%. NEAR softened from +17.60% 24h to +14.43% with top L/S down 0.02 over 7d on the refresh (was up 0.12). HYPE flipped negative on the day at -0.90% with OI -2.59% and funding -0.008%/8h. The leverage tail decompressed across one prefetch cycle.',
  forward: 'BEAT is the cleanest near-CATALYST-BREAKOUT print. Vol ran 11.60x with OI +71.40% 24h and short liqs 9.2x the 7d p75. Taker buy 51.00% sits 1.00pp under the +52% Tier 2 gate. A taker-buy flip fires the regime. PROVE funding-flip means the flush may have completed. A second funding tick negative with OI extending lower re-arms CAPITULATION. FIDA funding -0.188%/8h on basis +0.311% still reads as cash-and-carry unwind. A green 24h with OI dropping fires SHORT-SQUEEZE.',
};

// Regime changes — surface NEAR/ONDO/CL out of ACCUMULATION + new entrants worth flagging.
const regime_changes = [];
for (const a of Object.keys(metrics)) {
  const ry = yesterday[a];
  const rt = metrics[a].regime;
  if (ry === undefined) {
    // New universe entrant — only surface if today's regime is not NEUTRAL,
    // or the asset's profile is worth a named note despite NEUTRAL classification.
    if (rt !== 'NEUTRAL') {
      regime_changes.push({ asset: a, from: '(new entrant)', to: rt, note: '' });
    }
    continue;
  }
  if (ry !== rt) {
    let note = '';
    if (ry === 'ACCUMULATION' && rt === 'NEUTRAL') {
      if (a === 'NEAR') note = 'Range expanded to 59.78% over 7d past the 25% accumulation gate on a +14.43% 24h rip. OI +36.64% 24h, vol 5.53x, taker buy 50.12%. Top L/S down 0.02 over 7d reverses yesterday\'s smart-money confirmation. The bid held but the structure broke past the accumulation gate.';
      else if (a === 'ONDO') note = 'Range stretched to 42.95% on a +7.05% 24h push with OI +5.52% 24h. Structure broke past the 25% accumulation range gate.';
      else if (a === 'CL') note = 'OI rolled -2.45% 24h. Price -4.11% 7d turned the 7d delta negative and broke the pct_7d > 0 gate.';
    }
    regime_changes.push({ asset: a, from: ry, to: rt, note });
  }
}

// Populate regimes from compute output (any non-NEUTRAL assets).
const regimes = {};
for (const r of REGIMES) regimes[r] = [];

for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  if (m.regime === 'NEUTRAL') continue;
  // No regime fired on this prefetch — section stays empty.
  regimes[m.regime].push({
    asset: a,
    tier: m.tier,
    marker: 'bullet',
    repeat_days_suffix: null,
    metrics_line: '',
    tags: [],
  });
}

// WATCH bucket — near-misses on the refreshed compute.
const watch = [
  {
    asset: 'BEAT',
    metrics_line: '+45.93% 24h, +71.18% 7d, OI +71.40% 24h on OI +75.09% 7d, vol 11.60x, funding +0.026%/8h (7d avg +0.009%), taker buy 51.00%, short liqs $2.08M vs 7d p75 $227K, top L/S 1.71 down 0.21 7d, pct_4h +7.22%',
    transition_read: 'Missed CATALYST-BREAKOUT by 1.00pp on the +52% Tier 2 taker-buy gate. Vol 11.60x, OI cascade +71.40%, and short-liq pile-on at 9.2x the 7d p75 all confirm. A taker-buy flip through 52% fires the regime.',
  },
  {
    asset: 'PROVE',
    metrics_line: '-11.52% 24h, +16.45% 7d, OI -17.01% 24h on OI +502.18% 7d, vol 2.07x, funding +0.0002%/8h (7d avg -0.071%), liq $906K vs 7d p75 $233K, long $586K vs short $320K, top L/S 1.19 down 1.27 7d, basis +0.311%',
    transition_read: 'Cleared the pct_24h and OI gates for CAPITULATION but funding flipped from -0.037% to +0.0002% between prefetches. Funding now blocks the regime. Reads as the flush pausing. A second funding tick negative with OI extending lower re-arms CAPITULATION.',
  },
  {
    asset: 'LIT',
    metrics_line: '-10.04% 24h, +49.71% 7d, OI -14.43% 24h on OI +63.78% 7d, funding +0.003%/8h (7d avg +0.007%), liq $411K vs 7d p75 $761K, top L/S 2.03 down 0.55 7d',
    transition_read: 'Cleared pct_24h -10.04% and OI -14.43% gates for CAPITULATION but funding +0.003%/8h blocks. Liq $411K also sits under the 7d p75 of $761K so even with funding negative the cascade hasn\'t intensified. Watch for funding flip negative on a second-day drawdown.',
  },
  {
    asset: 'FIDA',
    metrics_line: '-5.07% 24h, +127.86% 7d, OI -12.73% 24h on OI +1135.07% 7d, funding -0.188%/8h (7d avg -0.161%), basis +0.311%, top L/S 1.03 collapsed 2.18 7d, taker buy 49.96%',
    transition_read: 'Funding at -0.188%/8h with OI flipping -12.73% 24h reads as forced short cover starting against the +128% 7d run. Basis collapsed from +0.591% to +0.311% on the refresh — the cash-and-carry unwind is in motion. Pct_24h -5.07% blocks SHORT-SQUEEZE today. A green push higher with OI dropping fires the regime.',
  },
  {
    asset: 'EDEN',
    metrics_line: '+24.05% 24h, +308.92% 7d, OI +13.55% 24h on OI +1212.0% 7d, vol 1.40x, funding +0.007%/8h (7d avg -0.025%), top L/S 1.19 down 0.61 7d, basis -0.099%',
    transition_read: 'Cleared pct_24h +24.05% > 20% Tier 2 gate and oi_24h +13.55% > 10% gate. Vol 1.40x blocks CATALYST-BREAKOUT against the 2.0x floor. Basis flipped negative on the refresh — the futures bid faded against spot. A vol push past 2.0x fires the regime. A red day with OI dropping fires CAPITULATION first.',
  },
  {
    asset: 'NEAR',
    metrics_line: '+14.43% 24h, +42.84% 7d, OI +36.64% 24h on OI +142.17% 7d, vol 5.53x, funding +0.005%/8h, taker buy 50.12%, short liqs $4.02M vs 7d p75 $1.38M, top L/S 1.73 down 0.02 7d',
    transition_read: 'Missed CATALYST-BREAKOUT by 5.57pp on the +20% Tier 2 pct_24h gate. Top L/S down 0.02 7d reverses yesterday\'s smart-money confirmation. Yesterday\'s ACCUMULATION CONFIRMED day-2 print collapsed into NEUTRAL on the range gate. The setup weakened from "long continuation" to "watch for re-acceleration." A continuation push through +20% 24h with taker-buy turning fires the regime.',
  },
  {
    asset: 'WLD',
    metrics_line: '+9.80% 24h, +20.47% 7d, OI +16.34% 24h on OI +48.50% 7d, vol 1.98x, funding +0.008%/8h (7d avg -0.035%), short liqs $730K vs 7d p75 $284K, top L/S 1.63 down 0.22 7d',
    transition_read: 'Missed CATALYST-BREAKOUT by 10.20pp on pct_24h and 0.02x on vol. Short-liq cascade 2.6x p75 confirms the squeeze leg. Funding repaired from -0.035% 7d avg to +0.008%/8h reads as new longs paying premium against covered shorts. A pct_24h push through +20% 24h fires CATALYST-BREAKOUT.',
  },
  {
    asset: 'GRASS',
    metrics_line: '+3.72% 24h, +37.89% 7d, OI +25.13% 24h on OI +139.81% 7d, vol 13.54x, funding -0.002%/8h, taker buy 51.10%, short liqs $637K vs 7d p75 $55K, top L/S 1.10 down 0.20 7d',
    transition_read: 'Vol 13.54x with short-liq cascade 11.5x the 7d p75. Pct_24h decelerated from +7.01% to +3.72% on the refresh — the move slowed but the structure stayed intact. Funding -0.002%/8h on rising price still reads as short pile-in. Pct_24h sits 6.28pp under the +10% Tier 2 SHORT-SQUEEZE gate. A push past +10% 24h with OI flipping negative fires SHORT-SQUEEZE.',
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
    ACCUMULATION: 'no qualifying assets — yesterday\'s three prints all rolled out (NEAR range expanded past 25%, ONDO range broke past 25% on the +7.05% 24h push, CL pct_7d turned -4.11%)',
    'CATALYST-BREAKOUT': 'no qualifying assets — BEAT cleared +45.93% 24h with vol 11.60x and OI +71.40% 24h, missed the +52% Tier 2 taker-buy gate by 1.00pp. EDEN cleared +24.05% with OI +13.55% but vol 1.40x sits under the 2.0x floor',
    'SHORT-SQUEEZE': 'no qualifying assets — FIDA carries funding -0.188%/8h with OI flipping -12.73% but pct_24h -5.07% is the wrong direction. GRASS holds vol 13.54x on short-liqs 11.5x p75 but pct_24h +3.72% sits 6.28pp under the +10% Tier 2 gate',
    MOMENTUM: 'no qualifying assets — HYPE +31.50% 7d on OI +41.01% 7d sits at funding -0.008%/8h with OI -2.59% 24h, blocked by both the funding gate and the oi_24h ≥ 0 floor',
    COMPRESSION: 'no qualifying assets — Tier 2 universe has no asset under the 5% range gate today; closest is BNB at 6.43% on OI -6.10% 7d which fails the OI build',
    DISTRIBUTION: 'no qualifying assets — funding muted across the long side universe-wide, no Tier 2 asset over the +0.08%/8h gate',
    CAPITULATION: 'no qualifying assets — PROVE cleared pct_24h and oi_24h gates but funding flipped from -0.037% to +0.0002% between prefetches and blocks. LIT cleared pct_24h -10.04% and OI -14.43% but funding +0.003%/8h blocks',
  },
  watch,
  neutral_summary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(out, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — regimes:${REGIMES.map((r) => `${r}=${regimes[r].length}`).join(' ')} watch=${watch.length} tail=${tail.length} transitions=${regime_changes.length}`);
