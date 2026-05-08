#!/usr/bin/env node
const fs = require('fs');

const markets = JSON.parse(fs.readFileSync('.outputs/cg-markets.json','utf8'));
const trending = JSON.parse(fs.readFileSync('.outputs/cg-trending.json','utf8'));

const STABLE_IDS = new Set([
  'tether','usd-coin','dai','first-digital-usd','ethena-usde','tusd','usdd','paypal-usd','pyusd','fdusd','paxg','true-usd',
  'frax','lusd','usdb','usds','susds','crvusd','gho','susd','usdp','tether-eurt','tether-gold','sky-dollar-usds','wrapped-usdr','usde',
  'paxos-standard','liquity-usd','staked-usds','usdr','rai','origin-dollar','reserve-rights-token','dola','feiusd'
]);
function isStable(c){
  if (STABLE_IDS.has(c.id)) return true;
  const sym = (c.symbol||'').toUpperCase();
  if (/^USD/.test(sym) || /^EUR/.test(sym) || /^GBP/.test(sym)) return true;
  if (sym==='USDE' || sym==='USDS' || sym==='SUSDS' || sym==='SUSD' || sym==='USDD') return true;
  const name = (c.name||'').toLowerCase();
  if (name.includes('stablecoin')) return true;
  return false;
}

const WRAPPED = new Set(['wbtc','weth','steth','wsteth','wbeth','reth','cbeth','meth','tbtc','sweth','rseth','ezeth','renbtc','msol','jitosol']);
function isWrapped(c){ return WRAPPED.has(c.id); }

const filtered = markets.filter(c => {
  if (!c) return false;
  if (isStable(c)) return false;
  if (isWrapped(c)) return false;
  if ((c.total_volume||0) < 1_000_000) return false;
  if (c.price_change_percentage_24h == null) return false;
  return true;
});

const top100 = filtered.slice(0,100);
const top50 = filtered.slice(0,50);
const greenIn100 = top100.filter(c => (c.price_change_percentage_24h||0) > 0).length;
const sortedTop50 = top50.map(c=>c.price_change_percentage_24h).sort((a,b)=>a-b);
const median50 = sortedTop50.length ? sortedTop50[Math.floor(sortedTop50.length/2)] : 0;

const sortedByChange = [...filtered].sort((a,b)=>b.price_change_percentage_24h-a.price_change_percentage_24h);
const winners = sortedByChange.slice(0,10);
const losers = [...filtered].sort((a,b)=>a.price_change_percentage_24h-b.price_change_percentage_24h).slice(0,10);

const trendingList = (trending.coins||[]).slice(0,7).map(t=>{
  const item = t.item || {};
  const data = item.data || {};
  return {
    id: item.id,
    name: item.name,
    symbol: (item.symbol||'').toUpperCase(),
    rank: item.market_cap_rank,
    price: data.price ? Number(data.price) : null,
    pct24: data.price_change_percentage_24h && data.price_change_percentage_24h.usd != null
      ? data.price_change_percentage_24h.usd : null,
    total_volume: data.total_volume || null,
    market_cap: data.market_cap || null
  };
});
const trendingIds = new Set(trendingList.map(t => t.id));

function tagsFor(c, isWinner, isLoser){
  const tags = [];
  const ch24 = c.price_change_percentage_24h || 0;
  const ch7d = c.price_change_percentage_7d_in_currency || 0;
  const rank = c.market_cap_rank || 9999;
  const mcap = c.market_cap || 0;
  const vol = c.total_volume || 0;
  const inTrending = trendingIds.has(c.id);
  if (inTrending && isWinner) tags.push('TRENDING+UP');
  if (inTrending && isLoser) tags.push('TRENDING+DOWN');
  if (ch24 > 15 && ch7d > 25) tags.push('BREAKOUT');
  if (ch24 > 20 && ch7d < 0) tags.push('FADE');
  if (ch24 < -10 && (mcap > 0 ? (vol/mcap) : 0) > 0.25) tags.push('CAPITULATION');
  if (rank > 150 && ch24 > 30) tags.push('PUMP-RISK');
  if (mcap < 50_000_000) tags.push('MICROCAP');
  if (rank <= 20) tags.push('MAJOR');
  const priority = ['TRENDING+UP','TRENDING+DOWN','BREAKOUT','PUMP-RISK','CAPITULATION','FADE','MAJOR','MICROCAP'];
  return tags.sort((a,b)=>priority.indexOf(a)-priority.indexOf(b)).slice(0,2);
}

function fmtPrice(p){
  if (p == null) return '?';
  if (p >= 100) return '$' + p.toLocaleString('en-US', {maximumFractionDigits: 2});
  if (p >= 1) return '$' + p.toPrecision(4);
  if (p >= 0.01) return '$' + p.toPrecision(3);
  return '$' + p.toFixed(6);
}
function fmtBig(n){
  if (n == null) return '?';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}
function fmtPct(p){
  if (p == null) return '?';
  const sign = p > 0 ? '+' : '';
  return sign + p.toFixed(1) + '%';
}

function row(c, idx, isWinner, isLoser){
  const tags = tagsFor(c, isWinner, isLoser);
  const tagStr = tags.length ? '  [' + tags.join(',') + ']' : '';
  const sym = (c.symbol||'').toUpperCase();
  const ch1h = c.price_change_percentage_1h_in_currency;
  const ch24 = c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency;
  return `${idx+1}. ${sym} (${c.name}) — ${fmtPrice(c.current_price)}  ${fmtPct(ch24)} / 7d ${fmtPct(ch7d)} / 1h ${fmtPct(ch1h)}  •  ${fmtBig(c.total_volume)} / #${c.market_cap_rank||'?'}${tagStr}`;
}

