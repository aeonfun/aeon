#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for 2026-05-24 from .outputs/_perps_compute.json
// + yesterday's perps-scan.data.json (2026-05-23 reference) for transition/repeat detection.
// Verdict prose, WATCH bucket reads, transition notes authored inline against the
// 2026-05-24 06:56Z prefetch.
import fs from 'node:fs';

const TODAY = '2026-05-24';
const REGIMES = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;

// Yesterday's data — same file path; the prior artifact carries the 05-23 mapping.
// The render-perps-scan postprocess will overwrite the markdown, but we read the JSON
// before we overwrite it.
const prior = JSON.parse(fs.readFileSync('.outputs/perps-scan.data.json', 'utf8'));
if (prior.date !== '2026-05-23') {
  console.error(`prior artifact date is ${prior.date}, not 2026-05-23 — proceeding but transition logic assumes 05-23`);
}
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

function repeatDaysFor(asset, regimeToday) {
  const prev = priorByAsset.get(asset);
  if (!prev) return 1;
  if (prev.regime === regimeToday) return (prev.repeat_days || 1) + 1;
  return 1;
}

// Verdict block authored against the 06:56Z prefetch.
const verdict = {
  word: 'QUIET',
  distribution: '25 NEUTRAL across 25 assessed on the 06:56Z prefetch.',
  cycle:
    'Every assessed asset prints NEUTRAL while leverage extremes pile up under the hood. BSB funding ripped to +0.0943%/8h, clearing the +0.08 Tier 2 DISTRIBUTION gate, but pct_24h +18.38% outran pct_7d/7 of +18.20% by 0.17pp. Gains-accelerating blocks DISTRIBUTION even as funding above +0.07 simultaneously blocks MOMENTUM, leaving BSB in a structural gap. IN entered the universe with OI +492.44% 7d on vol_ratio 1.43x and pct_7d +75.76%, but funding -0.0016%/8h fails the MOMENTUM positive-funding floor and taker buy 51.44% lacks the 52% CATALYST gate. GMT funding at -0.2038%/8h marks the heaviest short premium in the universe by a 14x margin, with top L/S 1.20 down 0.68 over 7d. Smart money joined the shorts hard. EDEN cleared three of four CAPITULATION gates yesterday and still has not delivered the $2M+ liq flush, while today pct_24h -6.86% slipped 3.14pp inside the Tier 2 -10% drawdown gate.',
  forward:
    'BSB needs a flat-to-red day with funding holding above +0.08%/8h to fire DISTRIBUTION via the gains-slowing gate. A reversal with funding extending fires LONG-TRAP. IN needs another 4h extending pct_24h through +20% with taker buy clearing 52% to fire CATALYST-BREAKOUT. EDEN needs pct_24h pushing past -10% with liq clearing $2M to complete CAPITULATION. GMT shorts covering on a green pct_24h +10% day with OI rolling further negative and short_liqs above 7d p75 fires SHORT-SQUEEZE. BEAT OI rebuilding to positive with funding holding inside the +0.03 to +0.07 band fires MOMENTUM.',
};

// Regime transitions — diff today vs yesterday for assets present in both universes.
const regime_changes = [];
for (const a of Object.keys(metrics)) {
  const prev = priorByAsset.get(a);
  const rt = metrics[a].regime;
  if (!prev) continue; // new asset — no transition
  if (prev.regime !== rt) {
    regime_changes.push({ asset: a, from: prev.regime, to: rt, note: '' });
  }
}

// Curated note for BSB — the only transition today.
const bsb = regime_changes.find((c) => c.asset === 'BSB');
if (bsb) {
  bsb.note =
    'Funding repriced from +0.0560%/8h yesterday to +0.0943%/8h today, a +0.0383pp jump that cleared the +0.08 Tier 2 DISTRIBUTION trigger. Pct_24h +18.38% outran pct_7d/7 of +18.20% by 0.17pp, so gains-accelerating blocks DISTRIBUTION by the thinnest margin in the universe. Funding above the +0.07 MOMENTUM cap simultaneously closes the prior regime. The coin sits in a structural gap between MOMENTUM and DISTRIBUTION until either funding cools or pct_24h slows.';
}

// Empty regimes today.
const regimes = {};
for (const r of REGIMES) regimes[r] = [];

