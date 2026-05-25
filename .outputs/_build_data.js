#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for 2026-05-25 from computed metrics.

const fs = require('fs');
const path = require('path');

const ROOT = '/home/runner/work/aeon/aeon';
const METRICS = JSON.parse(fs.readFileSync(path.join(ROOT, '.outputs', 'perps-scan.metrics.json'), 'utf8'));

const m = {};
for (const a of METRICS.assets) m[a.asset] = a;

// Yesterday's regime map (from prior artifact)
const yest = {
  BTC: { regime: 'NEUTRAL', days: 3 }, ETH: { regime: 'NEUTRAL', days: 3 }, SOL: { regime: 'NEUTRAL', days: 3 },
  HYPE: { regime: 'NEUTRAL', days: 3 }, ZEC: { regime: 'NEUTRAL', days: 3 }, NEAR: { regime: 'NEUTRAL', days: 3 },
  BSB: { regime: 'NEUTRAL', days: 1 }, XRP: { regime: 'NEUTRAL', days: 3 }, DOGE: { regime: 'NEUTRAL', days: 3 },
  BILL: { regime: 'NEUTRAL', days: 3 }, BEAT: { regime: 'NEUTRAL', days: 2 }, GRASS: { regime: 'NEUTRAL', days: 1 },
  ONDO: { regime: 'NEUTRAL', days: 3 }, SUI: { regime: 'NEUTRAL', days: 3 }, WLD: { regime: 'NEUTRAL', days: 3 },
  BNB: { regime: 'NEUTRAL', days: 3 }, TON: { regime: 'NEUTRAL', days: 3 }, UB: { regime: null, days: 1 },
  EDEN: { regime: 'NEUTRAL', days: 3 }, '1000PEPE': { regime: 'NEUTRAL', days: 3 },
  GENIUS: { regime: null, days: 1 }, ASTER: { regime: null, days: 1 },
};

const r2 = x => x == null ? null : Math.round(x * 100) / 100;
const r4 = x => x == null ? null : Math.round(x * 10000) / 10000;

function tailMetrics(a) {
  return {
    price: a.current_price_fmt,
    pct_24h: r2(a.pct_24h),
    pct_7d: r2(a.pct_7d),
    pct_4h: r2(a.pct_4h),
    range_7d: a.range_7d_pct == null ? null : `${r2(a.range_7d_pct)}%`,
    pct_24h_vs_btc: r2(a.pct_24h_vs_btc),
    pct_7d_vs_btc: r2(a.pct_7d_vs_btc),
    oi_usd: a.oi_now_fmt,
    oi_24h_pct: r2(a.oi_24h_pct),
    oi_7d_pct: r2(a.oi_7d_pct),
    funding_now: r4(a.funding_now),
    funding_7d_avg: r4(a.funding_7d_avg),
    funding_delta: r4(a.funding_delta),
    liq_24h: a.liq_24h_total_fmt,
    liq_7d_p75: a.liq_7d_p75_fmt,
    long_liqs: a.long_liqs_24h_fmt,
    short_liqs: a.short_liqs_24h_fmt,
    liqs_4h: a.liqs_4h_fmt,
    top_ls: r2(a.top_ls_now),
    top_ls_7d_avg: r2(a.top_ls_7d_avg),
    top_ls_delta_7d: r2(a.top_ls_delta_7d),
    basis: a.basis_now == null ? null : r4(a.basis_now),
    taker_buy: r2(a.taker_buy_pct_24h),
  };
}

const tail = [];
for (const a of METRICS.assets) {
  const y = yest[a.asset];
  const yRegime = y ? y.regime : null;
  const todayRegime = 'NEUTRAL';
  // repeat_days: increment if today's regime matches yesterday's; reset to 1 if different or new
  const repeatDays = y && yRegime === todayRegime ? y.days + 1 : 1;
  tail.push({
    asset: a.asset,
    tier: a.tier,
    regime: todayRegime,
    sub_tags: [],
    pattern_tags: [],
    metrics: tailMetrics(a),
    yesterday_regime: yRegime,
    repeat_days: repeatDays,
  });
}

