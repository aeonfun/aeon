"""Persistent, idempotent state for discovered compute resources.

State is a JSON document (default `memory/state/compute/resources.json`) keyed by
`Resource.resource_id`. Two properties matter:

- **Idempotent:** re-discovering the same offer updates it in place (never a
  duplicate); re-applying a lifecycle transition the resource is already in is a
  no-op. So a run that is retried from the start converges to the same state.
- **Crash-safe:** writes go to a temp file in the same directory and are
  `os.replace`d into place, so an interrupted run never leaves a half-written
  (corrupt) state file.

Re-discovery refreshes an offer's specs/pricing but PRESERVES its lifecycle
state: a RUNNING machine seen again in the market does not revert to DISCOVERED.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from typing import Any

import contracts
import lifecycle

STATE_VERSION = 1
DEFAULT_STATE_PATH = "memory/state/compute/resources.json"


def new_state() -> dict[str, Any]:
    return {"version": STATE_VERSION, "resources": {}}


def load(path: str) -> dict[str, Any]:
    if not os.path.exists(path):
        return new_state()
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise ValueError(f"compute state at {path} is not valid JSON: {exc}") from exc
    if not isinstance(data, dict) or "resources" not in data:
        raise ValueError(f"compute state at {path} is malformed (missing 'resources')")
    version = data.get("version", STATE_VERSION)
    if not isinstance(version, int) or version > STATE_VERSION:
        raise ValueError(
            f"compute state at {path} has unsupported version {version!r} "
            f"(this build supports up to {STATE_VERSION})"
        )
    data["version"] = version
    if not isinstance(data["resources"], dict):
        raise ValueError(f"compute state at {path} has a non-object 'resources'")
    return data


def save(path: str, state: dict[str, Any]) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".compute-state-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(state, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def upsert_resource(
    state: dict[str, Any],
    resource: contracts.Resource,
    *,
    initial_state: lifecycle.ResourceState = lifecycle.ResourceState.DISCOVERED,
    now: float | None = None,
) -> dict[str, Any]:
    now = time.time() if now is None else now
    rid = resource.resource_id
    entries = state["resources"]
    existing = entries.get(rid)
    if existing is None:
        entries[rid] = {
            "resource": resource.to_dict(),
            "state": initial_state.value,
            "first_seen": now,
            "updated_at": now,
        }
    else:
        existing["resource"] = resource.to_dict()
        existing["updated_at"] = now
    return state


def get_resource_state(state: dict[str, Any], resource_id: str) -> lifecycle.ResourceState:
    entry = state["resources"][resource_id]
    return lifecycle.ResourceState(entry["state"])


def apply_transition(
    state: dict[str, Any],
    resource_id: str,
    target: lifecycle.ResourceState,
    *,
    now: float | None = None,
) -> dict[str, Any]:
    """Move a tracked resource to `target`. Idempotent: if it is already in
    `target`, nothing changes. Raises KeyError for an unknown resource and
    lifecycle.InvalidTransition for an illegal edge."""
    now = time.time() if now is None else now
    entry = state["resources"][resource_id]
    current = lifecycle.ResourceState(entry["state"])
    if current == target:
        return state
    entry["state"] = lifecycle.transition(current, target).value
    entry["updated_at"] = now
    return state


def resources(state: dict[str, Any]) -> list[contracts.Resource]:
    return [contracts.Resource.from_dict(e["resource"]) for e in state["resources"].values()]
