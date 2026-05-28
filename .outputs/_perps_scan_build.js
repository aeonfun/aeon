#!/usr/bin/env node
'use strict';
const fs = require('fs');

const TODAY = '2026-05-28';
const R = JSON.parse(fs.readFileSync('.outputs/_perps_scan_results.json', 'utf8'));
const ASSET_ORDER = ['BTC', 'ETH', 'SOL', 'HYPE', 'ZEC', 'XRP', 'NEAR', 'DOGE', 'WLD', 'XLM', 'BSB', 'BEAT', 'SUI', 'FIL', 'XAU', 'LAB', 'MU', 'BNB', '1000PEPE', 'GUA', 'ADA', 'ICP', 'TON', 'TAO', 'PLAY'];

// ---------- formatting helpers ----------
const sgn = (v) => (v >= 0 ? '+' : '');
const fp = (v, d = 2) => (v === null || v === undefined ? '—' : sgn(v) + v.toFixed(d) + '%');
const ff = (v) => (v === null || v === undefined ? '—' : sgn(v) + v.toFixed(4) + '%/8h');
const fpct4 = (v) => (v === null || v === undefined ? '—' : sgn(v) + v.toFixed(4) + '%');
const fr = (v, d = 2) => (v === null || v === undefined ? '—' : v.toFixed(d));
const fdelta = (v) => (v === null || v === undefined ? '—' : 'Δ ' + sgn(v) + v.toFixed(2));
function fmtPrice(p) {
  if (p === null || p === undefined) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return '$' + p.toPrecision(4);
}
function fmtUsd(v) {
  if (v === null || v === undefined) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}
const r2 = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v === null || v === undefined ? null : Math.round(v * 10000) / 10000);

function watchLine(a) {
  const m = R[a].m;
  return `${fp(m.pct_24h)} 24h, ${fp(m.pct_7d)} 7d, OI ${fp(m.oi_24h_pct)} 24h on OI ${fp(m.oi_7d_pct)} 7d, ` +
    `funding ${ff(m.funding_now)} (7d avg ${fp(m.funding_7d_avg, 4)}, delta ${fp(m.funding_delta, 4)}), ` +
    `taker buy ${fr(m.taker_buy_pct_24h)}%, liq ${fmtUsd(m.liq_24h_total)} vs 7d p75 ${fmtUsd(m.liq_7d_p75)}, ` +
    `top L/S ${fr(m.top_ls_now)} (${fdelta(m.top_ls_delta_7d)} 7d), basis ${fpct4(m.basis_now)}, ` +
    `pct_4h ${fp(m.pct_4h)}, vol ${fr(m.vol_ratio)}x, range ${fr(m.range_7d_pct)}%`;
}

// ---------- prose (soul + writing-style applied) ----------
const verdict = {
  word: 'QUIET',
  distribution: '1 COMPRESSION across 25 assessed, 24 NEUTRAL.',
  cycle: 'Funding holds near zero across the universe, the majors drift lower on flat open interest, and the heavy weekly OI builds stay trapped in mid-caps that already ran past the 25% accumulation range gate.',
  forward: 'Watch XLM for the resolve. It pairs the universe’s only volume expansion at 2.26x and a +19.85% 24h OI build with negative funding, so a breakout prints above 52% taker buy and a squeeze prints if price clears +10% 24h on OI rolling over. NEAR, WLD, MU and BEAT convert to ACCUMULATION the day their 7d ranges contract under 25%.',
};

const regime_changes = [
  {
    asset: 'HYPE', from: 'ACCUMULATION', to: 'NEUTRAL',
    note: 'The accumulation unwound. OI 7d flipped to -4.77% from yesterday’s +13% build, funding turned negative at -0.0077%/8h, and taker buy fell to 49.32% under the 50% demand gate. The one-day ACCUMULATION print did not hold.',
  },
  {
    asset: 'XLM', from: '(new entrant)', to: 'NEUTRAL',
    note: 'First appearance, straight to NEUTRAL despite carrying the universe’s only volume expansion at 2.26x. Taker buy 50.54% held it under the 52% breakout gate.',
  },
  {
    asset: 'BEAT', from: '(new entrant)', to: 'NEUTRAL',
    note: 'First appearance on a +60.97% 7d run with a matching +57.76% 7d OI build, blocked from accumulation by a 110.4% range.',
  },
  {
    asset: 'GUA', from: '(new entrant)', to: 'NEUTRAL',
    note: 'First appearance. Funding +0.1654%/8h fires RETAIL-ANOMALY, but a +9.1% bounce on a -72% 7d collapse reads as noise on a broken meme, not signal.',
  },
  { asset: 'ICP', from: '(new entrant)', to: 'NEUTRAL', note: null },
  { asset: 'PLAY', from: '(new entrant)', to: 'NEUTRAL', note: null },
];

