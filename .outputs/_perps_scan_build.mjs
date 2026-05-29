#!/usr/bin/env node
// Build .outputs/perps-scan.data.json from _perps_scan_today.json + yesterday's artifact.
import fs from "node:fs";

const TODAY = "2026-05-29";
const root = "/home/runner/work/aeon/aeon";
const computed = JSON.parse(fs.readFileSync(`${root}/.outputs/_perps_scan_today.json`, "utf8"));
const yesterday = JSON.parse(fs.readFileSync(`${root}/.outputs/perps-scan.data.json`, "utf8"));

// yesterday regime mapping
const yRegime = {};
const yRepeatDays = {};
for (const r of yesterday.tail) {
  yRegime[r.asset] = r.regime;
  yRepeatDays[r.asset] = r.repeat_days ?? 1;
}

const fmtMoney = (v) => {
  if (v == null) return null;
  const av = Math.abs(v);
  if (av >= 1e9) return `$${(v/1e9).toFixed(2)}B`;
  if (av >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (av >= 1e3) return `$${(v/1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtPrice = (v) => {
  if (v == null) return null;
  const av = Math.abs(v);
  if (av >= 1000) return `$${v.toLocaleString(undefined, {maximumFractionDigits:0})}`;
  if (av >= 1) return `$${v.toFixed(3)}`;
  if (av >= 0.01) return `$${v.toFixed(4)}`;
  if (av >= 0.0001) return `$${v.toFixed(5)}`;
  return `$${v.toFixed(8)}`;
};
const round = (v, n=2) => v == null ? null : Number(v.toFixed(n));
const roundF = (v) => v == null ? null : Number(v.toFixed(4));
const pctStr = (v, n=2) => v == null ? null : `${v.toFixed(n)}%`;

const tail = [];
const REGIME_ORDER = ["BTC","ETH","SOL","HYPE","ALLO","XLM","ZEC","LAB","XRP","NEAR","DOGE","WLD","SUI","INJ","BNB","XAU","HEI","ADA","1000PEPE","ID","BSB","TAO","HBAR","BCH","FIL"];

for (const asset of REGIME_ORDER) {
  const m = computed.assets[asset];
  if (!m) continue;
  const yReg = yRegime[asset] ?? null;
  const sameRegime = yReg === m.regime;
  const repeatDays = sameRegime ? (yRepeatDays[asset] ?? 1) + 1 : 1;
  tail.push({
    asset: asset,
    tier: m.tier,
    regime: m.regime,
    sub_tags: m.sub_tags,
    pattern_tags: m.pattern_tags,
    metrics: {
      price: fmtPrice(m.current_price),
      pct_24h: round(m.pct_24h),
      pct_7d: round(m.pct_7d),
      pct_4h: round(m.pct_4h),
      range_7d: pctStr(m.range_7d_pct),
      pct_24h_vs_btc: round(m.pct_24h_vs_btc),
      pct_7d_vs_btc: round(m.pct_7d_vs_btc),
      oi_usd: fmtMoney(m.oi_now),
      oi_24h_pct: round(m.oi_24h_pct),
      oi_7d_pct: round(m.oi_7d_pct),
      funding_now: roundF(m.funding_now),
      funding_7d_avg: roundF(m.funding_7d_avg),
      funding_delta: roundF(m.funding_delta),
      liq_24h: fmtMoney(m.liq_24h_total),
      liq_7d_p75: fmtMoney(m.liq_7d_p75),
      long_liqs: fmtMoney(m.long_liqs_24h),
      short_liqs: fmtMoney(m.short_liqs_24h),
      liqs_4h: fmtMoney(m.liqs_4h),
      top_ls: round(m.top_ls_now, 2),
      top_ls_7d_avg: round(m.top_ls_7d_avg, 2),
      top_ls_delta_7d: round(m.top_ls_delta_7d, 2),
      basis: roundF(m.basis_now),
      taker_buy: round(m.taker_buy_pct_24h),
    },
    yesterday_regime: yReg,
    repeat_days: repeatDays,
  });
}

// Regime changes
const regime_changes = [];
// new entrants today
const newToday = REGIME_ORDER.filter((a) => yRegime[a] === undefined);
// transitions for assets present yesterday + today
for (const t of tail) {
  const y = yRegime[t.asset];
  if (y === undefined) continue;
  if (y !== t.regime) {
    regime_changes.push({asset: t.asset, from: y, to: t.regime, note: "TBD"});
  }
}
// new entrants
for (const a of newToday) {
  const m = computed.assets[a];
  if (!m) continue;
  regime_changes.push({asset: a, from: "(new entrant)", to: m.regime, note: "TBD"});
}

const data = {
  date: TODAY,
  edge_case: null,
  verdict: {
    word: "CHOP",
    distribution: "0 regime prints across 25 assessed, all 25 NEUTRAL.",
    cycle: "Fresh-listing parabolas dominate every directional print and each one stalls one point under the 52% taker-buy line. Majors grind sideways inside a 1% session range with funding rolled positive across the curve.",
    forward: "ALLO and LAB cross 52% taker buy or the leverage-led rip fades through an OI flush. HEI prints pct_4h -15% inside a +103% daily, so the leverage cascade has already started. XLM keeps the squeeze fuel loaded on top L/S 0.73 and pct_4h still climbing +10% into the close."
  },
  regime_changes,
  regimes: {
    "ACCUMULATION": [],
    "CATALYST-BREAKOUT": [],
    "SHORT-SQUEEZE": [],
    "MOMENTUM": [],
    "COMPRESSION": [],
    "DISTRIBUTION": [],
    "CAPITULATION": [],
  },
  regime_empty_notes: {
    "ACCUMULATION": "no asset clears the OI +10% 7d / positive 7d price / range under 25% trio. HYPE prints OI +25.31% 7d and +18.51% 7d price but range 25.14% sits one tick above the gate. INJ (oi_7d +31.41%, p7 +24.58%) and HEI (oi_7d +644%, p7 +72.84%) blow through the ceiling at ranges 41.92% and 168.27%. NEAR oi_7d build has faded to +2.46%, structure gone",
    "CATALYST-BREAKOUT": "no asset pairs a breakout-grade move with taker buy above 52%. ALLO (+53%, vol 35x, OI +100%), LAB (+47%, vol 4.79x, OI +52%), HEI (+103%, vol 71x, OI +652%) and ID (+37%, vol 63x, OI +510%) clear every price, volume and OI gate. Taker buy stalls between 49.66% and 51.98% across the entire group. Buying never crosses the spread on any of them",
    "SHORT-SQUEEZE": "no asset pairs a >10% rip with OI rolling negative. ALLO, LAB, HEI, ID, XLM and INJ all ripped double-to-triple digits but every one did it on rising OI, the shape of fresh longs piling in rather than forced short cover. The mechanism is leverage-led price discovery, not squeeze",
    "MOMENTUM": "no asset holds a 7d run with funding inside the +0.03 to +0.07 band. HEI (+72.84% 7d), XLM (+66.99% 7d), and ALLO (+177.07% 7d) clear the move comfortably but funding sits negative or near zero across the group. No structural longside heat behind the trends",
    "COMPRESSION": "no asset holds a sub-5% range with an OI build and flat funding. XAU prints the tightest range in the universe at 5.13% but OI sits at +1.67% 7d, missing the +5% build gate by half. Every other tier-2 prints range above the gate",
    "DISTRIBUTION": "no asset pairs extreme funding with a 5% OI build and slowing gains. SUI funding +0.0109%/8h sits well under the +0.08 tier-2 trigger and the +0.06 tier-1 trigger does not bite on BTC/ETH/SOL (all under +0.009). No longside funding extreme prints anywhere in the universe today",
    "CAPITULATION": "no drawdown pairs negative funding with an OI flush past the liquidation 75th percentile. TAO -5.03% missed the tier-2 -10% drawdown threshold and prints funding nearly flat. BSB -6.46% missed the threshold and held funding positive at +0.003. BCH closed flat at +0.47% on negative funding but no flush — yesterday's drop did not extend"
  },
  watch: [], // filled below
  neutral_summary: "Neutral · 25 assessed, 6 surfaced to WATCH · full data in the tail",
  tail,
};

fs.writeFileSync(`${root}/.outputs/_perps_scan_pre.json`, JSON.stringify(data, null, 2));
console.log("Wrote _perps_scan_pre.json");
console.log("New entrants:", newToday);
console.log("Transitions:", regime_changes.length);
