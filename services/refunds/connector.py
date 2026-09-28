from __future__ import annotations

from typing import Any

from platform_core.connectors import MockConnector

from .models import RefundRequest


class PaymentsConnector(MockConnector):
    def __init__(self) -> None:
        super().__init__("payments-processor")

    def fetch(self, resource: str, **params: Any) -> list[dict[str, Any]]:
        if resource != "payment":
            return super().fetch(resource, **params)
        order_id = str(params.get("key", ""))
        methods = ("card", "bank_transfer", "digital_wallet")
        statuses = ("captured", "settled", "pending")
        index = self.stable_int(order_id, len(methods))
        return [{"payment_method": methods[index], "payment_status": statuses[index]}]


def enrich_refund(_db: Any, obj: RefundRequest, data: dict[str, Any]) -> dict[str, Any]:
    data.update(PaymentsConnector().fetch_one("payment", key=obj.order_id) or {})
    return data
