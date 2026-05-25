#!/usr/bin/env python3
"""Render the outcome-tracker artifact + persistent track record document.

Reads memory/topics/state/active-setups.json. Writes:

  .outputs/outcome-tracker.md         — chain-consumed by perps-brief as
                                        ambient track-record context

  memory/topics/track-record.md       — persistent operator-facing analysis
                                        doc, overwritten each run

Cold-start safe: prints an "insufficient data" banner when the closed[]
window contains fewer than COLD_START_FLOOR entries.

Filter: V1_LOCK_DATE env var (YYYY-MM-DD). When set, only closed entries
with closed_date >= V1_LOCK_DATE are included in the rollups. Closed
entries before V1_LOCK_DATE are still counted in `closed_total_unfiltered`
so the operator can see the full history exists.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

# Allow `python3 scripts/render-outcome-tracker.py` to import scripts/lib/
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import ledger as L  # noqa: E402
from lib import track_record as T  # noqa: E402


OUT_ARTIFACT = Path(".outputs/outcome-tracker.md")
OUT_PERSISTENT = Path("memory/topics/track-record.md")

COLD_START_FLOOR = 3   # fewer than this many closed entries → cold-start banner
PATTERN_MIN_N = 3      # confluence patterns need ≥ this many samples to be ranked


# ---------------------------------------------------------------------------
# Formatting helpers


def fmt_pct(p: Optional[float], sign: bool = True, dash: str = "—") -> str:
    if p is None:
        return dash
    return f"{p:+.1f}%" if sign else f"{p:.1f}%"


def fmt_int(n: Optional[int], dash: str = "—") -> str:
    return str(n) if n is not None else dash


def fmt_float(n: Optional[float], digits: int = 1, dash: str = "—") -> str:
    return f"{n:.{digits}f}" if n is not None else dash


def fmt_price(p) -> str:
    if p is None:
        return "—"
    try:
        f = float(p)
        if f >= 100:
            return f"${f:,.0f}"
        if f >= 1:
            return f"${f:.2f}"
        if f >= 0.01:
            return f"${f:.4f}".rstrip("0").rstrip(".")
        return f"${f:.6f}".rstrip("0").rstrip(".")
    except (ValueError, TypeError):
        return str(p)


# ---------------------------------------------------------------------------
# Section renderers


def render_header(date_str: str, since: Optional[str]) -> List[str]:
    line = f"Track Record · {date_str}"
    if since:
        line += f" · since V1 lock ({since})"
    return [line, "─" * len(line), ""]


def render_cold_start(closed_n: int, open_n: int, watchlist_n: int) -> List[str]:
    return [
        "**Insufficient closed trades to compute meaningful statistics.**",
        "",
        f"Currently {closed_n} closed entries in the filter window, "
        f"{open_n} open positions, {watchlist_n} watchlist entries.",
        "",
        f"Need at least {COLD_START_FLOOR} closed entries before headline "
        "stats are surfaced. Confluence-pattern analysis needs at least "
        f"{PATTERN_MIN_N} samples per pattern.",
        "",
        "Patience. The data clock is running.",
    ]


def render_headline(stats: dict) -> List[str]:
    out = ["HEADLINE", ""]
    out.append(f"  Closed setups   {fmt_int(stats['count'])}")
    out.append(f"  LONG / SHORT    {fmt_int(stats['longs'])} / {fmt_int(stats['shorts'])}")
    win_rate = stats.get("win_rate_pct")
    strict_rate = stats.get("win_rate_strict_pct")
    if win_rate is not None:
        wins = stats.get("wins", 0)
        scares = stats.get("scares", 0)
        total = stats.get("count", 0)
        out.append(
            f"  Win rate        {fmt_pct(win_rate, sign=False)} "
            f"({wins + scares}/{total} — {wins} clean WIN, {scares} SCARE)"
        )
        if scares > 0 and strict_rate is not None:
            out.append(
                f"  Strict win rate {fmt_pct(strict_rate, sign=False)} "
                "(excluding SCARE — trades that breached stop but recovered)"
            )
    out.append(f"  Avg return      {fmt_pct(stats['avg_return_pct'])}")
    out.append(f"  Avg vs BTC      {fmt_pct(stats['avg_return_vs_btc_pct'])}")
    realized = stats.get("avg_horizon_realized_days")
    if realized is not None:
        ratio = stats.get("horizon_realization_ratio")
        ratio_str = f" ({fmt_float(ratio, 2)}x target)" if ratio is not None else ""
        out.append(f"  Avg holding     {fmt_float(realized, 1)}d{ratio_str}")
    out.append("")
    return out


def render_by_direction(by_dir: dict) -> List[str]:
    long_s = by_dir.get("LONG", {})
    short_s = by_dir.get("SHORT", {})
    if (long_s.get("count") or 0) == 0 and (short_s.get("count") or 0) == 0:
        return []
    out = ["BY DIRECTION", ""]
    for label, s in (("LONG", long_s), ("SHORT", short_s)):
        n = s.get("count", 0)
        if n == 0:
            out.append(f"  {label}   (no closed entries)")
            continue
        out.append(
            f"  {label}   {n} closed · "
            f"win {fmt_pct(s.get('win_rate_pct'), sign=False)} · "
            f"avg {fmt_pct(s.get('avg_return_vs_btc_pct'))} vs BTC"
        )
    out.append("")
    return out


def render_by_horizon(by_h: dict) -> List[str]:
    if not any((s.get("count") or 0) > 0 for s in by_h.values()):
        return []
    out = ["BY HORIZON", ""]
    for h in ("24h", "3d", "7d", "multi-week"):
        s = by_h.get(h, {})
        n = s.get("count", 0)
        if n == 0:
            continue
        out.append(
            f"  {h:11} {n} closed · "
            f"win {fmt_pct(s.get('win_rate_pct'), sign=False)} · "
            f"avg {fmt_pct(s.get('avg_return_vs_btc_pct'))} vs BTC · "
            f"held {fmt_float(s.get('avg_horizon_realized_days'), 1)}d"
        )
    out.append("")
    return out


def render_by_confluence(patterns: list, limit: int = 5) -> List[str]:
    if not patterns:
        return [
            "BY CONFLUENCE PATTERN",
            "",
            f"  No patterns have at least {PATTERN_MIN_N} samples yet.",
            "",
        ]
    out = ["BY CONFLUENCE PATTERN", ""]
    best = patterns[:limit]
    out.append("  BEST")
    for p in best:
        pattern_str = " + ".join(p["pattern"]) if p["pattern"] else "(no criteria logged)"
        out.append(
            f"    {pattern_str}"
        )
        out.append(
            f"      {p['count']} samples · "
            f"win {fmt_pct(p.get('win_rate_pct'), sign=False)} · "
            f"avg {fmt_pct(p.get('avg_return_vs_btc_pct'))} vs BTC"
        )
    out.append("")
    worst = list(reversed(patterns[-limit:]))
    # only render WORST if it's not the same as BEST (i.e., we have more than `limit` patterns)
    if len(patterns) > limit:
        out.append("  WORST")
        for p in worst:
            pattern_str = " + ".join(p["pattern"]) if p["pattern"] else "(no criteria logged)"
            out.append(f"    {pattern_str}")
            out.append(
                f"      {p['count']} samples · "
                f"win {fmt_pct(p.get('win_rate_pct'), sign=False)} · "
                f"avg {fmt_pct(p.get('avg_return_vs_btc_pct'))} vs BTC"
            )
        out.append("")
    return out


def render_by_provenance(by_p: dict) -> List[str]:
    p = by_p.get("promoted_from_watchlist", {})
    d = by_p.get("direct_entry", {})
    if (p.get("count") or 0) == 0 and (d.get("count") or 0) == 0:
        return []
    out = ["BY PROVENANCE", ""]
    for label, s in (
        ("promoted from watchlist", p),
        ("direct entry", d),
    ):
        n = s.get("count", 0)
        if n == 0:
            out.append(f"  {label}: no closed entries")
            continue
        out.append(
            f"  {label}: {n} closed · "
            f"win {fmt_pct(s.get('win_rate_pct'), sign=False)} · "
            f"avg {fmt_pct(s.get('avg_return_vs_btc_pct'))} vs BTC"
        )
    out.append("")
    return out


def render_auto_flips(flip: dict) -> List[str]:
    n = flip.get("count", 0)
    if n == 0:
        return []
    out = ["AUTO-FLIPS", ""]
    out.append(
        f"  {n} auto-flipped closes · "
        f"avg return on the flipped (pre-flip) side: "
        f"{fmt_pct(flip.get('avg_return_pct'))}"
    )
    out.append("")
    return out


def render_mark_to_market(mtm: list) -> List[str]:
    if not mtm:
        return []
    out = [f"OPEN POSITIONS · MARK TO MARKET ({len(mtm)})", ""]
    for m in mtm:
        asset = m.get("asset", "?")
        direction = m.get("direction", "?")
        fired = m.get("fired_date", "?")
        days = m.get("days_elapsed")
        horizon = m.get("horizon", "?")
        pnl = m.get("pnl_pct")
        cur = m.get("current_price")
        stale = " (stale price)" if m.get("price_is_stale") else ""
        mae = m.get("mae_pct")
        mfe = m.get("mfe_pct")
        breach = " · STOP BREACHED" if m.get("invalidation_breached") else ""
        prov = " · from watchlist" if m.get("watchlist_provenance") else ""
        out.append(
            f"  {asset} {direction} (fired {fired}, day {days}/{horizon}{prov})"
        )
        out.append(
            f"    now {fmt_price(cur)}{stale} · PnL {fmt_pct(pnl)} · "
            f"MAE {fmt_pct(mae)} · MFE {fmt_pct(mfe)}{breach}"
        )
    out.append("")
    return out


def render_notes(tr: dict) -> List[str]:
    """Auto-generated observations from the rollup data."""
    out = []
    notes = []

    head = tr["headline"]
    if head["count"] >= COLD_START_FLOOR:
        # Win rate context
        wr = head.get("win_rate_pct")
        if wr is not None:
            if wr >= 60:
                notes.append(f"Win rate at {wr:.0f}% is above the 60% baseline.")
            elif wr <= 40:
                notes.append(f"Win rate at {wr:.0f}% is below the 40% danger threshold — review confluence patterns.")
        # SCARE prevalence
        scares = head.get("scares", 0)
        if scares >= max(2, head["count"] * 0.2):
            notes.append(
                f"{scares} of {head['count']} closed trades are SCARE (won after "
                "breaching invalidation). Invalidation rules may be too tight."
            )

    # Direction skew
    bd = tr["by_direction"]
    long_s, short_s = bd.get("LONG", {}), bd.get("SHORT", {})
    if long_s.get("count") and short_s.get("count"):
        lwr = long_s.get("win_rate_pct")
        swr = short_s.get("win_rate_pct")
        if lwr is not None and swr is not None and abs(lwr - swr) >= 20:
            stronger = "LONG" if lwr > swr else "SHORT"
            weaker = "SHORT" if stronger == "LONG" else "LONG"
            notes.append(
                f"{stronger} edge over {weaker}: "
                f"{fmt_pct(lwr if stronger == 'LONG' else swr, sign=False)} vs "
                f"{fmt_pct(swr if stronger == 'LONG' else lwr, sign=False)} win rate."
            )

    # Watchlist patience
    bp = tr["by_provenance"]
    p, d = bp.get("promoted_from_watchlist", {}), bp.get("direct_entry", {})
    if (p.get("count") or 0) >= COLD_START_FLOOR and (d.get("count") or 0) >= COLD_START_FLOOR:
        pwr = p.get("win_rate_pct")
        dwr = d.get("win_rate_pct")
        if pwr is not None and dwr is not None:
            if pwr - dwr >= 10:
                notes.append(
                    f"Watchlist-promoted trades win {fmt_pct(pwr, sign=False)} vs "
                    f"{fmt_pct(dwr, sign=False)} for direct entries — patience pays."
                )
            elif dwr - pwr >= 10:
                notes.append(
                    f"Direct-entry trades win {fmt_pct(dwr, sign=False)} vs "
                    f"{fmt_pct(pwr, sign=False)} for watchlist-promoted — "
                    "watchlist may be filtering too conservatively."
                )

    if not notes:
        return []

    out.append("NOTES")
    out.append("")
    for n in notes:
        out.append(f"  · {n}")
    out.append("")
    return out


# ---------------------------------------------------------------------------
# Main


def main() -> int:
    if not L.LEDGER_PATH.exists():
        sys.stderr.write(
            f"render-outcome-tracker: no ledger at {L.LEDGER_PATH} — nothing to render\n"
        )
        return 0

    try:
        ledger = L.load()
    except L.LedgerError as e:
        sys.stderr.write(f"render-outcome-tracker: ledger validation failed: {e}\n")
        return 2

    since = os.environ.get("V1_LOCK_DATE") or None

    tr = T.build_track_record(ledger, since=since)

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    lines: List[str] = []
    lines.extend(render_header(today_str, since))

    closed_in_window = tr["closed_in_window"]

    if closed_in_window < COLD_START_FLOOR:
        lines.extend(render_cold_start(
            closed_in_window, tr["open_count"], tr["watchlist_count"]
        ))
        if since and tr["closed_total_unfiltered"] > closed_in_window:
            lines.append("")
            lines.append(
                f"(Note: {tr['closed_total_unfiltered']} closed entries exist "
                f"pre-V1-lock; filtered out of this window.)"
            )
    else:
        lines.extend(render_headline(tr["headline"]))
        lines.extend(render_by_direction(tr["by_direction"]))
        lines.extend(render_by_horizon(tr["by_horizon"]))
        lines.extend(render_by_confluence(tr["by_confluence_pattern"]))
        lines.extend(render_by_provenance(tr["by_provenance"]))
        lines.extend(render_auto_flips(tr["auto_flip"]))
        lines.extend(render_notes(tr))

    # Mark-to-market always shown if there are open positions
    if tr["mark_to_market"]:
        lines.extend(render_mark_to_market(tr["mark_to_market"]))

    payload = "\n".join(lines).rstrip() + "\n"

    # Write both artifacts
    OUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    OUT_ARTIFACT.write_text(payload)

    OUT_PERSISTENT.parent.mkdir(parents=True, exist_ok=True)
    OUT_PERSISTENT.write_text(payload)

    print(
        f"render-outcome-tracker: wrote {OUT_ARTIFACT} ({len(payload)} bytes) "
        f"and {OUT_PERSISTENT}. closed_in_window={closed_in_window}, "
        f"open={tr['open_count']}, watchlist={tr['watchlist_count']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
