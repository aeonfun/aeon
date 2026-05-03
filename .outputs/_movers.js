const fs = require("fs");
const data = JSON.parse(fs.readFileSync("/home/runner/work/aeon/aeon/.outputs/cg-markets-2.json"));
const trending = JSON.parse(fs.readFileSync("/home/runner/work/aeon/aeon/.outputs/cg-trending-2.json"));

const STABLES = new Set(["tether","usd-coin","dai","first-digital-usd","usde","tusd","usdd","pyusd","fdusd","paxg","usds","usdt","usdc","staked-ether","wrapped-bitcoin","wrapped-steth","wrapped-eth"]);
const WRAP_SYM = new Set(["wbtc","weth","steth","cbeth","wsteth","wbeth","reth"]);

function isStable(c){
  const sym = (c.symbol||"").toUpperCase();
  const name = (c.name||"").toLowerCase();
  const id = (c.id||"").toLowerCase();
  if (STABLES.has(id)) return true;
  if (sym.startsWith("USD")||sym.startsWith("EUR")||sym.startsWith("GBP")) return true;
  if (name.includes("stablecoin")) return true;
  return false;
}
function isWrapped(c){
  const name = (c.name||"").toLowerCase();
  const sym = (c.symbol||"").toLowerCase();
  if (name.startsWith("wrapped")||name.startsWith("staked")) return true;
  if (WRAP_SYM.has(sym)) return true;
  return false;
}

const filtered = data.filter(c=>!isStable(c)&&!isWrapped(c)&&(c.total_volume||0)>=1e6 && c.price_change_percentage_24h!=null);
const top100 = filtered.slice(0,100);
const green = top100.filter(c=>(c.price_change_percentage_24h||0)>0).length;
const top50 = filtered.slice(0,50).map(c=>c.price_change_percentage_24h||0).sort((a,b)=>a-b);
const median = top50[Math.floor(top50.length/2)] || 0;

function findSym(s){return data.find(c=>(c.symbol||"").toLowerCase()===s.toLowerCase());}
const btc=findSym("BTC"), eth=findSym("ETH"), sol=findSym("SOL");
function fnum(n){return n>=1?n.toLocaleString("en-US",{maximumFractionDigits:0}):n.toFixed(2);}

console.log(`PULSE: ${green}/100 green, top50 median=${median.toFixed(1)}%; BTC $${fnum(btc.current_price)} ${btc.price_change_percentage_24h.toFixed(1)}%, ETH $${fnum(eth.current_price)} ${eth.price_change_percentage_24h.toFixed(1)}%, SOL $${fnum(sol.current_price)} ${sol.price_change_percentage_24h.toFixed(1)}%`);

const trendingSyms = new Set();
const trendingItems = (trending.coins||[]).slice(0,7).map(tc=>tc.item||{});
trendingItems.forEach(it=>trendingSyms.add((it.symbol||"").toUpperCase()));

function tags(c){
  const t=[];
  const rank=c.market_cap_rank||9999;
  const p24=c.price_change_percentage_24h||0;
  const p7=c.price_change_percentage_7d_in_currency||0;
  const vol=c.total_volume||0;
  const mc=c.market_cap||1;
  const sym=(c.symbol||"").toUpperCase();
  const isTrend=trendingSyms.has(sym);
  if (isTrend && p24>0) t.push("TRENDING+UP");
  if (isTrend && p24<-3) t.push("TRENDING+DOWN");
  if (p24>15 && p7>25 && !t.includes("TRENDING+UP")) t.push("BREAKOUT");
  if (p24>20 && p7<0) t.push("FADE");
  if (p24<-10 && (vol/mc)>0.25) t.push("CAPITULATION");
  if (rank>150 && p24>30) t.push("PUMP-RISK");
  if (mc<5e7) t.push("MICROCAP");
  if (rank<=20) t.push("MAJOR");
  return t.slice(0,2);
}

function fmt(c){
  const sym=(c.symbol||"").toUpperCase();
  const name=c.name||"";
  const p=c.current_price||0;
  let ps;
  if (p<0.01) ps=`$${p.toFixed(6)}`;
  else if (p<1) ps=`$${p.toFixed(4)}`;
  else ps=`$${p.toLocaleString("en-US",{maximumSignificantDigits:4})}`;
  const p24=c.price_change_percentage_24h||0;
  const p7=c.price_change_percentage_7d_in_currency||0;
  const p1=c.price_change_percentage_1h_in_currency||0;
  const mc=c.market_cap||0;
  const rank=c.market_cap_rank||"?";
  let mcs;
  if (mc>=1e9) mcs=`$${(mc/1e9).toFixed(1)}B`;
  else if (mc>=1e6) mcs=`$${(mc/1e6).toFixed(0)}M`;
  else mcs=`$${(mc/1e3).toFixed(0)}K`;
  const tg=tags(c);
  const tgstr=tg.length?` [${tg.join(",")}]`:"";
  return `${sym} (${name}) ${ps} ${p24>=0?"+":""}${p24.toFixed(1)}% / 7d ${p7>=0?"+":""}${p7.toFixed(0)}% / 1h ${p1>=0?"+":""}${p1.toFixed(1)}% • ${mcs} #${rank}${tgstr}`;
}

const winners=[...filtered].sort((a,b)=>(b.price_change_percentage_24h||0)-(a.price_change_percentage_24h||0)).slice(0,10);
const losers=[...filtered].sort((a,b)=>(a.price_change_percentage_24h||0)-(b.price_change_percentage_24h||0)).slice(0,10);

console.log("\nWINNERS:");
winners.forEach(c=>console.log(fmt(c)));
console.log("\nLOSERS:");
losers.forEach(c=>console.log(fmt(c)));
console.log("\nTRENDING:");
trendingItems.forEach(it=>{
  const sym=(it.symbol||"").toUpperCase();
  const name=it.name||"";
  const rank=it.market_cap_rank||"?";
  const p24=(it.data||{}).price_change_percentage_24h?.usd;
  const pchg = p24!=null?`${p24>=0?"+":""}${p24.toFixed(1)}%`:"n/a";
  console.log(`${sym} (${name}) #${rank} 24h ${pchg}`);
});
