#!/usr/bin/env node
const fs = require('fs');

const FILES = [
  ['gt-global', '.runners-global.json'],
  ['gt-solana-trend', '.runners-solana-trend.json'],
  ['gt-solana-vol', '.runners-solana-vol.json'],
  ['gt-eth-trend', '.runners-eth-trend.json'],
  ['gt-eth-vol', '.runners-eth-vol.json'],
  ['gt-base-trend', '.runners-base-trend.json'],
  ['gt-base-vol', '.runners-base-vol.json'],
  ['gt-bsc-trend', '.runners-bsc-trend.json'],
  ['gt-bsc-vol', '.runners-bsc-vol.json'],
  ['gt-arbitrum-trend', '.runners-arbitrum-trend.json'],
  ['gt-arbitrum-vol', '.runners-arbitrum-vol.json'],
  ['gt-new', '.runners-new.json'],
];

const sources = {};
const allPools = [];

for (const [name, file] of FILES) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const j = JSON.parse(raw);
    if (j.status && j.status.error_code) { sources[name] = 'fail'; continue; }
    if (!Array.isArray(j.data)) { sources[name] = 'fail'; continue; }
    sources[name] = 'ok';
    for (const p of j.data) allPools.push(p);
  } catch (e) {
    sources[name] = 'fail';
  }
}

// Dedupe by base_token id, keep highest h24 vol
const byToken = new Map();
for (const p of allPools) {
  const tokId = p.relationships?.base_token?.data?.id;
  if (!tokId) continue;
  const v = parseFloat(p.attributes?.volume_usd?.h24 || '0');
  const ex = byToken.get(tokId);
  if (!ex || v > parseFloat(ex.attributes?.volume_usd?.h24 || '0')) {
    byToken.set(tokId, p);
  }
}
const preGate = byToken.size;

const rejections = { thinVol: 0, negPct: 0, lowLiq: 0, dumping: 0, honeypot: 0, tooNew: 0, rugLike: 0 };
const survivors = [];
const now = Date.now();

