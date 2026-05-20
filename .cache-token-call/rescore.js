#!/usr/bin/env node
// token-call scoring for 2026-05-20 third run
const fs = require('fs');

const trending = JSON.parse(fs.readFileSync('.cache-token-call/trending.json', 'utf8'));
const markets = JSON.parse(fs.readFileSync('.cache-token-call/markets.json', 'utf8'));
const dex = JSON.parse(fs.readFileSync('.cache-token-call/dex_trending.json', 'utf8'));

// 7-day dedup list (canonical symbols)
const DEDUP = new Set(['LIT','VVV','CHZ','HYPE','NEAR','INJ','BSB','TRAC','KAIA']);

const trendingSymbols = new Set();
for (const it of (trending.coins || [])) {
  if (it.item && it.item.symbol) trendingSymbols.add(it.item.symbol.toUpperCase());
}

// DexScreener trending — extract base token symbols from top pairs by volume
const dexSymbols = new Set();
if (dex && Array.isArray(dex.pairs)) {
  const sorted = [...dex.pairs].sort((a,b) => (b.volume?.h24||0) - (a.volume?.h24||0));
  for (const p of sorted.slice(0, 80)) {
    if (p.baseToken && p.baseToken.symbol) dexSymbols.add(p.baseToken.symbol.toUpperCase());
  }
}

// Find BTC and ETH 7d as RS benchmark
const btc = markets.find(c => c.symbol && c.symbol.toLowerCase() === 'btc');
const eth = markets.find(c => c.symbol && c.symbol.toLowerCase() === 'eth');
const btc7d = btc ? btc.price_change_percentage_7d_in_currency : 0;
const eth7d = eth ? eth.price_change_percentage_7d_in_currency : 0;
const btc24h = btc ? btc.price_change_percentage_24h_in_currency : 0;
const eth24h = eth ? eth.price_change_percentage_24h_in_currency : 0;

console.log(`BTC 24h ${btc24h.toFixed(2)}% / 7d ${btc7d.toFixed(2)}%`);
console.log(`ETH 24h ${eth24h.toFixed(2)}% / 7d ${eth7d.toFixed(2)}%`);
console.log(`CG trending list: ${[...trendingSymbols].join(', ')}`);
console.log(`DEX trending (top 80 pairs by 24h vol, sample): ${[...dexSymbols].slice(0,30).join(', ')}`);
console.log('');

const scored = [];
for (const c of markets) {
  if (!c.market_cap || c.market_cap < 20_000_000) continue;
  const sym = (c.symbol || '').toUpperCase();
  if (DEDUP.has(sym)) continue;
  const p24 = c.price_change_percentage_24h_in_currency;
  const p7 = c.price_change_percentage_7d_in_currency;
  if (p24 == null || p7 == null) continue;
  const vol = c.total_volume || 0;
  const vmc = vol / c.market_cap;
  let s = 0;
  const parts = [];
  if (p24 > 0) { s += 1; parts.push('24h+'); }
  if (p7 > 0) { s += 1; parts.push('7d+'); }
  if (p24 > 5 && p7 > 5) { s += 2; parts.push('both>5%'); }
  if (trendingSymbols.has(sym)) { s += 2; parts.push('CG-trending'); }
  if (vmc >= 0.20) { s += 3; parts.push(`vmc${vmc.toFixed(2)}>=0.20`); }
  else if (vmc >= 0.10) { s += 2; parts.push(`vmc${vmc.toFixed(2)}>=0.10`); }
  if (p7 > btc7d && p7 > eth7d) { s += 2; parts.push('outpaceBTC+ETH7d'); }
  if (dexSymbols.has(sym)) { s += 1; parts.push('DEX-trending'); }
  scored.push({ sym, name: c.name, price: c.current_price, mcap: c.market_cap, vol, vmc, p24, p7, score: s, parts });
}

scored.sort((a,b) => b.score - a.score || b.vmc - a.vmc);

console.log('Top 25 candidates (after $20M floor + 7d dedup):');
console.log('Rank | SYM        | $price        | 24h%   | 7d%    | mcap$M  | vol$M  | vmc   | score | signals');
console.log('-----+------------+---------------+--------+--------+---------+--------+-------+-------+------------------------');
for (let i = 0; i < Math.min(25, scored.length); i++) {
  const c = scored[i];
  const r = (i+1).toString().padStart(2);
  const pr = ('$' + c.price.toPrecision(5)).padEnd(13);
  const mc = (c.mcap/1e6).toFixed(0).padStart(7);
  const vl = (c.vol/1e6).toFixed(0).padStart(6);
  const p24 = c.p24.toFixed(2).padStart(6);
  const p7 = c.p7.toFixed(2).padStart(6);
  const v = c.vmc.toFixed(3).padStart(5);
  console.log(`${r}   | ${c.sym.padEnd(10)} | ${pr} | ${p24} | ${p7} | ${mc} | ${vl} | ${v} |  ${c.score}/10 | ${c.parts.join(', ')}`);
}
