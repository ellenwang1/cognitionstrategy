"""FastAPI app factory + config-driven resource router.

A tool service is: a SQLAlchemy model, a ``ToolConfig`` and (optionally) a few
custom action handlers. Everything else - list/detail endpoints, filtering,
permission gates, approval routing, audit trail - is generated here.
"""

from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import String, Text, cast, func, or_, select
from sqlalchemy.orm import Session

from . import approvals as approvals_engine
from .audit import diff, entity_audit_trail, record_audit
from .config import ActionSpec, ToolConfig
from .connectors import Connector
from .db import Base, get_db
from .models import ApprovalRequest, AuditLog, utcnow
from .security import Principal, assert_permission, current_principal

ActionHandler = Callable[[Session, Any, Principal, dict[str, Any]], None]
Enricher = Callable[[Session, Any, dict[str, Any]], dict[str, Any]]


def to_jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def serialize_model(obj: Base) -> dict[str, Any]:
    return {
        column.key: to_jsonable(getattr(obj, column.key))
        for column in obj.__table__.columns  # type: ignore[attr-defined]
    }


def serialize_audit(entry: AuditLog) -> dict[str, Any]:
    data = serialize_model(entry)
    data["changes"] = diff(entry.before, entry.after)
    return data


@dataclass
class ResourceBinding:
    """Binds a tool's SQLAlchemy model to its declarative config."""

    model: type[Base]
    handlers: dict[str, ActionHandler] = field(default_factory=dict)
    enrich: Enricher | None = None
    connectors: list[Connector] = field(default_factory=list)


class ActionRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""


class DecisionRequest(BaseModel):
    decision: str
    comment: str = ""


