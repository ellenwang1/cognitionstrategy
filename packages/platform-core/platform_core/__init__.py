"""platform-core: shared primitives for config-driven internal tools."""

from .api import ResourceBinding, create_tool_app, serialize_model
from .audit import record_audit
from .config import ToolConfig, load_tool_config, tool_config_json_schema
from .connectors import Connector, MockConnector, PostgresConnector
from .db import PLATFORM_SCHEMA, Base, get_db
from .security import Principal, current_principal, require_permission

__all__ = [
    "PLATFORM_SCHEMA",
    "Base",
    "Connector",
    "MockConnector",
    "PostgresConnector",
    "Principal",
    "ResourceBinding",
    "ToolConfig",
    "create_tool_app",
    "current_principal",
    "get_db",
    "load_tool_config",
    "record_audit",
    "require_permission",
    "serialize_model",
    "tool_config_json_schema",
]
