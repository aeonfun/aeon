#!/usr/bin/env node
// Mirror of scripts/render-perps-scan.py — renders .outputs/perps-scan.md from
// .outputs/perps-scan.data.json. Used here because python3 is unavailable in
// this session's sandbox.

const fs = require("fs");
const path = require("path");

const REGIME_ORDER = [
  "ACCUMULATION",
  "CATALYST-BREAKOUT",
  "SHORT-SQUEEZE",
  "MOMENTUM",
  "COMPRESSION",
  "DISTRIBUTION",
  "CAPITULATION",
];

const fmtMarker = (m) => (m === "star" ? "★" : "•");

function renderRegimeChanges(changes) {
  const out = ["REGIME CHANGES (since yesterday)"];
  if (!changes || changes.length === 0) {
    out.push("  (no comparison available — first run or prior artifact missing)");
    return out;
  }
  for (const c of changes) {
    out.push(`  ${c.asset} — ${c.from} → ${c.to}`);
    if (c.note) out.push(`    ${c.note}`);
  }
  return out;
}

function renderRegimeSection(name, assets, emptyNote) {
  const out = [name, ""];
  if (!assets || !assets.length) {
    const reason = emptyNote || "no qualifying assets";
    out.push(`(empty today — ${reason})`);
    return out;
  }
  assets.forEach((a, i) => {
    const marker = fmtMarker(a.marker || "bullet");
    const suffix = a.repeat_days_suffix ? ` ${a.repeat_days_suffix}` : "";
    out.push(`${marker} ${a.asset} — ${a.metrics_line}${suffix}`);
    if (a.tier === 1) out.push("  Tier 1 classification.");
    for (const t of a.tags || []) {
      let line = `  Tag: ${t.tag}`;
      if (t.read) line += ` — ${t.read}`;
      out.push(line);
      if (t.interpretation) out.push(`  Read: ${t.interpretation}`);
    }
    if (i < assets.length - 1) out.push("");
  });
  return out;
}

function renderWatch(watch) {
  if (!watch || !watch.length) return [];
  const out = ["WATCH (early signals, no full regime)", ""];
  watch.forEach((w, i) => {
    out.push(`• ${w.asset} — ${w.metrics_line}`);
    if (w.transition_read) out.push(`  ${w.transition_read}`);
    if (i < watch.length - 1) out.push("");
  });
  return out;
}

function renderTail(tail) {
  if (!tail || !tail.length) return [];
  const out = ["---", "ARTIFACT DATA TAIL (consumed by perps-brief Pass 0)", ""];
  tail.forEach((a, i) => {
    const m = a.metrics || {};
    const sub = (a.sub_tags || []).join(" ") || "—";
    const pat = (a.pattern_tags || []).join(" ") || "—";
    out.push(`Asset: ${a.asset} | Tier: ${a.tier} | Regime: ${a.regime} | Sub-tags: ${sub} | Pattern tags: ${pat}`);
    out.push(`  price: ${m.price ?? "—"} | pct_24h: ${m.pct_24h ?? "—"} | pct_7d: ${m.pct_7d ?? "—"} | pct_4h: ${m.pct_4h ?? "—"} | range_7d: ${m.range_7d ?? "—"}`);
    out.push(`  pct_24h_vs_btc: ${m.pct_24h_vs_btc ?? "—"} | pct_7d_vs_btc: ${m.pct_7d_vs_btc ?? "—"}`);
    out.push(`  oi: ${m.oi_usd ?? "—"} | oi_24h_pct: ${m.oi_24h_pct ?? "—"} | oi_7d_pct: ${m.oi_7d_pct ?? "—"}`);
    out.push(`  funding_now: ${m.funding_now ?? "—"} | funding_7d_avg: ${m.funding_7d_avg ?? "—"} | funding_delta: ${m.funding_delta ?? "—"}`);
    out.push(`  liq_24h: ${m.liq_24h ?? "—"} | liq_7d_p75: ${m.liq_7d_p75 ?? "—"} | long_liqs: ${m.long_liqs ?? "—"} | short_liqs: ${m.short_liqs ?? "—"} | liqs_4h: ${m.liqs_4h ?? "—"}`);
    out.push(`  top_ls: ${m.top_ls ?? "—"} | top_ls_7d_avg: ${m.top_ls_7d_avg ?? "—"} | top_ls_delta_7d: ${m.top_ls_delta_7d ?? "—"}`);
    out.push(`  basis: ${m.basis ?? "—"} | taker_buy: ${m.taker_buy ?? "—"}`);
    out.push(`  yesterday_regime: ${a.yesterday_regime ?? "—"} | repeat_days: ${a.repeat_days ?? 0}`);
    if (i < tail.length - 1) out.push("");
  });
  return out;
}

function main() {
  const jsonPath = ".outputs/perps-scan.data.json";
  const mdPath = ".outputs/perps-scan.md";

  if (!fs.existsSync(jsonPath)) {
    process.stderr.write("render-perps-scan(js): no .outputs/perps-scan.data.json — nothing to render\n");
    return 0;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (e) {
    const fallback = `Perps Regimes · unknown date · scan unavailable, render failed\n\nperps-scan.data.json was not valid JSON (${e}).\nperps-scan should be re-dispatched.\n`;
    fs.writeFileSync(mdPath, fallback);
    process.stderr.write(`render-perps-scan(js): perps-scan.data.json is not valid JSON: ${e}\n`);
    return 2;
  }

  if (data.edge_case === "prefetch_failed") {
    fs.writeFileSync(mdPath, `Perps Regimes · ${data.date || "unknown"} · scan unavailable, prefetch failed\n`);
    console.log("render-perps-scan(js): prefetch_failed edge case rendered");
    return 0;
  }

  for (const k of ["date", "verdict", "regimes"]) {
    if (!(k in data)) {
      process.stderr.write(`render-perps-scan(js): missing required key '${k}'\n`);
      return 2;
    }
  }
  for (const k of ["word", "distribution", "cycle", "forward"]) {
    if (!(k in data.verdict)) {
      process.stderr.write(`render-perps-scan(js): verdict missing key '${k}'\n`);
      return 2;
    }
  }

  const lines = [];
  lines.push(`Perps Regimes · ${data.date}`);
  lines.push("");
  lines.push(`Market read · ${data.verdict.word}`);
  lines.push(`  ${data.verdict.distribution}`);
  lines.push(`  ${data.verdict.cycle}`);
  lines.push(`  ${data.verdict.forward}`);
  lines.push("");
  lines.push(...renderRegimeChanges(data.regime_changes));
  lines.push("");

  const emptyNotes = data.regime_empty_notes || {};
  for (const name of REGIME_ORDER) {
    const assets = (data.regimes[name] || []);
    lines.push(...renderRegimeSection(name, assets, emptyNotes[name]));
    lines.push("");
  }

  const watch = data.watch || [];
  if (watch.length) {
    lines.push(...renderWatch(watch));
    lines.push("");
  }

  if (data.neutral_summary) {
    lines.push(data.neutral_summary);
    lines.push("");
  }

  const tail = data.tail || [];
  if (tail.length) {
    lines.push(...renderTail(tail));
    lines.push("");
  }

  fs.writeFileSync(mdPath, lines.join("\n").replace(/\s+$/, "") + "\n");
  const classifiedCount = Object.values(data.regimes).reduce((s, v) => s + (v?.length || 0), 0);
  console.log(`render-perps-scan(js): wrote ${mdPath} (${fs.statSync(mdPath).size} bytes, ${classifiedCount} classified assets, ${tail.length} tail entries)`);
  return 0;
}

process.exit(main());
