#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
// + the regime_yesterday mapping parsed from 2026-05-21's perps-scan log entry.
// Verdict prose, WATCH bucket reads, and transition notes are authored inline
// for the 2026-05-22 14:36Z prefetch snapshot.
import fs from 'node:fs';

const TODAY = '2026-05-22';
const REGIMES = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;

// Yesterday's (2026-05-21) regime mapping, sourced from 05-21 perps-scan log.
// Mostly NEUTRAL, three ACCUMULATION (NEAR/ONDO/CL), XAU in COMPRESSION (dropped from today's universe).
const yesterday = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  ZEC: 'NEUTRAL', HYPE: 'NEUTRAL', BSB: 'NEUTRAL', EDEN: 'NEUTRAL', DOGE: 'NEUTRAL',
  XRP: 'NEUTRAL', FIDA: 'NEUTRAL', SUI: 'NEUTRAL', TON: 'NEUTRAL', LIT: 'NEUTRAL',
  ONDO: 'ACCUMULATION', NEAR: 'ACCUMULATION', CL: 'ACCUMULATION',
  BILL: 'NEUTRAL', BNB: 'NEUTRAL', WLD: 'NEUTRAL', TAO: 'NEUTRAL',
  // Assets not in today's universe but recorded yesterday — preserved for completeness
  XAU: 'COMPRESSION', JTO: 'NEUTRAL', DASH: 'NEUTRAL', PLAY: 'NEUTRAL',
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

// Verdict — 24 NEUTRAL + 1 CAPITULATION = QUIET per step 9 (≥80% NEUTRAL).
// Cycle highlights PROVE flush. Forward names BEAT, FIDA, PROVE follow-ons.
const verdict = {
  word: 'QUIET',
  distribution: '1 CAPITULATION across 25 assessed, 24 NEUTRAL.',
  cycle: 'PROVE flushed into CAPITULATION on universe entry. Price dropped -11.34% 24h as OI rolled -17.30% on funding -0.037%/8h. Liq ran $890K against the 7d p75 of $229K. The cascade follows a +500% 7d OI build that collapsed today. NEAR, ONDO, CL all rolled out of yesterday\'s ACCUMULATION as 7d range expanded past the 25% gate.',
  forward: 'Watch PROVE for the IN-PROGRESS sub-tag if the cascade extends through the next 4h. BEAT cleared +50.58% 24h on vol 7.87x with OI +79.71% 24h. Only the +52% taker-buy gate keeps BEAT short of CATALYST-BREAKOUT. FIDA carries funding -0.232%/8h on a +130% 7d run with OI flipping -9.88% 24h. A green push higher fires SHORT-SQUEEZE on FIDA.',
};

