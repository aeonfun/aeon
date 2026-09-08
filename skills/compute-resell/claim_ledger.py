#!/usr/bin/env python3
"""Cross-skill claim ledger for the compute-resell family.

Every compute-resell fork (compute-resell, aws-compute-resell, vertex-compute-resell,
and any future fork whose state file matches ``*compute-resell.json``) lists offers on
the SAME Surplus marketplace. Surplus routes ``/api/markets/{model}`` to the cheapest
healthy offer regardless of which provider backs it, so two siblings listing the same
market id land in one order book and undercut each other - a self-inflicted price war
that drags the family's clearing price toward the free-credit sibling's floor.

This module is the family's shared claim ledger. It reads the live offers every sibling
has committed to ``memory/state/*compute-resell.json`` and answers two questions:

  * ``claimed_models(self)``  - which market ids a sibling already lists (never list these)
  * ``resolve_owner(...)``    - on an existing double-claim, which skill keeps it

Discovery is by glob, so a new fork needs zero config to be respected: drop its state
file in ``memory/state/`` and every sibling excludes its models on the next run.

Ownership tie-break (only ever needed for a pre-existing double-claim or a rare
simultaneous-run race - the staggered cron + commit-per-run normally prevents both):
the skill with the higher ``last_window.earned_usdc`` on that model keeps it; an exact
tie breaks on the lexicographically smallest skill name. Whoever loses moves the offer
to ``to_delist`` on its next run, so the ledger self-heals to one owner per model.

CLI: ``python claim_ledger.py <self-skill-name> [state-dir]`` prints a JSON report the
runbook consumes:
  {"self": "...", "siblings": [...], "claimed_models": [...],
   "conflicts": {"<model>": {"owner": "...", "mine_earned": x, "sibling_best": y}}}
"""

from __future__ import annotations

import glob
import json
import os
import sys

GLOB = "*compute-resell.json"


def _load(path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _self_filename(self_skill):
    # State file is named after the skill: compute-resell -> compute-resell.json
    return f"{self_skill}.json"


def sibling_offers(self_skill, state_dir="memory/state"):
    """{sibling_skill_name: {model: earned_usdc}} for every fork except ``self_skill``.

    ``earned_usdc`` is the offer's ``last_window.earned_usdc`` (0.0 when absent) - a
    proxy for how much that sibling is actually winning on the model, used only for the
    ownership tie-break.
    """
    self_file = _self_filename(self_skill)
    out = {}
    for path in sorted(glob.glob(os.path.join(state_dir, GLOB))):
        if os.path.basename(path) == self_file:
            continue
        state = _load(path)
        if not isinstance(state, dict):
            continue
        skill = os.path.basename(path)[: -len(".json")]
        offers = state.get("offers") or {}
        models = {}
        # offers may be a dict keyed by offer id, or (defensively) a list
        entries = offers.values() if isinstance(offers, dict) else offers
        for off in entries:
            if not isinstance(off, dict):
                continue
            model = off.get("model")
            if not model:
                continue
            earned = 0.0
            lw = off.get("last_window")
            if isinstance(lw, dict):
                try:
                    earned = float(lw.get("earned_usdc") or 0.0)
                except (TypeError, ValueError):
                    earned = 0.0
            # keep the max if a sibling somehow lists the same model twice
            models[model] = max(models.get(model, 0.0), earned)
        out[skill] = models
    return out


def claimed_models(self_skill, state_dir="memory/state"):
    """Set of market ids at least one sibling currently lists. Exclude these from
    selection at the very start - before the liquidity gate, scoring, probe, or create."""
    claimed = set()
    for models in sibling_offers(self_skill, state_dir).values():
        claimed.update(models.keys())
    return claimed


def resolve_owner(model, self_skill, self_earned, siblings):
    """Return the skill name that should own ``model``: the holder (this skill or any
    sibling that lists it) with the highest ``last_window.earned_usdc``; an exact tie
    breaks on the lexicographically smallest skill name. ``siblings`` == {skill:
    {model: earned}}. Returns ``self_skill`` when this skill keeps the model."""
    holders = {self_skill: float(self_earned or 0.0)}
    for skill, models in siblings.items():
        if model in models:
            holders[skill] = float(models[model] or 0.0)
    # iterate names ascending; max returns the first (smallest-name) holder at the top
    # earnings, so equal earnings deterministically go to the smallest name.
    return max(sorted(holders), key=lambda s: holders[s])


def report(self_skill, state_dir="memory/state"):
    siblings = sibling_offers(self_skill, state_dir)
    claimed = set()
    for models in siblings.values():
        claimed.update(models.keys())

    # conflicts: models THIS skill currently lists that a sibling also lists
    self_state = _load(os.path.join(state_dir, _self_filename(self_skill))) or {}
    self_offers = self_state.get("offers") or {}
    self_entries = self_offers.values() if isinstance(self_offers, dict) else self_offers
    my_models = {}
    for off in self_entries:
        if not isinstance(off, dict) or not off.get("model"):
            continue
        earned = 0.0
        lw = off.get("last_window")
        if isinstance(lw, dict):
            try:
                earned = float(lw.get("earned_usdc") or 0.0)
            except (TypeError, ValueError):
                earned = 0.0
        my_models[off["model"]] = max(my_models.get(off["model"], 0.0), earned)

    conflicts = {}
    for model, mine_earned in my_models.items():
        sib_holders = {s: m[model] for s, m in siblings.items() if model in m}
        if not sib_holders:
            continue
        owner = resolve_owner(model, self_skill, mine_earned, siblings)
        conflicts[model] = {
            "owner": owner,
            "keep_here": owner == self_skill,
            "mine_earned": round(mine_earned, 6),
            "sibling_best": round(max(sib_holders.values()), 6),
            "sibling_holders": {s: round(e, 6) for s, e in sib_holders.items()},
        }

    return {
        "self": self_skill,
        "siblings": sorted(siblings.keys()),
        "claimed_models": sorted(claimed),
        "conflicts": conflicts,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("usage: claim_ledger.py <self-skill-name> [state-dir]\n")
        sys.exit(2)
    skill = sys.argv[1]
    sd = sys.argv[2] if len(sys.argv) > 2 else "memory/state"
    print(json.dumps(report(skill, sd), indent=1))
