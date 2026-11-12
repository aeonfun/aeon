"""Resource lifecycle state machine for Aeon Compute.

A discovered offer is NOT a running machine. This state machine makes that
explicit: discovery yields DISCOVERED/AVAILABLE only; a resource reaches
RUNNING solely through PROVISIONING, which the read-only foundation never
performs. Transitions are restricted so a caller cannot, for example, mark a
discovered offer RUNNING without provisioning it.
"""
from __future__ import annotations

from enum import Enum


class ResourceState(str, Enum):
    DISCOVERED = "discovered"      # provider returned an offer; nothing acquired
    AVAILABLE = "available"        # offer confirmed currently rentable/usable
    PROVISIONING = "provisioning"  # acquisition in progress
    RUNNING = "running"            # a real machine is up and reachable
    UNAVAILABLE = "unavailable"    # was known, now not usable (capacity gone / host dropped)
    FAILED = "failed"              # an operation on it failed
    TERMINATING = "terminating"    # teardown in progress
    TERMINATED = "terminated"      # gone; terminal


_TRANSITIONS: dict[ResourceState, frozenset[ResourceState]] = {
    ResourceState.DISCOVERED: frozenset(
        {ResourceState.AVAILABLE, ResourceState.UNAVAILABLE, ResourceState.FAILED}
    ),
    ResourceState.AVAILABLE: frozenset(
        {ResourceState.PROVISIONING, ResourceState.UNAVAILABLE, ResourceState.FAILED}
    ),
    ResourceState.PROVISIONING: frozenset(
        {
            ResourceState.RUNNING,
            ResourceState.FAILED,
            ResourceState.UNAVAILABLE,
            ResourceState.TERMINATING,
        }
    ),
    ResourceState.RUNNING: frozenset(
        {ResourceState.UNAVAILABLE, ResourceState.TERMINATING, ResourceState.FAILED}
    ),
    ResourceState.UNAVAILABLE: frozenset(
        {
            ResourceState.AVAILABLE,       # recovered
            ResourceState.PROVISIONING,    # re-provision
            ResourceState.TERMINATING,
            ResourceState.FAILED,
        }
    ),
    ResourceState.FAILED: frozenset(
        {ResourceState.TERMINATING, ResourceState.TERMINATED, ResourceState.PROVISIONING}
    ),
    ResourceState.TERMINATING: frozenset(
        {ResourceState.TERMINATED, ResourceState.FAILED}
    ),
    ResourceState.TERMINATED: frozenset(),
}

# States reachable by read-only discovery alone. Anything past AVAILABLE implies
# an acquisition the foundation layer does not perform.
DISCOVERY_STATES = frozenset({ResourceState.DISCOVERED, ResourceState.AVAILABLE})

TERMINAL_STATES = frozenset({ResourceState.TERMINATED})


class InvalidTransition(ValueError):
    def __init__(self, current: ResourceState, target: ResourceState) -> None:
        super().__init__(f"invalid resource transition: {current.value} -> {target.value}")
        self.current = current
        self.target = target


def can_transition(current: ResourceState, target: ResourceState) -> bool:
    if not isinstance(current, ResourceState) or not isinstance(target, ResourceState):
        raise ValueError("can_transition requires ResourceState values")
    return target in _TRANSITIONS[current]


def transition(current: ResourceState, target: ResourceState) -> ResourceState:
    """Return `target` if the edge is legal, else raise InvalidTransition.

    A self-transition (current == target) is only legal when the state machine
    lists it; none do, so repeating a state is rejected here and idempotency is
    handled one layer up in `state` (which no-ops a re-applied target)."""
    if not can_transition(current, target):
        raise InvalidTransition(current, target)
    return target


def allowed_targets(current: ResourceState) -> frozenset[ResourceState]:
    if not isinstance(current, ResourceState):
        raise ValueError("allowed_targets requires a ResourceState")
    return _TRANSITIONS[current]
