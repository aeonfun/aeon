#!/usr/bin/env node
const fs = require('fs');

const chains    = JSON.parse(fs.readFileSync('chains.json'));
const protocols = JSON.parse(fs.readFileSync('protocols.json'));
const dexs      = JSON.parse(fs.readFileSync('dexs.json'));
const fees      = JSON.parse(fs.readFileSync('fees.json'));
const stables   = JSON.parse(fs.readFileSync('stables.json'));
const pools     = JSON.parse(fs.readFileSync('pools.json'));

// 1. Schema-drift sniff: do /v2/chains items carry change_1d?
const sampleChain = chains[0] || {};
const chainKeys = Object.keys(sampleChain);
const chainHasChange1d = chainKeys.includes('change_1d');
console.log('CHAIN_KEYS:', chainKeys.join(','));
console.log('chainHasChange1d:', chainHasChange1d);

// 2. Total TVL
const totalTvl = chains.reduce((a, c) => a + (c.tvl || 0), 0);
console.log('totalTvl:', totalTvl);

// Sort chains by TVL desc
const chainsSorted = [...chains].sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
console.log('TOP10_CHAINS_BY_TVL:');
chainsSorted.slice(0, 10).forEach(c => {
  console.log('  ', c.name, 'tvl=', c.tvl, 'change_1d=', c.change_1d, 'change_7d=', c.change_7d);
});

// 3. DEX overview header
console.log('\nDEXS_OVERVIEW:');
console.log('  total24h:', dexs.total24h, ' total7d:', dexs.total7d);
console.log('  change_1d:', dexs.change_1d, ' change_7d:', dexs.change_7d, ' change_1m:', dexs.change_1m);
const dexProtos = (dexs.protocols || []).slice().sort((a, b) => (b.total24h || 0) - (a.total24h || 0));
console.log('  TOP10_DEX:');
dexProtos.slice(0, 10).forEach(p => {
  console.log('    ', p.name, ' 24h=', p.total24h, ' chg1d=', p.change_1d, ' chg7d=', p.change_7d, ' chains=', (p.chains||[]).slice(0,3).join(','));
});

// 4. Fees overview header
console.log('\nFEES_OVERVIEW:');
console.log('  total24h:', fees.total24h, ' total7d:', fees.total7d);
console.log('  change_1d:', fees.change_1d, ' change_7d:', fees.change_7d, ' change_1m:', fees.change_1m);
const feesProtos = (fees.protocols || []).slice().sort((a, b) => (b.total24h || 0) - (a.total24h || 0));
console.log('  TOP10_FEES:');
feesProtos.slice(0, 10).forEach(p => {
  console.log('    ', p.name, ' 24h=', p.total24h, ' chg1d=', p.change_1d, ' chg7d=', p.change_7d, ' chains=', (p.chains||[]).slice(0,3).join(','));
});

// 5. Stables
const stableArr = stables.peggedAssets || [];
const totalStable = stableArr.reduce((a, s) => a + (s.circulating?.peggedUSD || 0), 0);
let stableTotal1dAgo = 0;
let stableTotal7dAgo = 0;
stableArr.forEach(s => {
  const cur = s.circulating?.peggedUSD || 0;
  const d1  = s.circulatingPrevDay?.peggedUSD || cur;
  const d7  = s.circulatingPrevWeek?.peggedUSD || cur;
  stableTotal1dAgo += d1;
  stableTotal7dAgo += d7;
});
const stableD1 = ((totalStable - stableTotal1dAgo) / stableTotal1dAgo) * 100;
const stableD7 = ((totalStable - stableTotal7dAgo) / stableTotal7dAgo) * 100;
console.log('\nSTABLES:');
console.log('  totalCirculating:', totalStable, ' total1dAgo:', stableTotal1dAgo, ' d1pct:', stableD1.toFixed(3), ' d7pct:', stableD7.toFixed(3));

// Top stables by size + 1d %
const stablesEnriched = stableArr.map(s => {
  const cur = s.circulating?.peggedUSD || 0;
  const prev = s.circulatingPrevDay?.peggedUSD || cur;
  const prev7 = s.circulatingPrevWeek?.peggedUSD || cur;
  const d1 = prev ? ((cur - prev) / prev) * 100 : 0;
  const d7 = prev7 ? ((cur - prev7) / prev7) * 100 : 0;
  return { name: s.symbol || s.name, cur, d1, d7 };
}).filter(s => s.cur >= 1e9);
stablesEnriched.sort((a, b) => b.cur - a.cur);
console.log('  TOP_STABLES (>$1B):');
stablesEnriched.slice(0, 15).forEach(s => {
  console.log('    ', s.name, ' cur=', s.cur, ' d1=', s.d1.toFixed(2), ' d7=', s.d7.toFixed(2));
});
console.log('  STABLES_NOTABLE_1D (>=1%):');
stablesEnriched.filter(s => Math.abs(s.d1) >= 1).slice(0, 10).forEach(s => {
  console.log('    ', s.name, ' cur=', s.cur, ' d1=', s.d1.toFixed(2), ' d7=', s.d7.toFixed(2));
});

// 6. Protocols movers
console.log('\nPROTOCOLS_MOVERS_UP (|chg1d|>=10% & tvl>=$100M):');
const protoUp = protocols.filter(p => p.tvl && p.tvl >= 100e6 && p.change_1d && p.change_1d >= 10);
protoUp.sort((a, b) => b.change_1d - a.change_1d);
protoUp.slice(0, 10).forEach(p => {
  console.log('  ', p.name, ' tvl=', p.tvl, ' chg1d=', p.change_1d, ' chg7d=', p.change_7d, ' cat=', p.category, ' chains=', (p.chains||[]).slice(0,3).join(','));
});

