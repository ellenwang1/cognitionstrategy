"""Connector abstraction over data sources.

Tools never talk to an external system directly: they declare a connector and
call ``fetch``/``fetch_one``. Everything external (payments processor,
sanctions vendor, ...) is a deterministic mock.
"""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from typing import Any


class ConnectorError(RuntimeError):
    pass


class Connector(ABC):
    """Common interface for every data source."""

    kind: str = "unknown"

    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def fetch(self, resource: str, **params: Any) -> list[dict[str, Any]]:
        """Return a list of records for ``resource``."""

    def fetch_one(self, resource: str, key: str, **params: Any) -> dict[str, Any] | None:
        records = self.fetch(resource, key=key, **params)
        return records[0] if records else None

    def health(self) -> dict[str, Any]:
        return {"connector": self.name, "kind": self.kind, "status": "ok"}


class MockConnector(Connector):
    """Deterministic in-memory stand-in for an external vendor API.

    Records are seeded per resource; derived values are hashed from the lookup
    key so repeated calls (and re-seeded environments) are stable.
    """

    kind = "mock"

    def __init__(self, name: str, data: dict[str, list[dict[str, Any]]] | None = None) -> None:
        super().__init__(name)
        self.data: dict[str, list[dict[str, Any]]] = data or {}

    def seed(self, resource: str, records: list[dict[str, Any]]) -> None:
        self.data[resource] = records

    def fetch(self, resource: str, **params: Any) -> list[dict[str, Any]]:
        records = self.data.get(resource)
        if records is None:
            raise ConnectorError(f"{self.name}: unknown resource {resource!r}")
        key = params.get("key")
        if key is None:
            return list(records)
        return [r for r in records if str(r.get("key", r.get("id"))) == str(key)]

    @staticmethod
    def stable_int(seed: str, modulo: int) -> int:
        digest = hashlib.sha256(seed.encode()).hexdigest()
        return int(digest[:8], 16) % modulo
