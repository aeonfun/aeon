#!/usr/bin/env python3
"""Render .outputs/perps-scan.md deterministically from .outputs/perps-scan.data.json.

Replaces the previous design where Claude wrote the markdown artifact directly.
That design hit ISS-003/ISS-004 three times in one day — Claude conflated the
artifact write with its end-of-task `## Summary` block and wrote prose narration
into the artifact. Prose-level guardrails in SKILL.md did not prevent it.

The structural fix: perps-scan writes a structured JSON intermediate; this
script renders the markdown from a fixed template. No LLM in this path, so
the format cannot be corrupted.

If the JSON is malformed, this script exits non-zero with a clear message —
the workflow's postprocess loop surfaces the failure rather than letting a
broken artifact pass downstream.

Schema (see skills/perps-scan/SKILL.md step 12 for the canonical definition):

    {
      "date": "2026-05-19",
      "edge_case": null | "prefetch_failed" | "quiet_all_neutral",
      "verdict": {
        "word": str,
        "distribution": str,
        "cycle": str,
        "forward": str
      },
      "regime_changes": [
        {"asset": str, "from": str, "to": str, "note": str}
      ] | null,
      "regimes": {
        "<REGIME_NAME>": [
          {
            "asset": str,
            "tier": 1 | 2,
            "marker": "star" | "bullet",
            "repeat_days_suffix": str | null,
            "metrics_line": str,
            "tags": [{"tag": str, "read": str | null}]
          }
        ]
      },
      "regime_empty_notes": {"<REGIME_NAME>": str},
      "watch": [
        {"asset": str, "metrics_line": str, "transition_read": str}
      ],
      "neutral_summary": str | null,
      "tail": [
        {
          "asset": str,
          "tier": 1 | 2,
          "regime": str,
          "sub_tags": [str],
          "pattern_tags": [str],
          "metrics": {<flat key:value of all numeric fields, see SKILL.md>},
          "yesterday_regime": str | null,
          "repeat_days": int
        }
      ]
    }
"""

import json
import sys
from pathlib import Path
from typing import List, Optional


REGIME_ORDER = [
    "ACCUMULATION",
    "CATALYST-BREAKOUT",
    "SHORT-SQUEEZE",
    "MOMENTUM",
    "COMPRESSION",
    "DISTRIBUTION",
    "CAPITULATION",
]


def fail(msg: str, code: int = 1) -> None:
    sys.stderr.write(f"render-perps-scan: {msg}\n")
    sys.exit(code)


def fmt_marker(m: str) -> str:
    return "★" if m == "star" else "•"


def render_regime_changes(changes) -> List[str]:
    out = ["REGIME CHANGES (since yesterday)"]
    if changes is None or len(changes) == 0:
        out.append("  (no comparison available — first run or prior artifact missing)")
        return out
    for c in changes:
        out.append(f"  {c['asset']} — {c['from']} → {c['to']}")
        if c.get("note"):
            out.append(f"    {c['note']}")
    return out


def render_regime_section(name: str, assets: list, empty_note: Optional[str]) -> List[str]:
    out = [name, ""]
    if not assets:
        reason = empty_note or "no qualifying assets"
        out.append(f"(empty today — {reason})")
        return out
    for i, a in enumerate(assets):
        marker = fmt_marker(a.get("marker", "bullet"))
        suffix = a.get("repeat_days_suffix")
        suffix_str = f" {suffix}" if suffix else ""
        out.append(f"{marker} {a['asset']} — {a['metrics_line']}{suffix_str}")
        if a.get("tier") == 1:
            out.append("  Tier 1 classification.")
        for t in a.get("tags", []):
            line = f"  Tag: {t['tag']}"
            if t.get("read"):
                line += f" — {t['read']}"
            out.append(line)
            # If the tag carried a "Read:" interpretation in v3 spec, surface it
            # on its own line for visual separation
            if t.get("interpretation"):
                out.append(f"  Read: {t['interpretation']}")
        if i < len(assets) - 1:
            out.append("")
    return out


def render_watch(watch: list) -> List[str]:
    if not watch:
        return []
    out = ["WATCH (early signals, no full regime)", ""]
    for i, w in enumerate(watch):
        out.append(f"• {w['asset']} — {w['metrics_line']}")
        if w.get("transition_read"):
            out.append(f"  {w['transition_read']}")
        if i < len(watch) - 1:
            out.append("")
    return out