const watchOrder = ['XLM', 'NEAR', 'WLD', 'MU', 'BEAT'];
const watchReads = {
  XLM: 'Reads as squeeze fuel building. Price +5.92% on OI +19.85% 24h with the only volume expansion in the universe at 2.26x, but funding sits negative at -0.019%/8h and top traders hold net short at 0.82 L/S and falling. SHORT-SQUEEZE fires if price clears +10% 24h as OI rolls negative. CATALYST-BREAKOUT fires instead if taker buy pushes past 52% on the OI build holding.',
  NEAR: 'Holds the second-heaviest weekly OI build at +43.29% 7d on +25.6% price, but range 55.35% sits well above the 25% accumulation ceiling and 24h OI cooled 4.02%. ACCUMULATION fires if the 7d range contracts under 25% while OI holds the build.',
  WLD: 'Carries the heaviest weekly OI build today at +44.32% 7d on +23.09% price, but range 60.45% blocks accumulation and top traders cut their long ratio 0.53 over the week. ACCUMULATION fires if the range contracts under 25% on OI holding.',
  MU: 'Prints the universe’s largest weekly OI build at +73.22% 7d, but range 33.86% holds it out of accumulation and top traders cut their long ratio 0.75 over the week. The build runs passive while smart money reduces. ACCUMULATION fires if the range contracts under 25% with top L/S turning up.',
  BEAT: 'Ran +60.97% on the week with a matching +57.76% 7d OI build, but range 110.4% sits far above the accumulation gate. Taker buy 51.6% leans to demand and funding climbs to +0.0203%/8h. MOMENTUM fires if funding pushes into the +0.03 to +0.07 band on the build holding.',
};

const regime_empty_notes = {
  ACCUMULATION: 'no asset clears oi_7d above +10% with positive 7d price inside the 25% range gate. NEAR (+43.29% oi_7d), WLD (+44.32%), MU (+73.22%) and BEAT (+57.76%) all carry the build and the positive 7d price, but ranges of 55%, 60%, 34% and 110% sit above the ceiling. XAU clears the build inside a 4.55% range but its -3.26% 7d price fails the positive gate, routing it to COMPRESSION',
  'CATALYST-BREAKOUT': 'no asset pairs a breakout-grade 24h move with vol above 2.0x, OI +10% 24h and taker buy above 52%. XLM clears vol at 2.26x and OI at +19.85% 24h, but pct_24h +5.92% falls short of the +20% Tier 2 floor and taker buy 50.54% misses the 52% gate',
  'SHORT-SQUEEZE': 'no asset clears pct_24h above the +10% Tier 2 squeeze floor with OI rolling negative. GUA +9.1% and PLAY +7.57% are the only positive 24h moves of size, both on positive 24h OI, so neither fits the forced-cover shape',
  MOMENTUM: 'no asset holds pct_7d above the tier momentum floor with funding inside the +0.03 to +0.07 band. NEAR (+25.6% 7d), WLD (+23.09%), BEAT (+60.97%) and MU (+17.56%) clear the 7d move, but funding tops out at +0.0203%/8h on BEAT across the group, all under the +0.03 entry floor. No leverage heat behind the moves',
  DISTRIBUTION: 'no asset pairs extreme funding with a +5% 24h OI build and slowing gains. GUA funding +0.1654%/8h clears the +0.08 Tier 2 trigger by 2x, but its +9.1% 24h move sits the wrong side of the slowing-gains gate. No structural long-side crowding elsewhere',
  CAPITULATION: 'no drawdown pairs negative funding with an OI flush above the liquidation 75th percentile. BSB fell -14.05% 24h on OI -17.14% 24h, clearing the price and OI gates, but funding holds positive at +0.0096%/8h and liquidations of $775K sit under the $3.0M 7d p75. Funding stays positive on every drawdown candidate, blocking the regime',
};

// ---------- build regimes map ----------
const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];
const regimes = {};
for (const r of REGIME_ORDER) regimes[r] = [];

