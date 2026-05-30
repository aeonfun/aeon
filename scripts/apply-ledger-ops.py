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
       confluence_missing, named_risks, watchlist_id_promoted,
       engine_watch_conditions}
    Opens a new entry in ledger.open[]. If watchlist_id_promoted is set,
    removes that entry from watchlist[] and attaches watchlist_provenance
    (with days_on_watchlist computed from first_seen_date).
    engine_watch_conditions is an optional array of structured triggers
    the hourly poller evaluates (see scripts/lib/ledger.py for shape).

  add_watchlist:
    - {ticker, direction, trigger, invalidation, horizon, thesis,
       confluence_fired, named_risks}
    Adds a new entry to ledger.watchlist[].

  keep_watchlist:
    - ["WATCHLIST-ID-1", ...]
    Watchlist IDs to retain. Anything not in this list AND not promoted
    AND not just-added AND not in drop_watchlist is archived implicitly
    as "stale" (with a note flagging Claude's omission).

  drop_watchlist:
    - [{watchlist_id, reason, note}]
    Explicit drops with Claude's reasoning. Each entry archives into
    watchlist_closed[] with reason + note preserved for V2 judgement
    review. reason ∈ {invalidated, thesis_decayed, stale}.
    "promoted" is NOT a valid reason here — promotions are handled
    inside open_now via the watchlist_id_promoted field.

Exit codes:
  0 — applied successfully
  2 — data.json missing or malformed; ledger untouched
  3 — ledger validation failed before or after apply; ledger untouched
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import ledger as L  # noqa: E402


def _current_slot() -> str | None:
    """Return the CHAIN_SLOT env value if it's a valid slot, else None."""
    s = os.environ.get("CHAIN_SLOT", "").strip().lower()
    return s if s in ("am", "pm") else None


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
    slot = _current_slot()
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
        # Tag with chain slot when available (twice-daily schedule).
        # Caller-provided slot wins if Claude explicitly set one; else use env.
        eval_slot = ev.get("slot") or slot
        if eval_slot:
            new_eval["slot"] = eval_slot
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
                "engine_watch_conditions": list(o.get("engine_watch_conditions") or []) or None,
                "evaluations": [],
            }

            # If promoted from a watchlist entry, build provenance, archive
            # the watchlist entry into watchlist_closed[], and remove from
            # active watchlist[].
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
                    days_watched = days_between(we["first_seen_date"], today)
                    entry["watchlist_provenance"] = {
                        "watchlist_id": promoted_id,
                        "days_on_watchlist": days_watched,
                        "original_trigger": we["trigger"],
                        "original_confluence_fired": list(we["confluence_fired"]),
                    }
                    # Archive the watchlist entry as "promoted" so the
                    # watchlist_closed[] log captures the full lifecycle.
                    archive = dict(we)
                    archive["closed_date"] = today
                    archive["close_reason"] = "promoted"
                    archive["close_note"] = o.get(
                        "promotion_note",
                        f"Promoted to {entry['id']}",
                    )
                    archive["days_on_watchlist"] = days_watched
                    archive["promoted_to_open_id"] = entry["id"]
                    ledger["watchlist_closed"].append(archive)
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


VALID_EXPLICIT_DROP_REASONS = {"invalidated", "thesis_decayed", "stale"}


