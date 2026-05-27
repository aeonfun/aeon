#!/usr/bin/env node
// Build .outputs/perps-scan.data.json for the current day from
// .outputs/_perps_compute.json + the prior data.json (read for yesterday's regime map).
import fs from 'node:fs';

const TODAY = '2026-05-27';
const PREFETCH_LABEL = '07:44Z prefetch';

const REGIME_ORDER = [
  'ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE',
  'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION',
];

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
  if (x >= 0.01) return `$${x.toFixed(4)}`;
  return `$${x.toFixed(5)}`;
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

const prior = JSON.parse(fs.readFileSync('.outputs/perps-scan.data.json', 'utf8'));
const priorByAsset = new Map();
for (const t of prior.tail || []) priorByAsset.set(t.asset, t);

// yesterday_regime[asset] = the asset's regime on 2026-05-26 (the prior parse stored it)
function yesterdayRegimeFor(asset) {
  const p = priorByAsset.get(asset);
  if (!p) return null;
  return p.yesterday_regime ?? null;
}

function repeatDaysFor(asset, regimeToday) {
  const p = priorByAsset.get(asset);
  if (!p) return 1;
  const yReg = p.yesterday_regime ?? null;
  if (yReg === null) return 1;
  if (regimeToday !== yReg) return 1;
  // yesterday's count: if prior_today_regime == yReg, then prior was a continuation
  // and yesterday's count = prior_repeat_days - 1
  const yesterdayCount = (p.regime === yReg) ? Math.max((p.repeat_days || 1) - 1, 1) : 1;
  return yesterdayCount + 1;
}

const byRegime = Object.fromEntries(REGIME_ORDER.map((r) => [r, []]));
const neutralAssets = [];
for (const a of assetList) {
  const r = metrics[a].regime;
  if (r === 'NEUTRAL') neutralAssets.push(a);
  else if (byRegime[r]) byRegime[r].push(a);
}

// --- transitions ---
function transitionNote(asset, prior, current, m) {
  if (prior === '(new entrant)') {
    if (current === 'COMPRESSION') {
      return `First appearance in the universe direct into COMPRESSION ${m.sub_tags.includes('QUIET') ? 'QUIET' : ''}. Range ${m.range_7d_pct.toFixed(2)}% sits well under the Tier 2 5% gate, OI ${pct(m.oi_7d_pct)} 7d builds with funding ${fpct(m.funding_now, 4)}/8h holding inside the 0.02 band. Taker buy ${m.taker_buy_pct_24h.toFixed(2)}% reads with a bullish lean.`;
    }
    return '';
  }
  if (current === 'ACCUMULATION' && asset === 'HYPE') {
    return `Rotates into ACCUMULATION CONFIRMED on OI ${pct(m.oi_7d_pct)} 7d with funding ${fpct(m.funding_now, 4)}/8h inside the band, taker buy ${m.taker_buy_pct_24h.toFixed(2)}% crosses the 50% gate, top L/S delta +${m.top_ls_delta_7d.toFixed(2)} over 7d. Range tightened to ${m.range_7d_pct.toFixed(2)}% from yesterday's reading.`;
  }
  if (prior === 'ACCUMULATION' && current === 'NEUTRAL' && asset === 'ZEC') {
    return `Drops out of ACCUMULATION on OI cooling to ${pct(m.oi_7d_pct)} 7d below the +10% gate, with pct_7d flipping to ${pct(m.pct_7d)} from yesterday's positive print. Funding ${fpct(m.funding_now, 4)}/8h still sits inside the 0.04 band, so the structural break is OI and price, not funding. Two-day ACCUMULATION read closed.`;
  }
  if (prior === 'ACCUMULATION' && current === 'NEUTRAL' && asset === 'TAO') {
    return `Drops out of ACCUMULATION on OI 7d cooling to ${pct(m.oi_7d_pct)} below the +10% gate. Funding ${fpct(m.funding_now, 4)}/8h with pct_7d ${pct(m.pct_7d)} reads as drift, not build.`;
  }
  return '';
}

const transitions = [];
for (const a of assetList) {
  const yReg = yesterdayRegimeFor(a);
  const current = metrics[a].regime;
  if (yReg === null) {
    // new entrant — surface even if NEUTRAL
    transitions.push({
      asset: a,
      from: '(new entrant)',
      to: current,
      note: transitionNote(a, '(new entrant)', current, metrics[a]) || null,
    });
  } else if (yReg !== current) {
    transitions.push({
      asset: a,
      from: yReg,
      to: current,
      note: transitionNote(a, yReg, current, metrics[a]) || null,
    });
  }
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
  parts.push(`basis ${m.basis_now != null ? fpct(m.basis_now, 4) : '—'}`);
  return parts.join(', ');
}

function buildTags(asset, m) {
  const tags = [];
  for (const sub of m.sub_tags || []) {
    tags.push({ tag: `${m.regime} · ${sub}` });
  }
  for (const pat of m.pattern_tags || []) {
    tags.push({ tag: pat });
  }
  return tags;
}

