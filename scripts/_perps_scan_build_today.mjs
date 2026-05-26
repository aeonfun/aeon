#!/usr/bin/env node
import fs from 'node:fs';

const TODAY = '2026-05-26';
const PREFETCH_LABEL = '08:23Z prefetch';

const REGIME_ORDER = [
  'ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE',
  'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION',
];

// Yesterday's full universe and regimes (all NEUTRAL per 2026-05-25 logs).
const YESTERDAY = {
  BTC: 'NEUTRAL', ETH: 'NEUTRAL', SOL: 'NEUTRAL',
  HYPE: 'NEUTRAL', ZEC: 'NEUTRAL', NEAR: 'NEUTRAL',
  XRP: 'NEUTRAL', DOGE: 'NEUTRAL', BILL: 'NEUTRAL',
  ONDO: 'NEUTRAL', SUI: 'NEUTRAL', WLD: 'NEUTRAL',
  BNB: 'NEUTRAL', TON: 'NEUTRAL', '1000PEPE': 'NEUTRAL',
  BEAT: 'NEUTRAL', BSB: 'NEUTRAL', GRASS: 'NEUTRAL',
  UB: 'NEUTRAL', NIL: 'NEUTRAL', ADA: 'NEUTRAL',
  ASTER: 'NEUTRAL', PLAY: 'NEUTRAL', XAN: 'NEUTRAL', VVV: 'NEUTRAL',
};

function fmtUsd(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(x / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(x / 1e3).toFixed(0)}K`;
  return `$${Math.round(x)}`;
}

function fmtPrice(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  if (x >= 1000) return `$${x.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  if (x >= 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(4)}`;
}

function pct(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${x >= 0 ? '+' : ''}${x.toFixed(d)}%`;
}

function fpct(x, d = 4) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${x >= 0 ? '+' : ''}${x.toFixed(d)}%`;
}

function rnd(x, d) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  return Number(x.toFixed(d));
}

const compute = JSON.parse(fs.readFileSync('.outputs/_perps_compute.json', 'utf8'));
const metrics = compute.metrics;
const assetList = Object.keys(metrics);

const byRegime = Object.fromEntries(REGIME_ORDER.map((r) => [r, []]));
const neutralAssets = [];
for (const a of assetList) {
  const r = metrics[a].regime;
  if (r === 'NEUTRAL') neutralAssets.push(a);
  else if (byRegime[r]) byRegime[r].push(a);
}

// --- transitions ---
const transitions = [];
for (const a of assetList) {
  const prior = YESTERDAY[a];
  const current = metrics[a].regime;
  if (prior === undefined) {
    if (current !== 'NEUTRAL') {
      transitions.push({
        asset: a,
        from: '(new entrant)',
        to: current,
        note: transitionNote(a, '(new entrant)', current, metrics[a]),
      });
    }
  } else if (prior !== current) {
    transitions.push({
      asset: a,
      from: prior,
      to: current,
      note: transitionNote(a, prior, current, metrics[a]),
    });
  }
}

function transitionNote(asset, prior, current, m) {
  if (current !== 'ACCUMULATION') return '';
  const oi7 = pct(m.oi_7d_pct);
  const fnow = fpct(m.funding_now, 4);
  const favg = fpct(m.funding_7d_avg, 4);
  const tb = m.taker_buy_pct_24h.toFixed(2);
  if (asset === 'ZEC') {
    return `OI ${oi7} 7d with funding flipping to ${fnow}/8h from a 7d average of ${favg}. DIVERGENT sub-tag fires on taker buy ${tb}%. Passive build, not aggressive bid.`;
  }
  if (asset === 'TAO') {
    return `First appearance in the universe. OI ${oi7} 7d with funding ${fnow}/8h (7d avg ${favg}). DIVERGENT sub-tag fires on taker buy ${tb}%. Top L/S 2.01 already crowded long against passive flow.`;
  }
  if (asset === 'INJ') {
    return `First appearance in the universe. OI ${oi7} 7d with funding ${fnow}/8h holding negative against the 7d average ${favg}. DIVERGENT sub-tag fires on taker buy ${tb}%. The heaviest 7d OI build in today's universe.`;
  }
  return `${prior} → ${current}. OI ${oi7} 7d, funding ${fnow}/8h.`;
}

// --- regime blocks ---
function buildMetricsLine(asset, m) {
  const parts = [];
  parts.push(`OI ${pct(m.oi_7d_pct)} 7d on ${pct(m.pct_7d)} price`);
  parts.push(`funding ${fpct(m.funding_now, 4)}/8h (7d avg ${fpct(m.funding_7d_avg, 4)})`);
  if (m.top_ls_now != null && m.top_ls_delta_7d != null) {
    parts.push(`top L/S ${m.top_ls_now.toFixed(2)} (Δ ${m.top_ls_delta_7d >= 0 ? '+' : ''}${m.top_ls_delta_7d.toFixed(2)} 7d)`);
  }
  parts.push(`range ${m.range_7d_pct.toFixed(2)}%`);
  if (m.taker_buy_pct_24h != null) parts.push(`taker buy ${m.taker_buy_pct_24h.toFixed(2)}%`);
  if (m.basis_now != null) parts.push(`basis ${fpct(m.basis_now, 4)}`);
  return parts.join(', ');
}

