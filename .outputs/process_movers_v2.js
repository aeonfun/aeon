#!/usr/bin/env node
// Token movers processor — 2026-05-03
const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json', 'utf8'));

const STABLES = new Set([
  'tether','usd-coin','dai','first-digital-usd','ethena-usde','true-usd','usdd',
  'paypal-usd','frax','liquity-usd','crvusd','gho','usdj','susd','tusd','fdusd',
  'pyusd','usde','paxg','pax-gold','tether-gold','xaut','digital-gold-token',
  'binance-bridged-usdt-bnb-smart-chain','bridged-usdc-polygon-pos-bridge',
  'bridged-usdc-polygon-pos-bridge-by-axelar','usdb','blast-usd','staked-frax',
  'sfrx-eth','staked-frax-ether'
]);
const WRAPPED = new Set([
  'wrapped-bitcoin','weth','staked-ether','wrapped-steth','rocket-pool-eth',
  'wrapped-eeth','coinbase-wrapped-btc','liquid-staked-ether','wbeth',
  'wrapped-beacon-eth','jito-staked-sol','msol','tbtc','wrapped-solana','wsteth',
  'binance-bridged-wbeth-bnb-smart-chain','bnsol','solv-protocol-solvbtc',
  'solv-protocol-solvbtc-bbn','wrapped-bera','wrapped-hype','jupiter-staked-sol',
  'kelp-dao-restaked-eth','renzo-restaked-eth','etherfi-staked-eth','rocket-pool',
  'wrapped-bnb','renzo','jito','sky','swell-restaked-eth','lido-staked-ether'
]);

function isStablecoinLike(c) {
  if (STABLES.has(c.id)) return true;
  const sym = (c.symbol||'').toUpperCase();
  if (/^USD/.test(sym) || /^EUR/.test(sym) || /^GBP/.test(sym)) return true;
  const name = (c.name||'').toLowerCase();
  if (name.includes('stablecoin') || name.includes('usd ') || name.endsWith(' usd')) return true;
  // Also drop near-pegged stables by behavior: |1h|<0.5 AND |24h|<0.5 AND price within 0.99-1.01
  const p = c.current_price||0;
  const c24 = c.price_change_percentage_24h_in_currency||0;
  const c1h = c.price_change_percentage_1h_in_currency||0;
  if (p>0.98 && p<1.02 && Math.abs(c24)<0.5 && Math.abs(c1h)<0.3) return true;
  return false;
}

function isWrapped(c) { return WRAPPED.has(c.id); }

const filtered = markets.filter(c => {
  if (isStablecoinLike(c)) return false;
  if (isWrapped(c)) return false;
  if ((c.total_volume||0) < 1_000_000) return false;
  if (c.price_change_percentage_24h_in_currency == null) return false;
  return true;
});

console.error(`Filter: ${markets.length} -> ${filtered.length}`);

const sorted24 = [...filtered].sort((a,b) => (b.price_change_percentage_24h_in_currency||0) - (a.price_change_percentage_24h_in_currency||0));
const winners = sorted24.slice(0,10);
const losers = [...sorted24].reverse().slice(0,10);

const trendCoins = (trending.coins||[]).slice(0,7).map(t => t.item);

