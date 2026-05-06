const fs = require('fs');
const path = require('path');

const ROOT = '/home/runner/work/aeon/aeon';
const TODAY = '2026-05-06';

const sources = {
  'gt-global':       `.runners-global.json`,
  'gt-solana-trend': `.runners-solana-trend.json`,
  'gt-solana-vol':   `.runners-solana-vol.json`,
  'gt-eth-trend':    `.runners-eth-trend.json`,
  'gt-eth-vol':      `.runners-eth-vol.json`,
  'gt-base-trend':   `.runners-base-trend.json`,
  'gt-base-vol':     `.runners-base-vol.json`,
  'gt-bsc-trend':    `.runners-bsc-trend.json`,
  'gt-bsc-vol':      `.runners-bsc-vol.json`,
  'gt-arbitrum-trend': `.runners-arbitrum-trend.json`,
  'gt-arbitrum-vol':   `.runners-arbitrum-vol.json`,
  'gt-new':            `.runners-new.json`,
};

const sourceStatus = {};
const allPools = [];

for (const [key, file] of Object.entries(sources)) {
  const fp = path.join(ROOT, file);
  try {
    const txt = fs.readFileSync(fp, 'utf8');
    const j = JSON.parse(txt);
    if (j.status && j.status.error_code) {
      sourceStatus[key] = `fail(${j.status.error_code})`;
      continue;
    }
    if (!Array.isArray(j.data)) {
      sourceStatus[key] = 'fail(no-data)';
      continue;
    }
    sourceStatus[key] = 'ok';
    for (const p of j.data) allPools.push(p);
  } catch (e) {
    sourceStatus[key] = `fail(${e.message.slice(0, 30)})`;
  }
}

console.log('=== source status ===');
for (const [k, v] of Object.entries(sourceStatus)) console.log(`  ${k}: ${v}`);

const byToken = new Map();
for (const p of allPools) {
  const tokenId = p.relationships?.base_token?.data?.id;
  if (!tokenId) continue;
  const vol = parseFloat(p.attributes?.volume_usd?.h24 || '0');
  const existing = byToken.get(tokenId);
  if (!existing || vol > parseFloat(existing.attributes?.volume_usd?.h24 || '0')) {
    byToken.set(tokenId, p);
  }
}
const preGate = byToken.size;
console.log(`\npools pre-gate (unique tokens): ${preGate}`);

