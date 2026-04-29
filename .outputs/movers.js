// token-movers analysis 2026-04-29
const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.outputs/cg-markets.json'));
const trending = JSON.parse(fs.readFileSync('/home/runner/work/aeon/aeon/.outputs/cg-trending.json'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','ethena-usde','tusd','true-usd','usdd',
  'pyusd','paypal-usd','fdusd','paxg','pax-gold','frax','lusd','liquity-usd','susd','dola',
  'gho','crvusd','usdp','usdx','susds','sky-dollar','ondo-us-dollar-yield','blackrock-usd','buidl',
  'usdy','ondo-usdy','usdtb','susde','staked-usde','m-by-m0','m-0-m','tether-eurt','tether-gold',
  'wrapped-usdr','reservoir-usdr'
]);

function isStable(c) {
  if (STABLE_IDS.has(c.id)) return true;
  const sym = (c.symbol || '').toUpperCase();
  const name = (c.name || '').toLowerCase();
  if (/^USD/.test(sym) || /^EUR/.test(sym) || /^GBP/.test(sym)) return true;
  if (name.includes('stablecoin')) return true;
  if (name.includes('staked usd') || name.includes('usd coin') || name.includes('us dollar')) return true;
  return false;
}

const WRAPPED = new Set([
  'wrapped-bitcoin','tbtc','threshold-network-token','wbtc','renbtc',
  'wrapped-steth','wrapped-eeth','staked-ether','lido-staked-ether','rocket-pool-eth','staked-eth',
  'mantle-staked-ether','jito-staked-sol','marinade-staked-sol','liquid-staked-eth','solv-protocol-solvbtc',
  'binance-staked-sol','ankreth','frax-ether','frxeth','sfrxeth','wbeth','weth','bridged-wrapped-ether',
  'coinbase-wrapped-staked-eth','coinbase-wrapped-btc','liquid-staked-ether-v2','solv-btc',
  'wrapped-eeth-1','solv-protocol-staked-btc','ethereum-staked-eth-mantle','msol',
  'kelp-restaked-eth-rseth','renzo-restaked-eth','ezeth','jitosol','wsteth',
  'lombard-staked-btc','lbtc','solvbtc','susolayer'
]);

const VOL_FLOOR = 1_000_000;

const filtered = markets.filter(c => {
  if (isStable(c)) return false;
  if (WRAPPED.has(c.id)) return false;
  if ((c.total_volume || 0) < VOL_FLOOR) return false;
  if (typeof c.price_change_percentage_24h !== 'number') return false;
  return true;
});

