const fs = require('fs');
const path = require('path');

const TMP = '/home/runner/work/aeon/aeon/.outputs/_runners-tmp';
const FILES = [
  'global.json',
  'solana-trend.json', 'solana-vol.json',
  'eth-trend.json', 'eth-vol.json',
  'base-trend.json', 'base-vol.json',
  'bsc-trend.json', 'bsc-vol.json',
  'arbitrum-trend.json', 'arbitrum-vol.json',
  'new.json',
];

const num = (x) => {
  if (x == null) return 0;
  if (typeof x === 'number') return x;
  const n = parseFloat(x);
  return isNaN(n) ? 0 : n;
};

const now = Math.floor(Date.now() / 1000);

const all = [];
for (const f of FILES) {
  const j = JSON.parse(fs.readFileSync(path.join(TMP, f), 'utf8'));
  const arr = j.data || [];
  for (const p of arr) {
    const a = p.attributes || {};
    const r = p.relationships || {};
    const chain = r.network?.data?.id || (p.id || '').split('_')[0];
    const created = a.pool_created_at ? Math.floor(new Date(a.pool_created_at).getTime() / 1000) : 0;
    const ageH = created ? Math.floor((now - created) / 3600) : 99999;
    const buys = a.transactions?.h24?.buys || 0;
    const sells = a.transactions?.h24?.sells || 0;
    const skew_b = (buys + sells) > 0 ? buys / (buys + sells) : 0.5;
    const bs_sb = buys > 0 ? sells / buys : 999;
    const bs_bs = sells > 0 ? buys / sells : 999;
    all.push({
      chain,
      token: r.base_token?.data?.id,
      name: a.name,
      pct24: num(a.price_change_percentage?.h24),
      pct6: num(a.price_change_percentage?.h6),
      pct1: num(a.price_change_percentage?.h1),
      vol24: num(a.volume_usd?.h24),
      vol6: num(a.volume_usd?.h6),
      vol1: num(a.volume_usd?.h1),
      liq: num(a.reserve_in_usd),
      mcap: num(a.market_cap_usd),
      fdv: num(a.fdv_usd),
      created: a.pool_created_at,
      ageH,
      buys,
      sells,
      skew_b,
      bs_sb,
      bs_bs,
      addr: a.address,
      src: f,
    });
  }
}

// Dedupe by base token — keep highest h24 volume per token
const byToken = new Map();
for (const p of all) {
  if (!p.token) continue;
  const cur = byToken.get(p.token);
  if (!cur || p.vol24 > cur.vol24) byToken.set(p.token, p);
}
const deduped = Array.from(byToken.values());

// Gate
const reasons = {
  'thin-vol': 0, 'down-no-move': 0, 'thin-liq': 0, 'dumping': 0,
  'honeypot': 0, 'too-new': 0, 'rug-like': 0,
};
const surviving = [];
for (const p of deduped) {
  let r = null;
  if (p.vol24 < 50000) r = 'thin-vol';
  else if (p.pct24 <= 0) r = 'down-no-move';
  else if (p.liq < 10000) r = 'thin-liq';
  else if (p.bs_sb > 10) r = 'dumping';
  else if (p.bs_bs > 50) r = 'honeypot';
  else if (p.ageH < 1 && p.vol24 < 100000) r = 'too-new';
  else if (p.pct24 > 10000) r = 'rug-like';
  if (r) {
    reasons[r]++;
    p.reject = r;
  } else {
    surviving.push(p);
  }
}

// Score
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
for (const p of surviving) {
  const pct_pts = clamp(p.pct24 / 500, 0, 1);
  const vol_pts = clamp(Math.log10(p.vol24 + 1) / 7, 0, 1);
  const liq_pts = clamp(Math.log10(p.liq + 1) / 6, 0, 1);
  const mom_pts = clamp((p.pct1 + 50) / 100, 0, 1);
  const skew_pts = clamp(p.skew_b, 0, 1);
  p.score = Math.round(40 * pct_pts + 25 * vol_pts + 15 * liq_pts + 10 * mom_pts + 10 * skew_pts);

  // Tag
  if (p.liq >= 1_000_000 && p.vol24 >= 1_000_000) p.tag = 'DEEP-LIQ';
  else if (p.ageH < 48 && p.vol24 >= 250_000) p.tag = 'BREAKOUT';
  else if (p.pct1 > 2 && p.pct24 > 50) p.tag = 'CONTINUATION';
  else if (p.pct1 < -5 && p.pct24 > 0) p.tag = 'REVERSAL';
  else p.tag = 'MICRO-SPEC';
}

surviving.sort((a, b) => b.score - a.score);

// Output
console.log(`pre-gate (deduped): ${deduped.length}`);
console.log(`post-gate:          ${surviving.length}`);
console.log(`rejections: ${JSON.stringify(reasons)}`);
console.log('\nTop 15 by score:');
const fmtUsd = (n) => {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'b';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'm';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + n.toFixed(0);
};
const fmtPct = (n) => {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 10) return sign + n.toFixed(0) + '%';
  return sign + n.toFixed(1) + '%';
};
for (const p of surviving.slice(0, 15)) {
  console.log(`  [${p.tag}] ${p.name} (${p.chain}) ${fmtPct(p.pct24)} 24h | score ${p.score} | vol ${fmtUsd(p.vol24)} liq ${fmtUsd(p.liq)} | h1 ${fmtPct(p.pct1)} h6 ${fmtPct(p.pct6)} | buys ${(p.skew_b*100).toFixed(0)}% | age ${p.ageH}h | mcap ${fmtUsd(p.mcap)} fdv ${fmtUsd(p.fdv)}`);
}

fs.writeFileSync(path.join(TMP, 'processed.json'), JSON.stringify({deduped: deduped.length, surviving, reasons}, null, 2));