// Build watch entries with metric lines + transition reads
function fmtSigned(x, decimals = 2) {
  if (x == null) return 'n/a';
  const s = x >= 0 ? '+' : '';
  return `${s}${x.toFixed(decimals)}`;
}
function fmtPct(x, decimals = 2) {
  if (x == null) return 'n/a';
  return `${fmtSigned(x, decimals)}%`;
}
function metricsLine(a) {
  const parts = [];
  parts.push(`${fmtPct(a.pct_24h)} 24h, ${fmtPct(a.pct_7d)} 7d`);
  parts.push(`OI ${fmtPct(a.oi_24h_pct)} 24h on OI ${fmtPct(a.oi_7d_pct)} 7d`);
  parts.push(`funding ${fmtSigned(a.funding_now, 4)}%/8h (7d avg ${fmtSigned(a.funding_7d_avg, 4)}%, delta ${fmtSigned(a.funding_delta, 4)}%)`);
  parts.push(`taker buy ${a.taker_buy_pct_24h == null ? 'n/a' : a.taker_buy_pct_24h.toFixed(2) + '%'}`);
  parts.push(`liq ${a.liq_24h_total_fmt} vs 7d p75 ${a.liq_7d_p75_fmt}`);
  parts.push(`top L/S ${a.top_ls_now == null ? 'n/a' : a.top_ls_now.toFixed(2)} ${a.top_ls_delta_7d == null ? '' : (a.top_ls_delta_7d >= 0 ? 'up' : 'down') + ' ' + Math.abs(a.top_ls_delta_7d).toFixed(2) + ' 7d'}`);
  if (a.basis_now != null) parts.push(`basis ${fmtSigned(a.basis_now, 4)}%`);
  parts.push(`pct_4h ${a.pct_4h == null ? 'n/a' : fmtPct(a.pct_4h)}`);
  parts.push(`vol ${a.vol_ratio == null ? 'n/a' : a.vol_ratio.toFixed(2) + 'x'}`);
  return parts.join(', ');
}

