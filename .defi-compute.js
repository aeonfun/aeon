const fs = require('fs');

// Chains
const chains = JSON.parse(fs.readFileSync('.chains.json'));
const totalTvl = chains.reduce((s,c)=>s+(c.tvl||0),0);
console.log(`TVL_TOTAL: $${(totalTvl/1e9).toFixed(2)}B`);
const chainsSorted = [...chains].sort((a,b)=>(b.tvl||0)-(a.tvl||0));
console.log("Top 10 chains:");
chainsSorted.slice(0,10).forEach(c=>console.log(`  ${c.name}: $${((c.tvl||0)/1e9).toFixed(2)}B 1d=${c.change_1d}% 7d=${c.change_7d}%`));

const sumW = chains.reduce((s,c)=>s+(c.tvl||0)*(c.change_1d||0)/100,0);
const tvlD = totalTvl ? sumW/totalTvl*100 : 0;
console.log(`TVL_1D_PCT: ${tvlD.toFixed(2)}%`);
const sumW7 = chains.reduce((s,c)=>s+(c.tvl||0)*(c.change_7d||0)/100,0);
const tvl7D = totalTvl ? sumW7/totalTvl*100 : 0;
console.log(`TVL_7D_PCT: ${tvl7D.toFixed(2)}%`);

console.log("");
console.log("=== Chain Movers (|1d|>=5%, tvl>=$500M) ===");
const movers = chains.filter(c=>(c.tvl||0)>=500e6 && Math.abs(c.change_1d||0)>=5);
console.log("UP:");
[...movers].sort((a,b)=>(b.change_1d||0)-(a.change_1d||0)).slice(0,5).forEach(c=>console.log(`  ${c.name}: $${((c.tvl||0)/1e9).toFixed(2)}B 1d=${c.change_1d}% 7d=${c.change_7d}%`));
console.log("DOWN:");
[...movers].sort((a,b)=>(a.change_1d||0)-(b.change_1d||0)).slice(0,5).forEach(c=>console.log(`  ${c.name}: $${((c.tvl||0)/1e9).toFixed(2)}B 1d=${c.change_1d}% 7d=${c.change_7d}%`));

// Protocols
console.log("");
const prots = JSON.parse(fs.readFileSync('.protocols.json'));
console.log(`PROTOCOLS_COUNT: ${prots.length}`);
const mp = prots.filter(p=>(p.tvl||0)>=100e6 && Math.abs(p.change_1d||0)>=10);
console.log("Protocol movers (|1d|>=10%, tvl>=$100M, top 12):");
mp.sort((a,b)=>Math.abs(b.change_1d||0)-Math.abs(a.change_1d||0)).slice(0,12).forEach(p=>{
  console.log(`  ${p.name} (${p.category}/${p.chain}): $${((p.tvl||0)/1e9).toFixed(3)}B 1d=${p.change_1d}% 7d=${p.change_7d}%`);
});

// Fees
console.log("");
const fees = JSON.parse(fs.readFileSync('.fees.json'));
console.log(`FEES_TOTAL_24H: $${(fees.total24h/1e6).toFixed(1)}M  total7d=$${(fees.total7d/1e6).toFixed(1)}M  c1d=${fees.change_1d}%  c7d=${fees.change_7d}%`);
const fps = fees.protocols||[];
const fpsSorted = [...fps].sort((a,b)=>(b.total24h||0)-(a.total24h||0));
console.log("Top 10 fees protocols (24h):");
fpsSorted.slice(0,10).forEach(p=>{
  const t24 = p.total24h||0, t7 = p.total7d||0, avg = t7?t7/7:0;
  const delta = avg ? (t24-avg)/avg*100 : 0;
  console.log(`  ${p.name}: 24h=$${(t24/1e6).toFixed(2)}M 7d=$${(t7/1e6).toFixed(1)}M  vs7d_avg=${delta>=0?'+':''}${delta.toFixed(1)}%  c1d=${p.change_1d}%  c7d=${p.change_7d}%`);
});

console.log("");
console.log("=== Fees beating TVL ===");
const protByName = Object.fromEntries(prots.map(p=>[p.name,p]));
const cands = [];
for (const fp of fps) {
  const pp = protByName[fp.name];
  if (!pp) continue;
  const fc7 = fp.change_7d, tc7 = pp.change_7d;
  if (fc7==null || tc7==null) continue;
  if (fc7>20 && tc7<5 && (fp.total24h||0)>=1e6) {
    cands.push({n:fp.name, fc7, tc7, t24:fp.total24h, tvl:pp.tvl});
  }
}
cands.sort((a,b)=>b.fc7-a.fc7).slice(0,10).forEach(c=>{
  console.log(`  ${c.n}: fees_7d=${c.fc7>=0?'+':''}${c.fc7.toFixed(1)}% / tvl_7d=${c.tc7>=0?'+':''}${c.tc7.toFixed(1)}% / 24h_fees=$${(c.t24/1e6).toFixed(2)}M / tvl=$${(c.tvl/1e9).toFixed(2)}B`);
});