// XAU COMPRESSION entry
{
  const m = R.XAU.m;
  const rep = R.XAU.repeat_days;
  regimes.COMPRESSION.push({
    asset: 'XAU', tier: 2,
    marker: rep >= 3 ? 'star' : 'bullet',
    repeat_days_suffix: rep >= 2 ? `(day ${rep})` : null,
    metrics_line: `OI ${fp(m.oi_7d_pct)} 7d on ${fp(m.pct_24h)} 24h price, funding ${ff(m.funding_now)} (7d avg ${fp(m.funding_7d_avg, 4)}), top L/S ${fr(m.top_ls_now)} (${fdelta(m.top_ls_delta_7d)} 7d), range ${fr(m.range_7d_pct)}%, vol ${fr(m.vol_ratio)}x, taker buy ${fr(m.taker_buy_pct_24h)}%, basis —`,
    tags: [{ tag: 'COMPRESSION · QUIET', read: 'vol 0.33x marks a true coil, OI +36.62% 7d building under a flat tape. Move pending a trigger.' }],
  });
}

// ---------- watch ----------
const watch = watchOrder.map((a) => ({
  asset: a,
  metrics_line: watchLine(a),
  transition_read: watchReads[a],
}));

// ---------- tail ----------
const tail = ASSET_ORDER.map((a) => {
  const r = R[a];
  const m = r.m;
  return {
    asset: a, tier: r.tier, regime: r.regime,
    sub_tags: r.sub_tags, pattern_tags: r.pattern_tags,
    metrics: {
      price: fmtPrice(m.current_price),
      pct_24h: r2(m.pct_24h), pct_7d: r2(m.pct_7d), pct_4h: r2(m.pct_4h),
      range_7d: (m.range_7d_pct === null ? '—' : m.range_7d_pct.toFixed(2) + '%'),
      pct_24h_vs_btc: r2(m.pct_24h_vs_btc), pct_7d_vs_btc: r2(m.pct_7d_vs_btc),
      oi_usd: fmtUsd(m.oi_now), oi_24h_pct: r2(m.oi_24h_pct), oi_7d_pct: r2(m.oi_7d_pct),
      funding_now: r4(m.funding_now), funding_7d_avg: r4(m.funding_7d_avg), funding_delta: r4(m.funding_delta),
      liq_24h: fmtUsd(m.liq_24h_total), liq_7d_p75: fmtUsd(m.liq_7d_p75),
      long_liqs: fmtUsd(m.long_liqs_24h), short_liqs: fmtUsd(m.short_liqs_24h), liqs_4h: fmtUsd(m.liqs_4h),
      top_ls: r2(m.top_ls_now), top_ls_7d_avg: r2(m.top_ls_7d_avg), top_ls_delta_7d: r2(m.top_ls_delta_7d),
      basis: (m.basis_now === null ? '—' : r4(m.basis_now)), taker_buy: r2(m.taker_buy_pct_24h),
    },
    yesterday_regime: r.yesterday_regime, repeat_days: r.repeat_days,
  };
});

const data = {
  date: TODAY,
  edge_case: null,
  verdict,
  regime_changes,
  regimes,
  regime_empty_notes,
  watch,
  neutral_summary: 'Neutral · 24 other assets · see artifact tail for full data',
  tail,
};

fs.writeFileSync('.outputs/perps-scan.data.json', JSON.stringify(data, null, 2));
console.log('wrote .outputs/perps-scan.data.json (' + fs.statSync('.outputs/perps-scan.data.json').size + ' bytes)');

