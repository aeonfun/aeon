"""Deterministic statistical analysis of the perps trading ledger.

Reads closed[] and watchlist_closed[] entries and produces a structured
stats dict suitable for either direct rendering (via embeds.py composer)
or as input context for Claude to synthesise narrative insights.

The split: this module is the math. It does NOT make qualitative
judgements about whether a number is good or bad — that's Claude's job
in the judgement-audit skill, working from these numbers. Keeping the
math pure makes it auditable, reproducible, and cheap (no LLM cost
for the computation step).

Schema returned by `build_audit(...)`:

    {
      "audit_window":     str,          # "7d" | "30d" | "all"
      "since":            "YYYY-MM-DD",
      "to":               "YYYY-MM-DD",
      "headline":         {...},
      "by_direction":     {LONG: {...}, SHORT: {...}},
      "by_horizon":       {24h: {...}, 3d: {...}, ...},
      "by_criterion":     [{criterion, n_fired, win_rate_when_fired,
                            n_missing, win_rate_when_missing, edge_pct}, ...],
      "watchlist_funnel": {...},
      "auto_flips":       {...},
      "time_to_outcome":  {...},
      "eval_call_calibration": {...}
    }

All percentages are floats in [0, 100]. n_X fields are ints. Missing/null
gracefully — empty windows produce zero-counts, not crashes.
"""

from __future__ import annotations

import statistics
from datetime import date, datetime, timedelta
from typing import Optional


# Canonical criterion list — mirrors scripts/lib/ledger.py's CONFLUENCE_CRITERIA.
# Hard-coded here so audit results stay stable across criterion-set changes.
CONFLUENCE_CRITERIA = [
    "quant_regime_aligned",
    "pattern_tag_supports",
    "narrative_phase_aligned",
    "market_regime_aligned",
    "both_tag",
    "repeat_appearance",
    "regime_transition",
    "cross_domain_bridge",
    "enrichment_positive",
    "dominance_aligned",
]


# ---------------------------------------------------------------------------
# Window filtering


def _to_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except (ValueError, TypeError):
        return None


def _filter_window(entries: list, window: str, today: Optional[date] = None) -> list:
    """Return entries whose closed_date falls within the window.

    window ∈ {"7d", "30d", "all"} or "YYYY-MM-DD" (since this date inclusive).
    Entries lacking a parseable closed_date are dropped.
    """
    today = today or datetime.utcnow().date()
    if window == "all":
        return [e for e in entries if _to_date(e.get("closed_date"))]
    if window == "7d":
        cutoff = today - timedelta(days=7)
    elif window == "30d":
        cutoff = today - timedelta(days=30)
    else:
        cutoff = _to_date(window) or today
    return [
        e for e in entries
        if _to_date(e.get("closed_date")) is not None
        and _to_date(e.get("closed_date")) >= cutoff
    ]


def _safe_pct(num: float, denom: float) -> Optional[float]:
    """Returns 100 * num/denom rounded to 1dp, or None if denom is zero."""
    if denom == 0:
        return None
    return round(100.0 * num / denom, 1)


def _safe_median(values: list[float]) -> Optional[float]:
    vs = [v for v in values if v is not None]
    if not vs:
        return None
    return round(statistics.median(vs), 2)


def _safe_mean(values: list[float]) -> Optional[float]:
    vs = [v for v in values if v is not None]
    if not vs:
        return None
    return round(statistics.fmean(vs), 2)


def _days_between(start: Optional[str], end: Optional[str]) -> Optional[int]:
    s = _to_date(start)
    e = _to_date(end)
    if s is None or e is None:
        return None
    return (e - s).days


# ---------------------------------------------------------------------------
# Headline metrics


