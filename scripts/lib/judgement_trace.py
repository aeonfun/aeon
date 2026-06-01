"""Reasoning-trace persistence for Claude judgement decisions.

Owns the rolling history file at `memory/topics/state/judgement-trace.json`.
Each entry is a STRUCTURED record of why Claude made a specific call —
the factors that drove it, supporting/contrary evidence, and an optional
counterfactual ("what would have changed the call").

Goal: give Claude its own past reasoning as input to future decisions.
When perps-brief composes a call on HYPE today, it reads recent HYPE
traces and sees what factors weighted as `decisive` in past calls and
how those decisions played out. Intuition compounds because reasoning
persists.

Schema:

    {
      "schema_version": "v1",
      "last_updated":   "YYYY-MM-DDTHH:MM:SSZ",
      "by_asset": {
        "HYPE": [TraceEntry, ...],     # newest last, ordered by ts_utc
        ...
      },
      "by_chain": [TraceEntry, ...]    # decisions not tied to an asset
                                       # (regime calls, macro reads, etc.)
    }

    TraceEntry:
      {
        "ts_utc":         "YYYY-MM-DDTHH:MM:SSZ",
        "skill":          str,            # which skill produced this
        "decision_type":  str,            # see DECISION_TYPES below
        "asset":          str | null,     # null for non-asset decisions
        "decision":       str,            # the call ("LONG (HIGH)", "RIDE", etc.)
        "factors":        [Factor, ...],  # what fed the decision
        "counterfactual": str | null      # what would have flipped the call
      }

    Factor:
      {
        "name":    str,            # e.g. "perps-scan regime"
        "value":   str | number,   # e.g. "LONG_HEAVY" or -7.49
        "context": str | null,     # e.g. "p10 of 30d range"
        "weight":  WEIGHT          # see WEIGHTS below
      }

Decision types (string enum — keep lowercase, snake_case):
  new_position      — Pass 3 entry call (new long/short)
  current_position  — Pass A call on an open position (RIDE / CLOSE)
  watchlist_decision — Pass B call (carry / drop / promote)
  regime            — perps-scan or market-context regime call
  narrative_phase   — narrative-tracker phase transition

Weights (string enum):
  decisive   — Without this factor the call flips
  supporting — Confirms the call but not load-bearing on its own
  contrary   — Argues against the call; Claude weighted it but moved past it
  noted      — Present in the data but didn't move the needle

Retention: per-asset and by_chain series capped at HISTORY_RETENTION_DAYS.
Older traces are trimmed on save.

Atomic write: tmpfile + flush + fsync + os.replace.
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional


HISTORY_PATH = Path("memory/topics/state/judgement-trace.json")
SCHEMA_VERSION = "v1"
HISTORY_RETENTION_DAYS = 60

DECISION_TYPES = frozenset({
    "new_position",
    "current_position",
    "watchlist_decision",
    "regime",
    "narrative_phase",
})

WEIGHTS = frozenset({"decisive", "supporting", "contrary", "noted"})


class JudgementTraceError(Exception):
    """Raised on history load/validate failures."""


def _empty_history() -> dict:
    return {
        "schema_version": SCHEMA_VERSION,
        "last_updated": None,
        "by_asset": {},
        "by_chain": [],
    }


def _ensure_shape(history: dict) -> dict:
    if not isinstance(history, dict):
        raise JudgementTraceError(
            f"history root must be object, got {type(history).__name__}"
        )
    history.setdefault("schema_version", SCHEMA_VERSION)
    history.setdefault("last_updated", None)
    history.setdefault("by_asset", {})
    history.setdefault("by_chain", [])
    if not isinstance(history["by_asset"], dict):
        raise JudgementTraceError("history.by_asset must be object")
    if not isinstance(history["by_chain"], list):
        raise JudgementTraceError("history.by_chain must be array")
    for asset, series in history["by_asset"].items():
        if not isinstance(series, list):
            raise JudgementTraceError(
                f"history.by_asset.{asset} must be array, got {type(series).__name__}"
            )
    return history


def load(path: Path = HISTORY_PATH) -> dict:
    """Load the history file. Returns empty history if missing."""
    if not path.exists():
        return _empty_history()
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise JudgementTraceError(f"history {path} is not valid JSON: {e}")
    return _ensure_shape(data)


def save(history: dict, path: Path = HISTORY_PATH) -> None:
    """Atomically write the history. Updates last_updated."""
    _ensure_shape(history)
    history["last_updated"] = datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(history, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Validation


def _validate_factor(factor: dict, ctx: str) -> None:
    if not isinstance(factor, dict):
        raise JudgementTraceError(f"{ctx}: factor must be object")
    for k in ("name", "weight"):
        if k not in factor:
            raise JudgementTraceError(f"{ctx}: factor missing '{k}'")
    if not isinstance(factor["name"], str) or not factor["name"]:
        raise JudgementTraceError(f"{ctx}: factor.name must be non-empty string")
    if factor["weight"] not in WEIGHTS:
        raise JudgementTraceError(
            f"{ctx}: factor.weight '{factor['weight']}' not in {sorted(WEIGHTS)}"
        )


def _validate_trace(trace: dict) -> None:
    for k in ("ts_utc", "skill", "decision_type", "decision", "factors"):
        if k not in trace:
            raise JudgementTraceError(f"trace missing required field '{k}'")
    if not isinstance(trace["ts_utc"], str):
        raise JudgementTraceError("trace.ts_utc must be string")
    if not isinstance(trace["skill"], str) or not trace["skill"]:
        raise JudgementTraceError("trace.skill must be non-empty string")
    if trace["decision_type"] not in DECISION_TYPES:
        raise JudgementTraceError(
            f"trace.decision_type '{trace['decision_type']}' not in {sorted(DECISION_TYPES)}"
        )
    if not isinstance(trace["decision"], str) or not trace["decision"]:
        raise JudgementTraceError("trace.decision must be non-empty string")
    if not isinstance(trace["factors"], list):
        raise JudgementTraceError("trace.factors must be array")
    if "asset" in trace and trace["asset"] is not None:
        if not isinstance(trace["asset"], str):
            raise JudgementTraceError("trace.asset must be string or null")
    if "counterfactual" in trace and trace["counterfactual"] is not None:
        if not isinstance(trace["counterfactual"], str):
            raise JudgementTraceError("trace.counterfactual must be string or null")
    for i, f in enumerate(trace["factors"]):
        _validate_factor(f, ctx=f"trace.factors[{i}]")


# ---------------------------------------------------------------------------
# Mutators


def append(history: dict, trace: dict) -> None:
    """Append a trace to the appropriate bucket. Idempotent on
    (asset, ts_utc, decision_type) for by_asset traces; on
    (skill, ts_utc, decision_type) for by_chain traces.

    Trims entries older than HISTORY_RETENTION_DAYS on every append."""
    _validate_trace(trace)
    asset = trace.get("asset")
    persisted = {
        "ts_utc":         trace["ts_utc"],
        "skill":          trace["skill"],
        "decision_type":  trace["decision_type"],
        "asset":          (asset.upper() if isinstance(asset, str) else None),
        "decision":       trace["decision"],
        "factors":        [dict(f) for f in trace["factors"]],
        "counterfactual": trace.get("counterfactual"),
    }

    if persisted["asset"]:
        series = history["by_asset"].setdefault(persisted["asset"], [])
        dedup_key = (persisted["ts_utc"], persisted["decision_type"])
        for i, existing in enumerate(series):
            if (existing.get("ts_utc"), existing.get("decision_type")) == dedup_key:
                series[i] = persisted
                _trim_old(series)
                return
        series.append(persisted)
        series.sort(key=lambda e: e.get("ts_utc", ""))
        _trim_old(series)
    else:
        series = history["by_chain"]
        dedup_key = (persisted["skill"], persisted["ts_utc"], persisted["decision_type"])
        for i, existing in enumerate(series):
            if (
                existing.get("skill"),
                existing.get("ts_utc"),
                existing.get("decision_type"),
            ) == dedup_key:
                series[i] = persisted
                _trim_old(series)
                return
        series.append(persisted)
        series.sort(key=lambda e: e.get("ts_utc", ""))
        _trim_old(series)


def _trim_old(series: list) -> None:
    if not series:
        return
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_RETENTION_DAYS)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = [e for e in series if e.get("ts_utc", "") >= cutoff_iso]
    series.clear()
    series.extend(fresh)


# ---------------------------------------------------------------------------
# Accessors (read-only — for Claude to query its own past reasoning)


def recent_for(history: dict, asset: str, days: int = 30) -> list:
    """Return the asset's traces within the last `days`. Newest last."""
    asset = asset.upper()
    series = history["by_asset"].get(asset, [])
    if not series:
        return []
    if days >= HISTORY_RETENTION_DAYS:
        return list(series)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
    return [e for e in series if e.get("ts_utc", "") >= cutoff_iso]


