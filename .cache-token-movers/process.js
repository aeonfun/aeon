const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.cache-token-movers/markets.json'));
const trending = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.cache-token-movers/trending.json'));

const STABLES = new Set(['tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg','frax','lusd','crvusd','susd','usdp','gusd','usdy','usdb','usds','ethena-usde','sky-dollar','ondo-us-dollar-yield','susds','rai','mim','mkusd','dola','susde']);

function isStable(c) {
  if (STABLES.has(c.id)) return true;
  const sym = (c.symbol || '').toUpperCase();
  const name = (c.name || '').toLowerCase();
  if (sym.startsWith('USD') || sym.startsWith('EUR') || sym.startsWith('GBP')) return true;
  if (name.includes('stablecoin') || name.includes('us dollar')) return true;
  return false;
}

const WRAPPED_DUPES = new Set(['wrapped-bitcoin','wrapped-steth','staked-ether','weth','wrapped-eeth','rocket-pool-eth','coinbase-wrapped-staked-eth','wrapped-eth','wrapped-bitcoin-bsc','binance-bridged-wbtc-bnb-smart-chain','bitcoin-avalanche-bridged-btc-b','solv-protocol-solvbtc','solv-protocol-solvbtcbnb','lombard-staked-btc','msol','jito-staked-sol','wbnb','liquid-staked-ethereum','wsteth']);

const filtered = markets.filter(c => {
  if (isStable(c)) return false;
  if (WRAPPED_DUPES.has(c.id)) return false;
  if (!c.total_volume || c.total_volume < 1000000) return false;
  if (typeof c.price_change_percentage_24h !== 'number') return false;
  return true;
});

console.log('Filtered count:', filtered.length);

