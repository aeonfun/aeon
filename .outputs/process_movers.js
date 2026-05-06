// Token-movers processor for 2026-05-06
const fs = require('fs');
const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json', 'utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','ethena-usde','tusd','true-usd','usdd','pyusd','fdusd','paxg',
  'paypal-usd','frax','usdp','gho','crvusd','lusd','susds','sky-dollar-usds','usds','ondo-us-dollar-yield',
  'binance-usd','tether-gold','xaut','tether-eurt','euro-coin','eurc','eurs','jpy-coin',
  'savings-dai','sdai','origin-dollar','reservoir','wrapped-usdr','usd-coin-pos','m-by-m0',
  'frax-share','sfrax','staked-frax','usd1','wlfi-usd-1','susde','ethena-staked-usde',
  'ousd','agdai','agora-dollar','agusd','usdg','usdf','dola-usd','sky-dollar','spark-usds',
  'falcon-finance','usdo','usual-usd','usual','m-2','tether-zar','blackrock-usd','paxos-standard',
  'reserve-rights-token','reserve','crvusd','mkusd','usdtb','usdt0','wenusdt','agora-dollar',
  'global-dollar-network','liquity-bold','bold','blackrock-buidl','blackrock-usd-institutional-digital-liquidity-fund',
  'tether-tokenized-stock-xstocks','susda','susdf','steakhouse-resolv-rlp','jpyc','m-0','m0',
  'ripple-usd','rlusd','stasis-eurs','ageur','origin-defi','sweth-protocol','liquity-usd',
  'mai','vai','husd','gusd','susd'
]);
const STABLE_SYMBOL_PREFIXES = ['USD','EUR','GBP','JPY','CHF','CAD','AUD'];

function isStable(c) {
  const id = (c.id||'').toLowerCase();
  const sym = (c.symbol||'').toUpperCase();
  const name = (c.name||'').toLowerCase();
  if (STABLE_IDS.has(id)) return true;
  if (STABLE_SYMBOL_PREFIXES.some(p => sym.startsWith(p))) return true;
  if (name.includes('stablecoin')) return true;
  if (name.includes('staked usd') || name.includes('savings usd') || name.includes('savings dai')) return true;
  if (name.endsWith(' usd') || / usd /.test(name)) return true;
  if (name.includes('tokenized stock')) return true;
  if (sym === 'PAXG' || sym === 'XAUT') return true;
  return false;
}

const WRAPPED_DUPES = new Set([
  'wrapped-bitcoin','wrapped-eeth','staked-ether','wrapped-steth','rocket-pool-eth','wrapped-beacon-eth',
  'wbnb','weth','wbtc','tbtc','lombard-staked-btc','solv-protocol-solvbtc','solv-protocol-solvbtc-bbn',
  'coinbase-wrapped-staked-eth','coinbase-wrapped-btc','cbeth','cbbtc','sweth','reth','sfrxeth',
  'frax-ether','steth','wsteth','msol','jitosol','bnsol','jupsol','binance-staked-sol','jito-staked-sol',
  'marinade-staked-sol','renzo-restaked-eth','rseth','ezeth','wrapped-rseth','meeth','tbtc-v2',
  'pirex-eth','pufeth','wmatic','stkbnb','clbtc','enzobtc','pumpbtc','renbtc','hbtc',
  'eigenpie-meeth','swell-restaked-eth','ankreth','stakewise-v3-oseth','staked-frax-ether',
  'liquid-staked-ether'
]);
function isWrappedDupe(c) { return WRAPPED_DUPES.has(c.id); }

const filtered = markets.filter(c => {
  if (isStable(c)) return false;
  if ((c.total_volume || 0) < 1_000_000) return false;
  if (c.price_change_percentage_24h_in_currency == null) return false;
  return true;
});

const trendingItems = (trending.coins || []).slice(0, 7).map(t => t.item);
const trendingIds = new Set(trendingItems.map(t => t.id));

