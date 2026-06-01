#!/usr/bin/env python3
"""Apply narrative-tracker's structured output to the narratives ledger.

Reads .outputs/narrative-tracker.data.json (Claude-written) and updates
memory/topics/state/narratives.json atomically via scripts/lib/narratives.py.

This script is the ONLY writer of the narratives ledger. Claude does
not touch it directly — it emits structured narratives in data.json
and this script reconciles state.

data.json shape (Claude writes this):

    {
      "schema_version": "v1",
      "date": "YYYY-MM-DD",
      "narratives": [
        {
          "narrative_id":  "privacy",       # stable, reused across runs
          "label":         "Privacy",
          "tokens":        ["ZEC", ...],
          "phase":         one of VALID_PHASES,
          "position":      one of VALID_POSITIONS,
          "mindshare":     1-5,
          "evidence":      str,
          "reflexivity":   str | null
        }
      ],
      "drop_narratives": [                  # explicit drops with reasoning
        {"narrative_id": "old-thing", "reason": "ignored",
         "note": "<why>"}
      ]
    }

Reconciliation logic:
  1. For each narrative in data.json:
     - If phase is in TERMINAL_PHASES (DEAD/IGNORE) → archive to closed[]
     - Else if narrative_id is in active[] → update fields + append
       phase_history entry if phase/position/mindshare changed
     - Else (new) → add to active[] with first_seen=today, single-entry
       phase_history
  2. Explicit drops (drop_narratives op):
     - Move from active[] to closed[] with the provided reason + note
  3. Implicit drops:
     - Anything still in active[] but NOT in data.json AND NOT explicitly
       dropped is archived as "absent" (similar to apply-ledger-ops's
       stale watchlist handling). This is the safety net so silent
       omission still gets tracked.

Exit codes:
  0 — applied successfully
  2 — data.json missing or malformed; ledger untouched
  3 — ledger validation failed; ledger untouched
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import narratives as N  # noqa: E402


DATA_JSON = Path(".outputs/narrative-tracker.data.json")


def warn(msg: str) -> None:
    sys.stderr.write(f"apply-narrative-ops: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"apply-narrative-ops: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"apply-narrative-ops: ERROR {msg}\n")
    sys.exit(code)


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def find_active_index(ledger: dict, narrative_id: str) -> int | None:
    for i, e in enumerate(ledger["active"]):
        if e["narrative_id"] == narrative_id:
            return i
    return None


def make_phase_transition(date: str, n: dict) -> dict:
    return {
        "date": date,
        "phase": n.get("phase", ""),
        "position": n.get("position", ""),
        "mindshare": n.get("mindshare", 0),
    }


def reconcile(ledger: dict, narratives: list, drops: list) -> dict:
    """Apply data.json's narrative state to the ledger.

    Returns counters for logging: {new, updated, terminal_archived,
    explicit_dropped, implicit_dropped, unchanged}
    """
    today = today_utc()
    counters = {
        "new": 0,
        "updated": 0,
        "terminal_archived": 0,
        "explicit_dropped": 0,
        "implicit_dropped": 0,
        "unchanged": 0,
    }

    # Track which narrative_ids appear in data.json so we can detect
    # implicit drops at the end.
    seen_ids: set[str] = set()
    explicitly_dropped_ids = {d.get("narrative_id") for d in drops}

    for n in narratives:
        nid = n.get("narrative_id")
        if not nid:
            warn("narrative without narrative_id — skipping")
            continue
        seen_ids.add(nid)

        phase = n.get("phase")
        if phase in N.TERMINAL_PHASES:
            # Auto-archive on terminal phase
            existing_idx = find_active_index(ledger, nid)
            if existing_idx is not None:
                entry = ledger["active"].pop(existing_idx)
                entry["phase"] = phase
                entry["position"] = n.get("position", entry.get("position", "WATCH"))
                entry["mindshare"] = n.get("mindshare", entry.get("mindshare", 1))
                entry["evidence"] = n.get("evidence", entry.get("evidence", ""))
                entry["reflexivity"] = n.get("reflexivity")
                entry["last_updated"] = today
                # Append final phase_history entry
                entry["phase_history"].append(make_phase_transition(today, n))
                # Add exit metadata
                entry["closed_date"] = today
                entry["close_reason"] = (
                    "dead" if phase == "DEAD" else "ignored"
                )
                entry["close_note"] = n.get(
                    "evidence", "Transitioned to terminal phase"
                )
                ledger["closed"].append(entry)
                counters["terminal_archived"] += 1
            else:
                # Brand new narrative that arrived already terminal — file
                # directly to closed[] as a single-day artifact.
                ledger["closed"].append({
                    "narrative_id": nid,
                    "label": n.get("label", nid),
                    "tokens": list(n.get("tokens", [])),
                    "phase": phase,
                    "position": n.get("position", "WATCH"),
                    "mindshare": n.get("mindshare", 1),
                    "evidence": n.get("evidence", ""),
                    "reflexivity": n.get("reflexivity"),
                    "first_seen": today,
                    "last_updated": today,
                    "phase_history": [make_phase_transition(today, n)],
                    "closed_date": today,
                    "close_reason": "dead" if phase == "DEAD" else "ignored",
                    "close_note": n.get("evidence", ""),
                })
                counters["terminal_archived"] += 1
            continue

        # Active phase — update or create
        existing_idx = find_active_index(ledger, nid)
        if existing_idx is not None:
            entry = ledger["active"][existing_idx]
            # Detect change
            changed = (
                entry.get("phase") != phase
                or entry.get("position") != n.get("position")
                or entry.get("mindshare") != n.get("mindshare")
            )
            entry["label"] = n.get("label", entry["label"])
            entry["tokens"] = list(n.get("tokens", entry["tokens"]))
            entry["phase"] = phase
            entry["position"] = n.get("position", entry.get("position", "WATCH"))
            entry["mindshare"] = n.get("mindshare", entry.get("mindshare", 1))
            entry["evidence"] = n.get("evidence", entry.get("evidence", ""))
            entry["reflexivity"] = n.get("reflexivity")
            entry["last_updated"] = today
            if changed:
                entry["phase_history"].append(make_phase_transition(today, n))
                counters["updated"] += 1
            else:
                counters["unchanged"] += 1
        else:
            # Brand new active narrative
            ledger["active"].append({
                "narrative_id": nid,
                "label": n.get("label", nid),
                "tokens": list(n.get("tokens", [])),
                "phase": phase,
                "position": n.get("position", "WATCH"),
                "mindshare": n.get("mindshare", 1),
                "evidence": n.get("evidence", ""),
                "reflexivity": n.get("reflexivity"),
                "first_seen": today,
                "last_updated": today,
                "phase_history": [make_phase_transition(today, n)],
            })
            counters["new"] += 1

    # Explicit drops
    for d in drops:
        nid = d.get("narrative_id")
        reason = d.get("reason", "ignored")
        note = (d.get("note") or "").strip() or "(no note provided)"
        if reason not in N.VALID_NARRATIVE_CLOSE_REASONS:
            warn(
                f"drop_narratives: invalid reason '{reason}' for {nid}. "
                f"Allowed: {sorted(N.VALID_NARRATIVE_CLOSE_REASONS)}. Skipping."
            )
            continue
        existing_idx = find_active_index(ledger, nid)
        if existing_idx is None:
            warn(f"drop_narratives references unknown id '{nid}' — skipping")
            continue
        entry = ledger["active"].pop(existing_idx)
        entry["last_updated"] = today
        entry["closed_date"] = today
        entry["close_reason"] = reason
        entry["close_note"] = note
        ledger["closed"].append(entry)
        counters["explicit_dropped"] += 1

    # Implicit drops — narratives that were in active[] but didn't appear
    # in data.json AND weren't explicitly dropped above
    implicit_drop_targets = [
        e for e in list(ledger["active"])
        if e["narrative_id"] not in seen_ids
        and e["narrative_id"] not in explicitly_dropped_ids
    ]
    for entry in implicit_drop_targets:
        ledger["active"].remove(entry)
        entry["last_updated"] = today
        entry["closed_date"] = today
        entry["close_reason"] = "absent"
        entry["close_note"] = (
            "Implicit drop — narrative-tracker omitted from today's output "
            "without an explicit drop_narratives op."
        )
        ledger["closed"].append(entry)
        counters["implicit_dropped"] += 1

    return counters


def main() -> int:
    if not DATA_JSON.exists():
        info(f"{DATA_JSON} not present; nothing to apply")
        return 0

    try:
        data = json.loads(DATA_JSON.read_text())
    except json.JSONDecodeError as e:
        fail(f"{DATA_JSON} is not valid JSON: {e}", code=2)

    narratives = data.get("narratives") or []
    drops = data.get("drop_narratives") or []

    try:
        ledger = N.load()
    except N.NarrativesError as e:
        fail(f"current narratives ledger failed validation: {e}", code=3)

    pre_active = len(ledger["active"])
    pre_closed = len(ledger["closed"])

    try:
        counters = reconcile(ledger, narratives, drops)
    except (KeyError, TypeError) as e:
        fail(f"narrative reconciliation failed: {e}", code=2)

    try:
        N.validate(ledger)
    except N.NarrativesError as e:
        fail(f"post-apply ledger fails validation: {e}", code=3)

    N.save(ledger)

    info(
        f"applied | active: {pre_active}→{len(ledger['active'])} "
        f"closed: {pre_closed}→{len(ledger['closed'])} | "
        f"new={counters['new']}, updated={counters['updated']}, "
        f"unchanged={counters['unchanged']}, "
        f"terminal_archived={counters['terminal_archived']}, "
        f"explicit_dropped={counters['explicit_dropped']}, "
        f"implicit_dropped={counters['implicit_dropped']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
