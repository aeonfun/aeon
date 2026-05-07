#!/usr/bin/env node
const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('/tmp/cg-markets.json', 'utf8'));
const trending = JSON.parse(fs.readFileSync('/tmp/cg-trending.json', 'utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','usde','tusd','usdd','pyusd',
  'fdusd','paxg','frax','binance-usd','true-usd','gemini-dollar','lusd',
  'ethena-usde','usds','paypal-usd','global-dollar','ondo-us-dollar-yield',
  'ousg','mountain-protocol-usdm','ethena-staked-usde','sky-dollar','usd1-wlfi',
  'ripple-usd','magic-internet-money','stake-dao-frax','crvusd','m0',
  'falcon-usd','resolv-usr','savings-usds','level-usd','liquity-usd','usd0',
  'usual-usd0pp','pax-gold','tether-gold','blackrock-usd-institutional-digital-liquidity-fund',
  'rlusd','usdy','susds','susde','agora-dollar','sky-dollar-usds',
  'level-usd-lvlusd','m-by-m0','aave-v3-usdc','staked-frax','usdt0',
  'world-liberty-financial-usd','sdai','euler-prime-usdc','curve-fi-usd',
  'mountain-protocol','m-by-m','pendle-pt-susde-jul-2026','pendle-pt-susde'
]);

const STABLE_PREFIXES = ['USD','EUR','GBP'];

const WRAPPED_DUPES = new Set([
  'wrapped-bitcoin','wrapped-steth','weth','staked-ether','wrapped-eeth',
  'rocket-pool-eth','msolana','jito-staked-sol','binance-staked-sol','wbeth',
  'mantle-staked-ether','kelp-dao-restaked-eth','renzo-restaked-eth',
  'lombard-staked-btc','coinbase-wrapped-btc','coinbase-wrapped-staked-eth',
  'lido-staked-ether','wrapped-beacon-eth','mantle-meth',
  'sky-bridged-usds-arbitrum','binance-bridged-usdt-bnb-smart-chain',
  'arbitrum-bridged-wbtc-arbitrum-one','binance-peg-weth','wbnb','tbtc',
  'lbtc','wsteth','cbbtc','cbeth','reth','bedrock-unibtc','solv-btc',
  'solv-protocol-solvbtc-bbn','klend-jlp','jupiter-staked-sol',
  'jupiter-perpetuals-liquidity-provider-token'
]);

function isStable(c) {
  const cid = (c.id||'').toLowerCase();
  const sym = (c.symbol||'').toUpperCase();
  const name = (c.name||'').toLowerCase();
  if (STABLE_IDS.has(cid)) return true;
  if (name.includes('stablecoin')) return true;
  for (const p of STABLE_PREFIXES) if (sym.startsWith(p)) return true;
  return false;
}
function isWrapped(c) { return WRAPPED_DUPES.has((c.id||'').toLowerCase()); }

const filtered = [];
for (const c of markets) {
  if (!c) continue;
  if (isStable(c)) continue;
  if (isWrapped(c)) continue;
  const vol = c.total_volume || 0;
  if (vol < 1_000_000) continue;
  if (c.price_change_percentage_24h_in_currency == null) continue;
  filtered.push(c);
}
process.stderr.write(`Filtered: ${filtered.length}\n`);

const sort24 = [...filtered].sort((a,b)=>(a.price_change_percentage_24h_in_currency||0)-(b.price_change_percentage_24h_in_currency||0));
const losers = sort24.slice(0,10);
const winners = sort24.slice(-10).reverse();

const trendingCoins = (trending.coins || []).slice(0,7);
const trendingIds = new Set(trendingCoins.map(t=>t.item.id));

const top100 = filtered.slice(0,100);
const green = top100.filter(c=>(c.price_change_percentage_24h_in_currency||0) > 0).length;
const top50 = filtered.slice(0,50);
const top50sorted = top50.map(c=>c.price_change_percentage_24h_in_currency||0).sort((a,b)=>a-b);
const median50 = top50sorted.length ? top50sorted[Math.floor(top50sorted.length/2)] : 0;
process.stderr.write(`Green: ${green}/100, median50: ${median50.toFixed(2)}\n`);