def apply_drop_watchlist(ledger: dict, drops: list) -> list:
    """Apply explicit watchlist drops with Claude-provided reasoning.

    Each drop op shape:
        {"watchlist_id": str, "reason": str, "note": str}

    Where reason ∈ {invalidated, thesis_decayed, stale}. Watchlist entries
    are moved from active watchlist[] into watchlist_closed[] with the
    provided reason + note preserved for V2 judgement review.

    "promoted" is NEVER a valid reason here — promotions are handled
    inside apply_open_now() via the watchlist_id_promoted field.

    Returns the list of watchlist IDs that were explicitly dropped.
    """
    today = today_utc()
    dropped_ids: list[str] = []
    for d in drops:
        wid = d.get("watchlist_id")
        reason = d.get("reason")
        note = (d.get("note") or "").strip()

        if reason == "promoted":
            warn(
                f"drop_watchlist: 'promoted' is reserved — use "
                f"watchlist_id_promoted in open_now instead. Skipping {wid}."
            )
            continue
        if reason not in VALID_EXPLICIT_DROP_REASONS:
            warn(
                f"drop_watchlist: invalid reason '{reason}' for {wid}. "
                f"Allowed: {sorted(VALID_EXPLICIT_DROP_REASONS)}. Skipping."
            )
            continue
        if not note:
            warn(
                f"drop_watchlist: empty note for {wid} ({reason}). "
                f"Operator-facing review will lack context."
            )
            note = "(no note provided)"

        widx = find_watchlist_index(ledger, wid)
        if widx is None:
            warn(
                f"drop_watchlist references unknown watchlist_id '{wid}' "
                f"— may have already been promoted or previously dropped. Skipping."
            )
            continue

        we = ledger["watchlist"][widx]
        archive = dict(we)
        archive["closed_date"] = today
        archive["close_reason"] = reason
        archive["close_note"] = note
        archive["days_on_watchlist"] = days_between(we["first_seen_date"], today)
        archive["promoted_to_open_id"] = None
        ledger["watchlist_closed"].append(archive)
        ledger["watchlist"].pop(widx)
        dropped_ids.append(wid)
    return dropped_ids


def apply_watchlist_drops(
    ledger: dict,
    keep_ids: list,
    promoted_ids: list,
    just_added_ids: list,
    explicitly_dropped_ids: list,
) -> None:
    """Apply implicit drops — watchlist entries that Claude did NOT include
    in keep_watchlist, did NOT explicitly drop via drop_watchlist, did NOT
    promote, and were NOT just added in this run.

    Implicit drops indicate Claude omitted the entry without providing a
    reason. Archived as `stale` with a note flagging the omission so V2
    judgement review can spot reasoning gaps.
    """
    today = today_utc()
    survivors = (
        set(keep_ids)
        | set(promoted_ids)
        | set(just_added_ids)
        | set(explicitly_dropped_ids)
    )
    implicit_drops = [e for e in ledger["watchlist"] if e["id"] not in survivors]
    for we in implicit_drops:
        archive = dict(we)
        archive["closed_date"] = today
        archive["close_reason"] = "stale"
        archive["close_note"] = (
            "Implicit drop — Claude omitted from keep_watchlist without "
            "providing an explicit drop_watchlist reason. Archived as stale."
        )
        archive["days_on_watchlist"] = days_between(we["first_seen_date"], today)
        archive["promoted_to_open_id"] = None
        ledger["watchlist_closed"].append(archive)

    before = len(ledger["watchlist"])
    ledger["watchlist"] = [e for e in ledger["watchlist"] if e["id"] in survivors]
    after = len(ledger["watchlist"])
    if before != after:
        info(
            f"dropped {before - after} watchlist entries implicitly "
            f"(archived as stale)"
        )


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

        # 3. open_now (may include watchlist promotions). When promoting,
        #    archives the promoted watchlist entry into watchlist_closed[]
        #    with close_reason="promoted" + link to the new open[] id.
        opens = ops.get("open_now", [])
        promoted_ids = [
            o["watchlist_id_promoted"] for o in opens if o.get("watchlist_id_promoted")
        ]
        apply_open_now(ledger, opens)

        # 4. drop_watchlist — explicit drops with Claude reasoning. Archives
        #    each drop into watchlist_closed[] with reason + note. Reasons:
        #    invalidated, thesis_decayed, stale.
        explicitly_dropped_ids = apply_drop_watchlist(
            ledger, ops.get("drop_watchlist", [])
        )

        # 5. add_watchlist
        pre_watchlist_ids = {e["id"] for e in ledger["watchlist"]}
        apply_add_watchlist(ledger, ops.get("add_watchlist", []))
        just_added_ids = [
            e["id"] for e in ledger["watchlist"] if e["id"] not in pre_watchlist_ids
        ]

        # 6. watchlist drops (implicit fallback). Anything still on
        #    watchlist[] that's not in keep + promoted + just-added +
        #    explicitly-dropped is archived as 'stale' with a note
        #    flagging that Claude omitted reasoning.
        apply_watchlist_drops(
            ledger,
            keep_ids=list(ops.get("keep_watchlist", [])),
            promoted_ids=promoted_ids,
            just_added_ids=just_added_ids,
            explicitly_dropped_ids=explicitly_dropped_ids,
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