const regimes = Object.fromEntries(REGIME_ORDER.map((r) => [r, []]));
for (const r of REGIME_ORDER) {
  for (const asset of byRegime[r]) {
    const m = metrics[asset];
    const rd = repeatDaysFor(asset, m.regime);
    regimes[r].push({
      asset,
      tier: m.tier,
      marker: rd >= 3 ? 'star' : 'bullet',
      repeat_days_suffix: rd >= 2 ? `(day ${rd})` : null,
      metrics_line: buildMetricsLine(asset, m),
      tags: buildTags(asset, m),
    });
  }
}

// --- regime empty notes ---
function getRegimeEmptyNote(regime) {
  switch (regime) {
    case 'CATALYST-BREAKOUT':
      return 'no asset combines pct_24h above the tier breakout floor with vol_ratio above 2.0x and OI +10% 24h on taker buy above 52%. MU pct_24h +2.83% on OI +11.62% 24h with vol 1.81x and taker buy 49.94% clears the OI and vol gates but falls 17.17pp short of the Tier 2 +20% price floor and 2.06pp under the taker-buy floor';
    case 'SHORT-SQUEEZE':
      return 'no asset combines pct_24h past the tier squeeze floor with OI rolling negative. DRIFT funding sits at -0.3644%/8h with OI +207.32% 7d, but pct_24h -13.61% prints the wrong side of the price gate by 23.61pp';
    case 'MOMENTUM':
      return 'no asset combines pct_7d above the tier momentum floor with funding inside the +0.03 to +0.07 band. UB pct_7d +95.49% on funding +0.0139%/8h sits 0.0161pp short of the entry floor. NEAR pct_7d +46.83% on funding +0.0136%/8h sits 0.0164pp short. WLD pct_7d +45.45% on funding +0.0053%/8h sits 0.0247pp short. MU pct_7d +30.27% on funding +0.0215%/8h sits 0.0085pp short';
    case 'DISTRIBUTION':
      return 'ESPORTS funding +0.3833%/8h clears the +0.08 Tier 2 trigger by a factor of 4.8, but OI -13.04% 24h misses the +5% OI gate by 18.04pp. MU funding +0.0215%/8h sits 0.0585pp under the trigger';
    case 'CAPITULATION':
      return 'DRIFT pct_24h -13.61% on OI +6.93% 24h clears the Tier 2 -10% drawdown gate but fails the -10% OI gate by 16.93pp. LAB pct_24h -7.92% on OI -8.30% 24h misses the drawdown gate by 2.08pp and the OI gate by 1.70pp. Funding holds positive on every drawdown candidate today, so the funding < 0 gate blocks the regime even where price and OI line up';
    default:
      return 'no qualifying assets';
  }
}

const regimeEmptyNotes = {};
for (const r of REGIME_ORDER) {
  if (regimes[r].length === 0) regimeEmptyNotes[r] = getRegimeEmptyNote(r);
}

// --- watch bucket ---
function buildWatchLine(asset) {
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
  parts.push(`range ${m.range_7d_pct.toFixed(2)}%`);
  return { metrics_line: parts.join(', '), m };
}

function watchRead(asset, m) {
  if (asset === 'NEAR') {
    const dir = m.top_ls_delta_7d < 0 ? 'down' : 'up';
    return `OI ${pct(m.oi_7d_pct)} 7d on pct_7d ${pct(m.pct_7d)} prints the second-heaviest weekly position build in today's universe. Range ${m.range_7d_pct.toFixed(2)}% sits ${(m.range_7d_pct - 25).toFixed(2)}pp above the Tier 2 25% ACCUMULATION ceiling. Top L/S ${m.top_ls_now.toFixed(2)} rolled ${dir} ${Math.abs(m.top_ls_delta_7d).toFixed(2)} over 7d, so smart money cooled into the run. ACCUMULATION fires if the 7d range contracts under 25% as OI continues to hold. MOMENTUM fires if funding pushes into the +0.03 to +0.07 band on pct_7d holding above +15%.`;
  }
  if (asset === 'DRIFT') {
    return `Funding ${fpct(m.funding_now, 4)}/8h prints the universe's deepest negative funding by an order of magnitude, paired with OI ${pct(m.oi_7d_pct)} 7d and vol ${m.vol_ratio.toFixed(2)}x. Pct_24h ${pct(m.pct_24h)} flushed on OI +6.93% 24h — longs still adding into the drawdown. CAPITULATION fails on OI 24h positive and funding positive-side blockage missing. SHORT-SQUEEZE fires if pct_24h flips past +10% while OI rolls negative against the stacked short funding wall.`;
  }
  if (asset === 'WLD') {
    return `OI ${pct(m.oi_7d_pct)} 7d on pct_7d ${pct(m.pct_7d)} reads as a heavy weekly position build cooling on pct_24h ${pct(m.pct_24h)} and OI ${pct(m.oi_24h_pct)} 24h. Range ${m.range_7d_pct.toFixed(2)}% sits ${(m.range_7d_pct - 25).toFixed(2)}pp above the ACCUMULATION ceiling. Funding ${fpct(m.funding_now, 4)}/8h with funding_7d_avg ${fpct(m.funding_7d_avg, 4)} sits at the zero line. ACCUMULATION fires if range contracts under 25% on OI holding.`;
  }
  if (asset === 'MU') {
    return `OI ${pct(m.oi_7d_pct)} 7d on pct_7d ${pct(m.pct_7d)} with vol ${m.vol_ratio.toFixed(2)}x and pct_24h ${pct(m.pct_24h)} reads as the cleanest building structure in today's NEUTRAL bucket. Funding ${fpct(m.funding_now, 4)}/8h sits 0.0085pp short of the MOMENTUM entry floor and 0.0585pp short of the DISTRIBUTION trigger — the structural gap. MOMENTUM fires if funding drops into the +0.03 to +0.07 band. DISTRIBUTION fires if funding clears +0.08 on continued OI build above +5% 24h.`;
  }
  if (asset === 'ESPORTS') {
    return `Funding ${fpct(m.funding_now, 4)}/8h clears the +0.08 Tier 2 DISTRIBUTION trigger by a factor of 4.8 — extreme stacked long premium. Top L/S ${m.top_ls_now.toFixed(2)} rolled ${m.top_ls_delta_7d.toFixed(2)} over 7d, fires RETAIL-ANOMALY since top L/S sits under 1.5. DISTRIBUTION fails on OI 24h ${pct(m.oi_24h_pct)} missing the +5% gate. Reads as squeeze risk over fade — retail crowded long while smart money lean light.`;
  }
  return '';
}