def by_factor(history: dict, factor_name: str, days: int = 30) -> list:
    """Return ALL traces (across assets and by_chain) where `factor_name`
    appeared in the factors[] list, within the last `days`. Useful for
    questions like "every time I weighted divergence_pct as decisive,
    what was the call?"."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
    matches = []
    for series in list(history["by_asset"].values()) + [history["by_chain"]]:
        for trace in series:
            if trace.get("ts_utc", "") < cutoff_iso:
                continue
            for f in trace.get("factors", []):
                if f.get("name") == factor_name:
                    matches.append(trace)
                    break
    return matches


def factor_frequency(history: dict, asset: str, days: int = 30) -> dict:
    """Return a count of how often each factor name appears in the
    asset's recent traces, broken down by weight. Helps Claude see
    which factors it weights decisively most often for this asset."""
    traces = recent_for(history, asset, days=days)
    by_factor: dict = {}
    for t in traces:
        for f in t.get("factors", []):
            name = f.get("name", "?")
            weight = f.get("weight", "?")
            by_factor.setdefault(name, Counter())[weight] += 1
    return {name: dict(c) for name, c in by_factor.items()}


# ---------------------------------------------------------------------------
# CLI


def _cli_validate(path: Path) -> int:
    try:
        history = load(path)
    except JudgementTraceError as e:
        sys.stderr.write(f"history {path}: INVALID — {e}\n")
        return 2
    n_assets = len(history["by_asset"])
    total_asset = sum(len(s) for s in history["by_asset"].values())
    n_chain = len(history["by_chain"])
    print(
        f"history {path}: schema {history['schema_version']}, "
        f"{n_assets} assets ({total_asset} traces) + {n_chain} chain traces, "
        f"last_updated={history.get('last_updated')}"
    )
    for asset, series in sorted(history["by_asset"].items()):
        if not series:
            continue
        last = series[-1]
        n_decisive = sum(
            1 for t in series
            for f in t.get("factors", [])
            if f.get("weight") == "decisive"
        )
        print(
            f"  {asset:<8} n={len(series):>3}  "
            f"last={last.get('ts_utc', '?')[:19]}  "
            f"decision={last.get('decision', '?')}  "
            f"decisive_factors_total={n_decisive}"
        )
    if n_chain:
        print(f"  by_chain n={n_chain}")
        for t in history["by_chain"][-3:]:
            print(
                f"    {t.get('ts_utc', '?')[:19]}  "
                f"skill={t.get('skill', '?')}  "
                f"type={t.get('decision_type', '?')}  "
                f"decision={t.get('decision', '?')}"
            )
    return 0


def _cli_main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else HISTORY_PATH
    return _cli_validate(path)


if __name__ == "__main__":
    sys.exit(_cli_main())
