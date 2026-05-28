#!/usr/bin/env node
// Assemble .outputs/perps-scan.data.json for 2026-05-28.
// Numbers come from _ps_results_0528.json (computed); prose is embedded below.
import fs from 'fs';
import path from 'path';

const OUT = '/home/runner/work/aeon/aeon/.outputs';
const R = JSON.parse(fs.readFileSync(path.join(OUT, '_ps_results_0528.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.coinglass-cache/manifest.json', 'utf8'));
const ORDER = MANIFEST.asset_list;

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);
function fmtPrice(p) {
  if (p == null) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return '$' + p.toFixed(5);
}
function fmtUsd(v) {
  if (v == null) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}
const sp = (v, nd = 2) => (v == null ? 'NA' : (v >= 0 ? '+' : '') + v.toFixed(nd)); // signed pct
const sf = (v) => (v == null ? 'NA' : (v >= 0 ? '+' : '') + v.toFixed(4)); // signed funding
const sd = (v) => (v == null ? 'NA' : (v >= 0 ? '+' : '') + v.toFixed(2)); // signed delta

// Dense WATCH metric line built from the computed metrics.
function watchLine(a) {
  const m = R[a].m;
  const parts = [];
  parts.push(`${sp(m.pct_24h)}% 24h`);
  parts.push(`${sp(m.pct_7d)}% 7d`);
  parts.push(`OI ${sp(m.oi_24h_pct)}% 24h on OI ${sp(m.oi_7d_pct)}% 7d`);
  parts.push(`funding ${sf(m.funding_now)}%/8h (7d avg ${sf(m.funding_7d_avg)}%, delta ${sf(m.funding_delta)}%)`);
  parts.push(`taker buy ${m.taker_buy_pct_24h == null ? 'NA' : m.taker_buy_pct_24h.toFixed(2)}%`);
  parts.push(`vol ${m.vol_ratio == null ? 'NA' : m.vol_ratio.toFixed(2)}x`);
  parts.push(`liq ${fmtUsd(m.liq_24h_total)} vs 7d p75 ${fmtUsd(m.liq_7d_p75)}`);
  parts.push(`short liqs ${fmtUsd(m.short_liqs_24h)} vs p75 ${fmtUsd(m.short_liqs_7d_p75)}`);
  parts.push(`top L/S ${m.top_ls_now == null ? 'NA' : m.top_ls_now.toFixed(2)} (Δ ${sd(m.top_ls_delta_7d)} 7d)`);
  parts.push(`basis ${m.basis_now == null ? '—' : sf(m.basis_now) + '%'}`);
  parts.push(`pct_4h ${sp(m.pct_4h)}%`);
  parts.push(`range ${m.range_7d_pct == null ? 'NA' : m.range_7d_pct.toFixed(2)}%`);
  return parts.join(', ');
}

function tailMetrics(a) {
  const m = R[a].m;
  return {
    price: fmtPrice(m.current_price),
    pct_24h: r2(m.pct_24h), pct_7d: r2(m.pct_7d), pct_4h: r2(m.pct_4h),
    range_7d: m.range_7d_pct == null ? null : r2(m.range_7d_pct) + '%',
    pct_24h_vs_btc: r2(m.pct_24h_vs_btc), pct_7d_vs_btc: r2(m.pct_7d_vs_btc),
    oi_usd: fmtUsd(m.oi_now), oi_24h_pct: r2(m.oi_24h_pct), oi_7d_pct: r2(m.oi_7d_pct),
    funding_now: r4(m.funding_now), funding_7d_avg: r4(m.funding_7d_avg), funding_delta: r4(m.funding_delta),
    liq_24h: fmtUsd(m.liq_24h_total), liq_7d_p75: fmtUsd(m.liq_7d_p75),
    long_liqs: fmtUsd(m.long_liqs_24h), short_liqs: fmtUsd(m.short_liqs_24h), liqs_4h: fmtUsd(m.liqs_4h),
    top_ls: r2(m.top_ls_now), top_ls_7d_avg: r2(m.top_ls_7d_avg), top_ls_delta_7d: r2(m.top_ls_delta_7d),
    basis: m.basis_now == null ? null : r4(m.basis_now),
    taker_buy: r2(m.taker_buy_pct_24h),
  };
}