function buildTags(asset, m) {
  const tags = [];
  for (const sub of m.sub_tags || []) {
    const tag = `${m.regime} · ${sub}`;
    let read = '';
    if (sub === 'DIVERGENT') {
      const tb = m.taker_buy_pct_24h.toFixed(2);
      const gap = (50 - m.taker_buy_pct_24h).toFixed(2);
      if (asset === 'ZEC') {
        read = `Taker buy ${tb}% sits ${gap}pp under the 50% gate. OI rebuilt ${pct(m.oi_7d_pct)} 7d without aggressive bid crossing.`;
      } else if (asset === 'TAO') {
        read = `Taker buy ${tb}% sits ${gap}pp under the 50% gate. OI ${pct(m.oi_7d_pct)} 7d builds passively against top L/S already crowded at 2.01.`;
      } else if (asset === 'INJ') {
        read = `Taker buy ${tb}% sits ${gap}pp under the 50% gate. OI ${pct(m.oi_7d_pct)} 7d builds passively while funding holds negative at ${fpct(m.funding_now, 4)}/8h.`;
      } else {
        read = `Taker buy ${tb}% sits ${gap}pp under the 50% gate. Passive OI build, not aggressive bid.`;
      }
    }
    tags.push({ tag, read });
  }
  for (const pat of m.pattern_tags || []) {
    tags.push({ tag: pat, read: '' });
  }
  return tags;
}

const regimes = Object.fromEntries(REGIME_ORDER.map((r) => [r, []]));
for (const r of REGIME_ORDER) {
  for (const asset of byRegime[r]) {
    const m = metrics[asset];
    regimes[r].push({
      asset,
      tier: m.tier,
      marker: 'bullet',
      repeat_days_suffix: null,
      metrics_line: buildMetricsLine(asset, m),
      tags: buildTags(asset, m),
    });
  }
}

// --- regime empty notes ---
function getRegimeEmptyNote(regime) {
  switch (regime) {
    case 'CATALYST-BREAKOUT':
      return 'no asset combines pct_24h > +20% (Tier 2) or > +8% (Tier 1) with vol_ratio > 2.0x and OI +10% 24h on taker buy > 52%. WLD pct_24h +11.02% on OI +17.15% 24h with taker buy 50.43% misses the Tier 2 +20% gate by 8.98pp and the 52% taker buy floor by 1.57pp. RENDER pct_24h +8.20% on OI +17.77% 24h with taker buy 52.57% clears the taker-buy gate but fails the Tier 2 pct gate by 11.80pp and the 2.0x vol floor at 1.33x';
    case 'SHORT-SQUEEZE':
      return "no asset combines a positive pct_24h push past +10% (Tier 2) with OI rolling negative. PHA carries the deepest negative funding in today's scan at -0.1034%/8h with basis +0.5203% but pct_24h -1.52% sits the wrong side of the price gate by 11.52pp. WLD pct_24h +11.02% clears the squeeze price gate but OI +17.15% 24h fails the OI < 0 requirement";
    case 'MOMENTUM':
      return 'no asset combines pct_7d > +15% (Tier 2) with funding inside the +0.03 to +0.07 band. GRASS pct_7d +90.61% on funding +0.0071%/8h, NEAR pct_7d +67.79% on funding -0.0011%/8h, BEAT pct_7d +73.38% on funding +0.0369%/8h, UB pct_7d +63.10% on funding +0.0115%/8h, PHA pct_7d +45.23% on funding -0.1034%/8h all sit outside the funding band. HYPE pct_7d +23.73% on funding +0.0064%/8h sits closest at 0.0236pp short of the entry gate';
    case 'COMPRESSION':
      return 'BNB range 6.06% misses the Tier 2 5% gate by 1.06pp. BTC range 5.36% misses the Tier 1 3% gate by 2.36pp. No asset combines a tight 7d range with OI rebuilding +5% 7d on calm funding';
    case 'DISTRIBUTION':
      return 'PLAY funding +0.0491%/8h sits 0.0309pp under the +0.08 Tier 2 trigger. BEAT funding +0.0369%/8h sits 0.0431pp short. UB funding +0.0115%/8h sits 0.0685pp short. No asset clears the funding trigger AND the OI +5% 24h gate today';
    case 'CAPITULATION':
      return 'NIL pct_24h -13.41% on OI -23.81% 24h clears both the Tier 2 -10% drawdown gate by 3.41pp and the -10% OI gate by 13.81pp, but funding +0.0036%/8h fails the funding < 0 requirement. ESPORTS pct_24h -6.81% on OI +4.37% 24h fails both the Tier 2 drawdown gate by 3.19pp and the -10% OI gate by 14.37pp. INJ pct_24h -3.16% on OI -4.95% 24h fails the drawdown gate by 6.84pp';
    default:
      return 'no qualifying assets';
  }
}

