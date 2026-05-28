"""Perps engine v4.1 ledger — schema validation + atomic read/write.

The ledger at memory/topics/state/active-setups.json is the source of truth
for every fired LONG/SHORT position. This module owns its on-disk format.

v4.1 changes from v4:
- pending[] renamed to watchlist[] (cap 5 enforced at render layer)
- MAE/MFE tracking on every open/closed entry (daily close granularity)
- SCARE added to outcome vocabulary (won the trade but breached invalidation)
- watchlist_provenance on open/closed entries promoted from a watchlist
- auto_flipped flag on closes triggered by opposite-direction entry
- VALID_CALLS simplified to {RIDE, CLOSE}

Schema:
    {
      "schema_version": "v4.1",
      "last_updated": str | null,
      "open":      [OpenEntry, ...],
      "watchlist": [WatchlistEntry, ...],
      "closed":    [ClosedEntry, ...]
    }

OpenEntry:
    {
      "id":              "TICKER-YYYY-MM-DD-NNN",
      "asset":           str,
      "direction":       "LONG" | "SHORT",
      "fired_date":      "YYYY-MM-DD",
      "fired_price":     number,
      "fired_btc_price": number | null,
      "fired_eth_price": number | null,
      "entry_zone":      str | null,
      "invalidation":    str,
      "horizon":         "24h" | "3d" | "7d" | "multi-week",
      "thesis":          str,
      "confluence_fired":   [str, ...],
      "confluence_missing": [str, ...],
      "named_risks":     [str, ...],
      "mae_pct":         number | null,    # worst PnL % seen so far
      "mfe_pct":         number | null,    # best  PnL % seen so far
      "mae_date":        "YYYY-MM-DD" | null,
      "mfe_date":        "YYYY-MM-DD" | null,
      "invalidation_breached": bool,
      "watchlist_provenance":  WatchlistProvenance | null,
      "engine_watch_conditions": [WatchCondition, ...] | null,
      "evaluations":     [Evaluation, ...]
    }

WatchCondition (per-trade trigger evaluated hourly by the poller):
    {
      "type":          one of VALID_WATCH_CONDITION_TYPES,
      "threshold":     number,                 # the level being watched
      "severity":      "info" | "warning" | "critical",
      "trigger_label": str,                    # operator-facing meaning
      "window":        str | null,             # e.g. "1h", "4h", "24h"
      "source":        str | null              # e.g. "coinglass", "ohlcv"
    }

WatchlistEntry (a setup that doesn't meet entry conviction yet):
    {
      "id":               "TICKER-watchlist-YYYY-MM-DD-NNN",
      "asset":            str,
      "direction":        "LONG" | "SHORT",
      "first_seen_date":  "YYYY-MM-DD",
      "trigger":          str,
      "invalidation":     str,
      "horizon":          str,
      "thesis":           str,
      "confluence_fired": [str, ...],
      "named_risks":      [str, ...]
    }

WatchlistProvenance:
    {
      "watchlist_id":              str,
      "days_on_watchlist":         number,
      "original_trigger":          str,
      "original_confluence_fired": [str, ...]
    }

Evaluation:
    {"date": "YYYY-MM-DD", "call": "RIDE" | "CLOSE",
     "price_at_eval": number | null, "note": str,
     "slot": "am" | "pm" | null}     # NEW: chain slot the eval came from

ClosedEntry: OpenEntry plus closed_date, closed_price, close_reason,
horizon_realized, return_pct, return_vs_btc_pct, return_vs_eth_pct,
outcome (WIN | LOSS | SCARE | NEUTRAL), auto_flipped.

Atomic write: write to .tmp file, fsync, then os.replace() into place.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LEDGER_PATH = Path("memory/topics/state/active-setups.json")
SNAPSHOT_DIR = Path("memory/topics/state/snapshots")
SCHEMA_VERSION = "v4.1"

VALID_DIRECTIONS = {"LONG", "SHORT"}
VALID_HORIZONS = {"24h", "3d", "7d", "multi-week"}
VALID_CALLS = {"RIDE", "CLOSE"}
VALID_OUTCOMES = {"WIN", "LOSS", "SCARE", "NEUTRAL"}
VALID_SLOTS = {"am", "pm"}

CONFLUENCE_CRITERIA = {
    "quant_regime_aligned",
    "pattern_tag_supports",
    "narrative_phase_aligned",
    "market_regime_aligned",
    "both_tag",
    "repeat_appearance",
    "regime_transition",
    "cross_domain_bridge",
    "enrichment_positive",
    "dominance_aligned",  # populated when Phase 3 ships
}

# engine_watch_conditions[] — per-trade structured triggers that the hourly
# poller evaluates against the Coinglass cache. Each condition the poller
# fires posts an alert to #perps-alerts. Conditions are author-defined by
# Claude when the position is opened, so they reflect the trade-specific
# thesis (e.g. "if LSR drops below 1.1, exit early") rather than universal
# market extremes.
VALID_WATCH_CONDITION_TYPES = {
    "price_close_above",
    "price_close_below",
    "funding_above",
    "funding_below",
    "oi_change_above_pct",
    "oi_change_below_pct",
    "lsr_above",
    "lsr_below",
    "lsr_delta_above",
    "lsr_delta_below",
    "taker_buy_above_pct",
    "taker_buy_below_pct",
    "basis_above",
    "basis_below",
    "volume_ratio_above",
}
VALID_WATCH_SEVERITY = {"info", "warning", "critical"}


class LedgerError(Exception):
    """Raised when the ledger fails validation or atomic write."""


# ---------------------------------------------------------------------------
# Validation helpers


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise LedgerError(msg)


def _require_str(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    _require(isinstance(obj[key], str), f"{where}: '{key}' must be string")
    _require(len(obj[key]) > 0, f"{where}: '{key}' must be non-empty")


def _require_str_or_strlist(obj: dict, key: str, where: str) -> None:
    """Field may be a single string (legacy v4.1 thesis) OR an array of
    non-empty strings (v4.1+ bullet thesis). Both shapes are accepted so
    the ledger validator stays back-compatible with entries written before
    the card-layout migration."""
    _require(key in obj, f"{where}: missing '{key}'")
    val = obj[key]
    if isinstance(val, str):
        _require(len(val) > 0, f"{where}: '{key}' string must be non-empty")
        return
    _require(
        isinstance(val, list),
        f"{where}: '{key}' must be string OR array of strings (got {type(val).__name__})",
    )
    _require(len(val) > 0, f"{where}: '{key}' array must be non-empty")
    for i, b in enumerate(val):
        _require(
            isinstance(b, str) and len(b.strip()) > 0,
            f"{where}: '{key}'[{i}] must be non-empty string",
        )


def _require_number(obj: dict, key: str, where: str, allow_none: bool = False) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    val = obj[key]
    if allow_none and val is None:
        return
    _require(
        isinstance(val, (int, float)) and not isinstance(val, bool),
        f"{where}: '{key}' must be number",
    )


def _require_bool(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    _require(isinstance(obj[key], bool), f"{where}: '{key}' must be boolean")


def _require_list(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    _require(isinstance(obj[key], list), f"{where}: '{key}' must be array")


def _validate_evaluation(ev: dict, where: str) -> None:
    _require(isinstance(ev, dict), f"{where}: evaluation must be object")
    _require_str(ev, "date", where)
    _require(
        ev.get("call") in VALID_CALLS,
        f"{where}: call must be one of {sorted(VALID_CALLS)}",
    )
    _require_number(ev, "price_at_eval", where, allow_none=True)
    _require_str(ev, "note", where)
    # Optional `slot` field: identifies which twice-daily chain slot the
    # evaluation came from. Older evaluations (pre twice-daily) won't have
    # this — we accept absence to stay backward-compatible.
    if "slot" in ev and ev["slot"] is not None:
        _require(
            ev["slot"] in VALID_SLOTS,
            f"{where}: slot must be one of {sorted(VALID_SLOTS)} or null/absent",
        )


def _validate_watchlist_provenance(prov: Any, where: str) -> None:
    if prov is None:
        return
    _require(isinstance(prov, dict), f"{where}: watchlist_provenance must be object or null")
    _require_str(prov, "watchlist_id", where)
    _require_number(prov, "days_on_watchlist", where)
    _require_str(prov, "original_trigger", where)
    _require_list(prov, "original_confluence_fired", where)


def _validate_confluence_list(lst: list, where: str, key: str) -> None:
    for c in lst:
        _require(
            c in CONFLUENCE_CRITERIA,
            f"{where}.{key}: unknown criterion '{c}' (allowed: {sorted(CONFLUENCE_CRITERIA)})",
        )


def _validate_watch_conditions(lst: Any, where: str) -> None:
    """Validate optional engine_watch_conditions[] array.

    None or missing → skip (field is optional, pre-V2 entries won't have it).
    Empty list is allowed (Claude may decide a position needs no watchers).
    Each condition must have: type (enum), threshold (number), severity (enum),
    trigger_label (non-empty string). Optional: window (str), source (str).
    """
    if lst is None:
        return
    _require(isinstance(lst, list), f"{where}: engine_watch_conditions must be array or null")
    for i, c in enumerate(lst):
        sub = f"{where}.engine_watch_conditions[{i}]"
        _require(isinstance(c, dict), f"{sub}: must be object")
        _require(
            c.get("type") in VALID_WATCH_CONDITION_TYPES,
            f"{sub}: type must be one of {sorted(VALID_WATCH_CONDITION_TYPES)}",
        )
        _require_number(c, "threshold", sub)
        _require(
            c.get("severity") in VALID_WATCH_SEVERITY,
            f"{sub}: severity must be one of {sorted(VALID_WATCH_SEVERITY)}",
        )
        _require_str(c, "trigger_label", sub)
        if c.get("window") is not None:
            _require(isinstance(c["window"], str), f"{sub}: window must be string or null")
        if c.get("source") is not None:
            _require(isinstance(c["source"], str), f"{sub}: source must be string or null")


def _validate_open_entry(entry: dict, idx: int) -> None:
    where = f"open[{idx}]"
    _require(isinstance(entry, dict), f"{where}: must be object")
    _require_str(entry, "id", where)
    _require_str(entry, "asset", where)
    _require(
        entry.get("direction") in VALID_DIRECTIONS,
        f"{where}: direction must be LONG or SHORT",
    )
    _require_str(entry, "fired_date", where)
    _require_number(entry, "fired_price", where)
    _require_number(entry, "fired_btc_price", where, allow_none=True)
    _require_number(entry, "fired_eth_price", where, allow_none=True)
    if entry.get("entry_zone") is not None:
        _require(
            isinstance(entry["entry_zone"], str),
            f"{where}: entry_zone must be string or null",
        )
    _require_str(entry, "invalidation", where)
    _require(
        entry.get("horizon") in VALID_HORIZONS,
        f"{where}: horizon must be one of {sorted(VALID_HORIZONS)}",
    )
    _require_str_or_strlist(entry, "thesis", where)
    _require_list(entry, "confluence_fired", where)
    _require(
        len(entry["confluence_fired"]) >= 1,
        f"{where}: confluence_fired must list at least one criterion",
    )
    _validate_confluence_list(entry["confluence_fired"], where, "confluence_fired")
    _require_list(entry, "confluence_missing", where)
    _validate_confluence_list(entry["confluence_missing"], where, "confluence_missing")
    _require_list(entry, "named_risks", where)
    _require(
        len(entry["named_risks"]) >= 1,
        f"{where}: named_risks must list at least one risk",
    )
    _require_number(entry, "mae_pct", where, allow_none=True)
    _require_number(entry, "mfe_pct", where, allow_none=True)
    if entry.get("mae_date") is not None:
        _require(isinstance(entry["mae_date"], str), f"{where}: mae_date must be string or null")
    if entry.get("mfe_date") is not None:
        _require(isinstance(entry["mfe_date"], str), f"{where}: mfe_date must be string or null")
    _require_bool(entry, "invalidation_breached", where)
    _validate_watchlist_provenance(entry.get("watchlist_provenance"), where)
    _validate_watch_conditions(entry.get("engine_watch_conditions"), where)
    _require_list(entry, "evaluations", where)
    for i, ev in enumerate(entry["evaluations"]):
        _validate_evaluation(ev, f"{where}.evaluations[{i}]")


def _validate_watchlist_entry(entry: dict, idx: int) -> None:
    where = f"watchlist[{idx}]"
    _require(isinstance(entry, dict), f"{where}: must be object")
    _require_str(entry, "id", where)
    _require_str(entry, "asset", where)
    _require(
        entry.get("direction") in VALID_DIRECTIONS,
        f"{where}: direction must be LONG or SHORT",
    )
    _require_str(entry, "first_seen_date", where)
    _require_str(entry, "trigger", where)
    _require_str(entry, "invalidation", where)
    _require(
        entry.get("horizon") in VALID_HORIZONS,
        f"{where}: horizon must be one of {sorted(VALID_HORIZONS)}",
    )
    _require_str_or_strlist(entry, "thesis", where)
    _require_list(entry, "confluence_fired", where)
    _validate_confluence_list(entry["confluence_fired"], where, "confluence_fired")
    _require_list(entry, "named_risks", where)


def _validate_closed_entry(entry: dict, idx: int) -> None:
    where = f"closed[{idx}]"
    _require(isinstance(entry, dict), f"{where}: must be object")
    _require_str(entry, "id", where)
    _require_str(entry, "asset", where)
    _require(
        entry.get("direction") in VALID_DIRECTIONS,
        f"{where}: direction must be LONG or SHORT",
    )
    _require_str(entry, "fired_date", where)
    _require_number(entry, "fired_price", where)
    _require_str(entry, "closed_date", where)
    _require_number(entry, "closed_price", where)
    _require_str(entry, "close_reason", where)
    _require(
        entry.get("horizon") in VALID_HORIZONS,
        f"{where}: horizon must be one of {sorted(VALID_HORIZONS)}",
    )
    _require_str(entry, "horizon_realized", where)
    _require_number(entry, "return_pct", where)
    _require_number(entry, "return_vs_btc_pct", where, allow_none=True)
    _require_number(entry, "return_vs_eth_pct", where, allow_none=True)
    _require(
        entry.get("outcome") in VALID_OUTCOMES,
        f"{where}: outcome must be one of {sorted(VALID_OUTCOMES)}",
    )
    _require_number(entry, "mae_pct", where, allow_none=True)
    _require_number(entry, "mfe_pct", where, allow_none=True)
    _require_bool(entry, "invalidation_breached", where)
    _require_bool(entry, "auto_flipped", where)
    _validate_watchlist_provenance(entry.get("watchlist_provenance"), where)
    _validate_watch_conditions(entry.get("engine_watch_conditions"), where)


def validate(ledger: dict) -> None:
    """Raise LedgerError if the ledger object is malformed."""
    _require(isinstance(ledger, dict), "ledger root: must be object")
    _require(
        ledger.get("schema_version") == SCHEMA_VERSION,
        f"ledger schema_version must be '{SCHEMA_VERSION}', "
        f"got '{ledger.get('schema_version')}'",
    )
    _require_list(ledger, "open", "ledger")
    _require_list(ledger, "watchlist", "ledger")
    _require_list(ledger, "closed", "ledger")
    for i, e in enumerate(ledger["open"]):
        _validate_open_entry(e, i)
    for i, e in enumerate(ledger["watchlist"]):
        _validate_watchlist_entry(e, i)
    for i, e in enumerate(ledger["closed"]):
        _validate_closed_entry(e, i)

    # Cross-cutting: IDs unique across open + closed (watchlist IDs are
    # separately namespaced via the "-watchlist-" segment).
    open_ids = [e["id"] for e in ledger["open"]]
    closed_ids = [e["id"] for e in ledger["closed"]]
    watchlist_ids = [e["id"] for e in ledger["watchlist"]]
    _require(len(open_ids) == len(set(open_ids)), "ledger: duplicate ID in open[]")
    _require(len(closed_ids) == len(set(closed_ids)), "ledger: duplicate ID in closed[]")
    _require(len(watchlist_ids) == len(set(watchlist_ids)), "ledger: duplicate ID in watchlist[]")
    cross = set(open_ids) & set(closed_ids)
    _require(not cross, f"ledger: ID(s) appear in both open and closed: {sorted(cross)}")

    # Asset uniqueness in open[] — one open position per asset (auto-flip
    # closes the prior). Same asset can appear in watchlist regardless,
    # but the render layer should suppress that combination.
    open_assets = [e["asset"] for e in ledger["open"]]
    _require(
        len(open_assets) == len(set(open_assets)),
        f"ledger: duplicate asset in open[] (auto-flip should have closed the prior): "
        f"{[a for a in open_assets if open_assets.count(a) > 1]}",
    )


# ---------------------------------------------------------------------------
# IO


def load(path: Path = LEDGER_PATH) -> dict:
    """Load and validate the ledger at path."""
    if not path.exists():
        raise LedgerError(f"ledger file not found at {path}")
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise LedgerError(f"ledger {path} is not valid JSON: {e}")
    validate(data)
    return data


def save(ledger: dict, path: Path = LEDGER_PATH) -> None:
    """Validate, then atomically write the ledger to path."""
    validate(ledger)
    ledger["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(ledger, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def snapshot(
    path: Path = LEDGER_PATH,
    snapshot_dir: Path = SNAPSHOT_DIR,
    slot: str | None = None,
) -> Path:
    """Copy the current ledger to a date-keyed snapshot.

    Filename format:
      - With slot:    active-setups.YYYY-MM-DD-{am|pm}.json
      - Without slot: active-setups.YYYY-MM-DD.json  (legacy)

    Twice-daily runs MUST pass a slot to avoid the PM run overwriting the
    AM snapshot. Slot is sourced from the CHAIN_SLOT environment variable
    if not passed explicitly.
    """
    if not path.exists():
        raise LedgerError(f"cannot snapshot: ledger {path} does not exist")
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if slot is None:
        slot = os.environ.get("CHAIN_SLOT") or None
    if slot and slot not in VALID_SLOTS:
        # Bad value → fall back to unsuffixed filename rather than crash
        slot = None
    suffix = f"-{slot}" if slot else ""
    target = snapshot_dir / f"active-setups.{date}{suffix}.json"
    target.write_text(path.read_text())
    return target


# ---------------------------------------------------------------------------
# Helpers


def next_entry_id(asset: str, fired_date: str, ledger: dict) -> str:
    """Compute the next available {ASSET}-{YYYY-MM-DD}-NNN id."""
    prefix = f"{asset.upper()}-{fired_date}-"
    existing = [
        e["id"]
        for e in (ledger.get("open", []) + ledger.get("closed", []))
        if e["id"].startswith(prefix)
    ]
    n = 1
    while f"{prefix}{n:03d}" in existing:
        n += 1
    return f"{prefix}{n:03d}"


def next_watchlist_id(asset: str, first_seen_date: str, ledger: dict) -> str:
    """Compute the next available {ASSET}-watchlist-{YYYY-MM-DD}-NNN id."""
    prefix = f"{asset.upper()}-watchlist-{first_seen_date}-"
    existing = [
        e["id"] for e in ledger.get("watchlist", []) if e["id"].startswith(prefix)
    ]
    n = 1
    while f"{prefix}{n:03d}" in existing:
        n += 1
    return f"{prefix}{n:03d}"


def compute_mae_mfe_update(
    direction: str,
    fired_price: float,
    todays_high: float | None,
    todays_low: float | None,
    current_mae: float | None,
    current_mfe: float | None,
    current_mae_date: str | None,
    current_mfe_date: str | None,
    today: str,
) -> tuple[float | None, float | None, str | None, str | None]:
    """Given today's price range + prior MAE/MFE, return updated values.

    MAE = worst PnL % seen (most negative).
    MFE = best  PnL % seen (most positive).

    For LONG: MAE comes from low; MFE comes from high.
    For SHORT: MAE comes from high (worst for short); MFE comes from low.

    Returns (mae_pct, mfe_pct, mae_date, mfe_date). All None-safe.
    """
    if todays_high is None or todays_low is None or fired_price <= 0:
        return current_mae, current_mfe, current_mae_date, current_mfe_date

    if direction == "LONG":
        todays_worst = (todays_low - fired_price) / fired_price * 100
        todays_best = (todays_high - fired_price) / fired_price * 100
    else:  # SHORT
        todays_worst = -(todays_high - fired_price) / fired_price * 100
        todays_best = -(todays_low - fired_price) / fired_price * 100

    new_mae = current_mae
    new_mae_date = current_mae_date
    if new_mae is None or todays_worst < new_mae:
        new_mae = todays_worst
        new_mae_date = today

    new_mfe = current_mfe
    new_mfe_date = current_mfe_date
    if new_mfe is None or todays_best > new_mfe:
        new_mfe = todays_best
        new_mfe_date = today

    return new_mae, new_mfe, new_mae_date, new_mfe_date


# ---------------------------------------------------------------------------
# CLI


def _cli_main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else LEDGER_PATH
    try:
        load(path)
        print(f"ledger {path}: valid ({SCHEMA_VERSION})")
        return 0
    except LedgerError as e:
        sys.stderr.write(f"ledger {path}: INVALID — {e}\n")
        return 2


if __name__ == "__main__":
    sys.exit(_cli_main())