// DEX vols
console.log("");
const dexs = JSON.parse(fs.readFileSync('.dexs.json'));
console.log(`DEX_TOTAL_24H: $${(dexs.total24h/1e9).toFixed(2)}B  c1d=${dexs.change_1d}%  c7d=${dexs.change_7d}%`);
const dps = dexs.protocols||[];
[...dps].sort((a,b)=>(b.total24h||0)-(a.total24h||0)).slice(0,6).forEach(p=>{
  console.log(`  ${p.name}: $${((p.total24h||0)/1e9).toFixed(2)}B  c1d=${p.change_1d}%  c7d=${p.change_7d}%`);
});

// Stables
console.log("");
const stables = JSON.parse(fs.readFileSync('.stables.json'));
const peggs = stables.peggedAssets||[];
let totalSupply=0, totalPrev=0, totalPrevW=0;
for (const s of peggs) {
  totalSupply += (s.circulating?.peggedUSD)||0;
  totalPrev += (s.circulatingPrevDay?.peggedUSD)||0;
  totalPrevW += (s.circulatingPrevWeek?.peggedUSD)||0;
}
const stableD = totalPrev? (totalSupply-totalPrev)/totalPrev*100 : 0;
const stableW = totalPrevW? (totalSupply-totalPrevW)/totalPrevW*100 : 0;
console.log(`STABLES_TOTAL: $${(totalSupply/1e9).toFixed(1)}B  1d=${stableD>=0?'+':''}${stableD.toFixed(2)}%  7d=${stableW>=0?'+':''}${stableW.toFixed(2)}%`);

console.log("Top stables by 1d (|1d|>=1%, supply>=$500M):");
const sm = [];
for (const s of peggs) {
  const cc = (s.circulating?.peggedUSD)||0;
  const cp = (s.circulatingPrevDay?.peggedUSD)||0;
  if (cc < 500e6 || !cp) continue;
  const pct = (cc-cp)/cp*100;
  if (Math.abs(pct)>=1) sm.push({sym:s.symbol, cc, pct});
}
sm.sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).slice(0,10).forEach(m=>console.log(`  ${m.sym}: $${(m.cc/1e9).toFixed(2)}B  1d=${m.pct>=0?'+':''}${m.pct.toFixed(2)}%`));

// Yields
console.log("");
const pools = JSON.parse(fs.readFileSync('.pools.json')).data;
console.log(`POOLS_TOTAL: ${pools.length}`);

// Real yield
const real = [];
for (const p of pools) {
  if (p.outlier) continue;
  if ((p.apyBase||0)<=0) continue;
  const apy = p.apy||0, apyR = p.apyReward||0;
  if (apy && (apyR/apy)>=0.5) continue;
  if ((p.predictions?.binnedConfidence||0)<2) continue;
  if ((p.apyMean30d||0)<apy*0.5) continue;
  if ((p.tvlUsd||0)<10e6) continue;
  real.push(p);
}
real.sort((a,b)=>(b.apyBase||0)-(a.apyBase||0));
console.log("Real yield top 12:");
real.slice(0,12).forEach(p=>console.log(`  ${p.symbol} (${p.project}/${p.chain}): apyBase=${p.apyBase.toFixed(2)}% apyReward=${p.apyReward} apy=${p.apy} apyMean30d=${p.apyMean30d} tvl=$${((p.tvlUsd||0)/1e6).toFixed(0)}M bc=${p.predictions?.binnedConfidence}`));

console.log("");
const inc = [];
for (const p of pools) {
  if (p.outlier) continue;
  if ((p.apyReward||0)<=0) continue;
  if ((p.tvlUsd||0)<25e6) continue;
  inc.push(p);
}
inc.sort((a,b)=>(b.apy||0)-(a.apy||0));
console.log("Incentive yield top 10:");
inc.slice(0,10).forEach(p=>console.log(`  ${p.symbol} (${p.project}/${p.chain}): apy=${(p.apy||0).toFixed(1)}% apyReward=${(p.apyReward||0).toFixed(1)}% tvl=$${((p.tvlUsd||0)/1e6).toFixed(0)}M rewards=${(p.rewardTokens||[]).length}`));