const regimeEmptyNotes = {};
for (const r of REGIME_ORDER) {
  if (regimes[r].length === 0) regimeEmptyNotes[r] = getRegimeEmptyNote(r);
}

// --- watch bucket ---
function buildWatch(asset) {
  const m = metrics[asset];
  if (!m) return null;
  const parts = [
    `${pct(m.pct_24h)} 24h, ${pct(m.pct_7d)} 7d`,
    `OI ${pct(m.oi_24h_pct)} 24h on OI ${pct(m.oi_7d_pct)} 7d`,
    `funding ${fpct(m.funding_now, 4)}/8h (7d avg ${fpct(m.funding_7d_avg, 4)}, delta ${fpct(m.funding_delta, 4)})`,
  ];
  if (m.taker_buy_pct_24h != null) parts.push(`taker buy ${m.taker_buy_pct_24h.toFixed(2)}%`);
  if (m.liq_24h_total != null && m.liq_7d_p75 != null) parts.push(`liq ${fmtUsd(m.liq_24h_total)} vs 7d p75 ${fmtUsd(m.liq_7d_p75)}`);
  if (m.top_ls_now != null && m.top_ls_delta_7d != null) {
    const dir = m.top_ls_delta_7d < 0 ? 'down' : 'up';
    parts.push(`top L/S ${m.top_ls_now.toFixed(2)} (${dir} ${Math.abs(m.top_ls_delta_7d).toFixed(2)} 7d)`);
  }
  if (m.basis_now != null) parts.push(`basis ${fpct(m.basis_now, 4)}`);
  if (m.pct_4h != null) parts.push(`pct_4h ${pct(m.pct_4h)}`);
  if (m.vol_ratio != null) parts.push(`vol ${m.vol_ratio.toFixed(2)}x`);
  return { metrics_line: parts.join(', '), m };
}

function watchRead(asset, m) {
  if (asset === 'NIL') {
    return "Pct_24h -13.41% prints the universe's heaviest 24h drawdown. OI -23.81% 24h means a quarter of yesterday's leverage build unwound today. Funding +0.0036%/8h blocks CAPITULATION on the funding < 0 gate. Top L/S 1.25 rolled -0.79 over 7d, so smart money exited cleanly into this flush. Liq $245K against 7d p75 $577K reads at 42% of the threshold, so the cascade still has room before the flush threshold trips. A second leg past -10% with funding flipping negative fires CAPITULATION. A funding push past +0.08% on the rebound fires DISTRIBUTION via the long-trap shape.";
  }
  if (asset === 'PHA') {
    return "First appearance in the universe with the deepest negative funding print in today's scan at -0.1034%/8h. OI +349.29% 7d on pct_7d +45.23% prints the heaviest weekly position build, with the funding wall flipping deep short on today's scan. Basis +0.5203% reads as the widest spot-futures gap in today's universe by a factor of three. Top L/S 1.17 rolled -0.25 over 7d, so smart money trimmed conviction through the build. Pct_4h +7.93% on pct_24h -1.52% means the last four hours delivered the day's push against a flat 24h session. SHORT-SQUEEZE fires if pct_24h pushes past +10% while OI rolls negative against the stacked short premium. CAPITULATION fires on pct_24h breaking below -10% with funding holding negative.";
  }
  if (asset === 'WLD') {
    return 'Pct_24h +11.02% on OI +17.15% 24h and vol 1.19x sits inside the SHORT-SQUEEZE price gate but OI positive blocks the regime. Taker buy 50.43% sits 1.57pp under the 52% CATALYST-BREAKOUT floor, and vol 1.19x sits under the 2.0x volume floor. The setup is a high-tier breakout candidate one signal short. A vol push past 2.0x with taker buy clearing 52% fires CATALYST-BREAKOUT. An OI roll negative on continued strength fires SHORT-SQUEEZE through the price gate.';
  }
  if (asset === 'HYPE') {
    return 'OI +21.10% 7d on pct_7d +23.73% with funding +0.0064%/8h sits inside both the ACCUMULATION OI gate and the funding band. Range 37.68% blocks the gate by 12.68pp, the single block. Top L/S 1.33 rolled +0.16 over 7d means smart money built conviction through the consolidation. Pct_24h -2.80% on OI -4.03% 24h cooled the run without unwinding the 7d structure. A range tightening below 25% over the next 7d fires ACCUMULATION through the OI build. A funding push past +0.03% on continued pct_7d above +15% fires MOMENTUM through the trend run.';
  }
  if (asset === 'RENDER') {
    return 'Pct_24h +8.20% on OI +17.77% 24h with taker buy 52.57% clears two of the four CATALYST-BREAKOUT gates. Vol 1.33x sits 0.67x under the 2.0x volume floor, and pct_24h 11.80pp under the Tier 2 +20% price floor. Top L/S 1.67 rolled -0.18 over 7d means smart money trimmed into the rally. A vol push past 2.0x with pct_24h clearing +20% fires CATALYST-BREAKOUT. A roll into MOMENTUM follows if pct_7d holds above +15% and funding flips back into the +0.03 to +0.07 band.';
  }
  return '';
}