// Regime changes — surface NEAR/ONDO/CL out of ACCUMULATION + PROVE new entrant into CAPITULATION.
const regime_changes = [];
for (const a of Object.keys(metrics)) {
  const ry = yesterday[a];
  const rt = metrics[a].regime;
  if (ry === undefined) {
    // New universe entrant — only surface if today's regime is not NEUTRAL.
    if (rt !== 'NEUTRAL') {
      let note = '';
      if (a === 'PROVE' && rt === 'CAPITULATION') {
        note = 'New universe entrant straight into CAPITULATION. Price dropped -11.34% 24h, OI rolled -17.30%, funding sat at -0.037%/8h. Liq ran $890K against the 7d p75 of $229K. Top L/S collapsed 1.28 over 7d to 1.18. Smart money had already left before the flush.';
      }
      regime_changes.push({ asset: a, from: '(new entrant)', to: rt, note });
    }
    continue;
  }
  if (ry !== rt) {
    let note = '';
    if (ry === 'ACCUMULATION' && rt === 'NEUTRAL') {
      if (a === 'NEAR') note = 'Range expanded to 59.78% over 7d past the 25% accumulation gate on a +17.60% 24h rip. OI +41.11% 24h, vol 5.05x, taker buy 50.19%. The bid held but the structure broke past the accumulation gate.';
      else if (a === 'ONDO') note = 'Range stretched to 42.95% on a +9.76% 24h push with OI +8.83% 24h. Structure broke past the 25% accumulation range gate.';
      else if (a === 'CL') note = 'OI rolled -1.18% 24h. Price -3.67% 7d turned the 7d delta negative and broke the pct_7d > 0 gate.';
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
  let metricsLine = '';
  const tags = [];

  if (a === 'PROVE' && m.regime === 'CAPITULATION') {
    metricsLine = '-11.34% 24h, +16.69% 7d, OI -17.30% 24h on OI +500.08% 7d, funding -0.037%/8h (7d avg -0.073%), liq $890K vs 7d p75 $229K, long $572K vs short $318K, liqs_4h $148K (17% of 24h), top L/S 1.18 collapsed 1.28 7d, basis +0.207%, vol 2.01x';
    // PROVE sub_tags: liqs_4h/liq_24h = 16.7% sits between 15% CLEARED and 40% IN-PROGRESS — no sub-tag fires
  }

  regimes[m.regime].push({
    asset: a,
    tier: m.tier,
    marker: 'bullet',  // first day in this regime, no ★
    repeat_days_suffix: null,
    metrics_line: metricsLine,
    tags,
  });
}

// WATCH bucket — six near-misses + pattern fires.
const watch = [
  {
    asset: 'BEAT',
    metrics_line: '+50.58% 24h, +76.64% 7d, OI +79.71% 24h on OI +83.58% 7d, vol 7.87x, funding +0.026%/8h (7d avg +0.009%), taker buy 51.19%, short liqs $1.79M vs 7d p75 $227K, top L/S 1.67 down 0.25 7d, pct_4h +14.27%',
    transition_read: 'Missed CATALYST-BREAKOUT by 0.81pp on the +52% Tier 2 taker-buy gate. Vol 7.87x, OI cascade +79.71%, and short-liq pile-on at 7.9x the 7d p75 all confirm. The last 4h delivered 28% of the 24h move. A taker-buy flip through 52% fires the regime.',
  },
  {
    asset: 'NEAR',
    metrics_line: '+17.60% 24h, +46.79% 7d, OI +41.11% 24h on OI +150.09% 7d, vol 5.05x, funding +0.007%/8h, taker buy 50.19%, short liqs $3.94M vs 7d p75 $1.38M, top L/S 1.87 up 0.12 7d',
    transition_read: 'Missed CATALYST-BREAKOUT on the +20% Tier 2 pct_24h gate by 2.4pp and the +52% taker-buy gate by 1.81pp. OI surge plus short-liq cascade reads as squeeze plus new-long pile-in stacked together. A continuation push through +20% 24h with taker-buy turning fires the regime.',
  },
  {
    asset: 'FIDA',
    metrics_line: '-4.33% 24h, +129.63% 7d, OI -9.88% 24h on OI +1175.45% 7d, funding -0.232%/8h (7d avg -0.163%, delta -0.069%), basis +0.591%, top L/S 1.03 collapsed 2.18 7d, taker buy 49.93%',
    transition_read: 'Funding plunged to -0.232%/8h with OI flipping -9.88% 24h. Reads as forced short cover starting against the +130% 7d run. Pct_24h -4.33% blocks SHORT-SQUEEZE today. A green push higher with OI dropping fires the regime.',
  },
  {
    asset: 'GRASS',
    metrics_line: '+7.01% 24h, +42.26% 7d, OI +32.42% 24h on OI +153.77% 7d, vol 12.89x, funding -0.003%/8h, taker buy 51.12%, short liqs $633K vs 7d p75 $55K, top L/S 1.06 down 0.24 7d',
    transition_read: 'Vol 12.89x with short-liq cascade 11x the 7d p75. Funding -0.003%/8h on rising price reads as classic short pile-in. Pct_24h +7.01% sits 3pp under the +10% Tier 2 SHORT-SQUEEZE gate. A push past +10% 24h with OI flipping fires SHORT-SQUEEZE.',
  },
  {
    asset: 'EDEN',
    metrics_line: '+21.34% 24h, +299.97% 7d, OI +11.07% 24h on OI +1183.35% 7d, vol 1.33x, funding +0.008%/8h (7d avg -0.025%), top L/S 1.23 down 0.57 7d, basis +0.054%',
    transition_read: 'Parabolic blow-off. OI stacked 12x over 7d while smart money exited 0.57 on the ratio. Funding flipped clean positive on the bounce. Vol 1.33x blocks CATALYST-BREAKOUT. A red day with OI dropping fires CAPITULATION.',
  },
  {
    asset: 'HYPE',
    metrics_line: '+2.09% 24h, +35.45% 7d, OI +2.50% 24h on OI +48.36% 7d, vol 0.83x, funding +0.001%/8h (7d avg +0.0006%), top L/S 1.39 up 0.15 7d, range 55.40%',
    transition_read: 'Funding muted at +0.001%/8h on a +35% 7d run with smart money still adding. Range 55% blocks ACCUMULATION. A funding extension through +0.03%/8h fires MOMENTUM.',
  },
];

const neutral_summary = 'Neutral · 24 assets · see artifact tail for full data';

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
    ACCUMULATION: 'no qualifying assets — yesterday\'s three prints all rolled out (NEAR range expanded past 25%, ONDO range broke past 25% on the +9.76% 24h push, CL pct_7d turned -3.67%)',
    'CATALYST-BREAKOUT': 'no qualifying assets — BEAT cleared +50.58% 24h with vol 7.87x and OI +79.71% 24h, missed the +52% Tier 2 taker-buy gate by 0.81pp',
    'SHORT-SQUEEZE': 'no qualifying assets — FIDA carries funding -0.232%/8h with OI flipping -9.88% but pct_24h -4.33% is the wrong direction. GRASS holds vol 12.89x on short-liqs 11x p75 but pct_24h +7.01% sits 3pp under the +10% Tier 2 gate',
    MOMENTUM: 'no qualifying assets — HYPE +35.45% 7d on OI +48.36% 7d sits at funding +0.001%/8h, well under the +0.03% gate',
    COMPRESSION: 'no qualifying assets — Tier 2 universe has no asset under the 5% range gate today',
    DISTRIBUTION: 'no qualifying assets — funding muted across the long side universe-wide, no Tier 2 asset over the +0.08%/8h gate',
  },
  watch,
  neutral_summary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(out, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — regimes:${REGIMES.map((r) => `${r}=${regimes[r].length}`).join(' ')} watch=${watch.length} tail=${tail.length} transitions=${regime_changes.length}`);
