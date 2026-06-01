"""Trace-outcome cross-reference — joins judgement-trace.json with the
ledger's closed[] entries to answer "for every factor weighted decisive,
what was the eventual trade outcome?".

This is the analysis layer on top of:
  - `judgement_trace.py` — Claude's reasoning records (ships PR #70)
  - `ledger.py`           — the active-setups.json closed[] outcomes

Substrate is ready (traces + ledger both live). Analysis layer is in
this module. It returns FACTS (counts and ratios) — judgement-audit
renders the narrative from them; daily-ops-review can surface
inconsistencies; nothing here classifies or labels.

Core question this answers:

  > For every factor I weighted as `decisive`, what was the eventual
  > outcome of the trade I made that decision on?

This is the closed loop: when divergence_pct shows up as decisive in
twelve traces and ten of those trades closed WIN, you have evidence
the factor's pulling its weight. When narrative-phase = PEAK shows up
as decisive in eight traces and three closed SCARE, you know the
factor's reading needs refinement.

The lib does NO classification. It returns:

  {
    "by_factor": {
      "<factor_name>": {
        "decisive":   {"WIN": n, "LOSS": n, "SCARE": n, "NEUTRAL": n, "n_total": n},
        "supporting": {...},
        "contrary":   {...},
        "noted":      {...}
      },
      ...
    },
    "n_trades": int,
    "lookback_days": int
  }

Judgement-audit interprets. Operator decides what to do with it.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib import judgement_trace as JT  # noqa: E402
from lib import ledger as L  # noqa: E402


VALID_OUTCOMES = ("WIN", "LOSS", "SCARE", "NEUTRAL")
VALID_WEIGHTS = ("decisive", "supporting", "contrary", "noted")


class JudgementAuditError(Exception):
    """Raised on cross-reference failures."""


def _parse_date(s: str) -> Optional[datetime]:
    """Parse YYYY-MM-DD into UTC midnight, or YYYY-MM-DDTHH:MM:SSZ."""
    if not isinstance(s, str) or not s:
        return None
    try:
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        return datetime.fromisoformat(s + "T00:00:00+00:00")
    except (ValueError, TypeError):
        return None


def _traces_for_trade(
    trace_history: dict, asset: str, fired_date: str, closed_date: str
) -> list:
    """Return the traces for `asset` whose ts_utc falls within
    [fired_date, closed_date + 1 day) — i.e. every trace that
    informed a decision on this trade while it was open."""
    fired = _parse_date(fired_date)
    closed = _parse_date(closed_date)
    if fired is None or closed is None:
        return []
    closed_plus = closed + timedelta(days=1)
    series = trace_history.get("by_asset", {}).get(asset.upper(), [])
    if not series:
        return []
    in_window = []
    for entry in series:
        ts = _parse_date(entry.get("ts_utc", ""))
        if ts is None:
            continue
        if fired <= ts < closed_plus:
            in_window.append(entry)
    return in_window


def _empty_weight_counts() -> dict:
    return {o: 0 for o in VALID_OUTCOMES} | {"n_total": 0}


def cross_reference_factors(
    trace_history: dict,
    ledger: dict,
    lookback_days: int = 30,
) -> dict:
    """Join traces with closed[] outcomes. Returns aggregated counts
    keyed by (factor_name, weight)."""

    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    by_factor: dict = {}
    n_trades = 0

    for closed_entry in ledger.get("closed", []) or []:
        asset = closed_entry.get("asset")
        outcome = closed_entry.get("outcome")
        fired_date = closed_entry.get("fired_date")
        closed_date = closed_entry.get("closed_date")
        if not asset or outcome not in VALID_OUTCOMES:
            continue
        if not fired_date or not closed_date:
            continue
        closed_dt = _parse_date(closed_date)
        if closed_dt is None or closed_dt < cutoff:
            continue

        traces = _traces_for_trade(trace_history, asset, fired_date, closed_date)
        if not traces:
            continue

        n_trades += 1

        # Aggregate factors across all traces for this trade
        # (factor_name, weight) → counted once per trade per (name, weight)
        # combo — if the same factor appears as decisive in 5 traces for
        # the same trade, that's still ONE data point for the trade.
        # This avoids double-counting when Claude re-affirms the same
        # weighting across multiple chain runs.
        seen_for_trade: set = set()
        for trace in traces:
            for f in trace.get("factors", []):
                name = f.get("name")
                weight = f.get("weight")
                if not name or weight not in VALID_WEIGHTS:
                    continue
                key = (name, weight)
                if key in seen_for_trade:
                    continue
                seen_for_trade.add(key)

                bucket = by_factor.setdefault(name, {
                    w: _empty_weight_counts() for w in VALID_WEIGHTS
                })
                bucket[weight][outcome] += 1
                bucket[weight]["n_total"] += 1

    return {
        "by_factor":     by_factor,
        "n_trades":      n_trades,
        "lookback_days": lookback_days,
    }


def win_rate(counts: dict) -> Optional[float]:
    """Compute WIN/(WIN+LOSS) for a counts dict. None if no decisive
    trades. SCARE and NEUTRAL are excluded — they're outcomes with
    their own meaning, not signal for "did the call work."."""
    wins = counts.get("WIN", 0)
    losses = counts.get("LOSS", 0)
    denom = wins + losses
    if denom == 0:
        return None
    return wins / denom


def hit_rate(counts: dict) -> Optional[float]:
    """Compute WIN/(WIN+LOSS+SCARE) for a counts dict. None if no
    trades. SCARE is treated as a partial miss (won the trade but
    breached invalidation = signal still flawed). NEUTRAL excluded."""
    wins = counts.get("WIN", 0)
    losses = counts.get("LOSS", 0)
    scares = counts.get("SCARE", 0)
    denom = wins + losses + scares
    if denom == 0:
        return None
    return wins / denom


def rank_factors_by_weight(
    cross_ref: dict, weight: str = "decisive", min_n: int = 3
) -> list:
    """Return factors ranked by win_rate within a given weight, filtered
    to those with at least min_n trades. Returns list of
    {name, n_total, win_rate, hit_rate, counts}."""
    if weight not in VALID_WEIGHTS:
        raise JudgementAuditError(f"weight must be one of {VALID_WEIGHTS}")
    rows = []
    for name, by_w in cross_ref.get("by_factor", {}).items():
        counts = by_w.get(weight, {})
        n = counts.get("n_total", 0)
        if n < min_n:
            continue
        rows.append({
            "name":     name,
            "n_total":  n,
            "win_rate": win_rate(counts),
            "hit_rate": hit_rate(counts),
            "counts":   dict(counts),
        })
    # Sort by win_rate desc, fall back to hit_rate, then n_total
    rows.sort(
        key=lambda r: (
            -(r["win_rate"] if r["win_rate"] is not None else -1),
            -(r["hit_rate"] if r["hit_rate"] is not None else -1),
            -r["n_total"],
        )
    )
    return rows


# ---------------------------------------------------------------------------
# CLI — for ad-hoc reads and inclusion in judgement-audit


def _cli_main() -> int:
    """Print the cross-reference summary for ops review."""
    lookback = 30
    if len(sys.argv) > 1:
        try:
            lookback = int(sys.argv[1])
        except ValueError:
            sys.stderr.write(f"usage: {sys.argv[0]} [lookback_days]\n")
            return 2
    try:
        trace_history = JT.load()
        ledger = L.load()
    except (JT.JudgementTraceError, L.LedgerError) as e:
        sys.stderr.write(f"judgement_audit: load failed: {e}\n")
        return 2
    cross_ref = cross_reference_factors(trace_history, ledger, lookback_days=lookback)
    print(json.dumps(cross_ref, indent=2))
    print(f"\nDecisive factor leaderboard (min n=3, lookback={lookback}d):")
    ranked = rank_factors_by_weight(cross_ref, weight="decisive", min_n=3)
    if not ranked:
        print("  (no factors with n>=3 yet — soak more traces)")
    else:
        for r in ranked:
            wr = "—" if r["win_rate"] is None else f"{r['win_rate']:.1%}"
            hr = "—" if r["hit_rate"] is None else f"{r['hit_rate']:.1%}"
            print(
                f"  {r['name']:<30}  n={r['n_total']:>3}  "
                f"WR={wr:>6}  HR={hr:>6}  {r['counts']}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(_cli_main())
