"""Perps engine v4 ledger — schema validation + atomic read/write.

The ledger at memory/topics/state/active-setups.json is the source of truth
for every fired LONG/SHORT call. This module owns its on-disk format.

Schema:
    {
      "schema_version": "v4",
      "last_updated": str | null,         # ISO 8601 UTC, set by writer
      "open":    [OpenEntry, ...],         # active positions
      "pending": [PendingEntry, ...],      # (wait) intents that haven't fired
      "closed":  [ClosedEntry, ...]        # historical, append-only
    }

OpenEntry:
    {
      "id":             "TICKER-YYYY-MM-DD-NNN",
      "asset":          str,
      "direction":      "LONG" | "SHORT",
      "fired_date":     "YYYY-MM-DD",
      "fired_price":    number,
      "fired_btc_price": number | null,
      "fired_eth_price": number | null,
      "entry_zone":     str | null,
      "invalidation":   str,
      "horizon":        "24h" | "3d" | "7d" | "multi-week",
      "thesis":         str,
      "confluence_fired":   [str, ...],
      "confluence_missing": [str, ...],
      "named_risks":    [str, ...],         # at least one
      "evaluations":    [Evaluation, ...]
    }

Evaluation:
    {"date": "YYYY-MM-DD", "call": "RIDE" | "SELL (now)" | "SELL (wait)",
     "price_at_eval": number | null, "note": str}

PendingEntry (a (wait) call that hasn't promoted to (now) yet):
    {
      "id":               "TICKER-pending-YYYY-MM-DD-NNN",
      "asset":            str,
      "direction":        "LONG" | "SHORT",
      "first_seen_date":  "YYYY-MM-DD",
      "trigger":          str,
      "invalidation":     str,
      "horizon":          "24h" | "3d" | "7d" | "multi-week",
      "thesis":           str,
      "confluence_fired": [str, ...],
      "named_risks":      [str, ...]
    }

ClosedEntry: OpenEntry plus closed_date, closed_price, close_reason,
horizon_realized, return_pct, return_vs_btc_pct, return_vs_eth_pct,
outcome ("WIN" | "LOSS" | "NEUTRAL").

Atomic write: write to .tmp file, fsync, then os.replace() into place.
os.replace() is atomic on POSIX filesystems. This protects against
partial writes if the process is killed mid-write.
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
SCHEMA_VERSION = "v4"

VALID_DIRECTIONS = {"LONG", "SHORT"}
VALID_HORIZONS = {"24h", "3d", "7d", "multi-week"}
VALID_CALLS = {"RIDE", "SELL (now)", "SELL (wait)"}
VALID_OUTCOMES = {"WIN", "LOSS", "NEUTRAL"}

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
    "dominance_aligned",  # populated when B1 ships in Phase 3
}


class LedgerError(Exception):
    """Raised when the ledger fails validation or atomic write."""


# ---------------------------------------------------------------------------
# Validation


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise LedgerError(msg)


def _require_str(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    _require(isinstance(obj[key], str), f"{where}: '{key}' must be string")
    _require(len(obj[key]) > 0, f"{where}: '{key}' must be non-empty")


def _require_number(
    obj: dict, key: str, where: str, allow_none: bool = False
) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    val = obj[key]
    if allow_none and val is None:
        return
    _require(
        isinstance(val, (int, float)) and not isinstance(val, bool),
        f"{where}: '{key}' must be number",
    )


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
    # entry_zone optional (can be null for "market" entries)
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
    _require_str(entry, "thesis", where)
    _require_list(entry, "confluence_fired", where)
    _require(
        len(entry["confluence_fired"]) >= 1,
        f"{where}: confluence_fired must list at least one criterion",
    )
    for c in entry["confluence_fired"]:
        _require(
            c in CONFLUENCE_CRITERIA,
            f"{where}: unknown confluence criterion '{c}' "
            f"(allowed: {sorted(CONFLUENCE_CRITERIA)})",
        )
    _require_list(entry, "confluence_missing", where)
    _require_list(entry, "named_risks", where)
    _require(
        len(entry["named_risks"]) >= 1,
        f"{where}: named_risks must list at least one risk",
    )
    _require_list(entry, "evaluations", where)
    for i, ev in enumerate(entry["evaluations"]):
        _validate_evaluation(ev, f"{where}.evaluations[{i}]")


def _validate_pending_entry(entry: dict, idx: int) -> None:
    where = f"pending[{idx}]"
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
    _require_str(entry, "thesis", where)
    _require_list(entry, "confluence_fired", where)
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


def validate(ledger: dict) -> None:
    """Raise LedgerError if the ledger object is malformed."""
    _require(isinstance(ledger, dict), "ledger root: must be object")
    _require(
        ledger.get("schema_version") == SCHEMA_VERSION,
        f"ledger schema_version must be '{SCHEMA_VERSION}', "
        f"got '{ledger.get('schema_version')}'",
    )
    _require_list(ledger, "open", "ledger")
    _require_list(ledger, "pending", "ledger")
    _require_list(ledger, "closed", "ledger")
    for i, e in enumerate(ledger["open"]):
        _validate_open_entry(e, i)
    for i, e in enumerate(ledger["pending"]):
        _validate_pending_entry(e, i)
    for i, e in enumerate(ledger["closed"]):
        _validate_closed_entry(e, i)

    # Cross-cutting: IDs must be unique across open + closed (pending IDs are
    # separately namespaced via the "-pending-" segment so collisions are
    # checked within pending only).
    open_ids = [e["id"] for e in ledger["open"]]
    closed_ids = [e["id"] for e in ledger["closed"]]
    pending_ids = [e["id"] for e in ledger["pending"]]
    _require(
        len(open_ids) == len(set(open_ids)),
        "ledger: duplicate ID in open[]",
    )
    _require(
        len(closed_ids) == len(set(closed_ids)),
        "ledger: duplicate ID in closed[]",
    )
    _require(
        len(pending_ids) == len(set(pending_ids)),
        "ledger: duplicate ID in pending[]",
    )
    cross = set(open_ids) & set(closed_ids)
    _require(
        not cross,
        f"ledger: ID(s) appear in both open and closed: {sorted(cross)}",
    )


# ---------------------------------------------------------------------------
# IO


def load(path: Path = LEDGER_PATH) -> dict:
    """Load and validate the ledger at path. Raises LedgerError on any issue."""
    if not path.exists():
        raise LedgerError(f"ledger file not found at {path}")
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise LedgerError(f"ledger {path} is not valid JSON: {e}")
    validate(data)
    return data


def save(ledger: dict, path: Path = LEDGER_PATH) -> None:
    """Validate, then atomically write the ledger to path.

    Writes to a sibling .tmp file, fsyncs, then os.replace()s into place.
    On POSIX, os.replace() is atomic — readers see either the old file or
    the new file, never a half-written one.
    """
    validate(ledger)
    ledger["last_updated"] = datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(ledger, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def snapshot(path: Path = LEDGER_PATH, snapshot_dir: Path = SNAPSHOT_DIR) -> Path:
    """Copy the current ledger to snapshots/active-setups.YYYY-MM-DD.json.

    Snapshots are pre-apply backups. If apply-ledger-ops corrupts the ledger,
    the operator restores from the most recent snapshot.
    """
    if not path.exists():
        raise LedgerError(f"cannot snapshot: ledger {path} does not exist")
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    target = snapshot_dir / f"active-setups.{date}.json"
    target.write_text(path.read_text())
    return target


# ---------------------------------------------------------------------------
# Helpers


def next_entry_id(asset: str, fired_date: str, ledger: dict) -> str:
    """Compute the next available {ASSET}-{YYYY-MM-DD}-NNN id.

    NNN starts at 001 for the first entry per asset/date, increments if there
    are existing entries with the same prefix (open or closed).
    """
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


def next_pending_id(asset: str, first_seen_date: str, ledger: dict) -> str:
    """Compute the next available {ASSET}-pending-{YYYY-MM-DD}-NNN id."""
    prefix = f"{asset.upper()}-pending-{first_seen_date}-"
    existing = [
        e["id"]
        for e in ledger.get("pending", [])
        if e["id"].startswith(prefix)
    ]
    n = 1
    while f"{prefix}{n:03d}" in existing:
        n += 1
    return f"{prefix}{n:03d}"


# ---------------------------------------------------------------------------
# CLI for ad-hoc validation


def _cli_main() -> int:
    """`python3 -m scripts.lib.ledger [path]` — validate-only entry point.

    Used by postprocess scripts to confirm the ledger is well-formed after
    apply-ledger-ops finishes. Exits 0 on valid, 2 on validation error.
    """
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