// ======== Node port of scripts/render-perps-scan.py ========
function fmtMarker(m) { return m === 'star' ? '★' : '•'; }
function renderRegimeChanges(changes) {
  const out = ['REGIME CHANGES (since yesterday)'];
  if (!changes || changes.length === 0) { out.push('  (no comparison available — first run or prior artifact missing)'); return out; }
  for (const c of changes) {
    out.push(`  ${c.asset} — ${c.from} → ${c.to}`);
    if (c.note) out.push(`    ${c.note}`);
  }
  return out;
}
function renderRegimeSection(name, assets, emptyNote) {
  const out = [name, ''];
  if (!assets || !assets.length) { out.push(`(empty today — ${emptyNote || 'no qualifying assets'})`); return out; }
  assets.forEach((a, i) => {
    const marker = fmtMarker(a.marker || 'bullet');
    const suffix = a.repeat_days_suffix ? ` ${a.repeat_days_suffix}` : '';
    out.push(`${marker} ${a.asset} — ${a.metrics_line}${suffix}`);
    if (a.tier === 1) out.push('  Tier 1 classification.');
    for (const t of (a.tags || [])) {
      let line = `  Tag: ${t.tag}`;
      if (t.read) line += ` — ${t.read}`;
      out.push(line);
    }
    if (i < assets.length - 1) out.push('');
  });
  return out;
}
function renderWatch(w) {
  if (!w || !w.length) return [];
  const out = ['WATCH (early signals, no full regime)', ''];
  w.forEach((x, i) => {
    out.push(`• ${x.asset} — ${x.metrics_line}`);
    if (x.transition_read) out.push(`  ${x.transition_read}`);
    if (i < w.length - 1) out.push('');
  });
  return out;
}
function renderTail(tail) {
  if (!tail || !tail.length) return [];
  const out = ['---', 'ARTIFACT DATA TAIL (consumed by perps-brief Pass 0)', ''];
  const G = (m, k) => (m[k] === undefined || m[k] === null ? '—' : m[k]);
  tail.forEach((a, i) => {
    const m = a.metrics || {};
    const sub = (a.sub_tags || []).join(' ') || '—';
    const pat = (a.pattern_tags || []).join(' ') || '—';
    out.push(`Asset: ${a.asset} | Tier: ${a.tier} | Regime: ${a.regime} | Sub-tags: ${sub} | Pattern tags: ${pat}`);
    out.push(`  price: ${G(m, 'price')} | pct_24h: ${G(m, 'pct_24h')} | pct_7d: ${G(m, 'pct_7d')} | pct_4h: ${G(m, 'pct_4h')} | range_7d: ${G(m, 'range_7d')}`);
    out.push(`  pct_24h_vs_btc: ${G(m, 'pct_24h_vs_btc')} | pct_7d_vs_btc: ${G(m, 'pct_7d_vs_btc')}`);
    out.push(`  oi: ${G(m, 'oi_usd')} | oi_24h_pct: ${G(m, 'oi_24h_pct')} | oi_7d_pct: ${G(m, 'oi_7d_pct')}`);
    out.push(`  funding_now: ${G(m, 'funding_now')} | funding_7d_avg: ${G(m, 'funding_7d_avg')} | funding_delta: ${G(m, 'funding_delta')}`);
    out.push(`  liq_24h: ${G(m, 'liq_24h')} | liq_7d_p75: ${G(m, 'liq_7d_p75')} | long_liqs: ${G(m, 'long_liqs')} | short_liqs: ${G(m, 'short_liqs')} | liqs_4h: ${G(m, 'liqs_4h')}`);
    out.push(`  top_ls: ${G(m, 'top_ls')} | top_ls_7d_avg: ${G(m, 'top_ls_7d_avg')} | top_ls_delta_7d: ${G(m, 'top_ls_delta_7d')}`);
    out.push(`  basis: ${G(m, 'basis')} | taker_buy: ${G(m, 'taker_buy')}`);
    out.push(`  yesterday_regime: ${a.yesterday_regime === null || a.yesterday_regime === undefined ? '—' : a.yesterday_regime} | repeat_days: ${a.repeat_days || 0}`);
    if (i < tail.length - 1) out.push('');
  });
  return out;
}

const lines = [];
lines.push(`Perps Regimes · ${data.date}`);
lines.push('');
lines.push(`Market read · ${verdict.word}`);
lines.push(`  ${verdict.distribution}`);
lines.push(`  ${verdict.cycle}`);
lines.push(`  ${verdict.forward}`);
lines.push('');
renderRegimeChanges(data.regime_changes).forEach((l) => lines.push(l));
lines.push('');
for (const name of REGIME_ORDER) {
  renderRegimeSection(name, regimes[name], regime_empty_notes[name]).forEach((l) => lines.push(l));
  lines.push('');
}
if (watch.length) { renderWatch(watch).forEach((l) => lines.push(l)); lines.push(''); }
if (data.neutral_summary) { lines.push(data.neutral_summary); lines.push(''); }
renderTail(tail).forEach((l) => lines.push(l));
lines.push('');

fs.writeFileSync('.outputs/perps-scan.md', lines.join('\n').replace(/\s+$/, '') + '\n');
console.log('wrote .outputs/perps-scan.md (' + fs.statSync('.outputs/perps-scan.md').size + ' bytes)');