for (const p of byToken.values()) {
  const a = p.attributes;
  const volH24 = parseFloat(a.volume_usd?.h24 || '0');
  const pctH24 = parseFloat(a.price_change_percentage?.h24 || '0');
  const liq = parseFloat(a.reserve_in_usd || '0');
  const buys = parseInt(a.transactions?.h24?.buys || '0');
  const sells = parseInt(a.transactions?.h24?.sells || '0');
  const created = a.pool_created_at ? Date.parse(a.pool_created_at) : 0;
  const ageH = created ? (now - created) / 3600_000 : 9999;

  if (volH24 < 50000) { rejections.thinVol++; continue; }
  if (pctH24 <= 0) { rejections.negPct++; continue; }
  if (liq < 10000) { rejections.lowLiq++; continue; }
  if (buys > 0 && sells / buys > 10) { rejections.dumping++; continue; }
  if (sells > 0 && buys / sells > 50) { rejections.honeypot++; continue; }
  if (ageH < 1 && volH24 < 100000) { rejections.tooNew++; continue; }
  if (pctH24 > 10000) { rejections.rugLike++; continue; }
  survivors.push({ p, volH24, pctH24, liq, buys, sells, ageH });
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
function tagOf(s) {
  const a = s.p.attributes;
  if (s.liq >= 1_000_000 && s.volH24 >= 1_000_000) return 'DEEP-LIQ';
  if (s.ageH <= 48 && s.volH24 >= 250_000) return 'BREAKOUT';
  const pctH1 = parseFloat(a.price_change_percentage?.h1 || '0');
  if (pctH1 > 2 && s.pctH24 > 50) return 'CONTINUATION';
  if (pctH1 < -5 && s.pctH24 > 0) return 'REVERSAL';
  return 'MICRO-SPEC';
}

const scored = survivors.map(s => {
  const a = s.p.attributes;
  const pctH1 = parseFloat(a.price_change_percentage?.h1 || '0');
  const pctPts = clamp(s.pctH24 / 500, 0, 1);
  const volPts = clamp(Math.log10(s.volH24 + 1) / 7, 0, 1);
  const liqPts = clamp(Math.log10(s.liq + 1) / 6, 0, 1);
  const momPts = clamp((pctH1 + 50) / 100, 0, 1);
  const skewDen = s.buys + s.sells;
  const skewPts = skewDen > 0 ? clamp(s.buys / skewDen, 0, 1) : 0.5;
  const score = 40 * pctPts + 25 * volPts + 15 * liqPts + 10 * momPts + 10 * skewPts;
  return { ...s, pctH1, score, tag: tagOf(s) };
}).sort((x, y) => y.score - x.score);

const top5 = scored.slice(0, 5);

function verdict(picks) {
  if (picks.length < 5) return 'SLEEPY';
  const tags = picks.map(p => p.tag);
  const deepLiq = tags.filter(t => t === 'DEEP-LIQ').length;
  const cont = tags.filter(t => t === 'CONTINUATION').length;
  const microOrBreak = tags.filter(t => t === 'MICRO-SPEC' || t === 'BREAKOUT').length;
  if (deepLiq >= 2) return 'STRONG';
  if (deepLiq === 1 || cont >= 2) return 'MIXED';
  if (microOrBreak >= 3) return 'SPECULATIVE';
  return 'MIXED';
}

const v = verdict(top5);

function fmtUsd(n) {
  if (n == null || isNaN(n)) return 'n/a';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return 'n/a';
  if (Math.abs(n) < 10) return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  return `${n >= 0 ? '+' : ''}${Math.round(n)}%`;
}

const out = {
  preGate,
  postGate: survivors.length,
  sources,
  verdict: v,
  rejections,
  top: top5.map(s => {
    const a = s.p.attributes;
    return {
      name: a.name,
      chain: s.p.relationships?.network?.data?.id || s.p.id?.split('_')[0],
      tokenId: s.p.relationships?.base_token?.data?.id,
      score: Math.round(s.score * 10) / 10,
      pctH24: s.pctH24,
      pctH1: s.pctH1,
      volH24: s.volH24,
      liq: s.liq,
      fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : null,
      mcap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : null,
      buys: s.buys,
      sells: s.sells,
      ageH: s.ageH,
      tag: s.tag,
    };
  }),
  slot6to8: scored.slice(5, 8).map(s => {
    const a = s.p.attributes;
    return {
      name: a.name,
      chain: s.p.relationships?.network?.data?.id || s.p.id?.split('_')[0],
      score: Math.round(s.score * 10) / 10,
      pctH24: s.pctH24,
      pctH1: parseFloat(a.price_change_percentage?.h1 || '0'),
      volH24: s.volH24,
      liq: s.liq,
      fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : null,
      tag: s.tag,
    };
  }),
  // Also surface highest-scoring DEEP-LIQ for self-improve evidence trail
  deepLiqInSurvivors: scored.filter(s => s.tag === 'DEEP-LIQ').slice(0, 5).map(s => {
    const a = s.p.attributes;
    return {
      name: a.name,
      chain: s.p.relationships?.network?.data?.id || s.p.id?.split('_')[0],
      score: Math.round(s.score * 10) / 10,
      pctH24: s.pctH24,
      volH24: s.volH24,
      liq: s.liq,
    };
  }),
};

fs.writeFileSync('.runners-result.json', JSON.stringify(out, null, 2));

console.log(`pre-gate=${preGate} post-gate=${survivors.length} verdict=${v}`);
console.log(`sources: ${Object.entries(sources).map(([k,v]) => `${k}=${v}`).join(' ')}`);
console.log(`rejections: ${JSON.stringify(rejections)}`);
console.log('top5:');
for (const t of out.top) {
  console.log(`  [${t.tag}] ${t.name} (${t.chain}) ${fmtPct(t.pctH24)} score=${t.score} vol=${fmtUsd(t.volH24)} liq=${fmtUsd(t.liq)} fdv=${fmtUsd(t.fdv)} h1=${fmtPct(t.pctH1)} buys:sells=${t.buys}:${t.sells} age=${t.ageH.toFixed(1)}h`);
}
console.log('slot6-8:');
for (const t of out.slot6to8) {
  console.log(`  [${t.tag}] ${t.name} (${t.chain}) ${fmtPct(t.pctH24)} score=${t.score} vol=${fmtUsd(t.volH24)} liq=${fmtUsd(t.liq)}`);
}
console.log(`deep-liq survivors: ${out.deepLiqInSurvivors.length}`);
for (const t of out.deepLiqInSurvivors) {
  console.log(`  [DEEP-LIQ] ${t.name} (${t.chain}) ${fmtPct(t.pctH24)} score=${t.score} vol=${fmtUsd(t.volH24)} liq=${fmtUsd(t.liq)}`);
}
