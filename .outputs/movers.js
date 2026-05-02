const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets-fresh.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending-fresh.json', 'utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd','fdusd','paxg',
  'frax','lusd','susd','gusd','usdp','usdj','susds','usds','usdt0','crvusd','mim','ousg',
  'tether-gold','pax-gold','usdtb','ethena-usde','ondo-us-dollar-yield',
  'blackrock-usd-institutional-digital-liquidity-fund','binance-usd','wrapped-ust','liquity-usd',
  'usdb','tron-usd','sky-dollar','spx6900-something' // padding
]);

const WRAPPED_BLOCK = new Set([
  'weth','wbtc','wbnb','steth','reth','wsteth','cbbtc','tbtc','wbeth','meth','sweth','wmatic',
  'msol','jitosol','jupsol','bsol','beth','sfrxeth','rseth','solvbtc','lbtc','renbtc','hbtc',
  'ezeth','rsweth','weeth','pufeth','swbtc','frxeth','swelleth'
]);

function isStable(c){
  if (STABLE_IDS.has(c.id)) return true;
  const sym = (c.symbol||'').toLowerCase();
  const name = (c.name||'').toLowerCase();
  if (sym.startsWith('usd') || sym.startsWith('eur') || sym.startsWith('gbp')) return true;
  if (name.includes('stablecoin') || name.includes('stable coin')) return true;
  if (sym === 'usd' || sym === 'eur' || sym === 'gbp') return true;
  if (typeof c.current_price === 'number' && c.current_price > 0.97 && c.current_price < 1.03 &&
      typeof c.price_change_percentage_7d_in_currency === 'number' &&
      Math.abs(c.price_change_percentage_7d_in_currency) < 0.5 &&
      typeof c.price_change_percentage_24h === 'number' &&
      Math.abs(c.price_change_percentage_24h) < 0.3) return true;
  return false;
}
function isWrapped(c){
  return WRAPPED_BLOCK.has((c.symbol||'').toLowerCase());
}