def render_tail(tail: list) -> List[str]:
    if not tail:
        return []
    out = ["---", "ARTIFACT DATA TAIL (consumed by perps-brief Pass 0)", ""]
    for i, a in enumerate(tail):
        m = a.get("metrics", {})
        sub = " ".join(a.get("sub_tags", [])) or "—"
        pat = " ".join(a.get("pattern_tags", [])) or "—"
        out.append(
            f"Asset: {a['asset']} | Tier: {a['tier']} | Regime: {a['regime']} | "
            f"Sub-tags: {sub} | Pattern tags: {pat}"
        )
        out.append(
            f"  price: {m.get('price', '—')} | pct_24h: {m.get('pct_24h', '—')} | "
            f"pct_7d: {m.get('pct_7d', '—')} | pct_4h: {m.get('pct_4h', '—')} | "
            f"range_7d: {m.get('range_7d', '—')}"
        )
        out.append(
            f"  pct_24h_vs_btc: {m.get('pct_24h_vs_btc', '—')} | "
            f"pct_7d_vs_btc: {m.get('pct_7d_vs_btc', '—')}"
        )
        out.append(
            f"  oi: {m.get('oi_usd', '—')} | oi_24h_pct: {m.get('oi_24h_pct', '—')} | "
            f"oi_7d_pct: {m.get('oi_7d_pct', '—')}"
        )
        out.append(
            f"  funding_now: {m.get('funding_now', '—')} | "
            f"funding_7d_avg: {m.get('funding_7d_avg', '—')} | "
            f"funding_delta: {m.get('funding_delta', '—')}"
        )
        out.append(
            f"  liq_24h: {m.get('liq_24h', '—')} | liq_7d_p75: {m.get('liq_7d_p75', '—')} | "
            f"long_liqs: {m.get('long_liqs', '—')} | short_liqs: {m.get('short_liqs', '—')} | "
            f"liqs_4h: {m.get('liqs_4h', '—')}"
        )
        out.append(
            f"  top_ls: {m.get('top_ls', '—')} | top_ls_7d_avg: {m.get('top_ls_7d_avg', '—')} | "
            f"top_ls_delta_7d: {m.get('top_ls_delta_7d', '—')}"
        )
        out.append(
            f"  basis: {m.get('basis', '—')} | taker_buy: {m.get('taker_buy', '—')}"
        )
        out.append(
            f"  yesterday_regime: {a.get('yesterday_regime', '—')} | "
            f"repeat_days: {a.get('repeat_days', 0)}"
        )
        if i < len(tail) - 1:
            out.append("")
    return out


def main() -> int:
    json_path = Path(".outputs/perps-scan.data.json")
    md_path = Path(".outputs/perps-scan.md")

    if not json_path.exists():
        # Not an error case in this script — perps-scan may not have run this
        # workflow, or it may have legitimately failed before the JSON write.
        # If .md exists, leave whatever's there (Claude-written or stale);
        # daily-ops-review surfaces missing artifacts.
        sys.stderr.write("render-perps-scan: no .outputs/perps-scan.data.json — nothing to render\n")
        return 0

    try:
        data = json.loads(json_path.read_text())
    except json.JSONDecodeError as e:
        fallback = (
            f"Perps Regimes · {Path('memory/logs').exists() and 'unknown date' or 'unknown date'} · "
            f"scan unavailable, render failed\n\nperps-scan.data.json was not valid JSON ({e}).\n"
            "perps-scan should be re-dispatched.\n"
        )
        md_path.write_text(fallback)
        fail(f"perps-scan.data.json is not valid JSON: {e}", code=2)

    # Edge case: explicit prefetch_failed signal
    if data.get("edge_case") == "prefetch_failed":
        md_path.write_text(
            f"Perps Regimes · {data.get('date', 'unknown')} · scan unavailable, prefetch failed\n"
        )
        print("render-perps-scan: prefetch_failed edge case rendered")
        return 0

    required = ["date", "verdict", "regimes"]
    for k in required:
        if k not in data:
            fail(f"perps-scan.data.json missing required key '{k}'", code=2)

    v = data["verdict"]
    for k in ["word", "distribution", "cycle", "forward"]:
        if k not in v:
            fail(f"perps-scan.data.json verdict missing key '{k}'", code=2)

    lines: List[str] = []
    lines.append(f"Perps Regimes · {data['date']}")
    lines.append("")
    lines.append(f"Market read · {v['word']}")
    lines.append(f"  {v['distribution']}")
    lines.append(f"  {v['cycle']}")
    lines.append(f"  {v['forward']}")
    lines.append("")
    lines.extend(render_regime_changes(data.get("regime_changes")))
    lines.append("")

    empty_notes = data.get("regime_empty_notes", {})
    for name in REGIME_ORDER:
        assets = data["regimes"].get(name, [])
        lines.extend(render_regime_section(name, assets, empty_notes.get(name)))
        lines.append("")

    watch = data.get("watch", [])
    if watch:
        lines.extend(render_watch(watch))
        lines.append("")

    if data.get("neutral_summary"):
        lines.append(data["neutral_summary"])
        lines.append("")

    tail = data.get("tail", [])
    if tail:
        lines.extend(render_tail(tail))
        lines.append("")

    md_path.write_text("\n".join(lines).rstrip() + "\n")
    print(f"render-perps-scan: wrote {md_path} ({md_path.stat().st_size} bytes, "
          f"{sum(len(v) for v in data['regimes'].values())} classified assets, "
          f"{len(tail)} tail entries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