const tail = ORDER.filter((a) => R[a] && !R[a].dropped).map((a) => ({
  asset: a, tier: R[a].tier, regime: R[a].regime,
  sub_tags: R[a].sub_tags, pattern_tags: R[a].pattern_tags,
  metrics: tailMetrics(a),
  yesterday_regime: R[a].yesterday_regime, repeat_days: R[a].repeat_days,
}));

// ---- Embedded prose (judgment layer) ----
const WATCH_READS = {
  XLM: 'XLM broke out +28% on open interest up 90% with the only major-grade volume expansion in the universe at 22.8x, and short liquidations ran 53x their weekly norm. Top traders hold net short at 0.70 L/S and falling, so the move squeezes them harder as it extends. CATALYST-BREAKOUT confirms the session taker buy clears 52% with the open-interest build holding. The setup invalidates if price loses the breakout level as open interest rolls over.',
  ALLO: 'ALLO ripped +66% with open interest up 360% in 24h and volume 27.8x its norm, a first appearance on a parabolic leverage build. Buying stalls at 51% taker, one point under the breakout gate, so demand has not crossed the spread. The 360% open-interest spike makes this fragile, a leverage-driven launch rather than absorbed accumulation. Taker buy above 52% confirms a breakout, an open-interest flush invalidates it.',
  H: 'H pushed +26% on open interest up 29% with volume 3.4x its norm and top traders crowding long at 2.38. Buying stalls at 51% taker, just under the gate. CATALYST-BREAKOUT confirms if taker buy clears 52% with open interest holding. The crowded long at 2.38 cuts both ways. A sharp reversal flushes it as fast as a breakout extends it.',
  WLD: 'WLD flushed -16.94% on open interest down 15% with funding negative at -0.0215%/8h, the cleanest capitulation shape on the board. Liquidations of $3.9M sat just under the $4.1M weekly 75th percentile, so the regime missed by a single gate. CAPITULATION confirms if a second leg down pushes liquidations past the p75. A reclaim of the prior range turns this into a failed breakdown instead.',
  ESPORTS: 'ESPORTS prints funding at +0.2692%/8h, over three times the extreme trigger, with top traders at 1.31 L/S under the crowded line. That pairing fires the RETAIL-ANOMALY pattern, a funding extreme without smart-money crowding. The +15.67% bounce sits on a -93.6% weekly collapse, so this reads as a dead-cat on a broken token, not a setup. The extreme resolves through a fade unless price reclaims structure it has not held in a week.',
};
const WATCH_ORDER = ['XLM', 'ALLO', 'H', 'WLD', 'ESPORTS'];
const watch = WATCH_ORDER.map((a) => ({
  asset: a, metrics_line: watchLine(a), transition_read: WATCH_READS[a],
}));