function fmtPrice(p){
  if (p == null) return 'n/a';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', {maximumFractionDigits: 0});
  if (p >= 100) return '$' + p.toFixed(0);
  if (p >= 1) return '$' + p.toFixed(2);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toExponential(2);
}
function fmtPct(p){
  if (p == null || isNaN(p)) return 'n/a';
  const sign = p > 0 ? '+' : '';
  return sign + p.toFixed(1) + '%';
}
function fmtAbbr(n){
  if (n == null) return 'n/a';
  if (n >= 1e12) return '$' + (n/1e12).toFixed(1) + 'T';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

const filtered = markets.filter(c => {
  if (isStable(c)) return false;
  if (isWrapped(c)) return false;
  if (typeof c.total_volume !== 'number' || c.total_volume < 1_000_000) return false;
  if (c.price_change_percentage_24h == null) return false;
  return true;
});

const trendingIds = new Set((trending.coins||[]).map(t => t.item.id));
const trendingTopList = (trending.coins||[]).slice(0,7).map(t => t.item);

function computeTags(c, isTrending){
  const tags = [];
  const p24 = c.price_change_percentage_24h;
  const p7 = c.price_change_percentage_7d_in_currency;
  const rank = c.market_cap_rank;
  const mcap = c.market_cap;
  const vol = c.total_volume;

  if (isTrending && p24 > 5) tags.push('TRENDING+UP');
  if (isTrending && p24 < -5) tags.push('TRENDING+DOWN');
  if (p24 > 15 && (p7 != null && p7 > 25)) tags.push('BREAKOUT');
  if (p24 > 20 && (p7 != null && p7 < 0)) tags.push('FADE');
  if (p24 < -10 && mcap && vol/mcap > 0.25) tags.push('CAPITULATION');
  if (rank && rank > 150 && p24 > 30) tags.push('PUMP-RISK');
  if (mcap && mcap < 50_000_000) tags.push('MICROCAP');
  if (rank && rank <= 20) tags.push('MAJOR');

  const priority = ['PUMP-RISK','TRENDING+UP','TRENDING+DOWN','CAPITULATION','BREAKOUT','FADE','MAJOR','MICROCAP'];
  tags.sort((a,b) => priority.indexOf(a) - priority.indexOf(b));
  return tags.slice(0,2);
}

const sortedDesc = [...filtered].sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
const sortedAsc = [...filtered].sort((a,b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
const winners = sortedDesc.slice(0,10);
const losers = sortedAsc.slice(0,10);

function fmtRow(c){
  const p24 = c.price_change_percentage_24h;
  const p7 = c.price_change_percentage_7d_in_currency;
  const p1 = c.price_change_percentage_1h_in_currency;
  const tags = computeTags(c, trendingIds.has(c.id));
  const tagStr = tags.length ? ` [${tags.join(',')}]` : '';
  return `${c.symbol.toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)}  ${fmtPct(p24)} / 7d ${fmtPct(p7)} / 1h ${fmtPct(p1)}  •  ${fmtAbbr(c.total_volume)} / #${c.market_cap_rank || 'n/a'}${tagStr}`;
}

const top100 = filtered.slice(0,100);
const greenCount = top100.filter(c => c.price_change_percentage_24h > 0).length;
const top50 = filtered.slice(0,50);
const sortedTop50_24 = [...top50].map(c => c.price_change_percentage_24h).sort((a,b) => a-b);
const median = sortedTop50_24.length ? sortedTop50_24[Math.floor(sortedTop50_24.length/2)] : null;

const btc = markets.find(c => c.id === 'bitcoin');
const eth = markets.find(c => c.id === 'ethereum');
const sol = markets.find(c => c.id === 'solana');

const out = {
  asof: new Date().toISOString(),
  filteredCount: filtered.length,
  totalCount: markets.length,
  pulse: {
    greenCount, median, top50count: sortedTop50_24.length,
    btc: btc ? {p:btc.current_price, p24:btc.price_change_percentage_24h, p7:btc.price_change_percentage_7d_in_currency} : null,
    eth: eth ? {p:eth.current_price, p24:eth.price_change_percentage_24h, p7:eth.price_change_percentage_7d_in_currency} : null,
    sol: sol ? {p:sol.current_price, p24:sol.price_change_percentage_24h, p7:sol.price_change_percentage_7d_in_currency} : null,
  },
  winners: winners.map(c => ({
    id: c.id, sym: c.symbol.toUpperCase(), name: c.name, p: c.current_price,
    p24: c.price_change_percentage_24h, p7: c.price_change_percentage_7d_in_currency, p1: c.price_change_percentage_1h_in_currency,
    rank: c.market_cap_rank, mcap: c.market_cap, vol: c.total_volume,
    tags: computeTags(c, trendingIds.has(c.id)),
    row: fmtRow(c),
  })),
  losers: losers.map(c => ({
    id: c.id, sym: c.symbol.toUpperCase(), name: c.name, p: c.current_price,
    p24: c.price_change_percentage_24h, p7: c.price_change_percentage_7d_in_currency, p1: c.price_change_percentage_1h_in_currency,
    rank: c.market_cap_rank, mcap: c.market_cap, vol: c.total_volume,
    tags: computeTags(c, trendingIds.has(c.id)),
    row: fmtRow(c),
  })),
  trending: trendingTopList.map(t => {
    const m = markets.find(c => c.id === t.id);
    if (!m) {
      return {
        sym: t.symbol, name: t.name, rank: t.market_cap_rank, p: null, p24: null,
        tags: ['TRENDING'],
        row: `${t.name} (${t.symbol}) — #${t.market_cap_rank || 'n/a'}, n/a, 24h n/a  [TRENDING]`,
      };
    }
    const tags = computeTags(m, true);
    return {
      sym: m.symbol.toUpperCase(), name: m.name, rank: m.market_cap_rank, p: m.current_price,
      p24: m.price_change_percentage_24h,
      tags,
      row: `${m.name} (${m.symbol.toUpperCase()}) — #${m.market_cap_rank}, ${fmtPrice(m.current_price)}, 24h ${fmtPct(m.price_change_percentage_24h)}${tags.length ? ' [' + tags.join(',') + ']' : ''}`,
    };
  }),
};

fs.writeFileSync('.outputs/movers.json', JSON.stringify(out, null, 2));
console.log('OK filtered=' + filtered.length + '/' + markets.length);
console.log('Pulse:', out.pulse);
console.log('Winners:', out.winners.map(w => w.sym + ' ' + w.p24.toFixed(1) + '%' + (w.tags.length ? ' ['+w.tags.join(',')+']':'')).join(' | '));
console.log('Losers:', out.losers.map(w => w.sym + ' ' + w.p24.toFixed(1) + '%' + (w.tags.length ? ' ['+w.tags.join(',')+']':'')).join(' | '));
console.log('Trending:', out.trending.map(t => t.sym + (t.tags && t.tags.length ? ' ['+t.tags.join(',')+']' : '')).join(' | '));
