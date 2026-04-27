// Runner score pipeline
const fs = require('fs');

const FILES = [
  '.runners-global.json',
  '.runners-solana-trend.json', '.runners-solana-vol.json',
  '.runners-eth-trend.json', '.runners-eth-vol.json',
  '.runners-base-trend.json', '.runners-base-vol.json',
  '.runners-bsc-trend.json', '.runners-bsc-vol.json',
  '.runners-arb-trend.json', '.runners-arb-vol.json',
  '.runners-new.json',
];

const NEW_POOL_IDS = new Set();

function loadFile(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const j = JSON.parse(raw);
    if (j.status && j.status.error_code) return [];
    return j.data || [];
  } catch (e) { return []; }
}

const all = [];
for (const f of FILES) {
  const pools = loadFile(f);
  if (f === '.runners-new.json') {
    for (const p of pools) NEW_POOL_IDS.add(p.id);
  }
  for (const p of pools) all.push({ src: f, pool: p });
}

// Dedup by base_token id, keep highest h24 volume
const byToken = new Map();
for (const { src, pool } of all) {
  const a = pool.attributes || {};
  const baseId = pool.relationships?.base_token?.data?.id;
  if (!baseId) continue;
  const vol = parseFloat(a.volume_usd?.h24 || 0);
  const existing = byToken.get(baseId);
  if (!existing || vol > existing.vol) {
    byToken.set(baseId, { src, pool, vol });
  }
}

const unique = [...byToken.values()].map(v => v.pool);
console.log('PRE_GATE:', unique.length);

// Gate
const rejections = { thinVol: 0, dump: 0, lowLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0 };
const survivors = [];
const now = Date.now();
for (const p of unique) {
  const a = p.attributes || {};
  const vh24 = parseFloat(a.volume_usd?.h24 || 0);
  const pct24 = parseFloat(a.price_change_percentage?.h24 || 0);
  const liq = parseFloat(a.reserve_in_usd || 0);
  const txh = a.transactions?.h24 || {};
  const buys = parseInt(txh.buys || 0);
  const sells = parseInt(txh.sells || 0);
  const created = a.pool_created_at ? new Date(a.pool_created_at).getTime() : 0;
  const ageH = (now - created) / 3600000;

  if (vh24 < 50000) { rejections.thinVol++; continue; }
  if (pct24 <= 0) { rejections.dump++; continue; }
  if (liq < 10000) { rejections.lowLiq++; continue; }
  if (buys > 0 && sells / Math.max(buys, 1) > 10) { rejections.dumping++; continue; }
  if (sells > 0 && buys / Math.max(sells, 1) > 50) { rejections.honeypot++; continue; }
  if (ageH < 1 && vh24 < 100000) { rejections.tooNew++; continue; }
  if (pct24 > 10000) { rejections.rugLike++; continue; }

  survivors.push(p);
}

console.log('POST_GATE:', survivors.length);
console.log('REJECTIONS:', JSON.stringify(rejections));

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

const scored = survivors.map(p => {
  const a = p.attributes || {};
  const pct24 = parseFloat(a.price_change_percentage?.h24 || 0);
  const pct1h = parseFloat(a.price_change_percentage?.h1 || 0);
  const vh24 = parseFloat(a.volume_usd?.h24 || 0);
  const liq = parseFloat(a.reserve_in_usd || 0);
  const txh = a.transactions?.h24 || {};
  const buys = parseInt(txh.buys || 0);
  const sells = parseInt(txh.sells || 0);

  const pctP = clamp(pct24 / 500, 0, 1);
  const volP = clamp(Math.log10(vh24 + 1) / 7, 0, 1);
  const liqP = clamp(Math.log10(liq + 1) / 6, 0, 1);
  const momP = clamp((pct1h + 50) / 100, 0, 1);
  const skewP = clamp(buys / Math.max(buys + sells, 1), 0, 1);
  const score = 40 * pctP + 25 * volP + 15 * liqP + 10 * momP + 10 * skewP;

  const created = a.pool_created_at ? new Date(a.pool_created_at).getTime() : 0;
  const ageH = (now - created) / 3600000;

  let tag;
  if (liq >= 1_000_000 && vh24 >= 1_000_000) tag = 'DEEP-LIQ';
  else if (ageH <= 48 && vh24 >= 250_000) tag = 'BREAKOUT';
  else if (pct1h > 2 && pct24 > 50) tag = 'CONTINUATION';
  else if (pct1h < -5 && pct24 > 0) tag = 'REVERSAL';
  else tag = 'MICRO-SPEC';

  let network = p.relationships?.network?.data?.id;
  if (!network && p.id) network = p.id.split('_')[0];
  if (!network) network = 'unknown';
  const fdv = parseFloat(a.fdv_usd || 0);
  const mcap = a.market_cap_usd ? parseFloat(a.market_cap_usd) : null;
  return {
    name: a.name,
    network,
    pct24,
    pct1h,
    vh24,
    liq,
    fdv,
    mcap,
    buys,
    sells,
    ageH,
    score: Math.round(score * 10) / 10,
    tag,
    poolId: p.id,
  };
});

scored.sort((a, b) => b.score - a.score);

const top5 = scored.slice(0, 5);

// Verdict
const tagCounts = top5.reduce((acc, p) => { acc[p.tag] = (acc[p.tag] || 0) + 1; return acc; }, {});
let verdict;
if (survivors.length < 5) verdict = 'SLEEPY';
else if ((tagCounts['DEEP-LIQ'] || 0) >= 2) verdict = 'STRONG';
else if ((tagCounts['DEEP-LIQ'] || 0) >= 1 || (tagCounts['CONTINUATION'] || 0) >= 2) verdict = 'MIXED';
else verdict = 'SPECULATIVE';

console.log('VERDICT:', verdict);
console.log('TAG_COUNTS:', JSON.stringify(tagCounts));
console.log('TOP_5:');
for (let i = 0; i < top5.length; i++) {
  const p = top5[i];
  console.log(JSON.stringify(p));
}

fs.writeFileSync('.runners-result.json', JSON.stringify({
  preGate: unique.length,
  postGate: survivors.length,
  rejections,
  verdict,
  tagCounts,
  top5,
  fullScored: scored.slice(0, 25),
}, null, 2));
