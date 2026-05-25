"""Outcome tracker analytics for the perps engine v4.1.

Reads memory/topics/state/active-setups.json, computes track-record
statistics across closed positions, mark-to-market for open positions,
and returns structured data the render script formats into markdown.

Filters:
- `since`: ISO date string. Only include closed entries with closed_date
  >= since. Used to filter pre-V1-lock data from the V1 baseline analysis.

Outcome semantics (mirrors apply-ledger-ops.py compute_outcome):
- WIN: return_vs_btc_pct >= +2 AND invalidation NOT breached
- SCARE: return_vs_btc_pct >= +2 AND invalidation breached at some point
  (the trade won but went through a stop that wasn't honored)
- LOSS: return_vs_btc_pct <= -2 OR closed at invalidation
- NEUTRAL: between -2 and +2 vs BTC

For win-rate calculations, SCARE counts as a WIN (the trade was profitable
in absolute terms) but is surfaced separately so the operator can see
which "wins" actually went through a stop.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Optional


LEDGER_PATH = Path("memory/topics/state/active-setups.json")
COINGLASS_CACHE = Path(".coinglass-cache")


def load_ledger(path: Path = LEDGER_PATH) -> dict:
    return json.loads(path.read_text())


def filter_closed_since(closed: list, since: Optional[str]) -> list:
    """Return only closed entries with closed_date >= since (YYYY-MM-DD)."""
    if not since:
        return closed
    return [e for e in closed if e.get("closed_date", "") >= since]


def _parse_horizon_days(s: str) -> Optional[float]:
    """Parse a horizon string like '3d', '24h', '7d', 'multi-week' to days."""
    if not s:
        return None
    s = str(s).strip()
    try:
        if s.endswith("d"):
            return float(s[:-1])
        if s.endswith("h"):
            return float(s[:-1]) / 24
        if s == "multi-week":
            return 21.0
    except ValueError:
        return None
    return None


def compute_rollup(closed: list) -> dict:
    """Aggregate stats across a list of closed entries."""
    if not closed:
        return {
            "count": 0,
            "longs": 0,
            "shorts": 0,
            "wins": 0,
            "losses": 0,
            "scares": 0,
            "neutrals": 0,
            "win_rate_pct": None,
            "win_rate_strict_pct": None,  # excludes SCARE
            "avg_return_pct": None,
            "avg_return_vs_btc_pct": None,
            "avg_horizon_realized_days": None,
            "horizon_realization_ratio": None,  # avg(realized/target)
        }

    longs = sum(1 for e in closed if e.get("direction") == "LONG")
    shorts = sum(1 for e in closed if e.get("direction") == "SHORT")
    wins = sum(1 for e in closed if e.get("outcome") == "WIN")
    losses = sum(1 for e in closed if e.get("outcome") == "LOSS")
    scares = sum(1 for e in closed if e.get("outcome") == "SCARE")
    neutrals = sum(1 for e in closed if e.get("outcome") == "NEUTRAL")

    # SCARE counts as win for headline win-rate; strict win-rate excludes it
    win_rate_pct = (wins + scares) / len(closed) * 100
    win_rate_strict_pct = wins / len(closed) * 100

    returns = [e["return_pct"] for e in closed if e.get("return_pct") is not None]
    returns_btc = [
        e["return_vs_btc_pct"] for e in closed if e.get("return_vs_btc_pct") is not None
    ]

    realized_days = []
    realization_ratios = []
    for e in closed:
        rd = _parse_horizon_days(e.get("horizon_realized", ""))
        td = _parse_horizon_days(e.get("horizon", ""))
        if rd is not None:
            realized_days.append(rd)
        if rd is not None and td and td > 0:
            realization_ratios.append(rd / td)

    return {
        "count": len(closed),
        "longs": longs,
        "shorts": shorts,
        "wins": wins,
        "losses": losses,
        "scares": scares,
        "neutrals": neutrals,
        "win_rate_pct": win_rate_pct,
        "win_rate_strict_pct": win_rate_strict_pct,
        "avg_return_pct": sum(returns) / len(returns) if returns else None,
        "avg_return_vs_btc_pct": sum(returns_btc) / len(returns_btc) if returns_btc else None,
        "avg_horizon_realized_days": sum(realized_days) / len(realized_days) if realized_days else None,
        "horizon_realization_ratio": sum(realization_ratios) / len(realization_ratios) if realization_ratios else None,
    }


def rollup_by_direction(closed: list) -> dict:
    return {
        "LONG": compute_rollup([e for e in closed if e.get("direction") == "LONG"]),
        "SHORT": compute_rollup([e for e in closed if e.get("direction") == "SHORT"]),
    }


def rollup_by_horizon(closed: list) -> dict:
    return {
        h: compute_rollup([e for e in closed if e.get("horizon") == h])
        for h in ("24h", "3d", "7d", "multi-week")
    }


def rollup_by_confluence_pattern(closed: list, min_n: int = 3) -> list:
    """Group closed entries by their confluence_fired set.

    Returns patterns with at least min_n samples, ranked by headline
    win_rate_pct descending. Each entry is the rollup dict + a 'pattern'
    field listing the criteria.
    """
    groups: dict[tuple, list] = defaultdict(list)
    for e in closed:
        pattern = tuple(sorted(e.get("confluence_fired", [])))
        groups[pattern].append(e)

    results = []
    for pattern, entries in groups.items():
        if len(entries) < min_n:
            continue
        stats = compute_rollup(entries)
        stats["pattern"] = list(pattern)
        results.append(stats)

    return sorted(results, key=lambda r: r.get("win_rate_pct") or 0, reverse=True)


def rollup_by_provenance(closed: list) -> dict:
    """Split closed entries by whether they were promoted from watchlist
    (operator was patient) vs entered directly (operator acted same-day)."""
    promoted = [e for e in closed if e.get("watchlist_provenance") is not None]
    direct = [e for e in closed if e.get("watchlist_provenance") is None]
    return {
        "promoted_from_watchlist": compute_rollup(promoted),
        "direct_entry": compute_rollup(direct),
    }


def auto_flip_stats(closed: list) -> dict:
    """Stats specific to auto-flipped closes (closed because an opposite-
    direction high-conviction entry fired on the same asset)."""
    flipped = [e for e in closed if e.get("auto_flipped")]
    return {"count": len(flipped), **compute_rollup(flipped)}


def _lookup_current_price(
    asset: str, cache_dir: Path = COINGLASS_CACHE
) -> Optional[float]:
    """Read the most recent close from .coinglass-cache/price-<ASSET>.json.

    Returns None if cache file missing or unreadable — the asset has
    likely dropped out of the perps-scan top-25 universe. Caller falls
    back to the most recent evaluation price from the ledger.
    """
    if not asset:
        return None
    f = cache_dir / f"price-{asset.upper()}.json"
    if not f.exists():
        return None
    try:
        data = json.loads(f.read_text())
        rows = data.get("data", [])
        if not rows:
            return None
        latest = rows[0]
        close = latest.get("close")
        return float(close) if close is not None else None
    except (json.JSONDecodeError, ValueError, KeyError, TypeError):
        return None


def _last_eval_price(entry: dict) -> Optional[float]:
    """Fall-back price source: most recent evaluation's price_at_eval."""
    evals = entry.get("evaluations", [])
    for ev in reversed(evals):
        p = ev.get("price_at_eval")
        if p is not None:
            try:
                return float(p)
            except (ValueError, TypeError):
                continue
    return None


