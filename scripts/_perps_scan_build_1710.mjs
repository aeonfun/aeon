#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for the 2026-05-24 17:10Z re-run prefetch.
// Prior artifact at .outputs/perps-scan.data.json is dated 2026-05-24 (the
// morning 06:56Z run) — per SKILL.md step 2 re-run case, regime_changes is null
// and we surface "(no comparison available)". Repeat_days inherits from the
// morning tail where the asset persisted at the same regime; same-day re-run
// does not advance the counter (per 05-20 precedent).

import fs from 'node:fs';

const TODAY = '2026-05-24';
const REGIMES = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;

const prior = JSON.parse(fs.readFileSync('.outputs/perps-scan.data.json', 'utf8'));
const priorByAsset = new Map();
for (const t of prior.tail || []) priorByAsset.set(t.asset, t);

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
  if (x >= 1000) return `$${x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  if (x >= 1) return `$${x.toFixed(3)}`;
  if (x >= 0.01) return `$${x.toFixed(4)}`;
  return `$${x.toFixed(6)}`;
}

function r2(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
}
function r4(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000;
}

// Same-day re-run preserves prior repeat_days when the regime carried;
// new entrants and regime resets start at 1.
function repeatDaysFor(asset, regimeToday) {
  const prev = priorByAsset.get(asset);
  if (!prev) return 1;
  if (prev.regime === regimeToday) return prev.repeat_days || 1;
  return 1;
}

const verdict = {
  word: 'QUIET',
  distribution: '25 NEUTRAL across 25 assessed on the 17:10Z re-run prefetch.',
  cycle:
    "Every assessed asset prints NEUTRAL for the second consecutive prefetch today. The 17:10Z snapshot rewires the watch bucket. BSB's structural gap from the morning unwound entirely — funding cooled from +0.0943%/8h at 06:56Z to +0.0038%/8h now, a -0.0905pp reset that pulled the coin back through the +0.07 MOMENTUM cap and far below the +0.08 DISTRIBUTION trigger. HYPE funding flipped to -0.0201%/8h on pct_24h +7.76% with OI +17.86% 24h, the cleanest fresh SHORT-SQUEEZE setup in the universe but pct_24h sits 2.24pp under the Tier 2 +10% gate. EDEN funding extended deeper negative to -0.0496%/8h on basis +0.336%, the heaviest short premium today by a 2.5x margin. UB pct_24h +24.38% is the only asset in the entire week to clear the Tier 2 +20% breakout gate, but vol_ratio 1.21x and taker buy 51.15% block by wide margins. Top L/S divergence runs broad today. Smart money exited longs in BEAT -0.43, ASTER -0.39, EDEN -0.37, ONDO -0.34, BSB -0.32 across 7d, and rebuilt longs in SUI +0.48, DOGE +0.42, NEAR +0.36, ETH +0.16, SOL +0.16, BTC +0.13.",
  forward:
    "HYPE needs another +2.24% to clear the +10% Tier 2 SHORT-SQUEEZE pct_24h gate. The OI build to +17.86% 24h fails the oi<0 squeeze requirement, so the trigger fires only on an OI reversal alongside the price extension. EDEN needs pct_24h pushing past +5% on a green day with OI reversing into the negative-funding wall to fire SHORT-SQUEEZE. UB needs vol_ratio clearing 2x and taker buy clearing 52% with pct_24h holding above +20% to fire CATALYST-BREAKOUT. GENIUS needs another +10.49% pct_24h on the existing 2.38x vol surge and 7.9% OI build extending past +10% to fire CATALYST-BREAKOUT. ZEC needs pct_24h extending past +10% with OI reversing and short_liqs printing above 7d p75 to fire SHORT-SQUEEZE through the top L/S 0.76 setup.",
};

// Re-run case — prior artifact is dated today. Set regime_changes to null
// per SKILL.md step 10 / step 12 schema rules.
const regime_changes = null;

const regimes = {};
for (const r of REGIMES) regimes[r] = [];

const watch = [
  {
    asset: 'HYPE',
    metrics_line:
      '+7.76% 24h, +38.47% 7d, OI +17.86% 24h on OI +53.90% 7d, funding -0.0201%/8h (7d avg +0.0007%, delta -0.0208%), taker buy 49.94%, liq $5.8M vs 7d p75 $9.4M, top L/S 1.34 up 0.09 7d, pct_4h +1.93%, vol 1.04x',
    transition_read:
      "Funding flipped to -0.0201%/8h from a +0.0007% 7d average on a pct_24h +7.76% green day with OI building +17.86% in 24h. Shorts paid premium into a rising tape while leverage stacked on top — the textbook fresh-squeeze coil. The pct_24h read sits 2.24pp under the Tier 2 +10% SHORT-SQUEEZE gate, and OI +17.86% fails the oi<0 squeeze requirement on its own. Top L/S 1.34 up 0.09 over 7d means smart money rebuilt long conviction this week while funding cooled — the divergence reads as positioning against the short-side leverage building underneath. Liq $5.8M printed 62% of the 7d p75 $9.4M threshold, so leverage is repricing without unwinding. Another +2.24% pct_24h with OI reversing fires SHORT-SQUEEZE. A push to +8% with OI holding and vol clearing 2x fires CATALYST-BREAKOUT through the Tier 2 +20% threshold proxy via Tier 1-style strength.",
  },
  {
    asset: 'EDEN',
    metrics_line:
      '+3.67% 24h, +103.29% 7d, OI +0.35% 24h on OI +98.89% 7d, funding -0.0496%/8h (7d avg -0.0238%, delta -0.0258%), taker buy 49.66%, liq $436K vs 7d p75 $2.1M, top L/S 1.29 down 0.37 7d, basis +0.344%, pct_4h n/a, vol 0.25x',
    transition_read:
      "Funding extended deeper negative to -0.0496%/8h, the heaviest short premium in the universe by a 2.5x margin over HYPE's -0.0201%. Shorts paid -0.0258pp more premium this slice than the 7d average. Basis +0.344% positive into deeply negative funding means spot still bids while futures shorts hold the line — the squeeze setup intensified from the morning print. Top L/S 1.29 down 0.37 over 7d means smart money exited 22% of long conviction this week while retail shorts kept piling in. Pct_24h +3.67% on OI +0.35% 24h prints quiet grind higher into the funding extreme. A green pct_24h push past +5% with OI reversing into the short wall fires SHORT-SQUEEZE. A flat-to-red day with funding extending past -0.08% with no flush fires the structural long-bleed setup.",
  },
  {
    asset: 'UB',
    metrics_line:
      '+24.38% 24h, +3.96% 7d, OI +47.39% 24h on OI +30.67% 7d, funding +0.0341%/8h (7d avg +0.0105%, delta +0.0236%), taker buy 51.15%, liq $523K vs 7d p75 (n/a), top L/S 0.90 down 0.03 7d, pct_4h +3.93%, vol 1.21x',
    transition_read:
      "Pct_24h +24.38% is the only print in the universe to clear the Tier 2 +20% CATALYST-BREAKOUT pct gate, but vol_ratio 1.21x sits 0.79x under the 2.0x gate and taker buy 51.15% sits 0.85pp under the 52% gate. Two of four CATALYST gates cleared, two failed. OI +47.39% 24h is the heaviest single-day position build in today's universe — leverage chased the move hard. Funding +0.0341%/8h sits cleanly inside the +0.03 to +0.07 MOMENTUM band but pct_7d +3.96% sits 11.04pp under the Tier 2 +15% MOMENTUM floor. Top L/S 0.90 means smart money sits net short heading into the move. Vol clearing 2x on continuation through the 4h fires CATALYST-BREAKOUT. A reversal with funding extending past +0.08% on flat-to-red pct_24h fires LONG-TRAP.",
  },
  {
    asset: 'GENIUS',
    metrics_line:
      '+9.51% 24h, +65.38% 7d, OI +7.90% 24h on OI +160.17% 7d, funding +0.0053%/8h (7d avg +0.0068%, delta -0.0015%), taker buy 50.97%, liq $837K vs 7d p75 (n/a), top L/S 1.54 down 0.12 7d, basis -0.014%, pct_4h +0.36%, vol 2.38x',
    transition_read:
      "Vol_ratio 2.38x clears the 2.0x CATALYST gate by 0.38x — the only asset besides GRASS to clear that threshold today. Pct_24h +9.51% sits 10.49pp under the Tier 2 +20% breakout trigger and OI +7.90% 24h sits 2.10pp under the +10% gate. Taker buy 50.97% sits 1.03pp under the 52% gate. Three CATALYST gates fail, one clears. Pct_7d +65.38% on OI +160.17% 7d clears the Tier 2 +15% MOMENTUM floor and OI ≥0 24h, but funding +0.0053% sits 0.0247pp under the +0.03 MOMENTUM entry — the gate that has blocked GENIUS since its day-1 appearance. The bsc name-farm cluster prints a fourth distinct contract on the runners side and the perps coin holds momentum without the funding heat. A funding warm-up past +0.03% on continuation fires MOMENTUM. A pct_24h push through +20% with taker clearing 52% fires CATALYST-BREAKOUT.",
  },
  {
    asset: 'ZEC',
    metrics_line:
      '+7.78% 24h, +26.87% 7d, OI +12.83% 24h on OI +59.17% 7d, funding +0.0068%/8h (7d avg -0.0044%, delta +0.0112%), taker buy 50.90%, liq $4.2M vs 7d p75 (n/a), top L/S 0.76 down 0.12 7d, basis +0.065%, pct_4h +1.40%, vol 0.80x',
    transition_read:
      "Top L/S 0.76 sits as the most-short smart-money positioning in today's universe — smart traders run net short 1.32-to-1 into a pct_24h +7.78% green day. Funding flipped from a -0.0044% 7d average to +0.0068%/8h on the move, marking the first positive 8h slice in a week. Pct_24h +7.78% sits 2.22pp under the Tier 2 +10% SHORT-SQUEEZE pct gate and OI +12.83% 24h fails the oi<0 squeeze requirement. Pct_7d +26.87% on OI +59.17% 7d clears the Tier 2 +15% MOMENTUM floor but funding +0.0068% sits 0.0232pp under the +0.03 MOMENTUM entry. Range 34.23% blocks ACCUMULATION even with OI +59% 7d qualifying. Another +2.22% with OI reversing fires SHORT-SQUEEZE. Funding extending past +0.03% on continuation fires MOMENTUM. The privacy/ZK narrative promotion from Fading to Rising aligns with the underlying short-side squeeze fuel — the cleanest cross-skill confluence in today's deck.",
  },
  {
    asset: 'BSB',
    metrics_line:
      '-0.20% 24h, +91.73% 7d, OI -7.21% 24h on OI +54.99% 7d, funding +0.0038%/8h (7d avg +0.0171%, delta -0.0133%), taker buy 49.46%, liq $1.7M vs 7d p75 (n/a), top L/S 1.92 down 0.32 7d, pct_4h -0.84%, vol 0.73x',
    transition_read:
      "Funding completely repriced. The 06:56Z morning print read +0.0943%/8h — clear of the +0.08 Tier 2 DISTRIBUTION trigger with the structural gap sitting between MOMENTUM and DISTRIBUTION. By 17:10Z funding had dropped -0.0905pp to +0.0038%, well below the MOMENTUM +0.03 entry and the DISTRIBUTION +0.08 trigger alike. Pct_24h -0.20% replaced the morning's +18.38% — the entire 24h window slid into the new measurement bracket. The structural gap setup unwound without firing either DISTRIBUTION or LONG-TRAP — funding cooled rather than extended. Top L/S 1.92 down 0.32 over 7d means smart money kept exiting through the funding reset. OI -7.21% 24h prints heavy leverage unwind on top of the 24h price flatline. The setup that made BSB the cleanest watchlist candidate at 06:56Z evaporated by 17:10Z. The next trigger needs either funding spiking back above +0.08% on a flat day to re-fire the DISTRIBUTION setup, or a -10% Tier 2 drawdown with funding sign-flipping for CAPITULATION.",
  },
];

const neutral_summary = 'Neutral · 19 other assets · see artifact tail for full data';

const tail = [];
for (const a of Object.keys(metrics)) {
  const m = metrics[a];
  const prev = priorByAsset.get(a);
  tail.push({
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
      range_7d: m.range_7d_pct === null ? null : `${r2(m.range_7d_pct)}%`,
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
    yesterday_regime: prev ? prev.regime : null,
    repeat_days: repeatDaysFor(a, m.regime),
  });
}

const out = {
  date: TODAY,
  edge_case: null,
  verdict,
  regime_changes,
  regimes,
  regime_empty_notes: {
    ACCUMULATION:
      'HYPE OI +53.90% 7d on pct_7d +38.47% sits at range 45.95%, blocked by the 25% range gate. NEAR OI +179.52% 7d sits at range 69.87%. WLD OI +58.37% 7d sits at range 37.13%. EDEN OI +98.89% 7d sits at range 277.82%. ZEC OI +59.17% 7d sits at range 34.23%. The 25% range gate clears nobody today.',
    'CATALYST-BREAKOUT':
      'UB pct_24h +24.38% clears the Tier 2 +20% pct gate but vol_ratio 1.21x sits 0.79x under the 2.0x gate and taker buy 51.15% sits 0.85pp under the 52% gate. GENIUS vol_ratio 2.38x clears the 2.0x gate but pct_24h +9.51% sits 10.49pp under the +20% trigger and OI +7.90% 24h sits 2.10pp under the +10% gate. BILL pct_24h +11.87% and HYPE pct_24h +7.76% both fail the Tier 2 +20% pct trigger.',
    'SHORT-SQUEEZE':
      'HYPE pct_24h +7.76% sits 2.24pp under the Tier 2 +10% gate and OI +17.86% 24h fails the oi<0 requirement. ZEC pct_24h +7.78% sits 2.22pp under the +10% gate and OI +12.83% 24h fails oi<0. EDEN pct_24h +3.67% sits 6.33pp under the gate. GENIUS pct_24h +9.51% sits 0.49pp under the gate and OI +7.90% 24h fails oi<0.',
    MOMENTUM:
      'ZEC pct_7d +26.87% on OI +59.17% 7d clears the Tier 2 +15% floor and OI ≥0 24h but funding +0.0068%/8h sits 0.0232pp under the +0.03 entry. GENIUS pct_7d +65.38% on OI +160.17% 7d clears the floor but funding +0.0053%/8h sits 0.0247pp under the entry. WLD pct_7d +26.34% clears but funding -0.0076%/8h sits under the entry. ONDO pct_7d +28.94% clears but funding +0.0054% under the entry. UB funding +0.0341%/8h sits cleanly inside the band but pct_7d +3.96% sits 11.04pp under the Tier 2 floor.',
    COMPRESSION:
      'BNB range 4.81% clears the Tier 2 5% gate but OI -1.44% 7d fails the +5% OI build requirement. ADA range 7.98% fails the gate. BTC range 5.36% fails the Tier 1 3% gate. No Tier 2 asset combines a tight range with OI rebuilding today.',
    DISTRIBUTION:
      'No asset clears the funding-extreme gate this slice. UB funding +0.0341%/8h sits 0.0459pp under the +0.08 Tier 2 trigger. BSB funding +0.0038%/8h cooled -0.0905pp from the 06:56Z print and sits 0.0762pp under the trigger. NEAR funding +0.0083%/8h is the second-highest reading and still sits 0.0717pp short.',
    CAPITULATION:
      'No asset clears the drawdown gate. TON pct_24h -3.76% prints the heaviest red of the universe and sits 6.24pp inside the Tier 2 -10% gate. SUI pct_24h -2.19% and BEAT pct_24h -2.29% both sit well inside the gate.',
  },
  watch,
  neutral_summary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(out, null, 2));
console.log(
  `wrote .outputs/perps-scan.data.json — regimes:${REGIMES.map((r) => `${r}=${regimes[r].length}`).join(' ')} watch=${watch.length} tail=${tail.length} regime_changes=null (re-run case)`,
);
