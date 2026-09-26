"""Export the ToolConfig JSON Schema so TypeScript types can be generated from it.

Usage: python3 scripts/export_config_schema.py
Writes packages/tool-sdk/schema/tool-config.schema.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "platform" / "core"))

from platform_core.config import tool_config_json_schema  # noqa: E402

OUT = ROOT / "packages" / "tool-sdk" / "schema" / "tool-config.schema.json"


def _strip_property_titles(node: object) -> None:
    """Pydantic titles every property; json2ts would turn each into a type alias."""
    if isinstance(node, dict):
        for name, prop in node.get("properties", {}).items():
            if isinstance(prop, dict):
                prop.pop("title", None)
                for variant in prop.get("anyOf", []):
                    if isinstance(variant, dict):
                        variant.pop("title", None)
        for child in node.values():
            _strip_property_titles(child)
    elif isinstance(node, list):
        for child in node:
            _strip_property_titles(child)


def main() -> None:
    schema = tool_config_json_schema()
    schema["title"] = "ToolConfig"
    _strip_property_titles(schema)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(schema, indent=2) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
