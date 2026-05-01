#!/usr/bin/env node
const fs = require('fs');
const R = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const chains = R('/home/runner/work/aeon/aeon/.defi-chains.json');
const protocols = R('/home/runner/work/aeon/aeon/.defi-protocols.json');
const dexs = R('/home/runner/work/aeon/aeon/.defi-dexs.json');
const fees = R('/home/runner/work/aeon/aeon/.defi-fees.json');
const stables = R('/home/runner/work/aeon/aeon/.defi-stables.json');
const pools = R('/home/runner/work/aeon/aeon/.defi-pools.json');

const fmtUsd = (n) => {
  if (n == null || isNaN(n)) return '?';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'k';
  return '$' + n.toFixed(0);
};
const fmtPct = (p) => {
  if (p == null || isNaN(p)) return 'n/a';
  const sign = p >= 0 ? '+' : '';
  return sign + p.toFixed(2) + '%';
};

// === TVL aggregate ===
const totalTvl = chains.reduce((s, c) => s + (c.tvl || 0), 0);
const totalTvlYesterday = chains.reduce((s, c) => {
  const t = c.tvl || 0;
  const ch1d = c.change_1d;
  if (ch1d != null && ch1d > -100) {
    return s + t / (1 + ch1d/100);
  }
  return s + t;
}, 0);
const totalTvl7d = chains.reduce((s, c) => {
  const t = c.tvl || 0;
  const ch7d = c.change_7d;
  if (ch7d != null && ch7d > -100) return s + t / (1 + ch7d/100);
  return s + t;
}, 0);
const tvl_d = (totalTvl - totalTvlYesterday) / totalTvlYesterday * 100;
const tvl_7 = (totalTvl - totalTvl7d) / totalTvl7d * 100;

// === DEX volume (24h) ===
const dexTotal = dexs.total24h ?? dexs.totalAllTime ?? 0;
const dexCh1d = dexs.change_1d;
const dexCh7d = dexs.change_7d;
const dexCh1m = dexs.change_1m;

// === Fees aggregate (24h) ===
const feesTotal = fees.total24h ?? 0;
const feesCh1d = fees.change_1d;

// === Stables ===
const stableArr = stables.peggedAssets || [];
const totalStable = stableArr.reduce((s, a) => {
  const c = a.circulating?.peggedUSD || a.circulating || 0;
  return s + (typeof c === 'object' ? 0 : c);
}, 0);
const totalStableYday = stableArr.reduce((s, a) => {
  const c = a.circulating?.peggedUSD || a.circulating || 0;
  const cP = a.circulatingPrevDay?.peggedUSD || 0;
  return s + (cP || c);
}, 0);
const totalStableWeek = stableArr.reduce((s, a) => {
  const c = a.circulating?.peggedUSD || a.circulating || 0;
  const cW = a.circulatingPrevWeek?.peggedUSD || 0;
  return s + (cW || c);
}, 0);
const stable_d = (totalStable - totalStableYday) / totalStableYday * 100;
const stable_7 = (totalStable - totalStableWeek) / totalStableWeek * 100;

// === Verdict ===
let verdict = 'Mixed';
let verdictRead = '';
if (tvl_d > 2 && (dexCh1d ?? 0) > 2 && stable_d > 2) {
  verdict = 'Risk-on';
  verdictRead = 'capital flowing in across TVL, volume, and stables';
} else if ([tvl_d, dexCh1d ?? 0, stable_d].filter(x => x < -2).length >= 2) {
  verdict = 'Risk-off';
  verdictRead = 'capital unwinding';
} else if (Math.abs(tvl_d) < 1 && Math.abs(dexCh1d ?? 0) < 5) {
  verdict = 'Sideways';
  verdictRead = 'no conviction; grind day';
} else {
  verdict = 'Mixed';
  // describe split in <=12 words
  const tvlWord = tvl_d > 0.5 ? 'TVL up' : tvl_d < -0.5 ? 'TVL down' : 'TVL flat';
  const volWord = (dexCh1d ?? 0) > 5 ? 'DEX vol bouncing' : (dexCh1d ?? 0) < -5 ? 'DEX vol pulling back' : 'DEX vol flat';
  const stWord = stable_d > 0.3 ? 'stables expanding' : stable_d < -0.3 ? 'stables shedding' : 'stables flat';
  verdictRead = `${tvlWord}, ${volWord}, ${stWord}`;
}

// === Top chains ===
const topChains = chains.filter(c => c.tvl).sort((a,b) => b.tvl - a.tvl).slice(0, 3);

// === Chain movers ===
const chainCands = chains.filter(c => (c.tvl || 0) >= 5e8 && c.change_1d != null && Math.abs(c.change_1d) >= 5);
const chainUp = [...chainCands].filter(c => c.change_1d > 0).sort((a,b) => b.change_1d - a.change_1d)[0];
const chainDown = [...chainCands].filter(c => c.change_1d < 0).sort((a,b) => a.change_1d - b.change_1d)[0];

// === Protocol movers ===
const protCands = protocols.filter(p => (p.tvl || 0) >= 1e8 && p.change_1d != null && Math.abs(p.change_1d) >= 10);
const protUp = [...protCands].filter(p => p.change_1d > 0).sort((a,b) => b.change_1d - a.change_1d)[0];
const protDown = [...protCands].filter(p => p.change_1d < 0).sort((a,b) => a.change_1d - b.change_1d)[0];

// === Fees leaders (24h) ===
const feesProtocols = (fees.protocols || []).filter(p => p.total24h != null && p.total24h > 0);
const feesLeaders = [...feesProtocols].sort((a,b) => (b.total24h||0) - (a.total24h||0)).slice(0, 5);