class ResourceService:
    def __init__(self, config: ToolConfig, binding: ResourceBinding) -> None:
        self.config = config
        self.binding = binding
        self.model = binding.model
        self.entity_type = config.entity.name

    # -- serialization ---------------------------------------------------

    def serialize(self, db: Session, obj: Base) -> dict[str, Any]:
        data = serialize_model(obj)
        if self.binding.enrich is not None:
            data = self.binding.enrich(db, obj, data)
        return data

    # -- retrieval --------------------------------------------------------

    def get_or_404(self, db: Session, entity_id: str) -> Base:
        obj = db.get(self.model, entity_id)
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{self.entity_type} not found")
        return obj

    def _list(
        self, db: Session, *, filters: dict[str, str], search: str | None,
        sort: str | None, direction: str, page: int, page_size: int,
    ) -> tuple[list[Base], int, dict[int, dict[str, Any]] | None]:
        stmt = select(self.model)
        columns = self.model.__table__.columns  # type: ignore[attr-defined]
        filter_specs = [
            spec for spec in self.config.list_view.filters
            if filters.get(spec.field) not in (None, "")
        ]

        for spec in filter_specs:
            column = columns.get(spec.field)
            if column is None:
                continue
            value = filters[spec.field]
            if spec.kind == "boolean":
                stmt = stmt.where(column.is_(value.lower() in ("1", "true", "yes")))
            elif spec.kind == "select":
                stmt = stmt.where(column == value)
            else:
                stmt = stmt.where(cast(column, String).ilike(f"%{value}%"))

        if search:
            searchable = [
                columns[name]
                for name in self.config.list_view.columns
                if name in columns and isinstance(columns[name].type, (String, Text))
            ]
            if searchable:
                stmt = stmt.where(or_(*[c.ilike(f"%{search}%") for c in searchable]))

        sort_field = sort or (
            self.config.list_view.default_sort.field if self.config.list_view.default_sort else None
        )
        sort_dir = direction or (
            self.config.list_view.default_sort.direction if self.config.list_view.default_sort else "desc"
        )
        derived = {
            spec.field for spec in filter_specs if columns.get(spec.field) is None
        }
        if sort_field and columns.get(sort_field) is None:
            derived.add(sort_field)

        if not derived:
            total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
            if sort_field and sort_field in columns:
                column = columns[sort_field]
                stmt = stmt.order_by(column.desc() if sort_dir == "desc" else column.asc())

            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            return list(db.scalars(stmt)), int(total), None

        rows = list(db.scalars(stmt))
        serialized = {id(obj): self.serialize(db, obj) for obj in rows}

        def matches_filter(spec: Any, data: dict[str, Any]) -> bool:
            value = filters[spec.field]
            actual = data.get(spec.field)
            if spec.kind == "boolean":
                return bool(actual) == (value.lower() in ("1", "true", "yes"))
            if spec.kind == "select":
                return actual == value
            return value.lower() in str(actual if actual is not None else "").lower()

        rows = [
            obj for obj in rows
            if all(matches_filter(spec, serialized[id(obj)]) for spec in filter_specs)
        ]
        if search:
            needle = search.lower()
            rows = [
                obj for obj in rows
                if any(
                    needle in str(serialized[id(obj)].get(name, "")).lower()
                    for name in self.config.list_view.columns
                )
            ]

        if sort_field:
            non_null = [obj for obj in rows if serialized[id(obj)].get(sort_field) is not None]
            nulls = [obj for obj in rows if serialized[id(obj)].get(sort_field) is None]
            non_null.sort(
                key=lambda obj: serialized[id(obj)].get(sort_field),
                reverse=sort_dir == "desc",
            )
            rows = non_null + nulls

        total = len(rows)
        start = (page - 1) * page_size
        rows = rows[start : start + page_size]
        return rows, total, {id(obj): serialized[id(obj)] for obj in rows}

    def list_serialized(
        self, db: Session, *, filters: dict[str, str], search: str | None,
        sort: str | None, direction: str, page: int, page_size: int,
    ) -> tuple[list[dict[str, Any]], int]:
        rows, total, serialized = self._list(
            db, filters=filters, search=search, sort=sort,
            direction=direction, page=page, page_size=page_size,
        )
        if serialized is None:
            serialized = {id(obj): self.serialize(db, obj) for obj in rows}
        return [serialized[id(obj)] for obj in rows], total

    # -- actions ----------------------------------------------------------

    def apply_action(
        self, db: Session, obj: Base, action: ActionSpec, actor: Principal,
        payload: dict[str, Any], *, via_approval: str | None = None,
    ) -> dict[str, Any]:
        before = serialize_model(obj)
        handler = self.binding.handlers.get(action.key)
        if handler is not None:
            handler(db, obj, actor, payload)
        else:
            self.default_handler(obj, action, payload)
        db.flush()
        after = serialize_model(obj)
        record_audit(
            db,
            tool=self.config.key,
            actor=actor,
            action=f"action:{action.key}",
            entity_type=self.entity_type,
            entity_id=str(getattr(obj, self.config.entity.id_field)),
            before=before,
            after=after,
            context={"payload": payload, "approval_id": via_approval},
        )
        return after

    def default_handler(self, obj: Base, action: ActionSpec, payload: dict[str, Any]) -> None:
        """Declarative behaviour: write editable fields and/or set the status field."""
        changed = False
        for name in action.fields:
            spec = self.config.field(name)
            if spec is None or not spec.editable:
                raise HTTPException(status_code=400, detail=f"field not editable: {name}")
            if name in payload:
                setattr(obj, name, payload[name])
                changed = True
        if action.sets_status and self.config.entity.status_field:
            setattr(obj, self.config.entity.status_field, action.sets_status)
            changed = True
        if changed and "updated_at" in obj.__table__.columns:  # type: ignore[attr-defined]
            setattr(obj, "updated_at", utcnow())

    def perform(
        self, db: Session, entity_id: str, action_key: str, actor: Principal, body: ActionRequest,
    ) -> dict[str, Any]:
        action = self.config.action(action_key)
        if action is None:
            raise HTTPException(status_code=404, detail=f"unknown action: {action_key}")
        assert_permission(actor, action.permission)
        obj = self.get_or_404(db, entity_id)
        snapshot = self.serialize(db, obj)
        proposed = {**snapshot, **body.payload}

        if (
            approvals_engine.approval_required(action.approval, snapshot)
            or approvals_engine.approval_required(action.approval, proposed)
        ):
            request = approvals_engine.request_approval(
                db,
                tool=self.config.key,
                action=action,
                entity_type=self.entity_type,
                entity_id=entity_id,
                requester=actor,
                reason=body.reason,
                payload=body.payload,
            )
            return {
                "status": "pending_approval",
                "approval": serialize_model(request),
                "entity": self.serialize(db, obj),
            }

        self.apply_action(db, obj, action, actor, body.payload)
        return {"status": "applied", "entity": self.serialize(db, obj)}

    def decide(
        self, db: Session, approval_id: str, actor: Principal, body: DecisionRequest,
    ) -> dict[str, Any]:
        request = approvals_engine.decide(
            db, approval_id=approval_id, approver=actor,
            decision=body.decision, comment=body.comment, tool=self.config.key,
        )
        entity: dict[str, Any] | None = None
        if request.status == approvals_engine.APPROVED:
            action = self.config.action(request.action_key)
            obj = self.get_or_404(db, request.entity_id)
            if action is not None:
                self.apply_action(
                    db, obj, action, actor, request.payload or {}, via_approval=request.id,
                )
            entity = self.serialize(db, obj)
        return {"approval": serialize_model(request), "entity": entity}


