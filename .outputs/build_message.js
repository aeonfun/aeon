const fs = require('fs');
const r = JSON.parse(fs.readFileSync('.outputs/movers-0506.json','utf8'));

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
  if (x >= 1e6) return '$' + (x/1e6).toFixed(0) + 'M';
  if (x >= 1e3) return '$' + (x/1e3).toFixed(0) + 'K';
  return '$' + (x||0).toFixed(0);
}
function pct(x) { if (x==null||isNaN(x)) return 'n/a'; return (x>=0?'+':'') + x.toFixed(1) + '%'; }
function tagStr(tags) { return tags && tags.length ? '  [' + tags.join(', ') + ']' : ''; }
const NB = ' '; // non-breaking, but normal ASCII works too

const out = [];
out.push(`*Token Movers — 2026-05-06*`);
out.push('');
out.push(`_Risk-on day 2 — 85/100 top coins green, median top-50 +2.8%; ZEC +34% / 7d +73% breaks out at rank #15 (first MAJOR-tier privacy rotation this cycle), TON day-2 +30.6% / 7d +80%, BILL #230 +53% on $246M vol = PUMP-RISK; majors split — BTC $82,084 +0.6%, ETH $2,396 flat, SOL $89.26 +3.8%._`);
out.push('');
out.push('*Top Winners (24h)*');
r.winners.forEach((w,i) => {
  const sym = w.symbol || '';
  const name = w.name && w.name !== w.symbol ? ` (${w.name})` : '';
  out.push(`${i+1}. ${sym}${name} — ${fmtPrice(w.price)}  ${pct(w.ch24)} / 7d ${pct(w.ch7d)} / 1h ${pct(w.ch1h)}  •  ${fmtBig(w.volume)} / #${w.rank}${tagStr(w.tags)}`);
});
out.push('');
out.push('*Top Losers (24h)*');
r.losers.forEach((l,i) => {
  let sym = l.symbol || '';
  let name = l.name || '';
  // BinanceLife / non-ASCII symbol cleanup
  if (l.id === 'binance-life' || /BinanceLife/i.test(name)) { sym = 'BLIFE'; name = 'BinanceLife'; }
  const nameStr = name && name !== sym ? ` (${name})` : '';
  out.push(`${i+1}. ${sym}${nameStr} — ${fmtPrice(l.price)}  ${pct(l.ch24)} / 7d ${pct(l.ch7d)} / 1h ${pct(l.ch1h)}  •  ${fmtBig(l.volume)} / #${l.rank}${tagStr(l.tags)}`);
});
out.push('');
out.push('*Trending*');
r.trending.forEach((t,i) => {
  const sym = t.symbol || '';
  const name = t.name && t.name !== t.symbol ? ` (${t.name})` : '';
  out.push(`${i+1}. ${sym}${name} — #${t.rank ?? '?'}, ${fmtPrice(t.price)}, 24h ${pct(t.ch24)}${tagStr(t.tags)}`);
});
out.push('');
out.push('*Notable*');
out.push('• ZEC: MAJOR-tier #15 +34% / 7d +73% on $1.71B vol — first sustained privacy-coin MAJOR breakout this cycle; DASH +26% + FIRO +21% confirm rotation flagged 05-04 has legs');
out.push('• BILL: #230 +53% on $246M vol (1.6× v/mc turnover) — PUMP-RISK on rank tier; was trending tail yesterday at +25%, breakout-or-bust today');
out.push('• LAB: 7d +381% / 24h +25% — day-5 pump-cycle still compounding; rank #167 = manipulation surface wide');
out.push('• Pump-cycle FLIPS: SKYAI (-5% → +26% V-shape re-fire), DASH (-8% → +26%) — same low-cap mean-reversion-volatility signature flagged 05-04/05-05');

const msg = out.join('\n');
fs.writeFileSync('.outputs/token-movers.md', msg);
console.error('CHARS:', msg.length);
process.stdout.write(msg);