def compute_mark_to_market(
    open_entries: list, cache_dir: Path = COINGLASS_CACHE
) -> list:
    """For each open entry, compute current PnL.

    Tries Coinglass cache first; falls back to the last evaluation's
    price_at_eval if the asset's cache file is missing. Marks `stale`
    when the fall-back was used.
    """
    results = []
    today = date.today()
    for e in open_entries:
        asset = e.get("asset")
        fired_price = e.get("fired_price")
        direction = e.get("direction")

        current_price = _lookup_current_price(asset, cache_dir)
        stale = False
        if current_price is None:
            current_price = _last_eval_price(e)
            stale = current_price is not None

        pnl_pct = None
        if current_price is not None and fired_price:
            try:
                fp = float(fired_price)
                if fp > 0:
                    if direction == "LONG":
                        pnl_pct = (current_price - fp) / fp * 100
                    else:
                        pnl_pct = -(current_price - fp) / fp * 100
            except (ValueError, TypeError):
                pass

        try:
            fd = date.fromisoformat(e.get("fired_date", ""))
            days_elapsed = (today - fd).days
        except ValueError:
            days_elapsed = None

        results.append(
            {
                "id": e.get("id"),
                "asset": asset,
                "direction": direction,
                "fired_date": e.get("fired_date"),
                "fired_price": fired_price,
                "current_price": current_price,
                "price_is_stale": stale,
                "pnl_pct": pnl_pct,
                "horizon": e.get("horizon"),
                "days_elapsed": days_elapsed,
                "mae_pct": e.get("mae_pct"),
                "mfe_pct": e.get("mfe_pct"),
                "invalidation_breached": e.get("invalidation_breached", False),
                "watchlist_provenance": e.get("watchlist_provenance"),
            }
        )
    return results


def build_track_record(
    ledger: dict,
    since: Optional[str] = None,
    confluence_min_n: int = 3,
) -> dict:
    """Top-level: assemble all rollups + mark-to-market into a single dict."""
    closed_all = ledger.get("closed", [])
    closed = filter_closed_since(closed_all, since)
    open_entries = ledger.get("open", [])

    return {
        "since": since,
        "closed_total_unfiltered": len(closed_all),
        "closed_in_window": len(closed),
        "open_count": len(open_entries),
        "watchlist_count": len(ledger.get("watchlist", [])),
        "headline": compute_rollup(closed),
        "by_direction": rollup_by_direction(closed),
        "by_horizon": rollup_by_horizon(closed),
        "by_confluence_pattern": rollup_by_confluence_pattern(closed, confluence_min_n),
        "by_provenance": rollup_by_provenance(closed),
        "auto_flip": auto_flip_stats(closed),
        "mark_to_market": compute_mark_to_market(open_entries),
    }