const watch = [
  {
    asset: 'BSB',
    metrics_line: metricsLine(m.BSB),
    transition_read: "Funding rebuilt 2.6x from +0.0038%/8h at the 2026-05-24 17:10Z prefetch to +0.0100%/8h now, the first directional reset since the 17:10Z trough. Top L/S surged from 1.92 yesterday to 1.97 with a +0.58 7d delta — smart money rebuilt long conviction by the largest weekly swing in today's deck. OI -0.92% 24h on OI +36.45% 7d means the 7d position build holds while the latest 24h trims, the textbook crowded-long shape rebuilding under cooled funding. The 7d avg funding +0.0171% still sits above today's print because the 2026-05-24 06:56Z +0.0943% peak anchors the window. The DISTRIBUTION trigger needs another +0.07pp funding step on a flat-to-red day with OI rebuilding past +5% 24h to fire. A pct_24h drop past -10% with funding flipping sign fires CAPITULATION through the +33.94% 7d run.",
  },
  {
    asset: 'AGT',
    metrics_line: metricsLine(m.AGT),
    transition_read: "Pct_24h -10.68% clears the Tier 2 -10% CAPITULATION drawdown gate by 0.68pp on OI -18.42% 24h, which clears the -10% OI gate by 8.42pp. Liq $61.2K sits above the 7d p75 of $55.0K, clearing the liq gate. The funding gate fails — funding +0.0003%/8h sits positive when CAPITULATION needs funding < 0. Three of four CAPITULATION gates fire on the heaviest single-day flush in today's universe. The setup reads as forced unwind into a positive-funding wall — long-side capitulation without short-side conviction. Funding flipping negative on continued downside fires CAPITULATION. A failed bounce with funding holding positive sets the LONG-TRAP shape on tomorrow's slice.",
  },
  {
    asset: 'FIDA',
    metrics_line: metricsLine(m.FIDA),
    transition_read: "Funding prints -0.2309%/8h against a -0.1253% 7d average, a -0.1056pp delta that marks the heaviest short premium in the engine's deployment to date. Basis +0.5572% sits 1.6x the next-highest reading. Shorts pay extreme premium while spot trades at the heaviest futures discount of the week — the structural split reads as a deliberate cash-and-carry footprint scaling past the engine's standard taker_buy window. Top L/S 1.13 with a +0.05 7d delta means smart money sits balanced into the extreme funding setup. Pct_24h +3.83% on OI +7.81% 24h prints quiet positive grind into the squeeze fuel. A pct_24h push past +10% with OI reversing to <0 and short_liqs printing above 7d p75 fires SHORT-SQUEEZE through the funding wall. A flat day with funding extending past -0.30% sets up structural short-side capitulation when the eventual rip arrives.",
  },
  {
    asset: 'HYPE',
    metrics_line: metricsLine(m.HYPE),
    transition_read: "Yesterday's 17:10Z fresh-squeeze coil — funding -0.0201%/8h on pct_24h +7.76% with OI +17.86% 24h — unwound on today's flatline. Funding flipped back positive to +0.0068%/8h with pct_24h -0.33% and OI -2.13% 24h. The short-side leverage that paid premium yesterday has covered or rotated. Top L/S 1.36 up 0.18 over 7d means smart money kept rebuilding long conviction through the unwind. Pct_7d +31.10% holds the broader uptrend intact but the immediate squeeze fuel evaporated. A green pct_24h push past +10% with OI flipping negative again fires SHORT-SQUEEZE. A funding push past +0.03% on continuation fires MOMENTUM through the +31% 7d run.",
  },
  {
    asset: 'EDEN',
    metrics_line: metricsLine(m.EDEN),
    transition_read: "Funding extended deeper negative to -0.0540%/8h, holding the heaviest short premium in today's universe by a 2.2x margin over the second-highest (1000PEPE's funding sits positive — FIDA breaks the comparison with -0.2309%, so EDEN reads second deepest among the structurally non-broken reads). Basis +0.0455% collapsed from +0.3436% yesterday — futures-spot divergence narrowed sharply even as the funding gap widened. Top L/S 1.38 up 0.34 over 7d means smart money rebuilt long conviction through the negative-funding window. Pct_24h -1.90% on OI +0.64% 24h prints quiet bleed into the deepening short premium. A green pct_24h push past +5% with OI reversing fires SHORT-SQUEEZE through the funding wall. A red day with funding extending past -0.08% on no flush sets up structural long-bleed.",
  },
  {
    asset: 'NIL',
    metrics_line: metricsLine(m.NIL),
    transition_read: "First-day entrant prints pct_7d +64.50% on OI +398.60% 7d — the heaviest 7d position build in the entire engine deployment. Top L/S -0.75 over 7d means smart money exited 38% of long conviction over the same window the OI nearly quintupled. The split reads as retail piling into a leveraged narrative while smart money distributed underneath. Funding +0.0115%/8h sits 0.0285pp under the +0.04 Tier 2 DISTRIBUTION trigger but the 7d setup has the shape of a forming top. Vol 0.76x sits the highest in today's universe — the only asset where intraday flow is tracking the prior-week average. A funding spike past +0.04 with pct_24h going flat-to-red fires LONG-TRAP. A pct_24h drop past -10% with funding flipping sign fires CAPITULATION.",
  },
  {
    asset: 'ZEC',
    metrics_line: metricsLine(m.ZEC),
    transition_read: "Pct_24h cooled from +7.78% yesterday to -0.16% today. Funding still flipped positive (+0.0043%/8h vs a -0.0045% 7d avg) — the structural short-side discount unwound on yesterday's push but funding hasn't reset to the multi-day negative print yet. Top L/S 0.71 holds as the most-short smart-money positioning in today's universe (smart traders run 1.41-to-1 short). Pct_7d +17.47% sits 2.47pp above the Tier 2 +15% MOMENTUM floor but funding +0.0043% sits 0.0257pp under the +0.03 MOMENTUM entry — same gate that has blocked ZEC's MOMENTUM print all week. A funding push past +0.03% on continuation fires MOMENTUM. A pct_24h reversal past -5% with the short positioning unwinding sets a long bias against the smart-money short stack.",
  },
];