def _build_headline(closed: list[dict]) -> dict:
    n = len(closed)
    n_wins = sum(1 for e in closed if e.get("outcome") == "WIN")
    n_losses = sum(1 for e in closed if e.get("outcome") == "LOSS")
    n_scares = sum(1 for e in closed if e.get("outcome") == "SCARE")
    n_neutral = sum(1 for e in closed if e.get("outcome") == "NEUTRAL")

    returns = [e.get("return_pct") for e in closed]
    returns_btc = [e.get("return_vs_btc_pct") for e in closed]
    maes = [e.get("mae_pct") for e in closed if e.get("mae_pct") is not None]
    mfes = [e.get("mfe_pct") for e in closed if e.get("mfe_pct") is not None]

    best = max(closed, key=lambda e: (e.get("return_pct") or float("-inf")), default=None)
    worst = min(closed, key=lambda e: (e.get("return_pct") or float("inf")), default=None)

    return {
        "n_closed":        n,
        "n_wins":          n_wins,
        "n_losses":        n_losses,
        "n_scares":        n_scares,
        "n_neutral":       n_neutral,
        # win_rate_pct counts WIN + SCARE together (both made money). Pure
        # WIN rate is also surfaced separately so the operator can see how
        # often we made money cleanly vs after a stop breach.
        "win_rate_pct":            _safe_pct(n_wins + n_scares, n),
        "clean_win_rate_pct":      _safe_pct(n_wins, n),
        "scare_share_of_wins_pct": _safe_pct(n_scares, n_wins + n_scares),
        "avg_return_pct":          _safe_mean(returns),
        "median_return_pct":       _safe_median(returns),
        "avg_return_vs_btc_pct":   _safe_mean(returns_btc),
        "median_return_vs_btc_pct": _safe_median(returns_btc),
        "max_drawdown_pct":        min(maes) if maes else None,
        "max_peak_gain_pct":       max(mfes) if mfes else None,
        "best_trade":  {
            "id":         best.get("id") if best else None,
            "asset":      best.get("asset") if best else None,
            "direction":  best.get("direction") if best else None,
            "return_pct": best.get("return_pct") if best else None,
        } if best else None,
        "worst_trade": {
            "id":         worst.get("id") if worst else None,
            "asset":      worst.get("asset") if worst else None,
            "direction":  worst.get("direction") if worst else None,
            "return_pct": worst.get("return_pct") if worst else None,
        } if worst else None,
    }


# ---------------------------------------------------------------------------
# Slice analyses


def _slice_stats(entries: list[dict]) -> dict:
    """Compute a slice-summary suitable for by_direction / by_horizon."""
    n = len(entries)
    n_wins = sum(1 for e in entries if e.get("outcome") == "WIN")
    n_losses = sum(1 for e in entries if e.get("outcome") == "LOSS")
    n_scares = sum(1 for e in entries if e.get("outcome") == "SCARE")
    n_neutral = sum(1 for e in entries if e.get("outcome") == "NEUTRAL")
    returns = [e.get("return_pct") for e in entries]
    returns_btc = [e.get("return_vs_btc_pct") for e in entries]
    return {
        "n":                       n,
        "n_wins":                  n_wins,
        "n_losses":                n_losses,
        "n_scares":                n_scares,
        "n_neutral":               n_neutral,
        "win_rate_pct":            _safe_pct(n_wins + n_scares, n),
        "clean_win_rate_pct":      _safe_pct(n_wins, n),
        "avg_return_pct":          _safe_mean(returns),
        "median_return_pct":       _safe_median(returns),
        "avg_return_vs_btc_pct":   _safe_mean(returns_btc),
    }


def _build_by_direction(closed: list[dict]) -> dict:
    return {
        "LONG":  _slice_stats([e for e in closed if e.get("direction") == "LONG"]),
        "SHORT": _slice_stats([e for e in closed if e.get("direction") == "SHORT"]),
    }


def _build_by_horizon(closed: list[dict]) -> dict:
    horizons = ["24h", "3d", "7d", "multi-week"]
    return {
        h: _slice_stats([e for e in closed if e.get("horizon") == h])
        for h in horizons
    }