const winners = [...filtered].sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 12);
const losers = [...filtered].sort((a,b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 12);

const trendingCoins = trending.coins.slice(0, 7).map(c => ({
  id: c.item.id,
  symbol: c.item.symbol,
  name: c.item.name,
  rank: c.item.market_cap_rank,
  price_btc: c.item.price_btc,
  data: c.item.data
}));

const trendingIds = new Set(trendingCoins.map(t => t.id));

function tagsFor(c, isWinner) {
  const tags = [];
  const ch24 = c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency;
  const vol = c.total_volume;
  const mcap = c.market_cap;
  const rank = c.market_cap_rank;
  const volMcap = mcap ? vol / mcap : 0;

  if (trendingIds.has(c.id) && ch24 > 5) tags.push('TRENDING+UP');
  if (trendingIds.has(c.id) && ch24 < -5) tags.push('TRENDING+DOWN');
  if (ch24 > 15 && ch7d != null && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d != null && ch7d < 0) tags.push('FADE');
  if (ch24 < -10 && volMcap > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if (mcap < 50000000) tags.push('MICROCAP');
  if (rank && rank <= 20) tags.push('MAJOR');
  return tags.slice(0, 2);
}

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p >= 100) return '$' + p.toFixed(2);
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toPrecision(4);
}
function fmtMoney(v) {
  if (v == null) return 'n/a';
  if (v >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v/1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v/1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}
function fmtPct(p) {
  if (p == null) return 'n/a';
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

function fmtLine(idx, c) {
  const tags = tagsFor(c);
  const tagStr = tags.length ? '  [' + tags.join('][') + ']' : '';
  return idx + '. ' + c.symbol.toUpperCase() + ' (' + c.name + ') — ' + fmtPrice(c.current_price) + '  ' + fmtPct(c.price_change_percentage_24h) + ' / 7d ' + fmtPct(c.price_change_percentage_7d_in_currency) + ' / 1h ' + fmtPct(c.price_change_percentage_1h_in_currency) + '  •  ' + fmtMoney(c.total_volume) + ' / #' + c.market_cap_rank + tagStr;
}

const top100 = markets.filter(c => !isStable(c) && !WRAPPED_DUPES.has(c.id)).slice(0, 100);
const greenCount = top100.filter(c => c.price_change_percentage_24h > 0).length;
const top50 = top100.slice(0, 50);
const sorted50 = [...top50].map(c => c.price_change_percentage_24h).filter(v => typeof v === 'number').sort((a,b)=>a-b);
const median50 = sorted50.length ? sorted50[Math.floor(sorted50.length/2)] : 0;

// Sample some majors
const btc = markets.find(m => m.id === 'bitcoin');
const eth = markets.find(m => m.id === 'ethereum');
const sol = markets.find(m => m.id === 'solana');

const out = {
  filteredCount: filtered.length,
  winners: winners.map((c,i) => ({line: fmtLine(i+1, c), tags: tagsFor(c), data: {id: c.id, sym: c.symbol, name: c.name, ch24: c.price_change_percentage_24h, ch7d: c.price_change_percentage_7d_in_currency, ch1h: c.price_change_percentage_1h_in_currency, vol: c.total_volume, mcap: c.market_cap, rank: c.market_cap_rank, price: c.current_price}})),
  losers: losers.map((c,i) => ({line: fmtLine(i+1, c), tags: tagsFor(c), data: {id: c.id, sym: c.symbol, name: c.name, ch24: c.price_change_percentage_24h, ch7d: c.price_change_percentage_7d_in_currency, ch1h: c.price_change_percentage_1h_in_currency, vol: c.total_volume, mcap: c.market_cap, rank: c.market_cap_rank, price: c.current_price}})),
  trending: trendingCoins,
  greenCount,
  median50,
  top100Count: top100.length,
  majors: {
    btc: btc ? {price: btc.current_price, ch24: btc.price_change_percentage_24h, ch7d: btc.price_change_percentage_7d_in_currency} : null,
    eth: eth ? {price: eth.current_price, ch24: eth.price_change_percentage_24h, ch7d: eth.price_change_percentage_7d_in_currency} : null,
    sol: sol ? {price: sol.current_price, ch24: sol.price_change_percentage_24h, ch7d: sol.price_change_percentage_7d_in_currency} : null
  }
};

fs.writeFileSync('/home/runner/work/aeon/aeon/.cache-token-movers/processed.json', JSON.stringify(out, null, 2));

console.log('\nWINNERS');
out.winners.forEach(w => console.log(w.line));
console.log('\nLOSERS');
out.losers.forEach(l => console.log(l.line));
console.log('\nTRENDING');
trendingCoins.forEach((t,i) => {
  const fullCoin = markets.find(m => m.id === t.id);
  const ch24 = fullCoin ? fullCoin.price_change_percentage_24h : (t.data ? (t.data.price_change_percentage_24h ? t.data.price_change_percentage_24h.usd : null) : null);
  const price = fullCoin ? fullCoin.current_price : (t.data ? t.data.price : null);
  const rank = fullCoin ? fullCoin.market_cap_rank : t.rank;
  const tags = [];
  if (rank && rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if (fullCoin && fullCoin.market_cap < 50000000) tags.push('MICROCAP');
  if (rank && rank <= 20) tags.push('MAJOR');
  if (ch24 > 5) tags.push('TRENDING+UP');
  if (ch24 < -5) tags.push('TRENDING+DOWN');
  const tagStr = tags.length ? '  [' + tags.slice(0,2).join('][') + ']' : '';
  console.log((i+1) + '. ' + t.name + ' (' + t.symbol.toUpperCase() + ') — #' + rank + ', ' + fmtPrice(price) + ', 24h ' + fmtPct(ch24) + tagStr);
});
console.log('\nPULSE');
console.log('Top100 green: ' + greenCount + '/100, median(top50) 24h: ' + median50.toFixed(2) + '%');
console.log('BTC ' + fmtPct(out.majors.btc.ch24) + ' / 7d ' + fmtPct(out.majors.btc.ch7d));
console.log('ETH ' + fmtPct(out.majors.eth.ch24) + ' / 7d ' + fmtPct(out.majors.eth.ch7d));
console.log('SOL ' + fmtPct(out.majors.sol.ch24) + ' / 7d ' + fmtPct(out.majors.sol.ch7d));
