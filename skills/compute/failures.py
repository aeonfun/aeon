"""Failure taxonomy for Aeon Compute.

Recovery behaviour depends on *why* something failed: an application error must
not trigger infrastructure replacement, and a budget stop must not look like a
provider outage. This module is the single place that classifies a failure, so
later layers (health, recovery) branch on a stable category rather than on
ad-hoc string matching.

Nothing here retries or recovers; it only names and classifies.
"""
from __future__ import annotations

from enum import Enum
from typing import Any


class FailureCategory(str, Enum):
    PROVIDER_API = "provider_api"              # provider API down, 5xx, rate-limited, malformed response
    RESOURCE_AVAILABILITY = "resource_availability"  # no capacity / offer gone / out of stock
    MACHINE_CONNECTION = "machine_connection"  # a provisioned host is unreachable / dropped
    WORKLOAD_APPLICATION = "workload_application"  # the user's workload itself errored (exit!=0)
    AUTH_PERMISSION = "auth_permission"        # missing/invalid credential, forbidden
    BUDGET_QUOTA = "budget_quota"              # budget cap, quota, or billing refusal
    TIMEOUT_INTERRUPTED = "timeout_interrupted"  # operation timed out or was interrupted mid-flight
    UNKNOWN = "unknown"


# Categories that describe the infrastructure/provider, not the user's workload.
# Only these should ever motivate failover or re-provisioning; a WORKLOAD_APPLICATION
# failure never should.
_INFRASTRUCTURE = frozenset(
    {
        FailureCategory.PROVIDER_API,
        FailureCategory.RESOURCE_AVAILABILITY,
        FailureCategory.MACHINE_CONNECTION,
        FailureCategory.TIMEOUT_INTERRUPTED,
    }
)

# Whether a category is, by default, worth retrying the same way. AUTH and BUDGET
# need operator action; a workload bug needs a fix, not a retry.
_RETRYABLE_DEFAULT = frozenset(
    {
        FailureCategory.PROVIDER_API,
        FailureCategory.RESOURCE_AVAILABILITY,
        FailureCategory.MACHINE_CONNECTION,
        FailureCategory.TIMEOUT_INTERRUPTED,
    }
)


class ComputeError(Exception):
    """A classified compute failure.

    `retryable` defaults from the category but can be overridden by a caller that
    knows better (e.g. a 429 with a non-retryable body)."""

    def __init__(
        self,
        category: FailureCategory,
        message: str,
        *,
        provider: str | None = None,
        retryable: bool | None = None,
        raw: Any = None,
    ) -> None:
        if not isinstance(category, FailureCategory):
            raise ValueError("ComputeError.category must be a FailureCategory")
        super().__init__(message)
        self.category = category
        self.message = message
        self.provider = provider
        self.retryable = _RETRYABLE_DEFAULT.__contains__(category) if retryable is None else retryable
        self.raw = raw

    @property
    def is_infrastructure(self) -> bool:
        return self.category in _INFRASTRUCTURE

    def to_dict(self) -> dict[str, Any]:
        return {
            "category": self.category.value,
            "message": self.message,
            "provider": self.provider,
            "retryable": self.retryable,
            "is_infrastructure": self.is_infrastructure,
        }


def is_infrastructure(category: FailureCategory) -> bool:
    return category in _INFRASTRUCTURE


def classify_http_status(status: int) -> FailureCategory:
    """Map an HTTP status from a provider call to a category.

    Conservative on purpose: a 2xx is not a failure, a 401/403 is clearly auth,
    a 402 is billing, a 404/409/410 on an offer is availability, 408/504 is a
    timeout, 429 and 5xx are the provider's problem. Anything unmapped is
    UNKNOWN rather than silently treated as infrastructure."""
    if 200 <= status < 300:
        raise ValueError(f"classify_http_status called on a success status {status}")
    if status in (401, 403):
        return FailureCategory.AUTH_PERMISSION
    if status == 402:
        return FailureCategory.BUDGET_QUOTA
    if status in (404, 409, 410):
        return FailureCategory.RESOURCE_AVAILABILITY
    if status in (408, 504):
        return FailureCategory.TIMEOUT_INTERRUPTED
    if status == 429 or 500 <= status < 600:
        return FailureCategory.PROVIDER_API
    return FailureCategory.UNKNOWN