def _build_by_criterion(closed: list[dict]) -> list[dict]:
    """For each canonical confluence criterion, compute the win-rate
    when it FIRED vs when it was MISSING. Edge = fired_rate - missing_rate.

    Sorted by edge descending — the most-discriminating criteria float to
    the top.
    """
    out: list[dict] = []
    for crit in CONFLUENCE_CRITERIA:
        fired = [e for e in closed if crit in (e.get("confluence_fired") or [])]
        missing = [e for e in closed if crit not in (e.get("confluence_fired") or [])]
        n_fired = len(fired)
        n_missing = len(missing)
        fired_wins = sum(1 for e in fired if e.get("outcome") in ("WIN", "SCARE"))
        missing_wins = sum(1 for e in missing if e.get("outcome") in ("WIN", "SCARE"))
        wr_fired = _safe_pct(fired_wins, n_fired)
        wr_missing = _safe_pct(missing_wins, n_missing)
        edge = None
        if wr_fired is not None and wr_missing is not None:
            edge = round(wr_fired - wr_missing, 1)
        out.append({
            "criterion":              crit,
            "n_fired":                n_fired,
            "win_rate_when_fired_pct": wr_fired,
            "n_missing":              n_missing,
            "win_rate_when_missing_pct": wr_missing,
            "edge_pct":               edge,
            # Average return WHEN FIRED — sometimes the win rate is similar
            # but the expected value differs because winners are bigger
            "avg_return_when_fired_pct": _safe_mean([e.get("return_pct") for e in fired]),
        })
    # Sort by absolute edge (most discriminating first), Nones last
    out.sort(
        key=lambda x: (
            x["edge_pct"] is None,
            -abs(x["edge_pct"] or 0),
        ),
    )
    return out


# ---------------------------------------------------------------------------
# Watchlist funnel


def _build_watchlist_funnel(watchlist_closed: list[dict], closed: list[dict]) -> dict:
    """Walk watchlist_closed[] to compute the watch → outcome funnel.

    Promoted entries link to closed[] entries via promoted_to_open_id; we
    look those up to get the eventual position outcome.
    """
    # Index closed[] entries by id for promotion outcome lookup
    closed_by_id = {e.get("id"): e for e in closed if e.get("id")}

    n_total = len(watchlist_closed)
    promoted = [w for w in watchlist_closed if w.get("close_reason") == "promoted"]
    invalidated = [w for w in watchlist_closed if w.get("close_reason") == "invalidated"]
    thesis_decayed = [w for w in watchlist_closed if w.get("close_reason") == "thesis_decayed"]
    stale = [w for w in watchlist_closed if w.get("close_reason") == "stale"]

    # Promoted-outcome stats: of all watchlist entries that promoted, how
    # did the resulting position perform? Only counts ones whose position
    # has CLOSED (and is therefore in closed_by_id).
    promoted_position_outcomes = []
    for w in promoted:
        open_id = w.get("promoted_to_open_id")
        if open_id and open_id in closed_by_id:
            promoted_position_outcomes.append(closed_by_id[open_id])

    n_promoted_resolved = len(promoted_position_outcomes)
    n_promoted_wins = sum(
        1 for e in promoted_position_outcomes
        if e.get("outcome") in ("WIN", "SCARE")
    )
    n_promoted_losses = sum(
        1 for e in promoted_position_outcomes if e.get("outcome") == "LOSS"
    )

    # Time-on-watchlist distributions per outcome
    return {
        "n_total":             n_total,
        "n_promoted":          len(promoted),
        "n_invalidated":       len(invalidated),
        "n_thesis_decayed":    len(thesis_decayed),
        "n_stale":             len(stale),
        "promote_rate_pct":     _safe_pct(len(promoted),     n_total),
        "invalidation_rate_pct": _safe_pct(len(invalidated), n_total),
        "decay_rate_pct":       _safe_pct(len(thesis_decayed), n_total),
        "stale_rate_pct":       _safe_pct(len(stale),        n_total),
        "median_days_promoted":     _safe_median(
            [w.get("days_on_watchlist") for w in promoted]),
        "median_days_invalidated":  _safe_median(
            [w.get("days_on_watchlist") for w in invalidated]),
        "median_days_thesis_decayed": _safe_median(
            [w.get("days_on_watchlist") for w in thesis_decayed]),
        "promoted_position_outcomes": {
            "n_resolved":     n_promoted_resolved,
            "n_pending":      len(promoted) - n_promoted_resolved,
            "n_wins":         n_promoted_wins,
            "n_losses":       n_promoted_losses,
            "win_rate_pct":   _safe_pct(n_promoted_wins, n_promoted_resolved),
        },
    }