const data = {
  date: '2026-05-28',
  edge_case: null,
  verdict: {
    word: 'CHOP',
    distribution: '0 regime prints across 25 assessed, all 25 NEUTRAL.',
    cycle: 'Leverage churns two-sided with nothing confirming. Up-moves stall under the 52% taker-buy line and drawdowns hold above the capitulation gate.',
    forward: 'Watch XLM for breakout confirmation above 52% taker buy on the open-interest build, and the WLD-led drawdown cluster for a capitulation flush if funding flips negative as price extends down.',
  },
  regime_changes: [
    { asset: 'HYPE', from: 'ACCUMULATION', to: 'NEUTRAL', note: 'The accumulation print did not hold. HYPE bounced +6.71% but its 7d open-interest build faded to +2%, dropping it under the +10% accumulation floor. A one-day structure, now a NEUTRAL bounce.' },
    { asset: 'XAU', from: 'COMPRESSION', to: 'NEUTRAL', note: 'The coil resolved through leverage, not price. Open interest flushed 20.7% in 24h and funding slipped negative, breaking the build. Price held flat while the position unwound.' },
    { asset: 'XLM', from: '(new entrant)', to: 'NEUTRAL', note: 'First appearance straight into a +28% breakout, held at NEUTRAL only by taker buy at 50.51% under the 52% gate. The marquee setup of the day. See WATCH.' },
    { asset: 'ALLO', from: '(new entrant)', to: 'NEUTRAL', note: 'First appearance on a +66% rip with open interest up 360%. Taker buy 51% kept it under the breakout gate. See WATCH.' },
    { asset: 'H', from: '(new entrant)', to: 'NEUTRAL', note: 'First appearance, +26% on open interest up 29%. Taker buy 51% held it out of CATALYST-BREAKOUT. See WATCH.' },
    { asset: 'GUA', from: '(new entrant)', to: 'NEUTRAL', note: 'First appearance, +120% on a -43.6% weekly collapse. A broken-meme bounce, not signal, and funding at +0.0223%/8h carries no extreme.' },
    { asset: 'BCH', from: '(new entrant)', to: 'NEUTRAL', note: 'First appearance, a -10.5% drawdown that missed CAPITULATION on open interest cooling only 4.3%.' },
    { asset: 'BEAT', from: '(new entrant)', to: 'NEUTRAL', note: 'First appearance, -12.86% on open interest down 18%, but funding held positive and blocked the capitulation print.' },
  ],
  regimes: {
    ACCUMULATION: [], 'CATALYST-BREAKOUT': [], 'SHORT-SQUEEZE': [], MOMENTUM: [],
    COMPRESSION: [], DISTRIBUTION: [], CAPITULATION: [],
  },
  regime_empty_notes: {
    ACCUMULATION: 'no asset clears open interest up 10% on 7d with positive 7d price inside the 25% range gate. NEAR (+33% oi_7d), WLD (+25%), ESPORTS (+37%) and H (+27%) carry the build and the positive 7d price, but ranges of 55%, 60%, over 2000% and 49% all blow past the ceiling. HYPE the one-day print unwound as its 7d build faded to +2%',
    'CATALYST-BREAKOUT': 'no asset pairs a breakout-grade move with taker buy above 52%. XLM (+28%, vol 22.8x, oi +90%), ALLO (+66%, vol 27.8x, oi +360%) and H (+26%, vol 3.4x, oi +29%) all clear price, volume and open interest, but taker buy tops out at 51% across the group. Buying never crosses the spread',
    'SHORT-SQUEEZE': 'no asset clears a +10% move with open interest rolling negative. XLM, ALLO, GUA and H all ripped double digits, but every one did it on rising open interest, the shape of fresh longs piling in rather than forced short covers',
    MOMENTUM: 'no asset holds a 7d run with funding inside the +0.03 to +0.07 band. NEAR (+26% 7d), UB (+97%), BEAT (+38%) and XLM (+43%) clear the move, but funding sits near zero across all of them. No leverage heat behind the trends',
    COMPRESSION: 'no asset holds a sub-5% range with an open-interest build and flat funding. XAU compressed into yesterday but its open interest flushed 20.7% in 24h, breaking the build and routing it to NEUTRAL',
    DISTRIBUTION: 'no asset pairs extreme funding with a 5% open-interest build and slowing gains. ESPORTS funding +0.2692%/8h clears the trigger eightfold, but its +15.67% move runs the wrong side of the slowing-gains gate. No structural long-side crowding elsewhere',
    CAPITULATION: 'no drawdown pairs negative funding with an open-interest flush above the liquidation 75th percentile. WLD fell -16.94% on oi -15% with negative funding, but $3.9M liquidations sat just under the $4.1M weekly p75. BSB, UB and BEAT dropped double digits on positive funding, and BCH open interest cooled only 4.3%. Each missed by one gate',
  },
  watch,
  neutral_summary: 'Neutral · 25 assessed, 5 surfaced to WATCH · full data in the tail',
  tail,
};

fs.writeFileSync(path.join(OUT, 'perps-scan.data.json'), JSON.stringify(data, null, 2));
console.log(`wrote perps-scan.data.json — ${tail.length} tail, ${watch.length} watch, ${data.regime_changes.length} changes`);
// quick echo of watch lines for review
for (const w of watch) console.log(`\n${w.asset}: ${w.metrics_line}`);