const winnersOut = winners.map((c,i) => row(c,i,true,false));
const losersOut = losers.map((c,i) => row(c,i,false,true));

const trendOut = trendingList.map((t,i)=>{
  const tags = [];
  if (t.rank && t.rank <= 20) tags.push('MAJOR');
  if (t.rank && t.rank > 250) tags.push('MICROCAP');
  if (t.pct24 != null && t.pct24 > 30 && t.rank && t.rank > 150) tags.push('PUMP-RISK');
  const tagStr = tags.length ? '  [' + tags.slice(0,2).join(',') + ']' : '';
  const symPart = t.symbol ? `${t.name} (${t.symbol})` : t.name;
  return `${i+1}. ${symPart} — #${t.rank||'?'}, ${fmtPrice(t.price)}, 24h ${fmtPct(t.pct24)}${tagStr}`;
});

// Notable
const notables = [];
for (const c of winners){
  const tags = tagsFor(c,true,false);
  const ch24 = c.price_change_percentage_24h;
  const ch7d = c.price_change_percentage_7d_in_currency;
  const sym = (c.symbol||'').toUpperCase();
  if (tags.includes('TRENDING+UP')){
    notables.push(`• ${sym}: trending and ${fmtPct(ch24)} on ${fmtBig(c.total_volume)} vol — corroborated signal`);
  } else if (tags.includes('PUMP-RISK')){
    notables.push(`• ${sym}: #${c.market_cap_rank} rank up ${ch24.toFixed(1)}% — PUMP-RISK, low-cap tier`);
  } else if (tags.includes('BREAKOUT')){
    notables.push(`• ${sym}: 24h ${fmtPct(ch24)} on top of 7d ${fmtPct(ch7d)} — sustained breakout`);
  } else if (tags.includes('FADE')){
    notables.push(`• ${sym}: 24h ${fmtPct(ch24)} but 7d ${fmtPct(ch7d)} — relief bounce in downtrend`);
  }
}
for (const c of losers){
  const tags = tagsFor(c,false,true);
  const ch24 = c.price_change_percentage_24h;
  const sym = (c.symbol||'').toUpperCase();
  if (tags.includes('CAPITULATION')){
    notables.push(`• ${sym}: 24h ${fmtPct(ch24)} on heavy turnover — CAPITULATION signal`);
  } else if (tags.includes('TRENDING+DOWN')){
    notables.push(`• ${sym}: trending and ${fmtPct(ch24)} — capitulation/news drawdown`);
  }
}
const notableSet = [];
const seenNotable = new Set();
for (const n of notables){
  if (!seenNotable.has(n)){ seenNotable.add(n); notableSet.push(n); }
  if (notableSet.length >= 4) break;
}

// Pulse
let pulse;
const pctGreen = greenIn100;
let tone;
if (pctGreen >= 65) tone = 'risk-on';
else if (pctGreen <= 35) tone = 'risk-off';
else tone = 'mixed';
if (Math.abs(median50) < 1) {
  pulse = `Quiet tape — ${pctGreen}/100 top coins green, median top-50 ${fmtPct(median50)}; trending dominated more by listings than price moves.`;
} else if (tone === 'risk-on'){
  pulse = `Risk-on tape — ${pctGreen}/100 top coins green, median top-50 ${fmtPct(median50)}.`;
} else if (tone === 'risk-off'){
  pulse = `Risk-off — ${pctGreen}/100 top coins green, median top-50 ${fmtPct(median50)}; losers dominate.`;
} else {
  pulse = `Mixed tape — ${pctGreen}/100 top coins green, median top-50 ${fmtPct(median50)}.`;
}

const today = new Date().toISOString().slice(0,10);

let msg = `*Token Movers — ${today}*\n\n_${pulse}_\n\n*Top Winners (24h)*\n${winnersOut.join('\n')}\n\n*Top Losers (24h)*\n${losersOut.join('\n')}\n\n*Trending*\n${trendOut.join('\n')}`;

if (notableSet.length){
  msg += `\n\n*Notable*\n${notableSet.join('\n')}`;
}

if (msg.length > 4000) {
  msg = msg.slice(0, 3990) + '\n…';
}

fs.writeFileSync('.outputs/token-movers.md', msg);

const payload = {
  pulse, pctGreen, median50,
  winners: winners.map(c => ({sym:(c.symbol||'').toUpperCase(),name:c.name,id:c.id,rank:c.market_cap_rank,price:c.current_price,ch24:c.price_change_percentage_24h,ch7d:c.price_change_percentage_7d_in_currency,ch1h:c.price_change_percentage_1h_in_currency,vol:c.total_volume,mcap:c.market_cap,tags:tagsFor(c,true,false)})),
  losers: losers.map(c => ({sym:(c.symbol||'').toUpperCase(),name:c.name,id:c.id,rank:c.market_cap_rank,price:c.current_price,ch24:c.price_change_percentage_24h,ch7d:c.price_change_percentage_7d_in_currency,ch1h:c.price_change_percentage_1h_in_currency,vol:c.total_volume,mcap:c.market_cap,tags:tagsFor(c,false,true)})),
  trending: trendingList,
  notables: notableSet,
};
fs.writeFileSync('.outputs/movers-0508.json', JSON.stringify(payload, null, 2));

console.log(msg);
console.log('\n---');
console.log('Length:', msg.length, 'Green/100:', pctGreen, 'Median50:', median50.toFixed(2));
