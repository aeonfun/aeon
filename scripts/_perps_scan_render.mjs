#!/usr/bin/env node
// Node.js port of scripts/render-perps-scan.py — used to render
// .outputs/perps-scan.md from .outputs/perps-scan.data.json when python3 is
// not in the Bash allowedTools list (this Claude harness).
// In production, the postprocess workflow step invokes the Python version.
import fs from 'node:fs';

const REGIME_ORDER = ['ACCUMULATION', 'CATALYST-BREAKOUT', 'SHORT-SQUEEZE', 'MOMENTUM', 'COMPRESSION', 'DISTRIBUTION', 'CAPITULATION'];

const data = JSON.parse(fs.readFileSync('.outputs/perps-scan.data.json', 'utf8'));

if (data.edge_case === 'prefetch_failed') {
  fs.writeFileSync('.outputs/perps-scan.md', `Perps Regimes · ${data.date} · scan unavailable, prefetch failed\n`);
  console.log('render: prefetch_failed edge case rendered');
  process.exit(0);
}

const v = data.verdict;
const lines = [];
lines.push(`Perps Regimes · ${data.date}`);
lines.push('');
lines.push(`Market read · ${v.word}`);
lines.push(`  ${v.distribution}`);
lines.push(`  ${v.cycle}`);
lines.push(`  ${v.forward}`);
lines.push('');

// REGIME CHANGES
lines.push('REGIME CHANGES (since yesterday)');
const ch = data.regime_changes;
if (!ch || ch.length === 0) {
  if (ch === null) lines.push('  (no comparison available — first run or prior artifact missing)');
  else lines.push('  (no transitions today)');
} else {
  for (const c of ch) {
    lines.push(`  ${c.asset} — ${c.from} → ${c.to}`);
    if (c.note) lines.push(`    ${c.note}`);
  }
}
lines.push('');

const fmtMarker = (m) => (m === 'star' ? '★' : '•');
const emptyNotes = data.regime_empty_notes || {};

for (const name of REGIME_ORDER) {
  const assets = (data.regimes && data.regimes[name]) || [];
  lines.push(name);
  lines.push('');
  if (!assets.length) {
    const reason = emptyNotes[name] || 'no qualifying assets';
    lines.push(`(empty today — ${reason})`);
  } else {
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const marker = fmtMarker(a.marker || 'bullet');
      const suffix = a.repeat_days_suffix ? ` ${a.repeat_days_suffix}` : '';
      lines.push(`${marker} ${a.asset} — ${a.metrics_line}${suffix}`);
      if (a.tier === 1) lines.push('  Tier 1 classification.');
      for (const t of a.tags || []) {
        let line = `  Tag: ${t.tag}`;
        if (t.read) line += ` — ${t.read}`;
        lines.push(line);
        if (t.interpretation) lines.push(`  Read: ${t.interpretation}`);
      }
      if (i < assets.length - 1) lines.push('');
    }
  }
  lines.push('');
}

const watch = data.watch || [];
if (watch.length) {
  lines.push('WATCH (early signals, no full regime)');
  lines.push('');
  for (let i = 0; i < watch.length; i++) {
    const w = watch[i];
    lines.push(`• ${w.asset} — ${w.metrics_line}`);
    if (w.transition_read) lines.push(`  ${w.transition_read}`);
    if (i < watch.length - 1) lines.push('');
  }
  lines.push('');
}

if (data.neutral_summary) {
  lines.push(data.neutral_summary);
  lines.push('');
}

const tail = data.tail || [];
if (tail.length) {
  lines.push('---');
  lines.push('ARTIFACT DATA TAIL (consumed by perps-brief Pass 0)');
  lines.push('');
  for (let i = 0; i < tail.length; i++) {
    const a = tail[i];
    const m = a.metrics || {};
    const sub = (a.sub_tags || []).join(' ') || '—';
    const pat = (a.pattern_tags || []).join(' ') || '—';
    const g = (k, d = '—') => (m[k] === null || m[k] === undefined ? d : m[k]);
    lines.push(`Asset: ${a.asset} | Tier: ${a.tier} | Regime: ${a.regime} | Sub-tags: ${sub} | Pattern tags: ${pat}`);
    lines.push(`  price: ${g('price')} | pct_24h: ${g('pct_24h')} | pct_7d: ${g('pct_7d')} | pct_4h: ${g('pct_4h')} | range_7d: ${g('range_7d')}`);
    lines.push(`  pct_24h_vs_btc: ${g('pct_24h_vs_btc')} | pct_7d_vs_btc: ${g('pct_7d_vs_btc')}`);
    lines.push(`  oi: ${g('oi_usd')} | oi_24h_pct: ${g('oi_24h_pct')} | oi_7d_pct: ${g('oi_7d_pct')}`);
    lines.push(`  funding_now: ${g('funding_now')} | funding_7d_avg: ${g('funding_7d_avg')} | funding_delta: ${g('funding_delta')}`);
    lines.push(`  liq_24h: ${g('liq_24h')} | liq_7d_p75: ${g('liq_7d_p75')} | long_liqs: ${g('long_liqs')} | short_liqs: ${g('short_liqs')} | liqs_4h: ${g('liqs_4h')}`);
    lines.push(`  top_ls: ${g('top_ls')} | top_ls_7d_avg: ${g('top_ls_7d_avg')} | top_ls_delta_7d: ${g('top_ls_delta_7d')}`);
    lines.push(`  basis: ${g('basis')} | taker_buy: ${g('taker_buy')}`);
    lines.push(`  yesterday_regime: ${a.yesterday_regime ?? '—'} | repeat_days: ${a.repeat_days ?? 0}`);
    if (i < tail.length - 1) lines.push('');
  }
  lines.push('');
}

fs.writeFileSync('.outputs/perps-scan.md', lines.join('\n').replace(/\s+$/, '') + '\n');
const stat = fs.statSync('.outputs/perps-scan.md');
const classified = REGIME_ORDER.reduce((s, r) => s + ((data.regimes[r] || []).length), 0);
console.log(`render: wrote .outputs/perps-scan.md (${stat.size} bytes, ${classified} classified assets, ${tail.length} tail entries)`);