const fmtUsd = v => {
  if (v == null) return '?';
  if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtPrice = p => {
  if (p == null) return '?';
  if (p >= 1000) return `$${p.toLocaleString('en-US',{maximumFractionDigits:0})}`;
  if (p >= 1) return `$${p.toFixed(p>=100?1:p>=10?2:3)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toPrecision(3)}`;
};

const fmtPct = p => p == null ? '?' : (p >= 0 ? '+' : '') + p.toFixed(1) + '%';

const trendIds = new Set();
const trendList = [];
for (const t of (trending.coins || []).slice(0, 14)) {
  trendIds.add(t.item.id);
  trendList.push({
    id: t.item.id,
    symbol: t.item.symbol,
    name: t.item.name,
    rank: t.item.market_cap_rank,
    price_usd: t.item.data?.price,
    pct_24h: t.item.data?.price_change_percentage?.usd ?? t.item.data?.price_change_percentage_24h?.usd,
    vol_24h: t.item.data?.total_volume,
    mcap: t.item.data?.market_cap
  });
}

function tagsFor(c) {
  const tags = [];
  const t24 = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
  const t7d = c.price_change_percentage_7d_in_currency;
  const rank = c.market_cap_rank;
  const vmRatio = c.market_cap > 0 ? (c.total_volume / c.market_cap) : 0;
  const inTrend = trendIds.has(c.id);

  if (inTrend && t24 > 5) tags.push('TRENDING+UP');
  if (inTrend && t24 < -5) tags.push('TRENDING+DOWN');
  if (t24 > 15 && t7d > 25) tags.push('BREAKOUT');
  if (t24 > 20 && t7d < 0) tags.push('FADE');
  if (t24 < -10 && vmRatio > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && t24 > 30) tags.push('PUMP-RISK');
  if (c.market_cap < 50_000_000) tags.push('MICROCAP');
  if (rank <= 20) tags.push('MAJOR');
  return tags.slice(0, 2);
}

const sorted24 = [...filtered].sort((a,b) =>
  (b.price_change_percentage_24h ?? -9e9) - (a.price_change_percentage_24h ?? -9e9));
const winners = sorted24.slice(0, 10);
const losers = [...filtered].sort((a,b) =>
  (a.price_change_percentage_24h ?? 9e9) - (b.price_change_percentage_24h ?? 9e9)).slice(0, 10);

const top100 = filtered.slice(0, 100);
const greens = top100.filter(c => c.price_change_percentage_24h > 0).length;
const reds = top100.length - greens;
const top50 = filtered.slice(0, 50);
const sorted50 = [...top50].sort((a,b)=>a.price_change_percentage_24h - b.price_change_percentage_24h);
const median50 = sorted50[Math.floor(sorted50.length/2)]?.price_change_percentage_24h;

const btc = markets.find(c => c.id==='bitcoin');
const eth = markets.find(c => c.id==='ethereum');
const sol = markets.find(c => c.id==='solana');

function row(c, idx) {
  const tags = tagsFor(c);
  const tagStr = tags.length ? ` [${tags.join(',')}]` : '';
  const t1h = c.price_change_percentage_1h_in_currency;
  const t7d = c.price_change_percentage_7d_in_currency;
  return `${idx+1}. ${c.symbol.toUpperCase()} (${c.name}) — ${fmtPrice(c.current_price)} ${fmtPct(c.price_change_percentage_24h)} / 7d ${fmtPct(t7d)} / 1h ${fmtPct(t1h)} • ${fmtUsd(c.total_volume)} / #${c.market_cap_rank}${tagStr}`;
}

const out = {
  date: '2026-04-29',
  filtered_count: filtered.length,
  pulse: { greens_top100: greens, reds_top100: reds, median_24h_top50: median50 },
  btc: btc ? { price: btc.current_price, pct24: btc.price_change_percentage_24h, pct7d: btc.price_change_percentage_7d_in_currency, vol: btc.total_volume } : null,
  eth: eth ? { price: eth.current_price, pct24: eth.price_change_percentage_24h, pct7d: eth.price_change_percentage_7d_in_currency, vol: eth.total_volume } : null,
  sol: sol ? { price: sol.current_price, pct24: sol.price_change_percentage_24h, pct7d: sol.price_change_percentage_7d_in_currency, vol: sol.total_volume } : null,
  winners: winners.map(c => ({
    sym: c.symbol.toUpperCase(), name: c.name, rank: c.market_cap_rank, price: c.current_price,
    p24: c.price_change_percentage_24h, p7d: c.price_change_percentage_7d_in_currency, p1h: c.price_change_percentage_1h_in_currency,
    vol: c.total_volume, mcap: c.market_cap, tags: tagsFor(c)
  })),
  losers: losers.map(c => ({
    sym: c.symbol.toUpperCase(), name: c.name, rank: c.market_cap_rank, price: c.current_price,
    p24: c.price_change_percentage_24h, p7d: c.price_change_percentage_7d_in_currency, p1h: c.price_change_percentage_1h_in_currency,
    vol: c.total_volume, mcap: c.market_cap, tags: tagsFor(c)
  })),
  trending: trendList.map(t => {
    const m = markets.find(x => x.id === t.id);
    const tags = [];
    const p24 = m?.price_change_percentage_24h ?? t.pct_24h;
    if (m) {
      if (m.market_cap_rank > 150 && p24 > 30) tags.push('PUMP-RISK');
      if (m.market_cap < 50_000_000) tags.push('MICROCAP');
      if (m.market_cap_rank <= 20) tags.push('MAJOR');
    } else if (t.rank && t.rank > 150 && p24 > 30) {
      tags.push('PUMP-RISK');
    }
    return {
      sym: (t.symbol||'').toUpperCase(),
      name: t.name,
      rank: t.rank,
      price: m?.current_price ?? t.price_usd,
      p24,
      vol: m?.total_volume ?? t.vol_24h,
      mcap: m?.market_cap ?? t.mcap,
      tags: tags.slice(0,2)
    };
  }).slice(0, 7)
};

fs.writeFileSync('/home/runner/work/aeon/aeon/.outputs/movers.json', JSON.stringify(out, null, 2));

const W = winners.map((c,i)=>row(c,i)).join('\n');
const L = losers.map((c,i)=>row(c,i)).join('\n');
const T = out.trending.map((t,i) => {
  const tagStr = t.tags?.length ? ` [${t.tags.join(',')}]` : '';
  return `${i+1}. ${t.name} (${t.sym}) — #${t.rank ?? '?'}, ${fmtPrice(t.price)}, 24h ${fmtPct(t.p24)}${tagStr}`;
}).join('\n');

let pulseTone;
if (greens >= 70) pulseTone = `Broad risk-on — ${greens}/100 top coins green, median ${fmtPct(median50)}`;
else if (greens <= 30) pulseTone = `Broad risk-off — ${reds}/100 top coins red, median ${fmtPct(median50)}`;
else if (Math.abs(median50) < 1) pulseTone = `Quiet tape — ${greens}/100 green, median ${fmtPct(median50)}`;
else pulseTone = `Mixed tape — ${greens}/100 green vs ${reds} red, median ${fmtPct(median50)}`;

const majors = `BTC ${fmtPrice(btc?.current_price)} ${fmtPct(btc?.price_change_percentage_24h)}, ETH ${fmtPrice(eth?.current_price)} ${fmtPct(eth?.price_change_percentage_24h)}, SOL ${fmtPrice(sol?.current_price)} ${fmtPct(sol?.price_change_percentage_24h)}`;

console.log('PULSE:', pulseTone);
console.log('MAJORS:', majors);
console.log('FILTERED:', filtered.length);
console.log('---WINNERS---'); console.log(W);
console.log('---LOSERS---'); console.log(L);
console.log('---TRENDING---'); console.log(T);