# ---------------------------------------------------------------------------
# Auto-flip + time-to-outcome + eval-call calibration


def _build_auto_flips(closed: list[dict]) -> dict:
    """Auto-flipped closes: the position that CLOSED to make room for the
    opposite-direction open. The question: when auto-flip fires, does
    the NEW (opposite-direction) position outperform?

    For each closed entry where auto_flipped=true, find the next opened
    position on the same asset and look up its outcome (if closed).
    """
    flips = [e for e in closed if e.get("auto_flipped")]
    n = len(flips)

    # The position that took over after auto-flip is the open[] entry on
    # the same asset opened ON the closed_date. Lookup: closed list grouped
    # by asset, ordered by fired_date.
    by_asset: dict[str, list[dict]] = {}
    for e in closed:
        asset = e.get("asset", "").upper()
        by_asset.setdefault(asset, []).append(e)
    for arr in by_asset.values():
        arr.sort(key=lambda e: (e.get("fired_date") or "", e.get("id") or ""))

    flip_followups: list[dict] = []
    for f in flips:
        asset = f.get("asset", "").upper()
        flip_closed_date = f.get("closed_date")
        if not asset or not flip_closed_date:
            continue
        # The followup is the next closed entry on the same asset with
        # fired_date == flip_closed_date AND opposite direction.
        for candidate in by_asset.get(asset, []):
            if (
                candidate.get("fired_date") == flip_closed_date
                and candidate.get("direction") != f.get("direction")
                and candidate.get("id") != f.get("id")
            ):
                flip_followups.append(candidate)
                break

    n_followups_resolved = len(flip_followups)
    n_wins = sum(1 for e in flip_followups if e.get("outcome") in ("WIN", "SCARE"))
    return {
        "n":                            n,
        "n_followups_resolved":         n_followups_resolved,
        "n_followups_unresolved":       n - n_followups_resolved,
        "followup_win_rate_pct":        _safe_pct(n_wins, n_followups_resolved),
        "followup_avg_return_pct":      _safe_mean(
            [e.get("return_pct") for e in flip_followups]),
    }


def _build_time_to_outcome(closed: list[dict]) -> dict:
    """Median time-to-close per outcome label."""
    by_outcome: dict[str, list[int]] = {"WIN": [], "LOSS": [], "SCARE": [], "NEUTRAL": []}
    for e in closed:
        outcome = e.get("outcome")
        if outcome not in by_outcome:
            continue
        d = _days_between(e.get("fired_date"), e.get("closed_date"))
        if d is not None:
            by_outcome[outcome].append(d)
    return {
        f"median_days_{k.lower()}": _safe_median(v) for k, v in by_outcome.items()
    }


def _build_eval_call_calibration(closed: list[dict]) -> dict:
    """When Claude says RIDE on a position, is the trade typically still
    positive when it eventually closes? When Claude says CLOSE, was the
    position already underperforming?

    Counts at the EVAL level, not the position level.
    """
    n_ride = 0
    n_close = 0
    n_close_neg_at_eval = 0
    n_ride_then_loss = 0  # rides that ended up as LOSS / SCARE
    n_ride_then_win = 0

    for e in closed:
        outcome = e.get("outcome")
        final_ok = outcome in ("WIN", "SCARE")
        fired_price = e.get("fired_price")
        for ev in (e.get("evaluations") or []):
            call = ev.get("call")
            if call == "RIDE":
                n_ride += 1
                if final_ok:
                    n_ride_then_win += 1
                else:
                    n_ride_then_loss += 1
            elif call == "CLOSE":
                n_close += 1
                # "Already negative at CLOSE call" — proxy: price_at_eval
                # vs fired_price, signed by direction
                p = ev.get("price_at_eval")
                if p is not None and fired_price:
                    pnl_signed = (p - fired_price) / fired_price
                    if e.get("direction") == "SHORT":
                        pnl_signed = -pnl_signed
                    if pnl_signed < 0:
                        n_close_neg_at_eval += 1

    return {
        "n_ride_calls":                       n_ride,
        "n_close_calls":                      n_close,
        "ride_then_win_rate_pct":             _safe_pct(n_ride_then_win, n_ride),
        "ride_then_loss_rate_pct":            _safe_pct(n_ride_then_loss, n_ride),
        "close_when_already_underperforming_pct": _safe_pct(n_close_neg_at_eval, n_close),
    }


