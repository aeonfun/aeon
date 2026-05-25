#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for the 2026-05-25 08:14Z prefetch.
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const m = c.metrics;

const ORDER = ['BTC','ETH','SOL','HYPE','ZEC','BSB','NEAR','XRP','DOGE','BILL','BEAT','UB','ONDO','SUI','WLD','NIL','BNB','GRASS','TON','1000PEPE','ASTER','GENIUS','ADA','EDEN','FIDA'];

// yesterday_regime / repeat_days carried from the 05:26Z run today (re-run case)
// ADA is new in today's 08:14Z universe (replaced AGT). Everything else continues
// from the prior tail.
const YR = {
  BTC: ['NEUTRAL', 4], ETH: ['NEUTRAL', 4], SOL: ['NEUTRAL', 4],
  HYPE: ['NEUTRAL', 4], ZEC: ['NEUTRAL', 4], BSB: ['NEUTRAL', 2],
  NEAR: ['NEUTRAL', 4], XRP: ['NEUTRAL', 4], DOGE: ['NEUTRAL', 4],
  BILL: ['NEUTRAL', 4], BEAT: ['NEUTRAL', 3], ONDO: ['NEUTRAL', 4],
  UB: [null, 1], SUI: ['NEUTRAL', 4], WLD: ['NEUTRAL', 4],
  NIL: [null, 1], BNB: ['NEUTRAL', 4], GRASS: ['NEUTRAL', 2],
  TON: ['NEUTRAL', 4], '1000PEPE': ['NEUTRAL', 4], ASTER: [null, 1],
  GENIUS: [null, 1], ADA: [null, 1], EDEN: ['NEUTRAL', 4], FIDA: [null, 1],
};

const f2 = (x, d=2) => (x === null || x === undefined || !Number.isFinite(x)) ? null : Number(x.toFixed(d));
const f3 = (x) => f2(x, 3);
const f4 = (x) => f2(x, 4);

const fmtPrice = (p) => {
  if (p === null) return '—';
  if (p < 0.01) return '$' + p.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 1) return '$' + p.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 10) return '$' + p.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (p < 1000) return '$' + p.toFixed(3);
  return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 1 });
};

const fmtBig = (v) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v/1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v/1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (v/1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
};

const tail = ORDER.map((a) => {
  const x = m[a];
  if (!x) return null;
  const [yr, rd] = YR[a] || [null, 1];
  return {
    asset: a,
    tier: x.tier,
    regime: x.regime,
    sub_tags: x.sub_tags,
    pattern_tags: x.pattern_tags,
    metrics: {
      price: fmtPrice(x.current_price),
      pct_24h: f2(x.pct_24h),
      pct_7d: f2(x.pct_7d),
      pct_4h: f2(x.pct_4h),
      range_7d: f2(x.range_7d_pct) + '%',
      pct_24h_vs_btc: f2(x.pct_24h_vs_btc),
      pct_7d_vs_btc: f2(x.pct_7d_vs_btc),
      oi_usd: fmtBig(x.oi_now),
      oi_24h_pct: f2(x.oi_24h_pct),
      oi_7d_pct: f2(x.oi_7d_pct),
      funding_now: f4(x.funding_now),
      funding_7d_avg: f4(x.funding_7d_avg),
      funding_delta: f4(x.funding_delta),
      liq_24h: fmtBig(x.liq_24h_total),
      liq_7d_p75: fmtBig(x.liq_7d_p75),
      long_liqs: fmtBig(x.long_liqs_24h),
      short_liqs: fmtBig(x.short_liqs_24h),
      liqs_4h: fmtBig(x.liqs_4h),
      top_ls: f2(x.top_ls_now),
      top_ls_7d_avg: f2(x.top_ls_7d_avg),
      top_ls_delta_7d: f2(x.top_ls_delta_7d),
      basis: f4(x.basis_now),
      taker_buy: f2(x.taker_buy_pct_24h),
    },
    yesterday_regime: yr,
    repeat_days: rd,
  };
}).filter(Boolean);

