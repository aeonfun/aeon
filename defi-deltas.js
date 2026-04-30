#!/usr/bin/env node
const fs = require('fs');

function lastN(arr, n) { return arr.slice(-n); }

function pctChange(cur, prior) {
  if (!prior) return null;
  return ((cur - prior) / prior) * 100;
}

function loadHist(p) {
  if (!fs.existsSync(p)) return null;
  const txt = fs.readFileSync(p, 'utf8');
  if (!txt || txt[0] === '<') return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

// 1. Global TVL series
const g = loadHist('hist_global.json');
if (!g) { console.error('global hist missing'); process.exit(1); }
const last = g[g.length - 1];
const prev1 = g[g.length - 2];
const prev7 = g[g.length - 8];
console.log('GLOBAL_HIST tail:');
g.slice(-9).forEach(p => {
  const d = new Date(p.date * 1000).toISOString().slice(0, 10);
  console.log('  ', d, ' tvl=', p.tvl);
});
const tvlD1 = pctChange(last.tvl, prev1.tvl);
const tvlD7 = pctChange(last.tvl, prev7.tvl);
console.log('TVL_LAST:', last.tvl, '  d1:', tvlD1.toFixed(2), '  d7:', tvlD7.toFixed(2));

// 2. Per-chain series for top 20
const chainList = [
  'Ethereum','BSC','Solana','Bitcoin','Tron','Base','Arbitrum','Provenance',
  'Hyperliquid_L1','Polygon','Avalanche','Aptos','Plume','OP_Mainnet','Sui','Cronos','Sei','Sonic','Plasma','Linea'
];
const chainNames = {
  'Hyperliquid_L1': 'Hyperliquid L1',
  'OP_Mainnet': 'OP Mainnet'
};
const chainData = [];
for (const fn of chainList) {
  const data = loadHist('hist_' + fn + '.json');
  if (!data || !data.length) {
    console.log('SKIP', fn, '(no data)');
    continue;
  }
  const cur = data[data.length - 1];
  const p1 = data[data.length - 2];
  const p7 = data[data.length - 8] || p1;
  const d1 = pctChange(cur.tvl, p1.tvl);
  const d7 = pctChange(cur.tvl, p7.tvl);
  chainData.push({
    name: chainNames[fn] || fn,
    tvl: cur.tvl,
    tvlPrev: p1.tvl,
    d1, d7
  });
}
chainData.sort((a, b) => b.tvl - a.tvl);
console.log('\nCHAIN_DELTAS:');
chainData.forEach(c => {
  console.log('  ', c.name, ' tvl=', c.tvl.toFixed(0), ' prev1d=', c.tvlPrev.toFixed(0), ' d1%=', c.d1?.toFixed(2), ' d7%=', c.d7?.toFixed(2));
});

// 3. Movers gate
console.log('\nCHAIN_MOVERS (|d1|>=5% & tvl>=$500M):');
const movers = chainData.filter(c => c.tvl >= 500e6 && Math.abs(c.d1 || 0) >= 5);
movers.sort((a, b) => Math.abs(b.d1) - Math.abs(a.d1));
movers.forEach(c => {
  console.log('  ', c.name, ' tvl=', c.tvl.toFixed(0), ' d1=', c.d1.toFixed(2), ' d7=', c.d7.toFixed(2));
});

// 4. Aggregate top 20 weighted
const top20Tvl = chainData.reduce((a, c) => a + c.tvl, 0);
const top20PrevTvl = chainData.reduce((a, c) => a + c.tvlPrev, 0);
const aggD1 = pctChange(top20Tvl, top20PrevTvl);
console.log('\nTOP20_WEIGHTED  cur=', top20Tvl.toFixed(0), ' prev=', top20PrevTvl.toFixed(0), ' d1%=', aggD1.toFixed(3));