# ---------------------------------------------------------------------------
# Public API


def top_winners_losers(
    closed: list[dict],
    n_winners: int = 3,
    n_losers: int = 3,
) -> dict:
    """Pick the top-N winners and top-N losers from a list of closed
    entries for per-trade postmortem analysis by Claude.

    Selection rule:
      - Winners: sort by return_pct DESC, take top n_winners with return > 0
      - Losers: sort by return_pct ASC, take top n_losers with return < 0

    Ties broken by absolute return magnitude, then by closed_date DESC
    (more recent first).

    Returns {"winners": [...], "losers": [...]} where each entry is the
    full closed[] dict (including evaluations, watchlist_provenance,
    confluence, etc.) — Claude gets the full context for each.
    """
    def _key(e: dict) -> float:
        r = e.get("return_pct")
        return r if r is not None else 0.0

    positives = sorted(
        [e for e in closed if (e.get("return_pct") or 0) > 0],
        key=_key,
        reverse=True,
    )
    negatives = sorted(
        [e for e in closed if (e.get("return_pct") or 0) < 0],
        key=_key,
    )
    return {
        "winners": positives[:n_winners],
        "losers":  negatives[:n_losers],
    }


def build_audit(
    ledger: dict,
    window: str = "30d",
    today: Optional[date] = None,
    v1_lock_date: Optional[str] = None,
) -> dict:
    """Compute the full audit stats dict for the given window.

    window: "7d", "30d", "all", or an explicit "YYYY-MM-DD" cutoff.

    v1_lock_date: when set, "all"-window filters to entries closed on or
      after this date. Implements the operator's partial-reset baseline
      so pre-V1 closes don't contaminate V1 track-record analysis.
    """
    today = today or datetime.utcnow().date()
    closed_all = ledger.get("closed", []) or []
    wl_closed_all = ledger.get("watchlist_closed", []) or []

    # V1 lock applies regardless of window — it sets a floor.
    if v1_lock_date:
        v1_floor = _to_date(v1_lock_date)
        if v1_floor:
            closed_all = [
                e for e in closed_all
                if (d := _to_date(e.get("closed_date"))) is not None and d >= v1_floor
            ]
            wl_closed_all = [
                w for w in wl_closed_all
                if (d := _to_date(w.get("closed_date"))) is not None and d >= v1_floor
            ]

    closed = _filter_window(closed_all, window, today)
    wl_closed = _filter_window(wl_closed_all, window, today)

    since = min(
        ([_to_date(e.get("closed_date")) for e in closed if _to_date(e.get("closed_date"))]),
        default=None,
    )
    to = max(
        ([_to_date(e.get("closed_date")) for e in closed if _to_date(e.get("closed_date"))]),
        default=None,
    )

    return {
        "audit_window":     window,
        "since":            since.isoformat() if since else None,
        "to":               to.isoformat() if to else None,
        "v1_lock_date":     v1_lock_date,
        "headline":         _build_headline(closed),
        "by_direction":     _build_by_direction(closed),
        "by_horizon":       _build_by_horizon(closed),
        "by_criterion":     _build_by_criterion(closed),
        "watchlist_funnel": _build_watchlist_funnel(wl_closed, closed),
        "auto_flips":       _build_auto_flips(closed),
        "time_to_outcome":  _build_time_to_outcome(closed),
        "eval_call_calibration": _build_eval_call_calibration(closed),
        # Postmortem candidates — Claude reads these in the
        # judgement-audit skill and writes per-trade categorization.
        # Includes the FULL closed[] entry per pick so Claude has the
        # evaluations[] journal, watchlist_provenance, confluence,
        # MAE/MFE timing, close reason — everything needed to assess
        # asset vs regime failure mode without re-reading the ledger.
        "postmortem_candidates": top_winners_losers(closed, n_winners=3, n_losers=3),
    }
