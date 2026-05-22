const fs = require('fs');
const path = require('path');

const CACHE = '/home/runner/work/aeon/aeon/.gt-cache';
const NOW = new Date();

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const fnum = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Only ingest the canonical 12 fetched endpoint files, not the WebFetch caches or aux jsons.
const FILES = [
  'global.json',
  'solana-trend.json','solana-vol.json',
  'eth-trend.json','eth-vol.json',
  'base-trend.json','base-vol.json',
  'bsc-trend.json','bsc-vol.json',
  'arbitrum-trend.json','arbitrum-vol.json',
  'new.json',
];

const pools = new Map();
let raw = 0;
const seenPerFile = {};

for (const f of FILES) {
  const fp = path.join(CACHE, f);
  let txt;
  try { txt = fs.readFileSync(fp, 'utf8'); } catch (e) { seenPerFile[f] = 'missing'; continue; }
  let data;
  try { data = JSON.parse(txt); } catch (e) { seenPerFile[f] = 'parse-error'; continue; }
  if (!data || !Array.isArray(data.data)) { seenPerFile[f] = 'no-data-array'; continue; }
  seenPerFile[f] = data.data.length;
  for (const p of data.data) {
    const a = p.attributes || {};
    const rel = p.relationships || {};
    raw++;
    const bt = (rel.base_token && rel.base_token.data) || {};
    const net = (rel.network && rel.network.data) || {};
    const btId = bt.id || a.address;
    let networkId = net.id;
    if (!networkId) {
      // Derive from base_token id prefix or pool id prefix
      const probe = (bt.id || p.id || '');
      const m = probe.match(/^([a-z0-9-]+?)_/);
      if (m) networkId = m[1];
    }
    if (!networkId) networkId = '?';
    const vol = a.volume_usd || {};
    const pcp = a.price_change_percentage || {};
    const txn = (a.transactions && a.transactions.h24) || {};
    const rec = {
      name: a.name || '?',
      network: networkId,
      h24v: fnum(vol.h24) || 0,
      h24p: fnum(pcp.h24),
      h6p:  fnum(pcp.h6),
      h1p:  fnum(pcp.h1),
      reserve: fnum(a.reserve_in_usd) || 0,
      mcap: fnum(a.market_cap_usd),
      fdv: fnum(a.fdv_usd),
      buys: parseInt(txn.buys || 0, 10),
      sells: parseInt(txn.sells || 0, 10),
      created: a.pool_created_at || null,
      bt_id: btId,
    };
    const prev = pools.get(btId);
    if (!prev || rec.h24v > prev.h24v) pools.set(btId, rec);
  }
}

const deduped = [...pools.values()];
const preGate = deduped.length;
const rej = {'thin-vol':0,'down/no-move':0,'thin-liq':0,'dumping':0,'honeypot':0,'too-new':0,'rug-like':0};
const survivors = [];

for (const r of deduped) {
  if (r.h24v < 50000) { rej['thin-vol']++; continue; }
  if (r.h24p == null || r.h24p <= 0) { rej['down/no-move']++; continue; }
  if (r.reserve < 10000) { rej['thin-liq']++; continue; }
  const {buys: b, sells: s} = r;
  if (b > 0 && s / b > 10) { rej['dumping']++; continue; }
  if (s > 0 && b / s > 50) { rej['honeypot']++; continue; }
  let ageH = null;
  if (r.created) {
    const ct = new Date(r.created);
    if (!isNaN(ct)) ageH = (NOW - ct) / 3600000;
  }
  r.age_h = ageH;
  if (ageH != null && ageH < 1 && r.h24v < 100000) { rej['too-new']++; continue; }
  if (r.h24p > 10000) { rej['rug-like']++; continue; }
  survivors.push(r);
}

const postGate = survivors.length;

for (const r of survivors) {
  const h24p = r.h24p;
  const h1p = r.h1p == null ? 0 : r.h1p;
  const pct_pts = clamp(h24p / 500, 0, 1);
  const vol_pts = clamp(Math.log10(r.h24v + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(r.reserve + 1) / 6, 0, 1);
  const mom_pts = clamp((h1p + 50) / 100, 0, 1);
  const tot = r.buys + r.sells;
  const skew_pts = tot > 0 ? clamp(r.buys / tot, 0, 1) : 0.5;
  r.score = 40*pct_pts + 25*vol_pts + 15*liq_pts + 10*mom_pts + 10*skew_pts;
  r.skew = tot > 0 ? (r.buys / tot) * 100 : 0;

  const age = r.age_h;
  if (r.reserve >= 1_000_000 && r.h24v >= 1_000_000) r.tag = 'DEEP-LIQ';
  else if (age != null && age <= 48 && r.h24v >= 250_000) r.tag = 'BREAKOUT';
  else if (h1p > 2 && h24p > 50) r.tag = 'CONTINUATION';
  else if (h1p < -5 && h24p > 0) r.tag = 'REVERSAL';
  else r.tag = 'MICRO-SPEC';
}

survivors.sort((a, b) => b.score - a.score);
const top = survivors.slice(0, 5);

console.log('RAW_OBJECTS:', raw);
console.log('PRE_GATE:', preGate);
console.log('POST_GATE:', postGate);
console.log('REJECTIONS:', JSON.stringify(rej));
console.log('PER_FILE:', JSON.stringify(seenPerFile));
console.log('TOP5:');
for (let i = 0; i < top.length; i++) {
  const r = top[i];
  const age = r.age_h != null ? `${Math.round(r.age_h)}h` : 'n/a';
  const h1p = r.h1p == null ? 'null' : r.h1p.toFixed(2);
  const h6p = r.h6p == null ? 'null' : r.h6p.toFixed(2);
  console.log(`  ${i+1}. [${r.tag}] ${r.name} (${r.network}) h24=${r.h24p.toFixed(0)}% score=${r.score.toFixed(1)} vol=${Math.round(r.h24v)} liq=${Math.round(r.reserve)} h1=${h1p} h6=${h6p} buys=${r.buys} sells=${r.sells} skew=${r.skew.toFixed(0)}% mcap=${r.mcap} fdv=${r.fdv} age=${age}`);
}
const tagCounts = top.reduce((acc, r) => { acc[r.tag] = (acc[r.tag] || 0) + 1; return acc; }, {});
console.log('TOP5_TAGS:', JSON.stringify(tagCounts));

// Surface DEEP-LIQ pools that survived gate but missed top-5, for log color
const deepliq = survivors.filter(r => r.tag === 'DEEP-LIQ' && !top.includes(r));
console.log('DEEP_LIQ_SURVIVED_BUT_OFFBOARD:', deepliq.length);
for (let i = 0; i < Math.min(deepliq.length, 8); i++) {
  const r = deepliq[i];
  console.log(`    ${r.name} (${r.network}) +${r.h24p.toFixed(0)}% vol=$${Math.round(r.h24v)} liq=$${Math.round(r.reserve)} score=${r.score.toFixed(1)}`);
}

fs.writeFileSync(path.join(CACHE, 'processed.json'), JSON.stringify({top, all: survivors, rej, preGate, postGate, raw, tagCounts}, null, 2));
