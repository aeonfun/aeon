#!/usr/bin/env node
// Node port of scripts/render-perps-scan.py — same logic, identical output.
// Used when python3 is not in the allowed Bash tool list.
import fs from 'node:fs';

const REGIME_ORDER = [
  'ACCUMULATION',
  'CATALYST-BREAKOUT',
  'SHORT-SQUEEZE',
  'MOMENTUM',
  'COMPRESSION',
  'DISTRIBUTION',
  'CAPITULATION',
];

const JSON_PATH = '.outputs/perps-scan.data.json';
const MD_PATH = '.outputs/perps-scan.md';

function fmtMarker(m) {
  return m === 'star' ? '★' : '•';
}

function renderRegimeChanges(changes) {
  const out = ['REGIME CHANGES (since yesterday)'];
  if (changes === null || changes === undefined || changes.length === 0) {
    out.push('  (no comparison available — first run or prior artifact missing)');
    return out;
  }
  for (const c of changes) {
    out.push(`  ${c.asset} — ${c.from} → ${c.to}`);
    if (c.note) out.push(`    ${c.note}`);
  }
  return out;
}

function renderRegimeSection(name, assets, emptyNote) {
  const out = [name, ''];
  if (!assets || assets.length === 0) {
    const reason = emptyNote || 'no qualifying assets';
    out.push(`(empty today — ${reason})`);
    return out;
  }
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const marker = fmtMarker(a.marker || 'bullet');
    const suffix = a.repeat_days_suffix ? ` ${a.repeat_days_suffix}` : '';
    out.push(`${marker} ${a.asset} — ${a.metrics_line}${suffix}`);
    if (a.tier === 1) out.push('  Tier 1 classification.');
    for (const t of a.tags || []) {
      let line = `  Tag: ${t.tag}`;
      if (t.read) line += ` — ${t.read}`;
      out.push(line);
      if (t.interpretation) out.push(`  Read: ${t.interpretation}`);
    }
    if (i < assets.length - 1) out.push('');
  }
  return out;
}

function renderWatch(watch) {
  if (!watch || watch.length === 0) return [];
  const out = ['WATCH (early signals, no full regime)', ''];
  for (let i = 0; i < watch.length; i++) {
    const w = watch[i];
    out.push(`• ${w.asset} — ${w.metrics_line}`);
    if (w.transition_read) out.push(`  ${w.transition_read}`);
    if (i < watch.length - 1) out.push('');
  }
  return out;
}

function v(x) {
  return x === null || x === undefined ? '—' : x;
}

function renderTail(tail) {
  if (!tail || tail.length === 0) return [];
  const out = ['---', 'ARTIFACT DATA TAIL (consumed by perps-brief Pass 0)', ''];
  for (let i = 0; i < tail.length; i++) {
    const a = tail[i];
    const m = a.metrics || {};
    const sub = (a.sub_tags || []).join(' ') || '—';
    const pat = (a.pattern_tags || []).join(' ') || '—';
    out.push(`Asset: ${a.asset} | Tier: ${a.tier} | Regime: ${a.regime} | Sub-tags: ${sub} | Pattern tags: ${pat}`);
    out.push(`  price: ${v(m.price)} | pct_24h: ${v(m.pct_24h)} | pct_7d: ${v(m.pct_7d)} | pct_4h: ${v(m.pct_4h)} | range_7d: ${v(m.range_7d)}`);
    out.push(`  pct_24h_vs_btc: ${v(m.pct_24h_vs_btc)} | pct_7d_vs_btc: ${v(m.pct_7d_vs_btc)}`);
    out.push(`  oi: ${v(m.oi_usd)} | oi_24h_pct: ${v(m.oi_24h_pct)} | oi_7d_pct: ${v(m.oi_7d_pct)}`);
    out.push(`  funding_now: ${v(m.funding_now)} | funding_7d_avg: ${v(m.funding_7d_avg)} | funding_delta: ${v(m.funding_delta)}`);
    out.push(`  liq_24h: ${v(m.liq_24h)} | liq_7d_p75: ${v(m.liq_7d_p75)} | long_liqs: ${v(m.long_liqs)} | short_liqs: ${v(m.short_liqs)} | liqs_4h: ${v(m.liqs_4h)}`);
    out.push(`  top_ls: ${v(m.top_ls)} | top_ls_7d_avg: ${v(m.top_ls_7d_avg)} | top_ls_delta_7d: ${v(m.top_ls_delta_7d)}`);
    out.push(`  basis: ${v(m.basis)} | taker_buy: ${v(m.taker_buy)}`);
    out.push(`  yesterday_regime: ${a.yesterday_regime === null || a.yesterday_regime === undefined ? '—' : a.yesterday_regime} | repeat_days: ${a.repeat_days ?? 0}`);
    if (i < tail.length - 1) out.push('');
  }
  return out;
}

if (!fs.existsSync(JSON_PATH)) {
  process.stderr.write(`render-perps-scan: no ${JSON_PATH} — nothing to render\n`);
  process.exit(0);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
} catch (e) {
  fs.writeFileSync(MD_PATH, `Perps Regimes · unknown date · scan unavailable, render failed\n\nperps-scan.data.json was not valid JSON (${e.message}).\nperps-scan should be re-dispatched.\n`);
  process.stderr.write(`render-perps-scan: perps-scan.data.json is not valid JSON: ${e.message}\n`);
  process.exit(2);
}

if (data.edge_case === 'prefetch_failed') {
  fs.writeFileSync(MD_PATH, `Perps Regimes · ${data.date || 'unknown'} · scan unavailable, prefetch failed\n`);
  console.log('render-perps-scan: prefetch_failed edge case rendered');
  process.exit(0);
}

for (const k of ['date', 'verdict', 'regimes']) {
  if (!(k in data)) {
    process.stderr.write(`render-perps-scan: perps-scan.data.json missing required key '${k}'\n`);
    process.exit(2);
  }
}
for (const k of ['word', 'distribution', 'cycle', 'forward']) {
  if (!(k in data.verdict)) {
    process.stderr.write(`render-perps-scan: perps-scan.data.json verdict missing key '${k}'\n`);
    process.exit(2);
  }
}

const lines = [];
lines.push(`Perps Regimes · ${data.date}`);
lines.push('');
lines.push(`Market read · ${data.verdict.word}`);
lines.push(`  ${data.verdict.distribution}`);
lines.push(`  ${data.verdict.cycle}`);
lines.push(`  ${data.verdict.forward}`);
lines.push('');
lines.push(...renderRegimeChanges(data.regime_changes));
lines.push('');

const emptyNotes = data.regime_empty_notes || {};
for (const name of REGIME_ORDER) {
  const assets = (data.regimes || {})[name] || [];
  lines.push(...renderRegimeSection(name, assets, emptyNotes[name]));
  lines.push('');
}

const watch = data.watch || [];
if (watch.length) {
  lines.push(...renderWatch(watch));
  lines.push('');
}

if (data.neutral_summary) {
  lines.push(data.neutral_summary);
  lines.push('');
}

const tail = data.tail || [];
if (tail.length) {
  lines.push(...renderTail(tail));
  lines.push('');
}

const text = lines.join('\n').replace(/\s+$/, '') + '\n';
fs.writeFileSync(MD_PATH, text);
const bytes = fs.statSync(MD_PATH).size;
const classified = Object.values(data.regimes).reduce((a, arr) => a + arr.length, 0);
console.log(`render-perps-scan: wrote ${MD_PATH} (${bytes} bytes, ${classified} classified assets, ${tail.length} tail entries)`);