def build_resource_router(config: ToolConfig, binding: ResourceBinding) -> APIRouter:
    service = ResourceService(config, binding)
    router = APIRouter()
    prefix = config.api.resource_path.rstrip("/")
    read_permission = f"{config.key}:read"

    def reader(principal: Principal = Depends(current_principal)) -> Principal:
        assert_permission(principal, read_permission)
        return principal

    @router.get(prefix)
    def list_items(
        request: Request,
        db: Session = Depends(get_db),
        _: Principal = Depends(reader),
        search: str | None = None,
        sort: str | None = None,
        direction: str = Query(default="", pattern="^(asc|desc|)$"),
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=config.list_view.page_size, ge=1, le=200),
    ) -> dict[str, Any]:
        filters = {k: v for k, v in request.query_params.items()}
        items, total = service.list_serialized(
            db, filters=filters, search=search, sort=sort,
            direction=direction, page=page, page_size=page_size,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    @router.get(prefix + "/{entity_id}")
    def get_item(
        entity_id: str, db: Session = Depends(get_db), _: Principal = Depends(reader),
    ) -> dict[str, Any]:
        return service.serialize(db, service.get_or_404(db, entity_id))

    @router.get(prefix + "/{entity_id}/audit")
    def get_audit(
        entity_id: str, db: Session = Depends(get_db), _: Principal = Depends(reader),
    ) -> list[dict[str, Any]]:
        entries = entity_audit_trail(
            db, tool=config.key, entity_type=service.entity_type, entity_id=entity_id,
        )
        return [serialize_audit(e) for e in entries]

    @router.get(prefix + "/{entity_id}/approvals")
    def get_entity_approvals(
        entity_id: str, db: Session = Depends(get_db), _: Principal = Depends(reader),
    ) -> list[dict[str, Any]]:
        return [
            serialize_model(a)
            for a in approvals_engine.pending_for_entity(
                db, tool=config.key, entity_type=service.entity_type, entity_id=entity_id,
            )
        ]

    @router.post(prefix + "/{entity_id}/actions/{action_key}")
    def perform_action(
        entity_id: str,
        action_key: str,
        body: ActionRequest,
        db: Session = Depends(get_db),
        principal: Principal = Depends(current_principal),
    ) -> dict[str, Any]:
        return service.perform(db, entity_id, action_key, principal, body)

    @router.get("/approvals")
    def list_approvals(
        status: str | None = "pending",
        db: Session = Depends(get_db),
        _: Principal = Depends(reader),
    ) -> list[dict[str, Any]]:
        return [
            serialize_model(a)
            for a in approvals_engine.list_approvals(db, tool=config.key, status_filter=status)
        ]

    @router.post("/approvals/{approval_id}/decision")
    def decide_approval(
        approval_id: str,
        body: DecisionRequest,
        db: Session = Depends(get_db),
        principal: Principal = Depends(current_principal),
    ) -> dict[str, Any]:
        return service.decide(db, approval_id, principal, body)

    return router


def add_cors(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def create_tool_app(config: ToolConfig, binding: ResourceBinding) -> FastAPI:
    app = FastAPI(title=config.name, version="0.1.0")
    add_cors(app)

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {
            "status": "ok",
            "tool": config.key,
            "connectors": [c.health() for c in binding.connectors],
        }

    @app.get("/config")
    def get_config() -> dict[str, Any]:
        return config.model_dump(by_alias=True)

    @app.get("/me")
    def me(principal: Principal = Depends(current_principal)) -> Principal:
        return principal

    app.include_router(build_resource_router(config, binding))
    return app
