const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.outputs/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.outputs/cg-trending.json', 'utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg',
  'ethena-usde','sky-dollar','frax','lusd','crvusd','susd','gusd','usdp','usdtb','susds',
  'usdj','usdy','usds','usdo','m-by-m0','usdf','dola','blackrock-usd-institutional-digital-liquidity-fund',
  'ondo-us-dollar-yield','ousd','ousg','staked-frax','agora-dollar','curve-usd','agora','rlusd',
  'tether-eurt','euro-coin','eurs','eurc','eurr','steakhouse-usdc-prime','resolv-usr','usd1-wlfi',
  'usual-usd','elixir-deusd','dnero','vusd','reusd','first-digital-eur','origin-dollar','usdt0',
  'm-by-m-0','blackrock-usd'
]);

const WRAPPED_BTC = new Set(['wrapped-bitcoin','wbtc','tbtc','renbtc','hbtc','wrapped-btc','btcb','coinbase-wrapped-btc','lombard-staked-btc','solv-protocol-solvbtc','dlcbtc','21-co-wrapped-bitcoin']);
const WRAPPED_ETH = new Set(['weth','wrapped-steth','staked-ether','rocket-pool-eth','reth','steth','wbeth','mantle-staked-ether','renzo-restaked-eth','ether-fi-staked-eth','ezeth','wsteth','staked-frax-ether','frax-ether','sweth','cbeth','coinbase-wrapped-staked-eth','swell-restaked-eth','liquid-staked-ethereum','ankreth','wrapped-eeth','rseth','lido-staked-ether','restaked-swell-eth','kelp-dao-restaked-eth']);
const WRAPPED_SOL = new Set(['jito-staked-sol','msol','marinade-staked-sol','blazestake-staked-sol','jupsol','bnsol','jitosol','jupiter-staked-sol','binance-staked-sol','wsol']);
const WRAPPED_BNB = new Set(['wbnb']);

function isStable(c) {
  if (STABLE_IDS.has(c.id)) return true;
  const sym = (c.symbol||'').toUpperCase();
  if (sym.startsWith('USD') || sym.startsWith('EUR') || sym.startsWith('GBP')) return true;
  const name = (c.name||'').toLowerCase();
  if (name.includes('stablecoin')) return true;
  return false;
}

function isWrappedDupe(c) {
  return WRAPPED_BTC.has(c.id) || WRAPPED_ETH.has(c.id) || WRAPPED_SOL.has(c.id) || WRAPPED_BNB.has(c.id);
}

const filtered = markets.filter(c => {
  if (!c.total_volume || c.total_volume < 1_000_000) return false;
  if (isStable(c)) return false;
  if (isWrappedDupe(c)) return false;
  if (c.price_change_percentage_24h == null) return false;
  return true;
});

const trendIds = new Set((trending.coins || []).map(t => t.item.id));
const trendList = (trending.coins || []).slice(0, 7).map(t => t.item);