const data = {
  date: '2026-05-25',
  edge_case: null,
  verdict: {
    word: 'QUIET',
    distribution: '25 NEUTRAL across 25 assessed on the 2026-05-25 08:14Z prefetch.',
    cycle: "Every assessed asset prints NEUTRAL for the second consecutive calendar day. The 08:14Z snapshot moved hard on mid-caps since the same-day 05:26Z run. BSB flushed -6.71% on OI -5.93% 24h, BEAT dropped -10.42% on OI -15.10% 24h, UB popped +10.34% on OI +17.01% 24h, BILL bounced +6.85% off yesterday's -27.84% slide. No flip cleared a regime. BEAT crossed the Tier 2 CAPITULATION drawdown and OI gates by 0.42pp and 5.10pp but funding +0.0349%/8h held positive and liq $381K read under the 7d p75 of $1.98M. UB's pop forced the price-up read into the CATALYST-BREAKOUT path where vol_ratio 0.66x sits a third of the 2.0x gate. FIDA's funding -0.1739%/8h against basis +0.4588% holds the heaviest funding-basis split in the engine's deployment to date.",
    forward: 'BSB DISTRIBUTION fires on funding stepping past +0.04% with OI rebuilding past +5% 24h. BEAT CAPITULATION fires on funding flipping negative through the -10.42% drawdown already in place. UB CATALYST-BREAKOUT fires on vol_ratio clearing 2.0x with taker buy holding above 52% and OI continuing the build. FIDA SHORT-SQUEEZE fires on pct_24h pushing past +10% with OI reversing to <0 and short_liqs clearing 7d p75. HYPE MOMENTUM fires on funding pushing past +0.03% with pct_7d holding the +30% run.',
  },
  regime_changes: null,
  regimes: {
    ACCUMULATION: [],
    'CATALYST-BREAKOUT': [],
    'SHORT-SQUEEZE': [],
    MOMENTUM: [],
    COMPRESSION: [],
    DISTRIBUTION: [],
    CAPITULATION: [],
  },
  regime_empty_notes: {
    ACCUMULATION: 'every Tier 2 asset that clears OI +10% 7d AND funding band fails the range_7d_pct < 25% gate — HYPE range 38.38%, ZEC 25.13%, NEAR 58.90%, EDEN 258.23%, WLD 32.94%, ONDO 32.66%, NIL 82.96%, GRASS 91.53%, GENIUS 105.71%, BEAT 176.44%, UB 106.36%, BSB 446.90%. BNB range 4.72% qualifies but OI +3.43% 7d fails the +10% gate',
    'CATALYST-BREAKOUT': "UB pct_24h +10.34% reads the universe high but sits at half the Tier 2 +20% gate. Vol_ratio caps at 1.42x on NIL — the 2.0x gate is unreachable on this prefetch slice",
    'SHORT-SQUEEZE': 'UB pct_24h +10.34% clears the Tier 2 +10% gate but OI +17.01% 24h fails the OI < 0 requirement, forcing the price-up read into the CATALYST-BREAKOUT path. No other asset clears the price gate (next: BILL +6.85%, FIDA +2.07%, TON +2.76%, GRASS +2.77%)',
    MOMENTUM: 'no Tier 2 asset combines pct_7d > +15% with funding inside the +0.03 to +0.07 band — HYPE pct_7d +32.59% but funding +0.0075%; NEAR pct_7d +47.02% but funding +0.0071%; ZEC pct_7d +17.37% but funding +0.0055%; UB pct_7d +30.49% with funding +0.0146% holds closest to the entry gate but sits 0.0154pp short',
    COMPRESSION: 'BNB range 4.72% clears the Tier 2 5% gate but OI +3.43% 7d fails the +5% OI build requirement by 1.57pp. No Tier 2 asset combines tight range with OI rebuilding today',
    DISTRIBUTION: 'no asset clears the funding-extreme gate — BEAT funding +0.0349%/8h reads the universe high but sits 0.0451pp under the +0.08 Tier 2 trigger. BSB +0.0152%/8h, UB +0.0146%/8h, BNB +0.0068%/8h follow',
    CAPITULATION: 'BEAT pct_24h -10.42% on OI -15.10% 24h clears the Tier 2 drawdown and OI gates by 0.42pp and 5.10pp respectively but funding +0.0349%/8h fails the funding < 0 requirement and liq $381K reads under the 7d p75 of $1.98M',
  },
  watch: [
    {
      asset: 'BSB',
      metrics_line: '-6.71% 24h, +25.14% 7d, OI -5.93% 24h on OI +29.55% 7d, funding +0.0152%/8h (7d avg +0.0176%, delta -0.0025%), taker buy 49.59%, liq $167K vs 7d p75 $3.3M, top L/S 1.95 up 0.56 7d, pct_4h -7.50%, vol 0.13x',
      transition_read: "Yesterday's crowded-long shape flushed. Pct_24h -6.71% on OI -5.93% 24h means longs unwound through the drop while spot took the move. Funding held positive at +0.0152%/8h with the 7d avg sitting at +0.0176%. The prior week's funding wall still anchors the curve. Top L/S 1.95 with +0.56 over 7d reads as smart money holding net long through the flush. The shape reads as partial leverage unwind, not capitulation. A second leg down past -10% on the day with funding flipping negative fires CAPITULATION. A bounce with funding stepping past +0.04% and OI rebuilding past +5% 24h fires DISTRIBUTION through the rebuilding stack.",
    },
    {
      asset: 'BEAT',
      metrics_line: '-10.42% 24h, +71.05% 7d, OI -15.10% 24h on OI +46.03% 7d, funding +0.0349%/8h (7d avg +0.0113%, delta +0.0236%), taker buy 47.68%, liq $381K vs 7d p75 $2.0M, top L/S 1.63 down 0.32 7d, pct_4h -7.81%, vol 0.19x',
      transition_read: 'Pct_24h -10.42% clears the Tier 2 -10% CAPITULATION drawdown gate by 0.42pp. OI -15.10% 24h clears the -10% OI gate by 5.10pp. The funding gate fails on +0.0349%/8h sitting positive when CAPITULATION needs funding < 0. The liq gate fails on $381K reading under the 7d p75 of $1.98M. Two of four gates fire. Top L/S 1.63 with -0.32 over 7d means smart money cut conviction through the build. Funding rebuilt +0.0236% over the 7d avg, the heaviest funding delta in the universe today. Longs paid up as price flushed. The setup reads as long-side unwind into a positive-funding wall. Funding flipping negative on continued downside fires CAPITULATION. A failed bounce with funding holding positive sets LONG-TRAP on tomorrow\'s slice.',
    },
    {
      asset: 'UB',
      metrics_line: '+10.34% 24h, +30.49% 7d, OI +17.01% 24h on OI +98.81% 7d, funding +0.0146%/8h (7d avg +0.0108%, delta +0.0038%), taker buy 51.78%, liq $273K vs 7d p75 $590K, top L/S 0.90 down 0.09 7d, pct_4h +7.86%, vol 0.66x',
      transition_read: "Pct_24h +10.34% sits at half the Tier 2 +20% CATALYST-BREAKOUT gate. OI +17.01% 24h clears the +10% gate by 7.01pp. Taker buy 51.78% sits 0.22pp under the 52% gate. Vol_ratio 0.66x reads a third of the 2.0x gate, the binding constraint. The SHORT-SQUEEZE alternative fails on OI being positive (the gate requires OI flipping negative). Smart money sits 1.11-to-1 short at top L/S 0.90 with the position cut -0.09 over 7d. The move reads as forced short cover against a smart-money short stack. A continuation push to +20% 24h with vol_ratio crossing 2.0x and taker buy holding above 52% fires CATALYST-BREAKOUT. A reversal past -3% with OI flipping negative and short_liqs clearing p75 fires SHORT-SQUEEZE.",
    },
    {
      asset: 'FIDA',
      metrics_line: '+2.07% 24h, +73.29% 7d, OI +2.64% 24h on OI +21.97% 7d, funding -0.1739%/8h (7d avg -0.1116%, delta -0.0623%), taker buy 49.69%, liq $63K vs 7d p75 $1.6M, top L/S 1.11 up 0.03 7d, basis +0.4588%, pct_4h -0.96%, vol 0.13x',
      transition_read: "Funding prints -0.1739%/8h against a -0.1116% 7d average. The -0.0623pp delta extends the heaviest short premium in the engine's deployment to date. Basis +0.4588% holds 3.4x above any other reading in the universe outside EDEN's +0.3883%. Shorts pay extreme premium while spot trades at the heaviest futures discount of the week. The structural split reads as deliberate cash-and-carry footprint scaling past the engine's standard taker_buy window. Taker buy 49.69% sits inside the 48-52 cash-and-carry gate but funding_delta -0.0623 sits 5x outside the 0.01 absolute gate, so the CASH-AND-CARRY pattern tag does not fire. Top L/S 1.11 with +0.03 over 7d means smart money sits balanced into the extreme funding setup. Pct_24h +2.07% on OI +2.64% 24h prints quiet positive grind into the squeeze fuel. A pct_24h push past +10% with OI reversing to <0 and short_liqs clearing 7d p75 fires SHORT-SQUEEZE through the funding wall. A flat day with funding extending past -0.20% sets structural short-side capitulation when the eventual rip arrives.",
    },
    {
      asset: 'NIL',
      metrics_line: '+3.75% 24h, +66.65% 7d, OI +13.04% 24h on OI +410.41% 7d, funding +0.0004%/8h (7d avg +0.0007%, delta -0.0004%), taker buy 49.88%, liq $314K vs 7d p75 $333K, top L/S 1.19 down 0.77 7d, basis +0.0896%, pct_4h +1.47%, vol 1.42x',
      transition_read: 'Pct_7d +66.65% on OI +410.41% 7d extends the heaviest 7d position build in the engine deployment, up from yesterday\'s +398.60%. Top L/S 1.19 with -0.77 over 7d means smart money exited 39% of long conviction while OI quintupled. The split reads as retail piling into a leveraged narrative while smart money distributed underneath. Vol_ratio 1.42x sits the highest in today\'s universe and the only reading above 1.0x. Intraday flow tracks 142% of the prior-week average. Funding +0.0004%/8h cooled from yesterday\'s +0.0115% spike. The funding reset under continued OI growth and price expansion reads as retail refreshing the position without paying premium yet. A funding spike past +0.04% with pct_24h going flat-to-red fires LONG-TRAP. A pct_24h drop past -10% with funding flipping sign and OI shedding past -10% fires CAPITULATION.',
    },
    {
      asset: 'HYPE',
      metrics_line: '+0.80% 24h, +32.59% 7d, OI -0.83% 24h on OI +38.07% 7d, funding +0.0075%/8h (7d avg +0.0033%, delta +0.0041%), taker buy 49.78%, liq $1.0M vs 7d p75 $9.4M, top L/S 1.35 up 0.17 7d, pct_4h +0.88%, vol 0.29x',
      transition_read: "Pct_7d +32.59% holds the second-highest 7d run in today's universe behind GRASS +75.45%. The 05:26Z snapshot had pct_24h -0.33% on funding +0.0068%/8h. The 08:14Z snapshot lifts pct_24h to +0.80% with funding stepping to +0.0075%/8h. Funding sits 0.0225pp under the +0.03 MOMENTUM gate, the closest path to a regime print on this asset. Top L/S 1.35 with +0.17 over 7d means smart money kept building long conviction through the consolidation. OI -0.83% 24h on OI +38.07% 7d means the latest leverage adds trimmed by 1.6 percentage points of the weekly build. A funding push past +0.03% on continuation fires MOMENTUM through the +32% 7d run. A reversal past -5% 24h with funding flipping sign and OI shedding past -5% fires CAPITULATION.",
    },
    {
      asset: 'EDEN',
      metrics_line: '-2.28% 24h, +78.71% 7d, OI +1.28% 24h on OI +106.22% 7d, funding -0.0428%/8h (7d avg -0.0249%, delta -0.0179%), taker buy 50.01%, liq $20K vs 7d p75 $2.1M, top L/S 1.39 up 0.35 7d, basis +0.3883%, pct_4h -0.33%, vol 0.05x',
      transition_read: "Funding holds at -0.0428%/8h against a -0.0249% 7d average. Basis +0.3883% sits the second-highest in the universe behind FIDA's +0.4588%. Shorts pay sustained premium against spot trading at a futures discount. Top L/S 1.39 with +0.35 over 7d means smart money rebuilt long conviction through the negative-funding window. Pct_24h -2.28% on OI +1.28% 24h prints quiet bleed into the deepening short premium. A green pct_24h push past +5% with OI reversing fires SHORT-SQUEEZE through the funding wall. A red day with funding extending past -0.08% on no flush sets structural long-bleed.",
    },
  ],
  neutral_summary: 'Neutral · 18 other assets · see artifact tail for full data',
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(data, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — ${tail.length} tail entries, ${data.watch.length} watch entries`);