function fmtPrice(p) {
  if (p == null) return '?';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', {maximumFractionDigits:0});
  if (p >= 100) return '$' + p.toFixed(1);
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}
function fmtMoney(v) {
  if (v == null) return '?';
  if (v >= 1e12) return '$' + (v/1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v/1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + Math.round(v/1e6) + 'M';
  if (v >= 1e3) return '$' + Math.round(v/1e3) + 'K';
  return '$' + Math.round(v);
}
function fmtPct(p) {
  if (p == null) return 'n/a';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

function computeTags(c, isWinner=false, isLoser=false) {
  const tags = [];
  const cid = c.id||'';
  const rank = c.market_cap_rank || 999;
  const mcap = c.market_cap || 0;
  const vol = c.total_volume || 0;
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  const inTrending = trendingIds.has(cid);

  if (inTrending && isWinner) tags.push('TRENDING+UP');
  else if (inTrending && isLoser) tags.push('TRENDING+DOWN');

  if (p24 > 15 && p7 > 25) tags.push('BREAKOUT');
  else if (p24 > 20 && p7 < 0) tags.push('FADE');

  if (p24 < -10 && mcap > 0 && (vol/mcap) > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && p24 > 30) tags.push('PUMP-RISK');

  if (rank <= 20 && !tags.includes('MAJOR') && tags.length < 2) tags.push('MAJOR');
  if (mcap < 50_000_000 && mcap > 0 && !tags.includes('MICROCAP') && tags.length < 2) tags.push('MICROCAP');

  return tags.slice(0,2);
}

function coinLine(c, idx, isWinner, isLoser) {
  const sym = (c.symbol||'').toUpperCase();
  const name = c.name || '';
  const rank = c.market_cap_rank || '?';
  const price = fmtPrice(c.current_price);
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  const p1h = c.price_change_percentage_1h_in_currency || 0;
  const vol = fmtMoney(c.total_volume);
  const tags = computeTags(c, isWinner, isLoser);
  const tagStr = tags.length ? `  [${tags.join(', ')}]` : '';
  return `${idx}. ${sym} (${name}) — ${price}  ${fmtPct(p24)} / 7d ${fmtPct(p7)} / 1h ${fmtPct(p1h)}  •  ${vol} / #${rank}${tagStr}`;
}

const today = '2026-05-07';
const out = [];
out.push(`*Token Movers — ${today}*`);
out.push('');

let pulse;
if (green >= 60) pulse = `Risk-on tape — ${green}/100 top coins green, median 24h ${median50>=0?'+':''}${median50.toFixed(1)}%.`;
else if (green <= 35) pulse = `Broad risk-off — only ${green}/100 top coins green, median 24h ${median50>=0?'+':''}${median50.toFixed(1)}%.`;
else pulse = `Mixed tape — ${green}/100 top coins green, median 24h ${median50>=0?'+':''}${median50.toFixed(1)}%.`;
out.push(`_${pulse}_`);
out.push('');

out.push('*Top Winners (24h)*');
winners.forEach((c,i)=>out.push(coinLine(c, i+1, true, false)));
out.push('');

out.push('*Top Losers (24h)*');
losers.forEach((c,i)=>out.push(coinLine(c, i+1, false, true)));
out.push('');

const filteredById = Object.fromEntries(filtered.map(c=>[c.id,c]));
const allById = Object.fromEntries(markets.filter(c=>c).map(c=>[c.id,c]));

out.push('*Trending*');
trendingCoins.forEach((t,i)=>{
  const item = t.item;
  const tid = item.id;
  const name = item.name || '';
  const sym = (item.symbol || '').toUpperCase();
  const rank = item.market_cap_rank || '?';
  let priceUsd = null, p24 = null;
  if (item.data) {
    priceUsd = item.data.price;
    if (item.data.price_change_percentage_24h && item.data.price_change_percentage_24h.usd != null) {
      p24 = item.data.price_change_percentage_24h.usd;
    }
  }
  const cc = filteredById[tid] || allById[tid];
  if (cc) {
    if (priceUsd == null) priceUsd = cc.current_price;
    if (p24 == null) p24 = cc.price_change_percentage_24h_in_currency;
  }
  let tags = [];
  if (filteredById[tid]) {
    const isW = winners.some(w=>w.id===tid);
    const isL = losers.some(l=>l.id===tid);
    tags = computeTags(filteredById[tid], isW, isL);
  }
  const tagStr = tags.length ? `  [${tags.join(', ')}]` : '';
  const pFmt = priceUsd!=null ? fmtPrice(priceUsd) : 'n/a';
  const pctFmt = p24!=null ? fmtPct(p24) : 'n/a';
  out.push(`${i+1}. ${name} (${sym}) — #${rank}, ${pFmt}, 24h ${pctFmt}${tagStr}`);
});
out.push('');

const notable = [];
const seen = new Set();
function pushNotable(line) {
  if (!seen.has(line)) { seen.add(line); notable.push(line); }
}
for (const c of winners) {
  const sym = (c.symbol||'').toUpperCase();
  const cid = c.id||'';
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const p7 = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank || 999;
  const vol = c.total_volume || 0;
  const inTrending = trendingIds.has(cid);
  if (inTrending) pushNotable(`• ${sym}: trending and ${fmtPct(p24)} 24h on ${fmtMoney(vol)} vol — corroborated signal`);
  else if (p24 > 15 && p7 > 25) pushNotable(`• ${sym}: 24h ${fmtPct(p24)} on top of 7d ${fmtPct(p7)} — sustained breakout`);
  else if (rank > 150 && p24 > 30) pushNotable(`• ${sym}: rank #${rank} up ${fmtPct(p24)} — PUMP-RISK, low-cap manipulation probable`);
}
for (const c of losers) {
  const sym = (c.symbol||'').toUpperCase();
  const p24 = c.price_change_percentage_24h_in_currency || 0;
  const vol = c.total_volume || 0;
  const mcap = c.market_cap || 0;
  if (p24 < -10 && mcap > 0 && (vol/mcap) > 0.25) {
    pushNotable(`• ${sym}: ${fmtPct(p24)} 24h with vol/mcap ${(vol/mcap).toFixed(2)} — capitulation flush`);
  }
}
const finalNotable = notable.slice(0,4);
if (finalNotable.length) {
  out.push('*Notable*');
  finalNotable.forEach(l=>out.push(l));
  out.push('');
}

const outStr = out.join('\n').replace(/\n+$/,'') + '\n';
process.stderr.write(`Char count: ${outStr.length}\n`);
fs.writeFileSync('/home/runner/work/aeon/aeon/.outputs/token-movers.md', outStr);

const winnerStrs = winners.slice(0,6).map(w=>`${(w.symbol||'').toUpperCase()} (${fmtPct(w.price_change_percentage_24h_in_currency||0)})`);
const loserStrs = losers.slice(0,6).map(l=>`${(l.symbol||'').toUpperCase()} (${fmtPct(l.price_change_percentage_24h_in_currency||0)})`);
const trendingSyms = trendingCoins.map(t=>(t.item.symbol||'').toUpperCase());
const notableLines = finalNotable.map(l=>l.replace(/^•\s*/, '').slice(0,80));

const logEntry = `\n### token-movers
- Var: <none>
- Pulse: ${pulse}
- Winners: ${winnerStrs.join(', ')}
- Losers: ${loserStrs.join(', ')}
- Trending: ${trendingSyms.join(', ')}
- Notable: ${finalNotable.length} signals${finalNotable.length ? ' (' + notableLines.join('; ') + ')' : ''}
- Files: \`.outputs/token-movers.md\` (overwrote 05-06), this log entry. Tape vs prior: green ${green}/100 vs 85 (05-06) vs 88 (05-05).
`;

fs.writeFileSync('/home/runner/work/aeon/aeon/.outputs/_token_movers_log_v2.txt', logEntry);
console.log('OK');
console.log('PULSE:', pulse);
console.log('WINNER1:', winners[0] ? `${winners[0].symbol.toUpperCase()} ${fmtPct(winners[0].price_change_percentage_24h_in_currency)}` : 'none');
console.log('LOSER1:', losers[0] ? `${losers[0].symbol.toUpperCase()} ${fmtPct(losers[0].price_change_percentage_24h_in_currency)}` : 'none');
console.log('TRENDING1:', trendingCoins[0] ? trendingCoins[0].item.symbol : 'none');
console.log('NOTABLE_COUNT:', finalNotable.length);