const data = {
  date: '2026-05-25',
  edge_case: null,
  verdict: {
    word: 'QUIET',
    distribution: '25 NEUTRAL across 25 assessed on the 2026-05-25 05:26Z prefetch.',
    cycle: "Every assessed asset prints NEUTRAL for a second consecutive calendar day after yesterday's two intraday 25/25 prints. The early-UTC snapshot caps vol_ratio at 0.07-0.36x universe-wide, blocking every CATALYST-BREAKOUT path until intraday flow accumulates against the 2.0x gate. The reshuffle since yesterday surfaces three NEUTRAL setups worth watching. BSB funding rebuilt from +0.0038%/8h at the 17:10Z reset to +0.0100%/8h with top L/S surging to 1.97 on a +0.58 7d delta, the cleanest rebuilding-DISTRIBUTION shape in today's deck. AGT printed pct_24h -10.68% on OI -18.42% 24h — the only Tier 2 asset to clear the CAPITULATION drawdown gate but funding +0.0003%/8h blocks the regime. FIDA's funding -0.2309%/8h against basis +0.5572% sets the heaviest funding-basis split in the engine's deployment to date.",
    forward: "BSB DISTRIBUTION fires on another +0.07pp funding step with OI rebuilding past +5% 24h. AGT CAPITULATION fires on funding flipping negative through the -10.68% drawdown already in place. FIDA SHORT-SQUEEZE fires on a pct_24h push past +10% with OI reversing to <0 and short_liqs clearing 7d p75. HYPE's yesterday fresh-squeeze coil unwound. ZEC's MOMENTUM print stays blocked by funding +0.0043%/8h sitting 0.0257pp under the entry gate.",
  },
  regime_changes: [],
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
    ACCUMULATION: "every Tier 2 asset that clears OI +10% 7d AND funding band fails the range_7d_pct < 25% gate — HYPE range 46.66%, ZEC 34.23%, NEAR 69.87%, EDEN 277.82%, WLD 37.13%, ONDO 42.95%, NIL 83.28%, GRASS 94.56%, GENIUS 105.71%, AGT 152.39%, BEAT 176.44%, UB 100.49%, BSB 446.90%. BNB range 4.81% qualifies but OI +2.64% 7d fails the +10% gate",
    'CATALYST-BREAKOUT': "no Tier 2 asset clears pct_24h +20% (the universe sits at pct_24h between -10.68% and +3.83%) and the early-UTC snapshot caps vol_ratio at 0.07-0.36x — the 2.0x gate is unreachable on this prefetch slice",
    'SHORT-SQUEEZE': "no Tier 2 asset clears pct_24h +10% — the highest reads are FIDA +3.83%, UB +3.69%, TON +2.69%, NIL +2.40%. Without the price extension, the regime cannot fire even on the EDEN and FIDA negative-funding setups",
    MOMENTUM: "no Tier 2 asset combines pct_7d > +15% with funding inside the +0.03 to +0.07 band — ZEC pct_7d +17.47% but funding +0.0043%; HYPE pct_7d +31.10% but funding +0.0068%; NEAR pct_7d +46.52% but funding +0.0088%; UB pct_7d +22.63% with funding +0.0154% holds the closest to the entry gate but sits 0.0146pp short",
    COMPRESSION: "BNB range 4.81% clears the Tier 2 5% gate but OI +2.64% 7d fails the +5% OI build requirement. No Tier 2 asset combines a tight range with OI rebuilding today",
    DISTRIBUTION: "no asset clears the funding-extreme gate — UB funding +0.0154%/8h sits 0.0246pp under the +0.04 Tier 2 trigger, NIL +0.0115%/8h sits 0.0285pp short, BEAT +0.0106%/8h sits 0.0294pp short, BILL +0.0101%/8h sits 0.0299pp short, BSB +0.0100%/8h sits 0.0300pp short",
    CAPITULATION: "AGT pct_24h -10.68% on OI -18.42% 24h clears the drawdown and OI gates by 0.68pp and 8.42pp respectively, with liq $61.2K above the 7d p75 of $55.0K — but funding +0.0003%/8h fails the funding < 0 requirement",
  },
  watch,
  neutral_summary: 'Neutral · 18 other assets · see artifact tail for full data',
  tail,
};

const OUT = path.join(ROOT, '.outputs', 'perps-scan.data.json');
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`wrote ${OUT}`);
