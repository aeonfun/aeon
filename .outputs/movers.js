#!/usr/bin/env node
const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets.json','utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json','utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd',
  'fdusd','paxg','ethena-usde','ethena-staked-usde','susds','crvusd','frxusd',
  'usual-usd','blackrock-usd-institutional-digital-liquidity-fund','m-by-m0',
  'usds','sky-dollar','resolv-usr','falcon-usd','open-eden-tbill','xaut',
  'tether-gold','ondo-us-dollar-yield','paypal-usd',
  'usdt0','xsolvbtc','solv-protocol-solvbtc','solvbtc-bbn','tether-usdt0',
  'world-liberty-financial-usd','aave-usdc','staked-frax','agora-dollar',
  'eurc'
]);
const WRAPPED_IDS = new Set([
  'wrapped-bitcoin','wrapped-steth','wrapped-eeth','wrapped-beacon-eth',
  'staked-ether','rocket-pool-eth','coinbase-wrapped-btc','lombard-staked-btc',
  'binance-bridged-usdt-bnb-smart-chain','binance-bridged-usdc-bnb-smart-chain',
  'jito-staked-sol','msol','mantle-staked-ether','renzo-restaked-eth',
  'kelp-dao-restaked-eth','ether-fi-staked-eth','swell-restaked-eth',
  'wbeth','weth','bedrock-brbtc','bedrock-bnct','dogecoin-bridged-doge',
  'liquid-staked-ethereum','tbtc','wbnb','wmatic','wrapped-pol',
  'cbeth','sweth','reth','frxeth','sfrxeth','lsETH',
  'mantle-restaked-eth','restaked-swell-eth','wrapped-avax','wrapped-near',
  'wrapped-eth','tether-eurt','rseth','ezeth'
]);

function isStableSym(sym, name){
  const s = (sym||'').toUpperCase();
  const n = (name||'').toLowerCase();
  if (s.startsWith('USD') || s.startsWith('EUR') || s.startsWith('GBP')) return true;
  if (n.includes('stablecoin')) return true;
  if (n.includes('liquid stak') || n.includes('staked ether') || n.includes('wrapped ')) return true;
  return false;
}

let filtered = markets.filter(c => {
  if (!c || c.total_volume == null || c.market_cap == null) return false;
  if (STABLE_IDS.has(c.id)) return false;
  if (WRAPPED_IDS.has(c.id)) return false;
  if (isStableSym(c.symbol, c.name)) return false;
  if (c.total_volume < 1_000_000) return false;
  return true;
});

console.error(`Filtered ${markets.length} -> ${filtered.length}`);

const trendingCoins = (trending.coins||[]).slice(0, 7).map(t => ({
  id: t.item.id,
  name: t.item.name,
  symbol: t.item.symbol,
  rank: t.item.market_cap_rank,
  price_btc: t.item.price_btc,
  data: t.item.data || {}
}));

const trendingIds = new Set(trendingCoins.map(t=>t.id));

