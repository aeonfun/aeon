#!/usr/bin/env python3
"""Apply perps-brief's daily ledger operations to active-setups.json (v4.1).

Reads .outputs/perps-brief.data.json (Claude-written), reads the current
ledger at memory/topics/state/active-setups.json, computes the new ledger
state, and writes it back atomically via scripts/lib/ledger.py.

This script is the ONLY writer of the ledger. Claude does not touch the
ledger file directly — it writes operations into the data.json's
`ledger_ops` block and this script applies them.

v4.1 changes from v4:
- add_pending / keep_pending → add_watchlist / keep_watchlist
- pending_id_promoted → watchlist_id_promoted
- evaluations now carry todays_high / todays_low for MAE/MFE updates
- close entries carry auto_flipped flag
- outcome is COMPUTED by this script from return_vs_btc_pct +
  invalidation_breached. Claude provides invalidation_breached as part
  of the close.

Operations in data.json["ledger_ops"]:

  evaluations:
    - {open_id, date, call, price_at_eval, todays_high, todays_low,
       invalidation_breached_today, note}
    Per-day evaluation for an open ledger entry. Required once per open
    entry per run. Appends to entry.evaluations[]. Updates entry.mae_pct,
    entry.mfe_pct, entry.invalidation_breached.

  close:
    - {open_id, closed_price, close_reason, return_pct,
       return_vs_btc_pct, return_vs_eth_pct, horizon_realized,
       auto_flipped}
    Moves open → closed. outcome is computed by this script.

  open_now:
    - {ticker, direction, fired_price, fired_btc_price, fired_eth_price,
       entry_zone, invalidation, horizon, thesis, confluence_fired,
       confluence_missing, named_risks, watchlist_id_promoted}
    Opens a new entry in ledger.open[]. If watchlist_id_promoted is set,
    removes that entry from watchlist[] and attaches watchlist_provenance
    (with days_on_watchlist computed from first_seen_date).

  add_watchlist:
    - {ticker, direction, trigger, invalidation, horizon, thesis,
       confluence_fired, named_risks}
    Adds a new entry to ledger.watchlist[].

  keep_watchlist:
    - ["WATCHLIST-ID-1", ...]
    Watchlist IDs to retain. Anything not in this list AND not promoted
    AND not just-added is DROPPED.

Exit codes:
  0 — applied successfully
  2 — data.json missing or malformed; ledger untouched
  3 — ledger validation failed before or after apply; ledger untouched
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Any

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


def days_between(start: str, end: str) -> int:
    """Inclusive day count between two YYYY-MM-DD strings."""
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    return (e - s).days


def find_open_index(ledger: dict, open_id: str) -> int | None:
    for i, e in enumerate(ledger["open"]):
        if e["id"] == open_id:
            return i
    return None


def find_watchlist_index(ledger: dict, watchlist_id: str) -> int | None:
    for i, e in enumerate(ledger["watchlist"]):
        if e["id"] == watchlist_id:
            return i
    return None


def compute_outcome(
    return_vs_btc_pct: float | None,
    invalidation_breached: bool,
    return_pct: float,
    threshold: float = 2.0,
) -> str:
    """Compute outcome label from return + invalidation history.

    Logic:
      - return > +threshold vs BTC (or absolute if BTC missing) → WIN, or
        SCARE if invalidation was breached at some point during the trade
      - return < -threshold → LOSS
      - else → NEUTRAL
    """
    metric = return_vs_btc_pct if return_vs_btc_pct is not None else return_pct
    if metric >= threshold:
        return "SCARE" if invalidation_breached else "WIN"
    if metric <= -threshold:
        return "LOSS"
    return "NEUTRAL"


def apply_evaluations(ledger: dict, evals: list) -> None:
    """Append (or replace) per-day evaluations + update MAE/MFE +
    invalidation_breached.

    De-duplication: if an evaluation for the same (open_id, date) already
    exists in entry.evaluations[], REPLACE it with the new one instead of
    appending. This prevents duplicate-eval bloat from multi-dispatches
    on the same day (chain re-dispatched 3x today → 3 identical eval
    rows for each open position without this dedup).
    """
    today = today_utc()
    for ev in evals:
        oid = ev.get("open_id")
        idx = find_open_index(ledger, oid)
        if idx is None:
            warn(f"evaluation references unknown open_id '{oid}' — skipping")
            continue
        entry = ledger["open"][idx]
        eval_date = ev.get("date", today)
        new_eval = {
            "date": eval_date,
            "call": ev["call"],
            "price_at_eval": ev.get("price_at_eval"),
            "note": ev.get("note", ""),
        }
        # Carry the breach flag onto the eval entry so the SCARE provenance
        # is preserved per-day (even though the cumulative flag below is
        # what drives outcome computation).
        if "invalidation_breached_today" in ev:
            new_eval["invalidation_breached_today"] = ev["invalidation_breached_today"]

        # De-dup: remove ALL existing evals for this date, then append the
        # new one. (Earlier logic broke after replacing the first match,
        # which left pre-existing same-date duplicates in place. Verified
        # on HYPE-2026-05-22-001 ledger: had 3× 2026-05-22 evals from
        # multi-dispatch, dedup replaced only one, leaving 2 duplicates.)
        entry["evaluations"] = [
            ev for ev in entry["evaluations"] if ev.get("date") != eval_date
        ]
        entry["evaluations"].append(new_eval)

        # MAE/MFE update from today's high/low
        todays_high = ev.get("todays_high")
        todays_low = ev.get("todays_low")
        if todays_high is not None and todays_low is not None:
            mae, mfe, mae_date, mfe_date = L.compute_mae_mfe_update(
                direction=entry["direction"],
                fired_price=entry["fired_price"],
                todays_high=float(todays_high),
                todays_low=float(todays_low),
                current_mae=entry.get("mae_pct"),
                current_mfe=entry.get("mfe_pct"),
                current_mae_date=entry.get("mae_date"),
                current_mfe_date=entry.get("mfe_date"),
                today=ev.get("date", today),
            )
            entry["mae_pct"] = mae
            entry["mfe_pct"] = mfe
            entry["mae_date"] = mae_date
            entry["mfe_date"] = mfe_date

        # invalidation_breached is sticky once set true
        if ev.get("invalidation_breached_today"):
            entry["invalidation_breached"] = True


def apply_close(ledger: dict, closes: list) -> None:
    today = today_utc()
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
        entry["horizon_realized"] = c.get("horizon_realized", entry.get("horizon", ""))
        entry["auto_flipped"] = bool(c.get("auto_flipped", False))
        entry["outcome"] = compute_outcome(
            return_vs_btc_pct=entry["return_vs_btc_pct"],
            invalidation_breached=entry.get("invalidation_breached", False),
            return_pct=entry["return_pct"],
        )
        ledger["closed"].append(entry)


def apply_open_now(ledger: dict, opens: list) -> None:
    today = today_utc()
    for o in opens:
        asset = o["ticker"].upper()
        direction = o["direction"]

        # Asset-uniqueness guard: if there's still an open position on this
        # asset in the SAME direction, that's a pyramid attempt — warn and
        # skip. If OPPOSITE direction, that's an auto-flip — the brief
        # should have CLOSEd the prior in the same run; if it didn't, warn
        # but still apply (the ledger validator will fail post-apply if a
        # duplicate slips through).
        for existing in ledger["open"]:
            if existing["asset"] == asset:
                if existing["direction"] == direction:
                    warn(
                        f"open_now {asset} {direction}: same-direction position "
                        f"already open ({existing['id']}). Pyramiding not "
                        f"supported in v4.1. Skipping."
                    )
                    break
                else:
                    warn(
                        f"open_now {asset} {direction}: opposite-direction "
                        f"position still open ({existing['id']}) — brief should "
                        f"have CLOSEd it first with auto_flipped:true. Proceeding "
                        f"anyway; validator will catch duplicate asset."
                    )
        else:
            new_id = L.next_entry_id(asset, today, ledger)
            entry = {
                "id": new_id,
                "asset": asset,
                "direction": direction,
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
                "mae_pct": None,
                "mfe_pct": None,
                "mae_date": None,
                "mfe_date": None,
                "invalidation_breached": False,
                "watchlist_provenance": None,
                "evaluations": [],
            }

            # If promoted from a watchlist entry, build provenance + remove
            # from watchlist[].
            promoted_id = o.get("watchlist_id_promoted")
            if promoted_id:
                widx = find_watchlist_index(ledger, promoted_id)
                if widx is None:
                    warn(
                        f"open_now {asset}: claims watchlist promotion of "
                        f"'{promoted_id}' but no such entry exists"
                    )
                else:
                    we = ledger["watchlist"][widx]
                    entry["watchlist_provenance"] = {
                        "watchlist_id": promoted_id,
                        "days_on_watchlist": days_between(
                            we["first_seen_date"], today
                        ),
                        "original_trigger": we["trigger"],
                        "original_confluence_fired": list(we["confluence_fired"]),
                    }
                    ledger["watchlist"].pop(widx)

            ledger["open"].append(entry)


def apply_add_watchlist(ledger: dict, adds: list) -> None:
    today = today_utc()
    for p in adds:
        asset = p["ticker"].upper()
        new_id = L.next_watchlist_id(asset, today, ledger)
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
        ledger["watchlist"].append(entry)


def apply_watchlist_drops(
    ledger: dict, keep_ids: list, promoted_ids: list, just_added_ids: list
) -> None:
    survivors = set(keep_ids) | set(promoted_ids) | set(just_added_ids)
    before = len(ledger["watchlist"])
    ledger["watchlist"] = [e for e in ledger["watchlist"] if e["id"] in survivors]
    after = len(ledger["watchlist"])
    if before != after:
        info(f"dropped {before - after} watchlist entries (no longer carried forward)")


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

    try:
        ledger = L.load()
    except L.LedgerError as e:
        fail(f"current ledger failed validation; refusing to apply: {e}", code=3)

    pre_open = len(ledger["open"])
    pre_watchlist = len(ledger["watchlist"])
    pre_closed = len(ledger["closed"])

    try:
        # 1. Evaluations (incl. MAE/MFE + invalidation_breached updates)
        apply_evaluations(ledger, ops.get("evaluations", []))

        # 2. Close (manual + auto-flip closes). MUST happen before open_now
        #    so an auto-flip frees the asset slot for the new direction.
        apply_close(ledger, ops.get("close", []))

        # 3. open_now (may include watchlist promotions)
        opens = ops.get("open_now", [])
        promoted_ids = [
            o["watchlist_id_promoted"] for o in opens if o.get("watchlist_id_promoted")
        ]
        apply_open_now(ledger, opens)

        # 4. add_watchlist
        pre_watchlist_ids = {e["id"] for e in ledger["watchlist"]}
        apply_add_watchlist(ledger, ops.get("add_watchlist", []))
        just_added_ids = [
            e["id"] for e in ledger["watchlist"] if e["id"] not in pre_watchlist_ids
        ]

        # 5. watchlist drops
        apply_watchlist_drops(
            ledger,
            keep_ids=list(ops.get("keep_watchlist", [])),
            promoted_ids=promoted_ids,
            just_added_ids=just_added_ids,
        )
    except (KeyError, TypeError) as e:
        fail(
            f"ledger_ops malformed (missing required field?): {e}. Ledger untouched.",
            code=2,
        )

    try:
        L.validate(ledger)
    except L.LedgerError as e:
        fail(f"post-apply ledger fails validation; refusing to write: {e}", code=3)

    L.save(ledger)

    info(
        f"applied | open: {pre_open}→{len(ledger['open'])} "
        f"watchlist: {pre_watchlist}→{len(ledger['watchlist'])} "
        f"closed: {pre_closed}→{len(ledger['closed'])}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
