"""The provider adapter interface.

Every compute provider -- a GPU marketplace, a sandbox service, a cloud VM API,
a bring-your-own-computer connection, a distributed inference backend -- is
reached through this one interface, so the core never depends on a provider's
data model. The foundation layer implements only the read-only half
(`discover`). Provisioning and execution are declared here as the shape future
adapters will fill, but default to NotImplementedError so the discovery/
provisioning boundary stays explicit and nothing accidentally acts on infra.
"""
from __future__ import annotations

import abc
from typing import Any

import contracts


class ProviderAdapter(abc.ABC):
    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Stable provider identifier, used as the `provider` on every Resource."""

    @property
    def supports_provisioning(self) -> bool:
        return False

    @abc.abstractmethod
    def discover(self, query: dict[str, Any] | None = None) -> list[contracts.Resource]:
        """Read-only. Return resources the provider currently advertises,
        normalized into the Resource contract. Must not create, rent, start,
        stop, or otherwise change anything."""

    # --- Future lifecycle surface (not implemented in the foundation layer) ---

    def provision(self, resource: contracts.Resource, spec: contracts.WorkloadSpec) -> contracts.Resource:
        raise NotImplementedError(f"{self.name}: provisioning is not implemented in the foundation layer")

    def status(self, resource: contracts.Resource) -> contracts.Resource:
        raise NotImplementedError(f"{self.name}: status is not implemented in the foundation layer")

    def execute(self, resource: contracts.Resource, command: str) -> Any:
        raise NotImplementedError(f"{self.name}: execution is not implemented in the foundation layer")

    def terminate(self, resource: contracts.Resource) -> None:
        raise NotImplementedError(f"{self.name}: termination is not implemented in the foundation layer")
