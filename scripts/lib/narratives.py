"""Narrative ledger — schema validation + atomic read/write.

The narratives ledger at memory/topics/state/narratives.json is the
source of truth for every active and closed narrative the engine
tracks. Mirrors the structure of scripts/lib/ledger.py (the perps
trading ledger) but for narrative-tracker state.

Schema:
    {
      "schema_version": "v1",
      "last_updated":   str | null,
      "active":         [NarrativeEntry, ...],
      "closed":         [NarrativeClosedEntry, ...]
    }

NarrativeEntry (active narrative being tracked):
    {
      "narrative_id":   "privacy",           # stable across runs
      "label":          "Privacy",
      "tokens":         ["ZEC", "RAILGUN"],  # canonical tickers
      "phase":          one of VALID_PHASES (without DEAD/IGNORE — those archive)
      "position":       one of VALID_POSITIONS,
      "mindshare":      int 1-5,
      "evidence":       str,                  # driver/evidence sentence
      "reflexivity":    str | null,           # optional reflexivity callout
      "first_seen":     "YYYY-MM-DD",
      "last_updated":   "YYYY-MM-DD",
      "phase_history":  [PhaseTransition, ...]
    }

PhaseTransition:
    {"date": "YYYY-MM-DD", "phase": str, "position": str, "mindshare": int}

NarrativeClosedEntry: NarrativeEntry shape PLUS exit metadata:
    {
      ...all NarrativeEntry fields...,
      "closed_date":  "YYYY-MM-DD",
      "close_reason": one of VALID_NARRATIVE_CLOSE_REASONS,
      "close_note":   str
    }

VALID_PHASES: EMERGING, RISING, PEAK, FADING (active),
              DEAD, IGNORE (terminal — auto-archive)
VALID_POSITIONS: WATCH, FRONT-RUN, RIDE, RIDE w/ trail, FADE

VALID_NARRATIVE_CLOSE_REASONS:
    dead             — narrative ran its course (phase = DEAD)
    ignored          — narrative no longer warrants tracking (phase = IGNORE)
    absent           — disappeared from narrative-tracker output (implicit drop)

Atomic write: tmpfile + fsync + os.replace.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


NARRATIVES_PATH = Path("memory/topics/state/narratives.json")
SCHEMA_VERSION = "v1"

# Active phases — narrative stays in active[]
ACTIVE_PHASES = {"EMERGING", "RISING", "PEAK", "FADING"}
# Terminal phases — archive to closed[]
TERMINAL_PHASES = {"DEAD", "IGNORE"}
VALID_PHASES = ACTIVE_PHASES | TERMINAL_PHASES

VALID_POSITIONS = {
    "WATCH",
    "FRONT-RUN",
    "RIDE",
    "RIDE w/ trail",
    "FADE",
}

VALID_NARRATIVE_CLOSE_REASONS = {
    "dead",
    "ignored",
    "absent",
}


class NarrativesError(Exception):
    """Raised when the narratives ledger fails validation or atomic write."""


# ---------------------------------------------------------------------------
# Validation helpers


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise NarrativesError(msg)


def _require_str(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    _require(isinstance(obj[key], str), f"{where}: '{key}' must be string")
    _require(len(obj[key]) > 0, f"{where}: '{key}' must be non-empty")


def _require_int(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    val = obj[key]
    _require(isinstance(val, int) and not isinstance(val, bool),
             f"{where}: '{key}' must be integer")


def _require_list(obj: dict, key: str, where: str) -> None:
    _require(key in obj, f"{where}: missing '{key}'")
    _require(isinstance(obj[key], list), f"{where}: '{key}' must be array")


def _validate_phase_transition(t: dict, where: str) -> None:
    _require(isinstance(t, dict), f"{where}: must be object")
    _require_str(t, "date", where)
    _require(
        t.get("phase") in VALID_PHASES,
        f"{where}: phase must be one of {sorted(VALID_PHASES)}",
    )
    _require(
        t.get("position") in VALID_POSITIONS,
        f"{where}: position must be one of {sorted(VALID_POSITIONS)}",
    )
    _require_int(t, "mindshare", where)
    _require(1 <= t["mindshare"] <= 5, f"{where}: mindshare must be 1-5")


def _validate_narrative_entry(entry: dict, idx: int) -> None:
    where = f"active[{idx}]"
    _require(isinstance(entry, dict), f"{where}: must be object")
    _require_str(entry, "narrative_id", where)
    _require_str(entry, "label", where)
    _require_list(entry, "tokens", where)
    for i, t in enumerate(entry["tokens"]):
        _require(
            isinstance(t, str) and len(t) > 0,
            f"{where}.tokens[{i}] must be non-empty string",
        )
    # Active entries can only have ACTIVE_PHASES; DEAD/IGNORE archive
    _require(
        entry.get("phase") in ACTIVE_PHASES,
        f"{where}: phase must be one of {sorted(ACTIVE_PHASES)} "
        f"(DEAD/IGNORE archive to closed[])",
    )
    _require(
        entry.get("position") in VALID_POSITIONS,
        f"{where}: position must be one of {sorted(VALID_POSITIONS)}",
    )
    _require_int(entry, "mindshare", where)
    _require(1 <= entry["mindshare"] <= 5, f"{where}: mindshare must be 1-5")
    _require_str(entry, "evidence", where)
    if entry.get("reflexivity") is not None:
        _require(
            isinstance(entry["reflexivity"], str),
            f"{where}: reflexivity must be string or null",
        )
    _require_str(entry, "first_seen", where)
    _require_str(entry, "last_updated", where)
    _require_list(entry, "phase_history", where)
    for i, t in enumerate(entry["phase_history"]):
        _validate_phase_transition(t, f"{where}.phase_history[{i}]")


def _validate_narrative_closed_entry(entry: dict, idx: int) -> None:
    where = f"closed[{idx}]"
    _require(isinstance(entry, dict), f"{where}: must be object")
    _require_str(entry, "narrative_id", where)
    _require_str(entry, "label", where)
    _require_list(entry, "tokens", where)
    # Closed entries can be any phase (including terminal)
    _require(
        entry.get("phase") in VALID_PHASES,
        f"{where}: phase must be one of {sorted(VALID_PHASES)}",
    )
    _require(
        entry.get("position") in VALID_POSITIONS,
        f"{where}: position must be one of {sorted(VALID_POSITIONS)}",
    )
    _require_int(entry, "mindshare", where)
    _require_str(entry, "evidence", where)
    if entry.get("reflexivity") is not None:
        _require(
            isinstance(entry["reflexivity"], str),
            f"{where}: reflexivity must be string or null",
        )
    _require_str(entry, "first_seen", where)
    _require_str(entry, "last_updated", where)
    _require_list(entry, "phase_history", where)
    # Exit metadata
    _require_str(entry, "closed_date", where)
    _require(
        entry.get("close_reason") in VALID_NARRATIVE_CLOSE_REASONS,
        f"{where}: close_reason must be one of {sorted(VALID_NARRATIVE_CLOSE_REASONS)}",
    )
    _require_str(entry, "close_note", where)


def validate(narratives: dict) -> None:
    """Raise NarrativesError if the narratives ledger is malformed."""
    _require(isinstance(narratives, dict), "narratives root: must be object")
    _require(
        narratives.get("schema_version") == SCHEMA_VERSION,
        f"narratives schema_version must be '{SCHEMA_VERSION}', "
        f"got '{narratives.get('schema_version')}'",
    )
    _require_list(narratives, "active", "narratives")
    _require_list(narratives, "closed", "narratives")
    for i, e in enumerate(narratives["active"]):
        _validate_narrative_entry(e, i)
    for i, e in enumerate(narratives["closed"]):
        _validate_narrative_closed_entry(e, i)
    # IDs unique within active + within closed (an archived narrative can
    # be revived by Claude using a NEW id; we don't enforce cross-list
    # uniqueness because a re-emerging narrative is genuinely new state)
    active_ids = [e["narrative_id"] for e in narratives["active"]]
    closed_ids = [e["narrative_id"] for e in narratives["closed"]]
    _require(
        len(active_ids) == len(set(active_ids)),
        "narratives: duplicate id in active[]",
    )
    # closed[] may contain multiple historical entries with the same id
    # (a narrative dies, revives, dies again). No uniqueness check there.


# ---------------------------------------------------------------------------
# IO


def load(path: Path = NARRATIVES_PATH) -> dict:
    """Load and validate the narratives ledger at path. Returns an empty
    valid ledger if the file doesn't exist yet (first run after merge)."""
    if not path.exists():
        return {
            "schema_version": SCHEMA_VERSION,
            "last_updated": None,
            "active": [],
            "closed": [],
        }
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise NarrativesError(f"narratives {path} is not valid JSON: {e}")
    validate(data)
    return data


def save(narratives: dict, path: Path = NARRATIVES_PATH) -> None:
    """Validate, then atomically write the narratives ledger to path."""
    validate(narratives)
    narratives["last_updated"] = datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = json.dumps(narratives, indent=2, ensure_ascii=False) + "\n"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(payload)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# CLI


def _cli_main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else NARRATIVES_PATH
    try:
        narratives = load(path)
        print(
            f"narratives {path}: valid ({SCHEMA_VERSION}) — "
            f"active={len(narratives['active'])}, "
            f"closed={len(narratives['closed'])}"
        )
        return 0
    except NarrativesError as e:
        sys.stderr.write(f"narratives {path}: INVALID — {e}\n")
        return 2


if __name__ == "__main__":
    sys.exit(_cli_main())