function tagsFor(c) {
  const ch24 = c.price_change_percentage_24h_in_currency ?? 0;
  const ch7d = c.price_change_percentage_7d_in_currency ?? 0;
  const tags = [];
  if (trendingIds.has(c.id)) {
    if (ch24 >= 5) tags.push('TRENDING+UP');
    else if (ch24 <= -5) tags.push('TRENDING+DOWN');
    else tags.push('TRENDING');
  }
  if (ch24 > 15 && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d < 0) tags.push('FADE');
  const volMc = (c.total_volume || 0) / (c.market_cap || 1);
  if (ch24 < -10 && volMc > 0.25) tags.push('CAPITULATION');
  if ((c.market_cap_rank ?? 999) > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if ((c.market_cap || 0) < 50_000_000) tags.push('MICROCAP');
  if ((c.market_cap_rank ?? 999) <= 20) tags.push('MAJOR');
  // dedupe + cap to 2
  const seen = new Set(); const out = [];
  for (const t of tags) { if (!seen.has(t)) { seen.add(t); out.push(t); } }
  return out.slice(0, 2);
}

function fmtPrice(p) {
  if (p == null) return 'n/a';
  if (p >= 10000) return '$' + p.toLocaleString('en-US', {maximumFractionDigits:0});
  if (p >= 100) return '$' + p.toFixed(2);
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(5);
  return '$' + p.toFixed(7);
}
function fmtBig(x) {
  if (x == null) return 'n/a';
  if (x >= 1e12) return '$' + (x/1e12).toFixed(2) + 'T';
  if (x >= 1e9) return '$' + (x/1e9).toFixed(2) + 'B';
  if (x >= 1e6) return '$' + (x/1e6).toFixed(1) + 'M';
  if (x >= 1e3) return '$' + (x/1e3).toFixed(0) + 'K';
  return '$' + (x||0).toFixed(0);
}
function pct(x) {
  if (x == null || isNaN(x)) return 'n/a';
  return (x>=0?'+':'') + x.toFixed(1) + '%';
}

const sorted24 = [...filtered].sort((a,b) => (b.price_change_percentage_24h_in_currency ?? -999) - (a.price_change_percentage_24h_in_currency ?? -999));

function pickList(arr, n) {
  const out = [];
  const seenBase = new Set();
  for (const c of arr) {
    if (isWrappedDupe(c)) {
      const sym = (c.symbol||'').toLowerCase();
      const base = sym.replace(/^w/, '').replace(/^st/, '').replace(/^cb/, '').replace(/^r/,'');
      if (seenBase.has(base)) continue;
      seenBase.add(base);
    }
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

const winners = pickList(sorted24, 10);
const losers = pickList([...sorted24].reverse(), 10);

const trendingMarkets = trendingItems.map(t => {
  const m = markets.find(mm => mm.id === t.id);
  const ch24 = m?.price_change_percentage_24h_in_currency ?? (t.data?.price_change_percentage_24h?.usd ?? null);
  const ch7d = m?.price_change_percentage_7d_in_currency ?? null;
  const price = m?.current_price ?? (t.data?.price ?? null);
  const tags = m ? tagsFor(m) : (() => {
    const o = ['TRENDING'];
    if ((t.market_cap_rank ?? 999) > 150 && (ch24 ?? 0) > 30) o.push('PUMP-RISK');
    if ((m?.market_cap || 0) < 50_000_000 && m) o.push('MICROCAP');
    return o.slice(0, 2);
  })();
  return {
    id: t.id, name: t.name, symbol: (t.symbol||'').toUpperCase(),
    rank: m?.market_cap_rank ?? t.market_cap_rank, price, ch24, ch7d,
    market_cap: m?.market_cap ?? null, total_volume: m?.total_volume ?? null,
    tags, inMarkets: !!m, vol_mc: m ? ((m.total_volume||0)/(m.market_cap||1)) : null
  };
});

// Pulse
const top100 = filtered.slice().sort((a,b)=>(a.market_cap_rank||999)-(b.market_cap_rank||999)).slice(0,100);
const greenCount = top100.filter(c => (c.price_change_percentage_24h_in_currency ?? 0) > 0).length;
const top50 = top100.slice(0, 50);
const t50 = top50.map(c => c.price_change_percentage_24h_in_currency ?? 0).sort((a,b)=>a-b);
const median50 = t50.length ? (t50[Math.floor((t50.length-1)/2)] + t50[Math.ceil((t50.length-1)/2)])/2 : 0;

const btc = markets.find(m=>m.id==='bitcoin');
const eth = markets.find(m=>m.id==='ethereum');
const sol = markets.find(m=>m.id==='solana');

const result = {
  date: '2026-05-06',
  filteredCount: filtered.length,
  pulse: {
    greenTop100: greenCount, redTop100: 100 - greenCount,
    medianTop50: median50,
    btc: btc ? {price: btc.current_price, ch24: btc.price_change_percentage_24h_in_currency, ch7d: btc.price_change_percentage_7d_in_currency} : null,
    eth: eth ? {price: eth.current_price, ch24: eth.price_change_percentage_24h_in_currency, ch7d: eth.price_change_percentage_7d_in_currency} : null,
    sol: sol ? {price: sol.current_price, ch24: sol.price_change_percentage_24h_in_currency, ch7d: sol.price_change_percentage_7d_in_currency} : null,
  },
  winners: winners.map(c => ({
    id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), rank: c.market_cap_rank,
    price: c.current_price, ch1h: c.price_change_percentage_1h_in_currency,
    ch24: c.price_change_percentage_24h_in_currency, ch7d: c.price_change_percentage_7d_in_currency,
    volume: c.total_volume, market_cap: c.market_cap, tags: tagsFor(c),
    volMc: (c.total_volume||0)/(c.market_cap||1)
  })),
  losers: losers.map(c => ({
    id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), rank: c.market_cap_rank,
    price: c.current_price, ch1h: c.price_change_percentage_1h_in_currency,
    ch24: c.price_change_percentage_24h_in_currency, ch7d: c.price_change_percentage_7d_in_currency,
    volume: c.total_volume, market_cap: c.market_cap, tags: tagsFor(c),
    volMc: (c.total_volume||0)/(c.market_cap||1)
  })),
  trending: trendingMarkets,
};

fs.writeFileSync('.outputs/movers-0506.json', JSON.stringify(result, null, 2));

// Human-readable summary
const lines = [];
lines.push(`PULSE: green=${greenCount}/100 red=${100-greenCount} median50=${median50.toFixed(2)}%`);
lines.push(`BTC ${fmtPrice(btc.current_price)} ${pct(btc.price_change_percentage_24h_in_currency)} 7d ${pct(btc.price_change_percentage_7d_in_currency)}`);
lines.push(`ETH ${fmtPrice(eth.current_price)} ${pct(eth.price_change_percentage_24h_in_currency)} 7d ${pct(eth.price_change_percentage_7d_in_currency)}`);
lines.push(`SOL ${fmtPrice(sol.current_price)} ${pct(sol.price_change_percentage_24h_in_currency)} 7d ${pct(sol.price_change_percentage_7d_in_currency)}`);
lines.push('');
lines.push('--- WINNERS ---');
for (const w of result.winners) {
  lines.push(`${w.symbol} (${w.name}) #${w.rank} ${fmtPrice(w.price)} 24h ${pct(w.ch24)} 7d ${pct(w.ch7d)} 1h ${pct(w.ch1h)} vol ${fmtBig(w.volume)} mcap ${fmtBig(w.market_cap)} v/mc ${w.volMc.toFixed(3)} ${JSON.stringify(w.tags)}`);
}
lines.push('');
lines.push('--- LOSERS ---');
for (const l of result.losers) {
  lines.push(`${l.symbol} (${l.name}) #${l.rank} ${fmtPrice(l.price)} 24h ${pct(l.ch24)} 7d ${pct(l.ch7d)} 1h ${pct(l.ch1h)} vol ${fmtBig(l.volume)} mcap ${fmtBig(l.market_cap)} v/mc ${l.volMc.toFixed(3)} ${JSON.stringify(l.tags)}`);
}
lines.push('');
lines.push('--- TRENDING ---');
for (const t of result.trending) {
  lines.push(`${t.symbol} (${t.name}) #${t.rank ?? '?'} ${fmtPrice(t.price)} 24h ${pct(t.ch24)} 7d ${pct(t.ch7d)} mcap ${fmtBig(t.market_cap)} ${JSON.stringify(t.tags)}`);
}
console.log(lines.join('\n'));