const watchOrder = ['NIL', 'PHA', 'WLD', 'HYPE', 'RENDER'];
const watch = [];
for (const asset of watchOrder) {
  const w = buildWatch(asset);
  if (!w) continue;
  watch.push({ asset, metrics_line: w.metrics_line, transition_read: watchRead(asset, w.m) });
}

// --- verdict ---
const nTotal = assetList.length;
const nNeutral = neutralAssets.length;
const classified = nTotal - nNeutral;
const partsDistribution = [];
for (const r of REGIME_ORDER) {
  if (byRegime[r].length > 0) partsDistribution.push(`${byRegime[r].length} ${r}`);
}
partsDistribution.push(`${nNeutral} NEUTRAL`);
const distribution = `${partsDistribution.join(', ')} across ${nTotal} assessed on the ${TODAY} ${PREFETCH_LABEL}.`;

const word = nNeutral / nTotal >= 0.8 ? 'QUIET' : 'MIXED';

const cycle = [
  "Three ACCUMULATION prints emerge from yesterday's fully NEUTRAL universe.",
  "ZEC rotates out of NEUTRAL on OI +19.75% 7d with funding flipping to +0.0109%/8h from a 7d average of -0.0036%.",
  "TAO and INJ enter the universe direct into ACCUMULATION on OI +19.71% and +47.39% 7d.",
  "All three carry the DIVERGENT sub-tag. Taker buy under 50% on every print means passive OI build, not buyers crossing the spread.",
  "The majors print red across the board with BTC -0.68%, ETH -0.61%, SOL -0.65% on near-flat OI and funding cooling toward zero across all three.",
  "NIL flushed -13.41% 24h on OI -23.81% 24h, missing CAPITULATION on funding holding positive at +0.0036%/8h.",
  "PHA stepped into the universe with the deepest negative funding in today's scan at -0.1034%/8h against +45.23% 7d and OI +349.29% 7d.",
  "The heavy weekly build paired with a stacked short premium reads as a squeeze setup, blocked today on the 24h price sitting flat.",
  "WLD pushed +11.02% 24h on OI +17.15% 24h, blocked from CATALYST-BREAKOUT by vol 1.19x and taker buy 50.43%."
].join(' ');

const forward = [
  "ZEC ACCUMULATION advances to CONFIRMED if taker buy clears 50% on tomorrow's scan with top L/S rotating up.",
  "PHA SHORT-SQUEEZE fires if pct_24h pushes past +10% while OI rolls negative against the stacked short premium.",
  "WLD CATALYST-BREAKOUT fires if vol_ratio clears 2.0x with taker buy past 52% on continued pct_24h strength.",
  "NIL CAPITULATION fires on a second leg past -10% with funding flipping negative.",
  "HYPE re-enters ACCUMULATION if the 7d range tightens under 25%, with the current 37.68% blocking the gate."
].join(' ');

const verdict = { word, distribution, cycle, forward };

// --- tail ---
const tail = [];
for (const asset of assetList) {
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
      range_7d: m.range_7d_pct != null ? `${m.range_7d_pct.toFixed(2)}%` : '—',
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
    yesterday_regime: YESTERDAY[asset] !== undefined ? YESTERDAY[asset] : null,
    repeat_days: YESTERDAY[asset] === m.regime ? 2 : 1,
  });
}

const neutralSummary = `Neutral · ${nNeutral} other assets · see artifact tail for full data`;

const data = {
  date: TODAY,
  edge_case: null,
  verdict,
  regime_changes: transitions,
  regimes,
  regime_empty_notes: regimeEmptyNotes,
  watch,
  neutral_summary: neutralSummary,
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(data, null, 2));
console.log(`wrote .outputs/perps-scan.data.json — verdict=${word} regimes=${REGIME_ORDER.map((r) => `${r}:${regimes[r].length}`).join(' ')} neutral=${nNeutral} transitions=${transitions.length} watch=${watch.length} tail=${tail.length}`);