const watchOrder = ['NEAR', 'DRIFT', 'WLD', 'MU', 'ESPORTS'];
const watch = [];
for (const asset of watchOrder) {
  const w = buildWatchLine(asset);
  if (!w) continue;
  watch.push({ asset, metrics_line: w.metrics_line, transition_read: watchRead(asset, w.m) });
}

// --- verdict ---
const nTotal = assetList.length;
const nNeutral = neutralAssets.length;
const partsDistribution = [];
for (const r of REGIME_ORDER) {
  if (byRegime[r].length > 0) partsDistribution.push(`${byRegime[r].length} ${r}`);
}
partsDistribution.push(`${nNeutral} NEUTRAL`);
const distribution = `${partsDistribution.join(', ')} across ${nTotal} assessed on the ${TODAY} ${PREFETCH_LABEL}.`;

const word = nNeutral / nTotal >= 0.8 ? 'QUIET' : 'MIXED';

const cycle = [
  "HYPE rotates into ACCUMULATION CONFIRMED on OI +13.33% 7d with funding +0.0054%/8h inside the band, taker buy 52.43% crossing the 50% gate, top L/S delta +0.15 over 7d.",
  "XAU enters direct into COMPRESSION QUIET on range 2.27% well under the Tier 2 5% gate, OI +16.17% 7d, vol 0.36x signalling true coil.",
  "Yesterday's ACCUMULATION prints rolled off — ZEC drops on OI cooling to -19.73% 7d with pct_7d flipping to -14.46%, TAO drops on OI 7d cooling to +5.05% below the +10% gate.",
  "The NEUTRAL bucket masks heavy weekly builds blocked on the 25% range ceiling — NEAR oi_7d +103.84% on pct_7d +46.83%, WLD oi_7d +85.46% on pct_7d +45.45%, UB oi_7d +196.21% on pct_7d +95.49%, DRIFT oi_7d +207.32% on pct_7d +21.94%.",
  "DRIFT funding -0.3644%/8h prints the deepest negative funding in today's universe, paired with OI +207.32% 7d — classic squeeze fuel.",
  "ESPORTS funding +0.3833%/8h clears the DISTRIBUTION trigger by a factor of 4.8 with top L/S 1.45 firing RETAIL-ANOMALY — squeeze risk over fade.",
  "MU prints the cleanest build behind HYPE on oi_7d +51.46% and vol 1.81x, blocked from regime classification by funding +0.0215%/8h sitting in the structural gap between MOMENTUM and DISTRIBUTION."
].join(' ');

const forward = [
  "HYPE advances from ACCUMULATION to MOMENTUM if funding lifts into the +0.03 to +0.07 band on continued OI build above +5% 24h.",
  "XAU COMPRESSION resolves bullish if vol_ratio expands past 1.0x on a range break above 5% — taker buy 51.11% on OI +16.17% 7d leans bullish.",
  "DRIFT SHORT-SQUEEZE fires if pct_24h pushes past +10% while OI rolls negative against the stacked short funding wall.",
  "NEAR ACCUMULATION fires if the 7d range contracts under 25% on OI holding above the +10% gate.",
  "ESPORTS resolves either direction — short-squeeze if pct_24h pushes past +10% on OI flipping negative, fade if OI rebuilds with funding holding extreme."
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
    yesterday_regime: yesterdayRegimeFor(asset),
    repeat_days: repeatDaysFor(asset, m.regime),
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