// === Fees beating TVL ===
// Need protocols where fees change_7d > 20% and TVL change_7d < 5%
const protBySlug = new Map();
for (const p of protocols) {
  if (p.slug) protBySlug.set(p.slug, p);
  if (p.name) protBySlug.set((p.name || '').toLowerCase(), p);
}
const feesBeatTvl = [];
for (const fp of feesProtocols) {
  if (!fp.change_7d || fp.change_7d <= 20) continue;
  if ((fp.total24h || 0) < 1e5) continue;
  const matchSlug = fp.slug || (fp.name || '').toLowerCase();
  const tvlProt = protBySlug.get(matchSlug) || protBySlug.get((fp.name || '').toLowerCase());
  if (!tvlProt) continue;
  const tvlChg7 = tvlProt.change_7d;
  if (tvlChg7 == null || tvlChg7 >= 5) continue;
  if ((tvlProt.tvl || 0) < 1e8) continue;
  // Skip absurd outliers (>200% fees7d likely near-zero baseline)
  if (fp.change_7d > 200) continue;
  feesBeatTvl.push({ name: fp.name, fees24h: fp.total24h, feesCh7: fp.change_7d, tvl: tvlProt.tvl, tvlCh7: tvlChg7 });
}
feesBeatTvl.sort((a,b) => b.feesCh7 - a.feesCh7);
const feesBeatTop = feesBeatTvl.slice(0, 2);

// === DEX top ===
const dexProts = (dexs.protocols || []).filter(p => p.total24h != null);
const dexTop = [...dexProts].sort((a,b) => (b.total24h||0) - (a.total24h||0)).slice(0, 5);

// === Stable single-issuer movers ===
const stableMovers = stableArr.map(a => {
  const c = a.circulating?.peggedUSD || 0;
  const cP = a.circulatingPrevDay?.peggedUSD || 0;
  if (cP === 0 || c === 0) return null;
  const ch = (c - cP) / cP * 100;
  return { name: a.name, symbol: a.symbol, c, ch };
}).filter(x => x && x.c >= 1e9 && Math.abs(x.ch) >= 1).sort((a,b) => Math.abs(b.ch) - Math.abs(a.ch));

// === Yields ===
const poolList = pools.data || [];
// Real yield filter
const realYield = poolList.filter(p => {
  if (!p.apyBase || p.apyBase <= 0) return false;
  const aR = p.apyReward || 0;
  const apyTotal = p.apy || (p.apyBase + aR);
  if (apyTotal <= 0) return false;
  if (aR / apyTotal >= 0.5) return false;
  if (p.outlier) return false;
  if ((p.predictions?.binnedConfidence || 0) < 2) return false;
  if (!p.apyMean30d || p.apyMean30d < apyTotal * 0.5) return false;
  if ((p.tvlUsd || 0) < 10e6) return false;
  return true;
}).sort((a,b) => (b.apyBase || 0) - (a.apyBase || 0)).slice(0, 5);

// Incentive yield filter
const incYield = poolList.filter(p => {
  if (!p.apyReward || p.apyReward <= 0) return false;
  if (p.outlier) return false;
  if ((p.tvlUsd || 0) < 25e6) return false;
  return true;
}).sort((a,b) => (b.apy || 0) - (a.apy || 0)).slice(0, 5);

// === Output ===
const out = {
  totalTvl, tvl_d, tvl_7,
  dexTotal, dexCh1d, dexCh7d, dexCh1m,
  feesTotal, feesCh1d,
  totalStable, stable_d, stable_7,
  verdict, verdictRead,
  topChains: topChains.map(c => ({ name: c.name, tvl: c.tvl, change_1d: c.change_1d, change_7d: c.change_7d })),
  chainUp: chainUp ? { name: chainUp.name, tvl: chainUp.tvl, change_1d: chainUp.change_1d, change_7d: chainUp.change_7d } : null,
  chainDown: chainDown ? { name: chainDown.name, tvl: chainDown.tvl, change_1d: chainDown.change_1d, change_7d: chainDown.change_7d } : null,
  protUp: protUp ? { name: protUp.name, tvl: protUp.tvl, change_1d: protUp.change_1d, change_7d: protUp.change_7d, category: protUp.category, chain: protUp.chain } : null,
  protDown: protDown ? { name: protDown.name, tvl: protDown.tvl, change_1d: protDown.change_1d, change_7d: protDown.change_7d, category: protDown.category, chain: protDown.chain } : null,
  feesLeaders: feesLeaders.map(p => ({ name: p.name, total24h: p.total24h, total7d: p.total7d, change_1d: p.change_1d, change_7d: p.change_7d })),
  feesBeatTvl: feesBeatTop,
  dexTop: dexTop.map(p => ({ name: p.name, total24h: p.total24h, change_1d: p.change_1d, change_7d: p.change_7d })),
  stableMovers: stableMovers.slice(0, 6),
  realYield: realYield.map(p => ({ project: p.project, symbol: p.symbol, chain: p.chain, apyBase: p.apyBase, apyReward: p.apyReward, apy: p.apy, tvlUsd: p.tvlUsd, apyMean30d: p.apyMean30d, ilRisk: p.ilRisk })),
  incYield: incYield.map(p => ({ project: p.project, symbol: p.symbol, chain: p.chain, apyBase: p.apyBase, apyReward: p.apyReward, apy: p.apy, tvlUsd: p.tvlUsd, rewardTokens: p.rewardTokens })),
};

fs.writeFileSync('/home/runner/work/aeon/aeon/.defi-summary.json', JSON.stringify(out, null, 2));
console.log('OK summary written, verdict=' + verdict);