function tagFor(c, isWinner, isLoser, inTrending){
  const tags = [];
  const ch24 = c.price_change_percentage_24h ?? 0;
  const ch7d = c.price_change_percentage_7d_in_currency ?? 0;
  const rank = c.market_cap_rank ?? 9999;
  const mcap = c.market_cap ?? 0;
  const volMcRatio = (c.total_volume && c.market_cap) ? c.total_volume / c.market_cap : 0;

  if (inTrending && isWinner && ch24 > 0) tags.push('TRENDING+UP');
  if (inTrending && isLoser && ch24 < 0) tags.push('TRENDING+DOWN');
  if (ch24 > 15 && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d < 0) tags.push('FADE');
  if (ch24 < -10 && volMcRatio > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if (mcap < 50_000_000 && mcap > 0) tags.push('MICROCAP');
  if (rank <= 20) tags.push('MAJOR');

  return tags.slice(0, 2);
}

function fmtPrice(p){
  if (p == null) return '?';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', {maximumFractionDigits:0});
  if (p >= 1) return '$' + p.toFixed(p>=100?1:p>=10?2:3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}
function fmtPct(p){ if (p==null) return '?'; return (p>=0?'+':'') + p.toFixed(1) + '%'; }
function fmtAbbrev(n){
  if (n==null) return '?';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n/1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n/1e6).toFixed(0)  + 'M';
  if (n >= 1e3)  return '$' + (n/1e3).toFixed(0)  + 'K';
  return '$' + n.toFixed(0);
}

const sortedByCh24 = [...filtered].sort((a,b)=> (b.price_change_percentage_24h||0) - (a.price_change_percentage_24h||0));
const winners = sortedByCh24.slice(0, 10);
const losers = [...sortedByCh24].reverse().slice(0, 10);

const top100 = [...filtered].sort((a,b)=> (a.market_cap_rank||9999) - (b.market_cap_rank||9999)).slice(0, 100);
const greenCount = top100.filter(c => (c.price_change_percentage_24h||0) > 0).length;
const top50 = top100.slice(0, 50);
const sortedCh = [...top50].map(c=>c.price_change_percentage_24h||0).sort((a,b)=>a-b);
const median = sortedCh.length ? sortedCh[Math.floor(sortedCh.length/2)] : 0;

const btc = top100.find(c=>c.id==='bitcoin');
const eth = top100.find(c=>c.id==='ethereum');
const sol = top100.find(c=>c.id==='solana');

function describe(c, inTrending){
  const ch24 = c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency;
  const ch1h = c.price_change_percentage_1h_in_currency;
  const isWinner = winners.some(w=>w.id===c.id);
  const isLoser = losers.some(l=>l.id===c.id);
  const tags = tagFor(c, isWinner, isLoser, inTrending);
  return {
    id: c.id, name: c.name, symbol: (c.symbol||'').toUpperCase(),
    rank: c.market_cap_rank, price: c.current_price,
    ch24, ch7d, ch1h, vol: c.total_volume, mcap: c.market_cap, tags
  };
}

const winnerEntries = winners.map(c => describe(c, trendingIds.has(c.id)));
const loserEntries = losers.map(c => describe(c, trendingIds.has(c.id)));
const trendingEntries = trendingCoins.map(t => {
  const m = filtered.find(c=>c.id===t.id) || markets.find(c=>c.id===t.id);
  if (m) return describe(m, true);
  return { id:t.id, name:t.name, symbol:(t.symbol||'').toUpperCase(),
           rank:t.rank, price: t.data.price ? Number(t.data.price) : null,
           ch24: t.data.price_change_percentage_24h?.usd ?? null, ch7d:null, ch1h:null,
           vol: t.data.total_volume ? Number(String(t.data.total_volume).replace(/[$,]/g,'')) : null,
           mcap: t.data.market_cap ? Number(String(t.data.market_cap).replace(/[$,]/g,'')) : null, tags: [] };
});

const out = {
  pulse: {
    greenOf100: greenCount, total100: top100.length,
    median24: median,
    btc: btc ? { price:btc.current_price, ch24:btc.price_change_percentage_24h, ch7d:btc.price_change_percentage_7d_in_currency } : null,
    eth: eth ? { price:eth.current_price, ch24:eth.price_change_percentage_24h, ch7d:eth.price_change_percentage_7d_in_currency } : null,
    sol: sol ? { price:sol.current_price, ch24:sol.price_change_percentage_24h, ch7d:sol.price_change_percentage_7d_in_currency } : null,
  },
  winners: winnerEntries,
  losers: loserEntries,
  trending: trendingEntries
};
fs.writeFileSync('.outputs/movers.json', JSON.stringify(out, null, 2));

function fmtRow(e){
  const tagStr = e.tags.length ? '  [' + e.tags.join(',') + ']' : '';
  return `${e.symbol} (${e.name}) — ${fmtPrice(e.price)}  ${fmtPct(e.ch24)} / 7d ${fmtPct(e.ch7d)} / 1h ${fmtPct(e.ch1h)}  •  ${fmtAbbrev(e.vol)} / #${e.rank ?? '?'}${tagStr}`;
}
function fmtTrend(e){
  const tagStr = e.tags.length ? '  [' + e.tags.join(',') + ']' : '';
  return `${e.name} (${e.symbol}) — #${e.rank ?? '?'}, ${fmtPrice(e.price)}, 24h ${fmtPct(e.ch24)}${tagStr}`;
}

console.log('=== PULSE ===');
console.log(`green/100: ${greenCount}, median 24h: ${median.toFixed(2)}%`);
if (btc) console.log(`BTC ${fmtPrice(btc.current_price)} ${fmtPct(btc.price_change_percentage_24h)} / 7d ${fmtPct(btc.price_change_percentage_7d_in_currency)}`);
if (eth) console.log(`ETH ${fmtPrice(eth.current_price)} ${fmtPct(eth.price_change_percentage_24h)} / 7d ${fmtPct(eth.price_change_percentage_7d_in_currency)}`);
if (sol) console.log(`SOL ${fmtPrice(sol.current_price)} ${fmtPct(sol.price_change_percentage_24h)} / 7d ${fmtPct(sol.price_change_percentage_7d_in_currency)}`);

console.log('\n=== WINNERS ===');
winnerEntries.forEach((e,i) => console.log(`${i+1}. ${fmtRow(e)}`));
console.log('\n=== LOSERS ===');
loserEntries.forEach((e,i) => console.log(`${i+1}. ${fmtRow(e)}`));
console.log('\n=== TRENDING ===');
trendingEntries.forEach((e,i) => console.log(`${i+1}. ${fmtTrend(e)}`));