const winners = [...filtered].sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 10);
const losers = [...filtered].sort((a,b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 10);

function tagsFor(c) {
  const tags = [];
  const ch24 = c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency;
  const rank = c.market_cap_rank;
  const mcap = c.market_cap;
  const vol = c.total_volume;
  const volMcap = mcap ? vol/mcap : 0;
  const inTrend = trendIds.has(c.id);

  if (inTrend && ch24 >= 5) tags.push('TRENDING+UP');
  if (inTrend && ch24 <= -5) tags.push('TRENDING+DOWN');
  if (ch24 > 15 && ch7d != null && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d != null && ch7d < 0) tags.push('FADE');
  if (ch24 < -10 && volMcap > 0.25) tags.push('CAPITULATION');
  if (rank && rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if (mcap && mcap < 50_000_000) tags.push('MICROCAP');
  if (rank && rank <= 20) tags.push('MAJOR');

  return tags.slice(0, 2);
}

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', {maximumFractionDigits: 0});
  if (p >= 100) return '$' + p.toFixed(1);
  if (p >= 10) return '$' + p.toFixed(2);
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}

function fmtAbbr(n) {
  if (n == null) return 'n/a';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(1) + 'T';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n;
}

function fmtPct(p) {
  if (p == null) return 'n/a';
  const s = p >= 0 ? '+' : '';
  return s + p.toFixed(1) + '%';
}

function lineFor(c, idx) {
  const tags = tagsFor(c);
  const tagStr = tags.length ? '  [' + tags.join(', ') + ']' : '';
  const ch7d = c.price_change_percentage_7d_in_currency;
  const ch1h = c.price_change_percentage_1h_in_currency;
  return `${idx+1}. ${c.symbol.toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)}  ${fmtPct(c.price_change_percentage_24h)} / 7d ${fmtPct(ch7d)} / 1h ${fmtPct(ch1h)}  •  ${fmtAbbr(c.total_volume)} / #${c.market_cap_rank}${tagStr}`;
}

function lineForTrend(t, idx) {
  const data = t.data || {};
  const price = data.price || 0;
  const ch24 = data.price_change_percentage_24h && data.price_change_percentage_24h.usd;
  const m = markets.find(mc => mc.id === t.id);
  let tagStr = '';
  if (m) {
    const tg = tagsFor(m);
    if (tg.length) tagStr = '  [' + tg.join(', ') + ']';
  }
  return `${idx+1}. ${t.name} (${(t.symbol||'').toUpperCase()}) — #${t.market_cap_rank || 'n/a'}, ${fmtPrice(price)}, 24h ${fmtPct(ch24)}${tagStr}`;
}

const top100 = filtered.slice().sort((a,b) => (a.market_cap_rank||999) - (b.market_cap_rank||999)).slice(0, 100);
const top50 = top100.slice(0, 50);
const greenCount = top100.filter(c => c.price_change_percentage_24h > 0).length;
const redCount = top100.length - greenCount;
const sortedTop50 = top50.map(c => c.price_change_percentage_24h).sort((a,b) => a-b);
const median = sortedTop50.length % 2 === 0
  ? (sortedTop50[sortedTop50.length/2 - 1] + sortedTop50[sortedTop50.length/2]) / 2
  : sortedTop50[Math.floor(sortedTop50.length/2)];

const btc = markets.find(c => c.id === 'bitcoin');
const eth = markets.find(c => c.id === 'ethereum');
const sol = markets.find(c => c.id === 'solana');

const pulse = {
  green: greenCount,
  red: redCount,
  median: median,
  btc24: btc ? btc.price_change_percentage_24h : null,
  btcPrice: btc ? btc.current_price : null,
  eth24: eth ? eth.price_change_percentage_24h : null,
  ethPrice: eth ? eth.current_price : null,
  sol24: sol ? sol.price_change_percentage_24h : null,
  solPrice: sol ? sol.current_price : null
};

console.log('=== PULSE ===');
console.log(JSON.stringify(pulse));
console.log('=== WINNERS ===');
winners.forEach((c, i) => console.log(lineFor(c, i)));
console.log('=== LOSERS ===');
losers.forEach((c, i) => console.log(lineFor(c, i)));
console.log('=== TRENDING ===');
trendList.forEach((t, i) => console.log(lineForTrend(t, i)));

console.log('=== NOTABLE ===');
const notable = [];
[...winners, ...losers].forEach(c => {
  const tg = tagsFor(c);
  if (tg.includes('TRENDING+UP') || tg.includes('BREAKOUT') || tg.includes('CAPITULATION') || tg.includes('PUMP-RISK')) {
    const volMcap = c.market_cap ? c.total_volume/c.market_cap : 0;
    notable.push({
      sym: c.symbol.toUpperCase(),
      name: c.name,
      tags: tg,
      ch24: c.price_change_percentage_24h,
      ch7d: c.price_change_percentage_7d_in_currency,
      rank: c.market_cap_rank,
      vol: c.total_volume,
      mcap: c.market_cap,
      volMcap: volMcap
    });
  }
});
console.log(JSON.stringify(notable, null, 2));