console.log('\nPROTOCOLS_MOVERS_DOWN (chg1d<=-10% & tvl>=$100M):');
const protoDown = protocols.filter(p => p.tvl && p.tvl >= 100e6 && p.change_1d && p.change_1d <= -10);
protoDown.sort((a, b) => a.change_1d - b.change_1d);
protoDown.slice(0, 10).forEach(p => {
  console.log('  ', p.name, ' tvl=', p.tvl, ' chg1d=', p.change_1d, ' chg7d=', p.change_7d, ' cat=', p.category, ' chains=', (p.chains||[]).slice(0,3).join(','));
});

// 7. Fees beating TVL
console.log('\nFEES_BEATING_TVL (fees7d>20% & TVL7d<5%, 24h fees>=$100k, TVL>=$100M):');
const feeBySlug = {};
feesProtos.forEach(p => { feeBySlug[(p.slug||'').toLowerCase()] = p; });
const feeByName = {};
feesProtos.forEach(p => { feeByName[(p.name||'').toLowerCase()] = p; });

const candidates = protocols
  .filter(p => p.tvl && p.tvl >= 100e6)
  .map(p => {
    const fp = feeBySlug[(p.slug||'').toLowerCase()] || feeByName[(p.name||'').toLowerCase()];
    if (!fp) return null;
    if (!(fp.total24h && fp.total24h >= 100000)) return null;
    if (!(fp.change_7d != null && fp.change_7d > 20)) return null;
    if (!(p.change_7d != null && p.change_7d < 5)) return null;
    return { name: p.name, tvl: p.tvl, tvlChg7d: p.change_7d, fees24h: fp.total24h, feesChg7d: fp.change_7d, cat: p.category };
  })
  .filter(Boolean);
candidates.sort((a, b) => b.feesChg7d - a.feesChg7d);
candidates.slice(0, 10).forEach(c => {
  console.log('  ', c.name, ' tvl=', c.tvl, ' tvl7d=', c.tvlChg7d, ' fees24h=', c.fees24h, ' fees7d=', c.feesChg7d, ' cat=', c.cat);
});

// 8. Yields - real
console.log('\nREAL_YIELD pools (apyBase>0 & rewardShare<0.5 & !outlier & conf>=2 & apyMean30d>=apy*0.5 & tvlUsd>=$10M):');
const realPools = (pools.data || []).filter(p => {
  const apyBase = p.apyBase || 0;
  const apyReward = p.apyReward || 0;
  const apy = p.apy || 0;
  const tvl = p.tvlUsd || 0;
  const conf = p.predictions?.binnedConfidence || 0;
  const mean30 = p.apyMean30d || 0;
  if (p.outlier) return false;
  if (apyBase <= 0) return false;
  const rewardShare = apy > 0 ? (apyReward / apy) : 0;
  if (rewardShare >= 0.5) return false;
  if (conf < 2) return false;
  if (mean30 < apy * 0.5) return false;
  if (tvl < 10e6) return false;
  return true;
});
realPools.sort((a, b) => (b.apyBase || 0) - (a.apyBase || 0));
console.log(' count_real:', realPools.length);
realPools.slice(0, 10).forEach(p => {
  console.log('  ', p.symbol, ' / ', p.project, ' chain=', p.chain, ' apyBase=', (p.apyBase||0).toFixed(2), ' apy=', (p.apy||0).toFixed(2), ' mean30d=', (p.apyMean30d||0).toFixed(2), ' tvl=', p.tvlUsd, ' il=', p.ilRisk);
});

// 9. Yields - incentive
console.log('\nINCENTIVE_YIELD pools (apyReward>0 & !outlier & tvlUsd>=$25M):');
const incPools = (pools.data || []).filter(p => {
  if (p.outlier) return false;
  if (!(p.apyReward && p.apyReward > 0)) return false;
  if ((p.tvlUsd || 0) < 25e6) return false;
  return true;
});
incPools.sort((a, b) => (b.apy || 0) - (a.apy || 0));
console.log(' count_inc:', incPools.length);
incPools.slice(0, 10).forEach(p => {
  console.log('  ', p.symbol, ' / ', p.project, ' chain=', p.chain, ' apy=', (p.apy||0).toFixed(2), ' apyReward=', (p.apyReward||0).toFixed(2), ' apyBase=', (p.apyBase||0).toFixed(2), ' tvl=', p.tvlUsd, ' rewardTokens=', (p.rewardTokens||[]).slice(0,3).join(','));
});

// 10. Chain movers (using change_1d if available; otherwise we'll need historicalChainTvl per-chain)
console.log('\nCHAIN_MOVERS (|chg1d|>=5% & tvl>=$500M):');
const chainMovers = chains.filter(c => c.tvl && c.tvl >= 500e6 && c.change_1d != null && Math.abs(c.change_1d) >= 5);
chainMovers.sort((a, b) => Math.abs(b.change_1d) - Math.abs(a.change_1d));
chainMovers.slice(0, 10).forEach(c => {
  console.log('  ', c.name, ' tvl=', c.tvl, ' chg1d=', c.change_1d, ' chg7d=', c.change_7d);
});