function fmtPrice(p){
  if (p>=10) return '$' + p.toLocaleString('en-US',{maximumFractionDigits:0});
  if (p>=1) return '$' + p.toFixed(2);
  if (p>=0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}
function fmtBig(n){
  if (n>=1e12) return '$' + (n/1e12).toFixed(2)+'T';
  if (n>=1e9) return '$' + (n/1e9).toFixed(2)+'B';
  if (n>=1e6) return '$' + (n/1e6).toFixed(1)+'M';
  if (n>=1e3) return '$' + (n/1e3).toFixed(0)+'k';
  return '$' + n.toFixed(0);
}
function pct(x){ if (x==null) return 'n/a'; const v = x.toFixed(1); return (x>=0?'+':'') + v + '%'; }

const trendingSet = new Set(trendCoins.map(t=>t.id));
const trendingSym = new Set(trendCoins.map(t=>(t.symbol||'').toUpperCase()));

function tagsFor(c, list){
  const t = [];
  const c24 = c.price_change_percentage_24h_in_currency || 0;
  const c7d = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank || 999;
  const mcap = c.market_cap || 0;
  const vol = c.total_volume || 0;
  const inTrend = trendingSet.has(c.id) || trendingSym.has((c.symbol||'').toUpperCase());

  if (inTrend && list==='winner') t.push('TRENDING+UP');
  if (inTrend && list==='loser') t.push('TRENDING+DOWN');
  if (c24 > 15 && c7d > 25) t.push('BREAKOUT');
  if (c24 > 20 && c7d < 0) t.push('FADE');
  if (c24 < -10 && (vol/Math.max(mcap,1)) > 0.25) t.push('CAPITULATION');
  if (rank > 150 && c24 > 30) t.push('PUMP-RISK');
  if (mcap > 0 && mcap < 50_000_000) t.push('MICROCAP');
  if (rank > 0 && rank <= 20) t.push('MAJOR');
  return t.slice(0,2);
}

function tagsForTrending(c){
  const t = [];
  const c24 = c.data?.price_change_percentage_24h?.usd ?? 0;
  const rank = c.market_cap_rank || 999;
  if (rank > 0 && rank <= 20) t.push('MAJOR');
  if (c24 > 15) t.push('UP-MOVE');
  if (c24 < -10) t.push('CAPITULATION');
  if (rank > 150 && c24 > 30) t.push('PUMP-RISK');
  return t.slice(0,2);
}

// Market pulse
const top100 = filtered.slice(0,100);
const top50 = filtered.slice(0,50);
const greenT100 = top100.filter(c => (c.price_change_percentage_24h_in_currency||0)>0).length;
const med = (arr) => {
  const v = arr.map(c => c.price_change_percentage_24h_in_currency||0).sort((a,b)=>a-b);
  const n = v.length; return n? (n%2? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2) : 0;
};
const med100 = med(top100);
const med50 = med(top50);

const btc = filtered.find(c => c.id==='bitcoin');
const eth = filtered.find(c => c.id==='ethereum');
const sol = filtered.find(c => c.id==='solana');

console.error(`Pulse: ${greenT100}/100 green, med100 ${med100.toFixed(2)}%, med50 ${med50.toFixed(2)}%`);
console.error(`BTC ${btc?.current_price} ${(btc?.price_change_percentage_24h_in_currency||0).toFixed(2)}%`);
console.error(`ETH ${eth?.current_price} ${(eth?.price_change_percentage_24h_in_currency||0).toFixed(2)}%`);
console.error(`SOL ${sol?.current_price} ${(sol?.price_change_percentage_24h_in_currency||0).toFixed(2)}%`);

function rowFor(c, list){
  const sym = (c.symbol||'').toUpperCase();
  const t = tagsFor(c, list);
  const tag = t.length ? ' [' + t.join(',') + ']' : '';
  const c24 = c.price_change_percentage_24h_in_currency;
  const c7d = c.price_change_percentage_7d_in_currency;
  const c1h = c.price_change_percentage_1h_in_currency;
  return {
    sym, name: c.name, price: fmtPrice(c.current_price),
    c24: pct(c24), c7d: pct(c7d), c1h: pct(c1h),
    vol: fmtBig(c.total_volume||0), rank: c.market_cap_rank||'-',
    mcap: fmtBig(c.market_cap||0), tags: t, tag,
    raw_c24: c24, raw_c7d: c7d
  };
}

const winnerRows = winners.map(c => rowFor(c, 'winner'));
const loserRows = losers.map(c => rowFor(c, 'loser'));
const trendRows = trendCoins.map(t => {
  const fullCoin = markets.find(m => m.id===t.id);
  let c24 = t.data?.price_change_percentage_24h?.usd ?? null;
  if (c24 == null && fullCoin) c24 = fullCoin.price_change_percentage_24h_in_currency;
  const price = t.data?.price ?? fullCoin?.current_price;
  const tags = tagsForTrending({...t, data: t.data || {price_change_percentage_24h: {usd:c24}}});
  // also flag direction matches
  if (winners.some(w => w.id===t.id)) tags.unshift('TRENDING+UP');
  if (losers.some(l => l.id===t.id)) tags.unshift('TRENDING+DOWN');
  const uniqTags = [...new Set(tags)].slice(0,2);
  return {
    sym: (t.symbol||'').toUpperCase(),
    name: t.name,
    rank: t.market_cap_rank || '-',
    price: price!=null ? fmtPrice(price) : 'n/a',
    c24: c24!=null ? pct(c24) : 'n/a',
    tags: uniqTags,
    tag: uniqTags.length ? ' [' + uniqTags.join(',') + ']' : ''
  };
});

const result = {
  pulse: { greenT100, med100, med50, btc: btc?.current_price, btc24: btc?.price_change_percentage_24h_in_currency, eth: eth?.current_price, eth24: eth?.price_change_percentage_24h_in_currency, sol: sol?.current_price, sol24: sol?.price_change_percentage_24h_in_currency },
  winners: winnerRows, losers: loserRows, trending: trendRows
};
fs.writeFileSync('.outputs/movers-0503.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
