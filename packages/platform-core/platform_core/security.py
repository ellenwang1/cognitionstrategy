"""Mocked-but-realistic identity: JWT-like sessions, roles and permission gates."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

JWT_ALGORITHM = "HS256"
DEFAULT_TTL_MINUTES = 12 * 60


def jwt_secret() -> str:
    secret = os.environ.get("PLATFORM_JWT_SECRET", "dev-only-not-a-real-secret")
    if os.environ.get("PLATFORM_ENV", "dev") != "dev" and secret == "dev-only-not-a-real-secret":
        raise RuntimeError("PLATFORM_JWT_SECRET must be set outside dev")
    return secret


def jwt_issuer() -> str:
    return os.environ.get("PLATFORM_JWT_ISSUER", "http://localhost:8000")


class Principal(BaseModel):
    """The authenticated caller, as resolved from the bearer token."""

    id: str
    email: str
    name: str
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)

    def has_permission(self, permission: str) -> bool:
        if "*" in self.permissions:
            return True
        if permission in self.permissions:
            return True
        # wildcard grants such as "refunds:*"
        prefix = permission.split(":", 1)[0]
        return f"{prefix}:*" in self.permissions


def issue_token(principal: Principal, ttl_minutes: int = DEFAULT_TTL_MINUTES) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "iss": jwt_issuer(),
        "sub": principal.id,
        "email": principal.email,
        "name": principal.name,
        "roles": principal.roles,
        "permissions": principal.permissions,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
    }
    return jwt.encode(claims, jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Principal:
    try:
        claims = jwt.decode(
            token,
            jwt_secret(),
            algorithms=[JWT_ALGORITHM],
            issuer=jwt_issuer(),
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {exc}"
        ) from exc
    return Principal(
        id=claims["sub"],
        email=claims.get("email", ""),
        name=claims.get("name", ""),
        roles=claims.get("roles", []),
        permissions=claims.get("permissions", []),
    )


def current_principal(request: Request) -> Principal:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token"
        )
    return decode_token(header.split(" ", 1)[1].strip())


def require_permission(permission: str):
    """FastAPI dependency factory gating a route on a single permission."""

    def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if not principal.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"missing permission: {permission}",
            )
        return principal

    return dependency


def assert_permission(principal: Principal, permission: str) -> None:
    if not principal.has_permission(permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=f"missing permission: {permission}"
        )
