#!/usr/bin/env python3
"""Apply perps-brief's daily ledger operations to active-setups.json.

Reads .outputs/perps-brief.data.json (Claude-written), reads the current
ledger at memory/topics/state/active-setups.json, computes the new ledger
state, and writes it back atomically via scripts/lib/ledger.py.

This script is the ONLY writer of the ledger. Claude does not touch the
ledger file directly — it writes operations into the data.json's
`ledger_ops` block and this script applies them. That keeps Claude out
of the format-locked artifact path (same pattern as render-perps-brief.py
keeps Claude out of the markdown artifact).

Operations in data.json["ledger_ops"]:

  open_now:
    - {ticker, direction, fired_price, fired_btc_price, fired_eth_price,
       entry_zone, invalidation, horizon, thesis,
       confluence_fired, confluence_missing, named_risks,
       pending_id_promoted: null | "ASSET-pending-YYYY-MM-DD-NNN"}
    Opens a new entry in ledger.open[]. If pending_id_promoted is set,
    removes that entry from pending[].

  add_pending:
    - {ticker, direction, trigger, invalidation, horizon, thesis,
       confluence_fired, named_risks}
    Adds a new entry to ledger.pending[]. Caller should NOT include this
    if continuing an existing pending entry — use keep_pending instead.

  keep_pending:
    - ["PENDING-ID-1", "PENDING-ID-2", ...]
    Pending IDs that should remain in the ledger. Any pending entry NOT
    in this list (and not promoted via open_now and not in add_pending)
    is DROPPED by the apply step. Claude must explicitly carry forward
    each pending entry it still believes in.

  evaluations:
    - {open_id, date, call, price_at_eval, note}
    Appends an entry to ledger.open[<open_id>].evaluations. Required
    once per open position per brief run.

  close:
    - {open_id, closed_price, close_reason, return_pct,
       return_vs_btc_pct, return_vs_eth_pct, outcome,
       horizon_realized}
    Moves an entry from open[] to closed[] with the close-time fields
    appended. closed_date is set to today's UTC date by this script.

Order of application within one run:
  1. Apply evaluations (append to existing open[] entries)
  2. Apply close (move open → closed)
  3. Apply open_now (add to open[], optionally remove from pending[])
  4. Apply add_pending (add to pending[])
  5. Apply pending drops (anything not in keep_pending, not promoted,
     not just-added)

Exit codes:
  0 — applied successfully
  2 — data.json missing or malformed; ledger untouched
  3 — ledger validation failed before or after apply; ledger untouched
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Allow `python3 scripts/apply-ledger-ops.py` to import scripts/lib/ledger.py
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import ledger as L  # noqa: E402


DATA_JSON = Path(".outputs/perps-brief.data.json")


def warn(msg: str) -> None:
    sys.stderr.write(f"apply-ledger-ops: WARN {msg}\n")


def info(msg: str) -> None:
    print(f"apply-ledger-ops: {msg}")


def fail(msg: str, code: int) -> None:
    sys.stderr.write(f"apply-ledger-ops: ERROR {msg}\n")
    sys.exit(code)


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def find_open_index(ledger: dict, open_id: str) -> int | None:
    for i, e in enumerate(ledger["open"]):
        if e["id"] == open_id:
            return i
    return None


def find_pending_index(ledger: dict, pending_id: str) -> int | None:
    for i, e in enumerate(ledger["pending"]):
        if e["id"] == pending_id:
            return i
    return None


def apply_evaluations(ledger: dict, evals: list) -> None:
    today = today_utc()
    for ev in evals:
        oid = ev.get("open_id")
        idx = find_open_index(ledger, oid)
        if idx is None:
            warn(f"evaluation references unknown open_id '{oid}' — skipping")
            continue
        ledger["open"][idx]["evaluations"].append(
            {
                "date": ev.get("date", today),
                "call": ev["call"],
                "price_at_eval": ev.get("price_at_eval"),
                "note": ev.get("note", ""),
            }
        )


def apply_close(ledger: dict, closes: list) -> None:
    today = today_utc()
    # Process closes in reverse-list order if multiple target adjacent
    # indices, to avoid index shifting during pop().
    by_id = {c["open_id"]: c for c in closes}
    for oid, c in by_id.items():
        idx = find_open_index(ledger, oid)
        if idx is None:
            warn(f"close references unknown open_id '{oid}' — skipping")
            continue
        entry = ledger["open"].pop(idx)
        entry["closed_date"] = c.get("closed_date", today)
        entry["closed_price"] = c["closed_price"]
        entry["close_reason"] = c["close_reason"]
        entry["return_pct"] = c["return_pct"]
        entry["return_vs_btc_pct"] = c.get("return_vs_btc_pct")
        entry["return_vs_eth_pct"] = c.get("return_vs_eth_pct")
        entry["outcome"] = c["outcome"]
        entry["horizon_realized"] = c.get(
            "horizon_realized", entry.get("horizon", "")
        )
        ledger["closed"].append(entry)


def apply_open_now(ledger: dict, opens: list) -> None:
    today = today_utc()
    for o in opens:
        asset = o["ticker"].upper()
        new_id = L.next_entry_id(asset, today, ledger)
        entry = {
            "id": new_id,
            "asset": asset,
            "direction": o["direction"],
            "fired_date": today,
            "fired_price": o["fired_price"],
            "fired_btc_price": o.get("fired_btc_price"),
            "fired_eth_price": o.get("fired_eth_price"),
            "entry_zone": o.get("entry_zone"),
            "invalidation": o["invalidation"],
            "horizon": o["horizon"],
            "thesis": o["thesis"],
            "confluence_fired": list(o.get("confluence_fired", [])),
            "confluence_missing": list(o.get("confluence_missing", [])),
            "named_risks": list(o.get("named_risks", [])),
            "evaluations": [],
        }
        ledger["open"].append(entry)

        # If this open_now promoted a pending entry, remove the pending row.
        promoted = o.get("pending_id_promoted")
        if promoted:
            pidx = find_pending_index(ledger, promoted)
            if pidx is None:
                warn(
                    f"open_now {new_id} claims to promote pending '{promoted}' "
                    "but no such pending entry exists"
                )
            else:
                ledger["pending"].pop(pidx)


def apply_add_pending(ledger: dict, adds: list) -> None:
    today = today_utc()
    for p in adds:
        asset = p["ticker"].upper()
        new_id = L.next_pending_id(asset, today, ledger)
        entry = {
            "id": new_id,
            "asset": asset,
            "direction": p["direction"],
            "first_seen_date": today,
            "trigger": p["trigger"],
            "invalidation": p["invalidation"],
            "horizon": p["horizon"],
            "thesis": p["thesis"],
            "confluence_fired": list(p.get("confluence_fired", [])),
            "named_risks": list(p.get("named_risks", [])),
        }
        ledger["pending"].append(entry)


def apply_pending_drops(
    ledger: dict, keep_ids: list, promoted_ids: list, just_added_ids: list
) -> None:
    """Drop any pending entry not in keep, not promoted, not just-added."""
    survivors = set(keep_ids) | set(promoted_ids) | set(just_added_ids)
    before = len(ledger["pending"])
    ledger["pending"] = [e for e in ledger["pending"] if e["id"] in survivors]
    after = len(ledger["pending"])
    if before != after:
        info(f"dropped {before - after} pending entries (no longer carried forward)")


def main() -> int:
    if not DATA_JSON.exists():
        info(f"{DATA_JSON} not present; nothing to apply")
        return 0

    try:
        data = json.loads(DATA_JSON.read_text())
    except json.JSONDecodeError as e:
        fail(f"{DATA_JSON} is not valid JSON: {e}", code=2)

    ops = data.get("ledger_ops")
    if not ops:
        info("data.json has no ledger_ops block; ledger untouched")
        return 0

    # Load + validate current ledger BEFORE any mutation so we abort cleanly
    # on a corrupt starting state.
    try:
        ledger = L.load()
    except L.LedgerError as e:
        fail(f"current ledger failed validation; refusing to apply: {e}", code=3)

    # Capture pre-apply state for diff reporting
    pre_open = len(ledger["open"])
    pre_pending = len(ledger["pending"])
    pre_closed = len(ledger["closed"])

    try:
        # 1. evaluations
        apply_evaluations(ledger, ops.get("evaluations", []))

        # 2. close
        apply_close(ledger, ops.get("close", []))

        # 3. open_now (collect promoted IDs to protect them from drop step)
        opens = ops.get("open_now", [])
        promoted_ids = [o["pending_id_promoted"] for o in opens if o.get("pending_id_promoted")]
        apply_open_now(ledger, opens)

        # 4. add_pending (collect new IDs to protect from drop step)
        pre_pending_ids = {e["id"] for e in ledger["pending"]}
        apply_add_pending(ledger, ops.get("add_pending", []))
        just_added_ids = [e["id"] for e in ledger["pending"] if e["id"] not in pre_pending_ids]

        # 5. pending drops (anything not kept, promoted, or just-added)
        apply_pending_drops(
            ledger,
            keep_ids=list(ops.get("keep_pending", [])),
            promoted_ids=promoted_ids,
            just_added_ids=just_added_ids,
        )
    except (KeyError, TypeError) as e:
        fail(
            f"ledger_ops malformed (missing required field?): {e}. "
            "Ledger untouched.",
            code=2,
        )

    # Validate post-state before writing
    try:
        L.validate(ledger)
    except L.LedgerError as e:
        fail(
            f"post-apply ledger fails validation; refusing to write: {e}",
            code=3,
        )

    L.save(ledger)

    info(
        f"applied | open: {pre_open}→{len(ledger['open'])} "
        f"pending: {pre_pending}→{len(ledger['pending'])} "
        f"closed: {pre_closed}→{len(ledger['closed'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