// WATCH bucket — six highest-signal near-misses.
const watch = [
  {
    asset: 'BSB',
    metrics_line:
      '+18.38% 24h, +127.42% 7d, OI +9.94% 24h on OI +83.61% 7d, funding +0.0943%/8h (7d avg +0.0205%, delta +0.0738%), taker buy 50.76%, liq $318K vs 7d p75 $3.3M, top L/S 2.00 down 0.24 7d, pct_4h +5.01%, vol 0.17x',
    transition_read:
      "Funding repriced from +0.0560%/8h yesterday to +0.0943%/8h today, a +0.0383pp jump in 24h on a coin already past the MOMENTUM band. The +0.0943% reading clears the +0.08 Tier 2 DISTRIBUTION trigger, but pct_24h +18.38% beat pct_7d/7 of +18.20% by 0.17pp. Gains-accelerating blocks DISTRIBUTION by the thinnest margin in today's universe. Funding above +0.07 simultaneously blocks MOMENTUM. Top L/S 2.00 down 0.24 over 7d means smart money exited 12% of long conviction this week while retail funded the move. Either a flat-to-red day with funding holding above +0.08 fires DISTRIBUTION, or a reversal with funding extending fires LONG-TRAP. Liq $318K against 7d p75 $3.3M leaves plenty of leverage left to unwind.",
  },
  {
    asset: 'IN',
    metrics_line:
      '+12.76% 24h, +75.76% 7d, OI +15.56% 24h on OI +492.44% 7d, funding -0.0016%/8h (7d avg +0.0109%, delta -0.0124%), taker buy 51.44%, liq $403K vs 7d p75 $160K, top L/S 1.28 up 0.10 7d, pct_4h +3.42%, vol 1.43x',
    transition_read:
      'First appearance in the universe. OI +492.44% 7d is the heaviest position build today by a 3x margin over BSB. Pct_24h +12.76% with vol_ratio 1.43x and taker buy 51.44% sits 0.56pp under the 52% CATALYST gate, and pct_24h itself sits 7.24pp under the +20% Tier 2 trigger. Funding -0.0016%/8h means late longs paid premium for the first six days of the run and rolled negative as the move extended. Liq $403K printed 2.5x the thin 7d p75 of $160K, so leverage is repricing without unwinding. Another 4h extending pct_24h through +20% with taker buy clearing 52% fires CATALYST-BREAKOUT. A reversal with funding pushing past -0.01% fires the heavy-OI-unwind setup.',
  },
  {
    asset: 'GMT',
    metrics_line:
      '-6.36% 24h, +13.63% 7d, OI -6.11% 24h on OI +249.57% 7d, funding -0.2038%/8h (7d avg -0.0834%, delta -0.1204%), taker buy 47.81%, liq $134K vs 7d p75 $81K, top L/S 1.20 down 0.68 7d, basis +0.336%, pct_4h -1.97%, vol 0.65x',
    transition_read:
      "Funding -0.2038%/8h marks the heaviest short premium in the universe by a 14x margin over the second-heaviest negative print. Funding extended -0.1204pp past the 7d -0.0834% average, meaning shorts paid sharply more premium this slice than they did all week. Top L/S 1.20 down 0.68 over 7d means smart money joined the short side hard. Pct_24h -6.36% on OI -6.11% 24h prints the standard bleed-with-leverage-rolling shape. Basis +0.336% positive into deeply negative funding means spot still bids while futures shorts hold the line. A green pct_24h day with OI rolling further negative and short_liqs above 7d p75 fires SHORT-SQUEEZE. The squeeze setup is the cleanest in today's universe.",
  },
  {
    asset: 'EDEN',
    metrics_line:
      '-6.86% 24h, +82.65% 7d, OI -3.58% 24h on OI +91.10% 7d, funding -0.0147%/8h (7d avg -0.0374%, delta +0.0227%), taker buy 50.07%, liq $130K vs 7d p75 $2.1M, top L/S 1.29 down 0.37 7d, basis +0.066%, pct_4h -5.35%, vol 0.09x',
    transition_read:
      "Yesterday cleared three of four CAPITULATION gates: pct_24h -11.24%, OI -30.10% 24h, and funding rolling back negative. Today pct_24h -6.86% slipped 3.14pp inside the Tier 2 -10% drawdown gate, so the regime trigger now fails on two fronts. Liq $130K against 7d p75 $2.1M holds at 6% of the threshold, meaning the cascade exhausted earlier in the week and the structure rebuilt slowly. Funding -0.0147%/8h cooled from yesterday's already-negative -0.0185% but stayed inside the negative-funding zone. Top L/S 1.29 down 0.37 over 7d means smart money still exiting. A second flush leg with pct_24h pushing past -10% on liq clearing $2M completes CAPITULATION. Without that flush the coin just bleeds out structurally.",
  },
  {
    asset: 'BEAT',
    metrics_line:
      '+3.09% 24h, +107.60% 7d, OI -4.45% 24h on OI +111.74% 7d, funding +0.0379%/8h (7d avg +0.0115%, delta +0.0263%), taker buy 51.28%, liq $816K vs 7d p75 $1.4M, top L/S 1.47 down 0.53 7d, pct_4h -9.81%, vol 0.64x',
    transition_read:
      "Yesterday's near-CATALYST-BREAKOUT setup faded. Pct_4h -9.81% prints heavy red on the last four hours and OI rolled to -4.45% 24h, blocking the MOMENTUM ≥0 OI gate while funding +0.0379%/8h sits cleanly inside the +0.03 to +0.07 MOMENTUM band. Leverage is unwinding faster than the price gives back. Top L/S 1.47 down 0.53 over 7d marks the second-heaviest smart-money exit in today's universe behind GMT. OI rebuilding to positive with funding holding inside the band fires MOMENTUM. Funding pushing through +0.08 on a flat-to-red pct_24h fires DISTRIBUTION.",
  },
  {
    asset: 'HYPE',
    metrics_line:
      '+5.02% 24h, +34.96% 7d, OI +10.21% 24h on OI +43.92% 7d, funding -0.0002%/8h (7d avg +0.0015%, delta -0.0016%), taker buy 49.72%, liq $2.8M vs 7d p75 $9.4M, top L/S 1.33 up 0.08 7d, pct_4h +2.71%, vol 0.37x',
    transition_read:
      'Pct_24h +5.02% with OI +10.21% 24h prints fresh leverage onto a fresh price tick. Both lifted together this slice. Funding -0.0002%/8h cooled from the +0.0015% 7d average and sits at the neutral line. Top L/S 1.33 up 0.08 over 7d means smart money rebuilt some long exposure this week while almost every other coin in the universe traded smart-money-exiting. Range 41.81% blocks ACCUMULATION even though OI +43.92% 7d and pct_7d +34.96% would qualify. Taker buy 49.72% sits 2.28pp under the 52% CATALYST gate. A range-tightening week under 25% with OI holding fires ACCUMULATION CONFIRMED. A pct_24h push above +8% with taker clearing 52% and vol clearing 2x fires CATALYST-BREAKOUT.',
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
      'HYPE OI +43.92% 7d on pct_7d +34.96% sits at range 41.81%, blocked by the 25% range gate. NEAR OI +169.93% 7d sits at range 67.43%. ONDO OI +52.27% 7d sits at range 42.95%. WLD OI +53.34% 7d sits at range 35.07%. The 25% range gate clears nobody today.',
    'CATALYST-BREAKOUT':
      'IN pct_24h +12.76% on vol_ratio 1.43x and OI +15.56% 24h, but taker buy 51.44% lacks the 52% gate by 0.56pp and pct_24h sits 7.24pp under the +20% Tier 2 trigger. BEAT pct_24h +3.09% on OI -4.45% 24h blocks every gate.',
    'SHORT-SQUEEZE':
      'IN and BSB both clear the +10% pct_24h gate but OI +15.56% / +9.94% 24h fails the oi<0 requirement on both. GMT carries -6.11% OI 24h but pct_24h -6.36% fails the +10% pct_24h gate by a wide margin.',
    MOMENTUM:
      'BSB funding +0.0943%/8h clears the +0.03 floor but sits 0.0243pp above the +0.07 cap. BEAT funding +0.0379%/8h sits inside the band but OI -4.45% 24h fails the ≥0 gate. WLD / ONDO / HYPE all clear the +15% Tier 2 pct_7d floor but funding sits below the +0.03 entry threshold.',
    COMPRESSION:
      'BNB range 4.81% clears the Tier 2 5% gate, but OI -1.99% 7d fails the +5% OI build requirement. BTC range 5.36% fails the Tier 1 3% gate. No Tier 2 asset combines a tight range with OI rebuilding today.',
    DISTRIBUTION:
      "BSB funding +0.0943%/8h clears the +0.08 Tier 2 trigger, but pct_24h +18.38% outran pct_7d/7 of +18.20% by 0.17pp. Gains-accelerating blocks the regime by the narrowest margin in today's universe. BEAT funding +0.0379%/8h sits 0.0421pp under the +0.08 trigger.",
    CAPITULATION:
      'EDEN pct_24h -6.86% fails the Tier 2 -10% drawdown gate by 3.14pp. The funding sign-flip block lifted yesterday, but the drawdown gate became the new hold-out today. Liq $130K against 7d p75 $2.1M would still block even if drawdown cleared.',
  },
  watch,
  neutral_summary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(out, null, 2));
console.log(
  `wrote .outputs/perps-scan.data.json — regimes:${REGIMES.map((r) => `${r}=${regimes[r].length}`).join(' ')} watch=${watch.length} tail=${tail.length} transitions=${regime_changes.length}`,
);
