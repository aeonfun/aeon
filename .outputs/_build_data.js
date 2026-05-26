// Build .outputs/perps-scan.data.json from .outputs/_perps_compute.json
const fs = require('fs');

const TODAY = '2026-05-26';

const d = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json'));
const yest = JSON.parse(fs.readFileSync('.outputs/perps-scan.data.json'));
const yestMap = {};
for (const a of yest.tail) yestMap[a.asset] = a.regime;

const M = d.metrics;
const fmt$ = (v) => {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtPx = (v) => {
  if (v >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  if (v >= 1) return `$${v.toFixed(3)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
};

// Repeat-days counter for NEUTRAL stretches based on prior log entries.
// All assets carrying NEUTRAL from yesterday (05-25 09:20Z) and prior days through 05-22 stretch.
const repeatDaysIfNeutral = {
  BTC: 5, ETH: 5, SOL: 5, HYPE: 5, XRP: 5, DOGE: 5, BILL: 5, ONDO: 5, SUI: 5, WLD: 5, BNB: 5, TON: 5,
  NEAR: 5, BEAT: 4, BSB: 3, GRASS: 3, UB: 2, NIL: 2, ADA: 2, PLAY: 2,
};

const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const byRegime = {};
for (const r of REGIME_ORDER) byRegime[r] = [];
const tail = [];

for (const asset of Object.keys(M)) {
  const m = M[asset];
  const reg = m.regime;
  if (reg !== 'NEUTRAL' && byRegime[reg]) byRegime[reg].push(asset);
  const yr = yestMap[asset] ?? null;
  let repeat = 1;
  if (reg === 'NEUTRAL' && yr === 'NEUTRAL') repeat = (repeatDaysIfNeutral[asset] ?? 2);
  tail.push({
    asset,
    tier: m.tier,
    regime: reg,
    sub_tags: m.sub_tags,
    pattern_tags: m.pattern_tags,
    metrics: {
      price: fmtPx(m.current_price),
      pct_24h: Number(m.pct_24h.toFixed(2)),
      pct_7d: Number(m.pct_7d.toFixed(2)),
      pct_4h: m.pct_4h === null ? null : Number(m.pct_4h.toFixed(2)),
      range_7d: `${m.range_7d_pct.toFixed(2)}%`,
      pct_24h_vs_btc: Number(m.pct_24h_vs_btc.toFixed(2)),
      pct_7d_vs_btc: Number(m.pct_7d_vs_btc.toFixed(2)),
      oi_usd: fmt$(m.oi_now),
      oi_24h_pct: Number(m.oi_24h_pct.toFixed(2)),
      oi_7d_pct: Number(m.oi_7d_pct.toFixed(2)),
      funding_now: Number(m.funding_now.toFixed(4)),
      funding_7d_avg: Number(m.funding_7d_avg.toFixed(4)),
      funding_delta: Number(m.funding_delta.toFixed(4)),
      liq_24h: fmt$(m.liq_24h_total),
      liq_7d_p75: fmt$(m.liq_7d_p75),
      long_liqs: fmt$(m.long_liqs_24h),
      short_liqs: fmt$(m.short_liqs_24h),
      liqs_4h: fmt$(m.liqs_4h),
      top_ls: m.top_ls_now === null ? null : Number(m.top_ls_now.toFixed(2)),
      top_ls_7d_avg: m.top_ls_7d_avg === null ? null : Number(m.top_ls_7d_avg.toFixed(2)),
      top_ls_delta_7d: m.top_ls_delta_7d === null ? null : Number(m.top_ls_delta_7d.toFixed(2)),
      basis: m.basis_now === null ? null : Number(m.basis_now.toFixed(4)),
      taker_buy: m.taker_buy_pct_24h === null ? null : Number(m.taker_buy_pct_24h.toFixed(2)),
    },
    yesterday_regime: yr,
    repeat_days: repeat,
  });
}

function metricLineAccum(a) {
  const m = M[a];
  const basis = m.basis_now !== null ? `, basis ${m.basis_now >= 0 ? '+' : ''}${m.basis_now.toFixed(4)}%` : '';
  return `OI +${m.oi_7d_pct.toFixed(2)}% 7d on +${m.pct_7d.toFixed(2)}% price, funding ${m.funding_now >= 0 ? '+' : ''}${m.funding_now.toFixed(4)}%/8h (7d avg ${m.funding_7d_avg >= 0 ? '+' : ''}${m.funding_7d_avg.toFixed(4)}%), top L/S ${m.top_ls_now.toFixed(2)} (Δ ${m.top_ls_delta_7d >= 0 ? '+' : ''}${m.top_ls_delta_7d.toFixed(2)} 7d), range ${m.range_7d_pct.toFixed(2)}%, taker buy ${m.taker_buy_pct_24h.toFixed(2)}%${basis}`;
}

const subTagReads = {
  ZEC: 'Taker buy 46.72% sits 3.28pp under the 50% gate. OI rebuilt +20.07% 7d without aggressive bid crossing.',
  TAO: 'Taker buy 46.68% sits 3.32pp under the 50% gate. OI +15.71% 7d builds passively against top L/S rolling -0.10 over 7d.',
  INJ: 'Taker buy 47.78% sits 2.22pp under the 50% gate. OI +47.88% 7d builds passively while funding flips to -0.0123%/8h.',
};

for (const r of REGIME_ORDER) {
  byRegime[r] = byRegime[r].map((a) => ({
    asset: a,
    tier: M[a].tier,
    marker: 'bullet',
    metrics_line: metricLineAccum(a),
    tags: [{ tag: `${r} · DIVERGENT`, read: subTagReads[a] }],
  }));
}

const regime_changes = [
  { asset: 'ZEC', from: 'NEUTRAL', to: 'ACCUMULATION', note: 'OI +20.07% 7d with funding +0.0107%/8h crosses the ACCUMULATION gates. DIVERGENT sub-tag fires on taker buy 46.72%. Passive build, not aggressive bid.' },
  { asset: 'TAO', from: '(new entrant)', to: 'ACCUMULATION', note: 'First appearance in the universe. OI +15.71% 7d with funding +0.0054%/8h. DIVERGENT sub-tag fires on taker buy 46.68%.' },
  { asset: 'INJ', from: '(new entrant)', to: 'ACCUMULATION', note: 'First appearance in the universe. OI +47.88% 7d with funding -0.0123%/8h. DIVERGENT sub-tag fires on taker buy 47.78%.' },
];

const regime_empty_notes = {
  'CATALYST-BREAKOUT': 'no asset combines pct_24h > +20% (Tier 2) or > +8% (Tier 1) with vol_ratio > 2.0x and OI +10% 24h on taker buy > 52%. WLD pct_24h +5.81% on OI +11.80% 24h fails the Tier 2 +20% gate by 14.19pp. UB pct_24h +4.15% on OI +7.14% 24h fails both the +20% pct gate and the +10% OI gate',
  'SHORT-SQUEEZE': 'no asset combines a positive pct_24h push past +10% (Tier 2) with OI rolling negative. PHA pct_24h -0.31% sits the right side of the OI gate at oi24 +12.13% but fails the price-up direction by 10.31pp. WLD pct_24h +5.81% on OI +11.80% 24h fails the OI < 0 requirement',
  'MOMENTUM': "no asset combines pct_7d > +15% (Tier 2) with funding inside the +0.03 to +0.07 band. GRASS pct_7d +89.68% on funding +0.0071%/8h, NEAR pct_7d +69.41% on funding -0.0026%/8h, BEAT pct_7d +74.22% on funding +0.0237%/8h, UB pct_7d +63.48% on funding +0.0117%/8h, PHA pct_7d +47.01% on funding -0.1419%/8h all sit below the +0.03 funding floor. HYPE pct_7d +24.21% on funding +0.0054%/8h sits closest at 0.0246pp short of the entry gate",
  'COMPRESSION': 'BNB range 6.06% misses the Tier 2 5% gate by 1.06pp. BTC range 5.36% misses the Tier 1 3% gate. No asset combines a tight 7d range with OI rebuilding +5% 7d on calm funding',
  'DISTRIBUTION': "PLAY funding +0.0422%/8h cooled from yesterday's +0.073%/8h print and now sits 0.0378pp under the +0.08 Tier 2 trigger. BEAT funding +0.0237%/8h sits 0.0563pp short. UB funding +0.0117%/8h sits 0.0683pp short. No asset clears the funding trigger AND the OI +5% 24h gate today",
  'CAPITULATION': 'NIL pct_24h -14.44% on OI -24.54% 24h clears both the Tier 2 -10% drawdown gate by 4.44pp and the -10% OI gate by 14.54pp, but funding +0.0043%/8h fails the funding < 0 requirement. ESPORTS pct_24h -9.45% sits 0.55pp short of the Tier 2 drawdown gate. ZEC pct_24h -5.59% on OI -8.16% 24h fails the drawdown gate by 4.41pp and the OI gate by 1.84pp',
};

function watchLine(a) {
  const m = M[a];
  const p4 = m.pct_4h !== null ? `, pct_4h ${m.pct_4h >= 0 ? '+' : ''}${m.pct_4h.toFixed(2)}%` : '';
  const basis = m.basis_now !== null ? `, basis ${m.basis_now >= 0 ? '+' : ''}${m.basis_now.toFixed(4)}%` : '';
  const liq = `liq ${fmt$(m.liq_24h_total)} vs 7d p75 ${fmt$(m.liq_7d_p75)}`;
  const tls = m.top_ls_now !== null ? `, top L/S ${m.top_ls_now.toFixed(2)} (Δ ${m.top_ls_delta_7d >= 0 ? '+' : ''}${m.top_ls_delta_7d.toFixed(2)} 7d)` : '';
  return `${m.pct_24h >= 0 ? '+' : ''}${m.pct_24h.toFixed(2)}% 24h, ${m.pct_7d >= 0 ? '+' : ''}${m.pct_7d.toFixed(2)}% 7d, OI ${m.oi_24h_pct >= 0 ? '+' : ''}${m.oi_24h_pct.toFixed(2)}% 24h on OI ${m.oi_7d_pct >= 0 ? '+' : ''}${m.oi_7d_pct.toFixed(2)}% 7d, funding ${m.funding_now >= 0 ? '+' : ''}${m.funding_now.toFixed(4)}%/8h (7d avg ${m.funding_7d_avg >= 0 ? '+' : ''}${m.funding_7d_avg.toFixed(4)}%, delta ${m.funding_delta >= 0 ? '+' : ''}${m.funding_delta.toFixed(4)}%), taker buy ${m.taker_buy_pct_24h !== null ? m.taker_buy_pct_24h.toFixed(2) + '%' : '—'}, ${liq}${tls}${basis}${p4}, vol ${m.vol_ratio !== null ? m.vol_ratio.toFixed(2) + 'x' : '—'}`;
}

const watch = [
  {
    asset: 'NIL',
    metrics_line: watchLine('NIL'),
    transition_read: "Pct_24h -14.44% prints the universe's heaviest 24h drawdown. OI -24.54% 24h means a quarter of the leverage built into yesterday's run unwound today. Funding +0.0043%/8h blocks CAPITULATION on the funding < 0 gate by a hair. Top L/S 1.21 rolled -0.83 over 7d, so smart money sat on the right side of this flush. Liq $231K against 7d p75 $577K reads at 40% of the flush threshold, so the cascade is not at full pace. A second leg past -10% with funding flipping negative fires CAPITULATION. A bounce holding funding flat with OI rebuilding past +5% 24h fires DISTRIBUTION through the rebuild stack.",
  },
  {
    asset: 'PHA',
    metrics_line: watchLine('PHA'),
    transition_read: "First appearance in the universe with the heaviest negative funding print in deployment at -0.1419%/8h, 0.1336pp below the 7d average. OI +348.69% 7d on +47.01% 7d price prints a heavy weekly position build with the funding wall flipping deep short on today's scan. Basis +0.6135% reads as the widest spot-futures gap in today's universe. Top L/S 1.17 rolled -0.25 over 7d, so smart money trimmed conviction through the build. Pct_4h +8.57% on pct_24h -0.31% means the last 4h delivered a fresh push against a flat 24h. SHORT-SQUEEZE fires if pct_24h pushes past +10% while OI rolls negative against the stacked short premium. CAPITULATION fires on pct_24h breaking below -10% with funding holding negative.",
  },
  {
    asset: 'HYPE',
    metrics_line: watchLine('HYPE'),
    transition_read: 'OI +21.80% 7d on pct_7d +24.21% with funding +0.0054%/8h sits inside both the ACCUMULATION OI gate and the funding band. Range 37.68% blocks the gate by 12.68pp, the single block. Top L/S 1.32 with +0.15 over 7d means smart money built conviction through the consolidation. Pct_24h -2.42% on OI -3.48% 24h cooled the run without unwinding the 7d structure. A range tightening below 25% over the next 7d fires ACCUMULATION through the OI build. A funding push past +0.03% on continued pct_7d above +15% fires MOMENTUM through the trend run.',
  },
  {
    asset: 'WLD',
    metrics_line: watchLine('WLD'),
    transition_read: 'Pct_24h +5.81% on OI +11.80% 24h and OI +96.39% 7d clears three of the four CATALYST-BREAKOUT gates. Pct_24h sits 14.19pp short of the Tier 2 +20% gate, the binding constraint. Vol_ratio 0.98x sits 1.02x short of the 2.0x gate. Pct_4h +5.31% on pct_24h +5.81% means the move concentrated in the last 4h. Top L/S 1.67 with +0.02 over 7d held flat through the run. Funding -0.0093%/8h flipped to a small short premium. A second leg past +20% with vol_ratio crossing 2.0x fires CATALYST-BREAKOUT. A continuation with funding flipping past +0.03% fires MOMENTUM through the 46.66% 7d run.',
  },
];

const data = {
  date: TODAY,
  edge_case: null,
  verdict: {
    word: 'QUIET',
    distribution: '3 ACCUMULATION across 25 assessed, 22 NEUTRAL on the 2026-05-26 07:38Z prefetch.',
    cycle: "Three ACCUMULATION prints emerge from yesterday's fully NEUTRAL universe. ZEC transitions out of NEUTRAL on OI +20.07% 7d with funding +0.0107%/8h. TAO and INJ enter the universe direct into ACCUMULATION on OI +15.71% and +47.88% 7d. All three carry the DIVERGENT sub-tag. Taker buy under 50% on every print means passive position building, not directional bid. The majors print a synchronized red day with BTC -0.89%, ETH -0.90%, SOL -1.12% on near-flat OI and funding holding inside +0.003 to +0.005%/8h. NIL flushed -14.44% 24h on OI -24.54% 24h, missing CAPITULATION on funding still positive at +0.0043%/8h. PHA stepped into the universe with funding -0.1419%/8h against +47.01% 7d and OI +348.69% 7d. The heavy weekly build paired with a deep funding wall reads as positioning unwind starting.",
    forward: "ZEC ACCUMULATION advances to CONFIRMED if taker buy clears 50% on tomorrow's scan with top L/S rotating up. PHA SHORT-SQUEEZE fires if pct_24h pushes past +10% while OI rolls negative against the stacked short premium. NIL CAPITULATION fires on a second leg past -10% with funding flipping negative. HYPE re-enters ACCUMULATION if the 7d range tightens under 25%. The current 37.68% blocks the gate.",
  },
  regime_changes,
  regimes: byRegime,
  regime_empty_notes,
  watch,
  neutral_summary: 'Neutral · 18 other assets · see artifact tail for full data',
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(data, null, 2));
console.log('wrote .outputs/perps-scan.data.json:', JSON.stringify({
  regime_counts: Object.fromEntries(REGIME_ORDER.map((r) => [r, byRegime[r].length])),
  tail_count: tail.length,
  watch_count: watch.length,
  regime_changes_count: regime_changes.length,
}));
