"""Tool configuration contract.

These Pydantic models are the single source of truth for the declarative tool
spec. The TypeScript types consumed by ``@platform/tool-sdk`` are generated from
the JSON Schema exported here (see ``scripts/export_config_schema.py``).
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


class FieldType(str, Enum):
    string = "string"
    text = "text"
    number = "number"
    currency = "currency"
    boolean = "boolean"
    enum = "enum"
    datetime = "datetime"
    tags = "tags"
    json = "json"


class EntityField(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str
    label: str
    type: FieldType = FieldType.string
    enum_values: list[str] = Field(default_factory=list, alias="enumValues")
    required: bool = False
    editable: bool = False
    help_text: str | None = Field(default=None, alias="helpText")


class EntitySpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str
    label: str
    plural_label: str = Field(alias="pluralLabel")
    id_field: str = Field(default="id", alias="idField")
    title_field: str = Field(default="id", alias="titleField")
    status_field: str | None = Field(default=None, alias="statusField")
    fields: list[EntityField]


class FilterSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    field: str
    label: str
    kind: Literal["search", "select", "boolean"] = "search"
    options: list[str] = Field(default_factory=list)


class SortSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    field: str
    direction: Literal["asc", "desc"] = "desc"


class ListViewSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    mode: Literal["queue", "table"] = "table"
    columns: list[str]
    filters: list[FilterSpec] = Field(default_factory=list)
    default_sort: SortSpec | None = Field(default=None, alias="defaultSort")
    page_size: int = Field(default=25, alias="pageSize")


class DetailSection(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str
    fields: list[str]


class DetailViewSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    sections: list[DetailSection]
    show_audit_trail: bool = Field(default=True, alias="showAuditTrail")
    show_approvals: bool = Field(default=True, alias="showApprovals")


class ApprovalPolicy(BaseModel):
    """When an action must be routed through the approvals engine."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: Literal["never", "always", "threshold", "field_true"] = "never"
    field: str | None = None
    threshold: float | None = None


class ActionSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    key: str
    label: str
    kind: Literal["approve", "reject", "edit", "custom"] = "custom"
    permission: str
    variant: Literal["primary", "danger", "secondary"] = "secondary"
    confirm: bool = False
    fields: list[str] = Field(default_factory=list)
    approval: ApprovalPolicy = Field(default_factory=ApprovalPolicy)
    sets_status: str | None = Field(default=None, alias="setsStatus")


class ApiSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    base_url_env: str = Field(alias="baseUrlEnv")
    base_url: str = Field(alias="baseUrl")
    resource_path: str = Field(default="/items", alias="resourcePath")


class ToolConfig(BaseModel):
    """A complete declarative description of one internal tool."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    key: str
    name: str
    description: str = ""
    icon: str = "square"
    entity: EntitySpec
    list_view: ListViewSpec = Field(alias="listView")
    detail_view: DetailViewSpec = Field(alias="detailView")
    actions: list[ActionSpec] = Field(default_factory=list)
    api: ApiSpec

    @model_validator(mode="after")
    def check_field_references(self) -> ToolConfig:
        names = {f.name for f in self.entity.fields}
        errors: list[str] = []

        def check(where: str, name: str) -> None:
            if name not in names:
                errors.append(f'{where}: unknown field "{name}"')

        for column in self.list_view.columns:
            check("listView.columns", column)
        for spec in self.list_view.filters:
            check("listView.filters", spec.field)
        if self.list_view.default_sort is not None:
            check("listView.defaultSort", self.list_view.default_sort.field)
        for section in self.detail_view.sections:
            for name in section.fields:
                check(f"detailView.{section.title}", name)
        for action in self.actions:
            for name in action.fields:
                check(f"actions.{action.key}.fields", name)
            if action.approval.field:
                check(f"actions.{action.key}.approval", action.approval.field)
        if self.entity.status_field:
            check("entity.statusField", self.entity.status_field)
        check("entity.titleField", self.entity.title_field)
        if errors:
            raise ValueError("; ".join(errors))
        return self

    def field(self, name: str) -> EntityField | None:
        return next((f for f in self.entity.fields if f.name == name), None)

    def action(self, key: str) -> ActionSpec | None:
        return next((a for a in self.actions if a.key == key), None)


def load_tool_config(path: str | Path) -> ToolConfig:
    """Load and validate a YAML tool config."""
    raw = yaml.safe_load(Path(path).read_text())
    return ToolConfig.model_validate(raw)


def tool_config_json_schema() -> dict[str, Any]:
    return ToolConfig.model_json_schema(by_alias=True)