const rejections = { thinVol: 0, negPct: 0, lowLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0 };
const survivors = [];
const NOW = Date.now();
for (const p of byToken.values()) {
  const a = p.attributes;
  const vol24 = parseFloat(a.volume_usd?.h24 || '0');
  const pct24 = parseFloat(a.price_change_percentage?.h24 || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const buys = parseInt(a.transactions?.h24?.buys || '0', 10);
  const sells = parseInt(a.transactions?.h24?.sells || '0', 10);
  const created = a.pool_created_at ? new Date(a.pool_created_at).getTime() : NOW;
  const ageH = (NOW - created) / 3600000;

  if (vol24 < 50000) { rejections.thinVol++; continue; }
  if (pct24 <= 0) { rejections.negPct++; continue; }
  if (liq < 10000) { rejections.lowLiq++; continue; }
  if (sells > 0 && buys / sells < 0.1) { rejections.dumping++; continue; }
  if (sells > 0 && buys / sells > 50) { rejections.honeypot++; continue; }
  if (sells === 0 && buys > 100) { rejections.honeypot++; continue; }
  if (ageH < 1 && vol24 < 100000) { rejections.tooNew++; continue; }
  if (pct24 > 10000) { rejections.rugLike++; continue; }

  survivors.push(p);
}
console.log(`pools post-gate: ${survivors.length}`);
console.log('rejections:', rejections);

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
const scored = survivors.map(p => {
  const a = p.attributes;
  const vol24 = parseFloat(a.volume_usd?.h24 || '0');
  const pct24 = parseFloat(a.price_change_percentage?.h24 || '0');
  const pctH1 = parseFloat(a.price_change_percentage?.h1 || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const buys = parseInt(a.transactions?.h24?.buys || '0', 10);
  const sells = parseInt(a.transactions?.h24?.sells || '0', 10);
  const created = a.pool_created_at ? new Date(a.pool_created_at).getTime() : NOW;
  const ageH = (NOW - created) / 3600000;

  const pct_pts = clamp(pct24 / 500, 0, 1);
  const vol_pts = clamp(Math.log10(vol24 + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(liq + 1) / 6, 0, 1);
  const mom_pts = clamp((pctH1 + 50) / 100, 0, 1);
  const skew_pts = (buys + sells) > 0 ? clamp(buys / (buys + sells), 0, 1) : 0.5;
  const score = 40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts;

  let tag = 'MICRO-SPEC';
  if (liq >= 1_000_000 && vol24 >= 1_000_000) tag = 'DEEP-LIQ';
  else if (ageH <= 48 && vol24 >= 250000) tag = 'BREAKOUT';
  else if (pctH1 > 2 && pct24 > 50) tag = 'CONTINUATION';
  else if (pctH1 < -5 && pct24 > 0) tag = 'REVERSAL';

  const fdv = parseFloat(a.fdv_usd || '0') || null;
  const mcap = parseFloat(a.market_cap_usd || '0') || null;
  const network = p.relationships?.network?.data?.id || 'unknown';
  const tokenId = p.relationships?.base_token?.data?.id || 'unknown';

  return {
    poolId: p.id,
    tokenId,
    network,
    name: a.name,
    pct24, pctH1, vol24, liq, fdv, mcap, buys, sells, ageH, tag, score,
  };
});

scored.sort((a, b) => b.score - a.score);

const top5 = scored.slice(0, 5);
const top10 = scored.slice(0, 10);
const deepLiqAll = scored.filter(s => s.tag === 'DEEP-LIQ');

console.log('\n=== TOP 10 ===');
for (let i = 0; i < top10.length; i++) {
  const s = top10[i];
  console.log(`${i+1}. [${s.tag}] ${s.name} (${s.network}) +${s.pct24.toFixed(0)}% — score ${s.score.toFixed(1)} vol $${(s.vol24/1e6).toFixed(2)}m liq $${(s.liq/1000).toFixed(0)}k h1 ${s.pctH1.toFixed(1)}% age ${s.ageH.toFixed(1)}h ${s.buys}:${s.sells} fdv ${s.fdv ? '$'+(s.fdv/1e6).toFixed(2)+'m' : 'n/a'} tokenId=${s.tokenId}`);
}

console.log('\n=== DEEP-LIQ all ===');
for (const s of deepLiqAll.slice(0, 15)) {
  console.log(`  [${s.tag}] ${s.name} (${s.network}) +${s.pct24.toFixed(0)}% score ${s.score.toFixed(1)} vol $${(s.vol24/1e6).toFixed(2)}m liq $${(s.liq/1e6).toFixed(2)}m h1 ${s.pctH1.toFixed(1)}% tokenId=${s.tokenId}`);
}

const tagCounts = top5.reduce((acc, s) => { acc[s.tag] = (acc[s.tag] || 0) + 1; return acc; }, {});
let verdict;
if (top5.length < 5) verdict = 'SLEEPY';
else if ((tagCounts['DEEP-LIQ'] || 0) >= 2) verdict = 'STRONG';
else if ((tagCounts['DEEP-LIQ'] || 0) >= 1 || (tagCounts['CONTINUATION'] || 0) >= 2) verdict = 'MIXED';
else verdict = 'SPECULATIVE';

console.log(`\nverdict: ${verdict}`);
console.log('tag distribution top5:', tagCounts);

const result = {
  today: TODAY,
  sourceStatus,
  preGate,
  postGate: survivors.length,
  rejections,
  top5,
  top10,
  deepLiqAll,
  verdict,
  tagCounts,
};
fs.writeFileSync(path.join(ROOT, '.runners-result.json'), JSON.stringify(result, null, 2));
console.log('\nWrote .runners-result.json');
