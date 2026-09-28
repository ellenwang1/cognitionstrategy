from pathlib import Path

from platform_core.api import ResourceBinding, create_tool_app
from platform_core.config import load_tool_config

from .connector import PaymentsConnector, enrich_refund
from .models import RefundRequest

config = load_tool_config(Path(__file__).parent / "tool.yaml")
app = create_tool_app(
    config,
    ResourceBinding(model=RefundRequest, enrich=enrich_refund, connectors=[PaymentsConnector()]),
)
