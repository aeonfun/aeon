const fs = require('fs');
const path = '/home/runner/work/aeon/aeon/.mrdata/';
const files = fs.readdirSync(path).filter(f => f.endsWith('.json'));
const pools = {};
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

for (const fn of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path + fn, 'utf8')); } catch (e) { continue; }
  if (!data || !Array.isArray(data.data)) continue;
  for (const p of data.data) {
    const a = p.attributes || {};
    const rel = p.relationships || {};
    const btid = ((rel.base_token || {}).data || {}).id;
    let net = ((rel.network || {}).data || {}).id;
    if (!net && typeof p.id === 'string' && p.id.includes('_')) net = p.id.split('_')[0];
    net = net || '?';
    const netMap = { solana: 'sol', ethereum: 'eth' };
    net = netMap[net] || net;
    if (!btid) continue;
    const vol24 = num((a.volume_usd || {}).h24) || 0;
    const rec = {
      name: a.name || '?', net, btid,
      pc: a.price_change_percentage || {},
      vol: a.volume_usd || {},
      vol24,
      mcap: num(a.market_cap_usd),
      fdv: num(a.fdv_usd),
      tx: ((a.transactions || {}).h24) || {},
      created: a.pool_created_at,
      liq: num(a.reserve_in_usd) || 0,
    };
    const prev = pools[btid];
    if (!prev || vol24 > prev.vol24) pools[btid] = rec;
  }
}

const pre = Object.keys(pools).length;
const now = Date.now();
const ageH = s => { if (!s) return null; const t = Date.parse(s); return isNaN(t) ? null : (now - t) / 3600000; };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const rej = { 'thin-vol': 0, down: 0, 'thin-liq': 0, dumping: 0, honeypot: 0, 'too-new': 0, 'rug-like': 0 };
const survivors = [];
for (const r of Object.values(pools)) {
  const pc24 = num(r.pc.h24);
  const buys = num(r.tx.buys) || 0;
  const sells = num(r.tx.sells) || 0;
  r.age = ageH(r.created);
  if (r.vol24 < 50000) { rej['thin-vol']++; continue; }
  if (pc24 == null || pc24 <= 0) { rej.down++; continue; }
  if (r.liq < 10000) { rej['thin-liq']++; continue; }
  if (buys > 0 && sells / buys > 10) { rej.dumping++; continue; }
  if (sells > 0 && buys / sells > 50) { rej.honeypot++; continue; }
  if (sells === 0 && buys > 0) { rej.honeypot++; continue; }
  if (r.age != null && r.age < 1 && r.vol24 < 100000) { rej['too-new']++; continue; }
  if (pc24 > 10000) { rej['rug-like']++; continue; }
  survivors.push(r);
}

for (const r of survivors) {
  const pc24 = num(r.pc.h24) || 0;
  const pc1 = num(r.pc.h1) || 0;
  const buys = num(r.tx.buys) || 0;
  const sells = num(r.tx.sells) || 0;
  const pct = clamp(pc24 / 500, 0, 1);
  const vol = clamp(Math.log10(r.vol24 + 1) / 7, 0, 1);
  const liq = clamp(Math.log10(r.liq + 1) / 6, 0, 1);
  const mom = clamp((pc1 + 50) / 100, 0, 1);
  const skew = (buys + sells) > 0 ? clamp(buys / (buys + sells), 0, 1) : 0.5;
  r.score = 40 * pct + 25 * vol + 15 * liq + 10 * mom + 10 * skew;
  r.skew = skew;
  if (r.liq >= 1e6 && r.vol24 >= 1e6) r.tag = 'DEEP-LIQ';
  else if (r.age != null && r.age <= 48 && r.vol24 >= 250000) r.tag = 'BREAKOUT';
  else if (pc1 > 2 && pc24 > 50) r.tag = 'CONTINUATION';
  else if (pc1 < -5 && pc24 > 0) r.tag = 'REVERSAL';
  else r.tag = 'MICRO-SPEC';
}

survivors.sort((a, b) => b.score - a.score);
console.log('PRE', pre, 'POST', survivors.length);
console.log('REJ', JSON.stringify(rej));
for (const r of survivors.slice(0, 15)) {
  const pc1 = num(r.pc.h1) || 0, pc6 = num(r.pc.h6) || 0, pc24 = num(r.pc.h24) || 0;
  const buys = num(r.tx.buys) || 0, sells = num(r.tx.sells) || 0;
  console.log(`${r.score.toFixed(1)} [${r.tag}] ${r.name} (${r.net}) h24=${pc24.toFixed(0)}% h6=${pc6.toFixed(0)}% h1=${pc1.toFixed(1)}% vol=${Math.round(r.vol24)} liq=${Math.round(r.liq)} skew=${r.skew.toFixed(2)} buys=${buys} sells=${sells} age=${r.age==null?'?':r.age.toFixed(1)+'h'} mcap=${r.mcap==null?'null':Math.round(r.mcap)}`);
}
