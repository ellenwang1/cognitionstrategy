from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from platform_core.api import add_cors
from platform_core.db import get_db
from platform_core.models import RolePermission, User
from platform_core.security import Principal, current_principal, issue_token, jwt_issuer
from sqlalchemy import select
from sqlalchemy.orm import Session

app = FastAPI(title="Mock OIDC Identity Service", version="0.1.0")
authorization_codes: dict[str, tuple[str, datetime]] = {}
add_cors(app)


def principal_for_user(db: Session, user: User) -> Principal:
    roles = [link.role_key for link in user.roles]
    permissions = list(
        db.scalars(select(RolePermission.permission).where(RolePermission.role_key.in_(roles)))
    )
    return Principal(
        id=user.id,
        email=user.email,
        name=user.name,
        roles=roles,
        permissions=permissions,
    )


@app.get("/.well-known/openid-configuration")
def openid_configuration() -> dict[str, object]:
    issuer = jwt_issuer()
    return {
        "issuer": issuer,
        "token_endpoint": f"{issuer}/token",
        "userinfo_endpoint": f"{issuer}/userinfo",
        "authorization_endpoint": f"{issuer}/authorize",
        "grant_types_supported": ["password", "authorization_code"],
    }


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "auth"}


@app.get("/users")
def users(db: Session = Depends(get_db)) -> list[dict[str, object]]:
    return [
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "roles": [link.role_key for link in user.roles],
        }
        for user in db.scalars(select(User).order_by(User.email))
        if user.active
    ]


@app.post("/token")
async def token(request: Request, db: Session = Depends(get_db)) -> dict[str, object]:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            values = await request.json()
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="invalid JSON") from exc
    else:
        values = dict(await request.form())
    grant_type = values.get("grant_type", "password")
    if grant_type not in ("password", "authorization_code"):
        raise HTTPException(status_code=400, detail="unsupported grant_type")
    if grant_type == "authorization_code":
        code = str(values.get("code", ""))
        grant = authorization_codes.pop(code, None)
        if grant is None or grant[1] <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="invalid authorization code")
        email = grant[0]
    else:
        email = values.get("username")
        if not email:
            raise HTTPException(status_code=400, detail="username is required")
    user = db.scalar(select(User).where(User.email == str(email), User.active.is_(True)))
    if user is None:
        raise HTTPException(status_code=401, detail="invalid credentials")
    if grant_type == "password" and values.get("password") != user.password:
        raise HTTPException(status_code=401, detail="invalid credentials")
    principal = principal_for_user(db, user)
    access_token = issue_token(principal)
    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 12 * 60 * 60,
        "id_token": access_token,
    }


@app.get("/authorize")
def authorize(
    redirect_uri: str,
    username: str,
    password: str,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> object:
    user = db.scalar(select(User).where(User.email == username, User.active.is_(True)))
    if user is None or password != user.password:
        raise HTTPException(status_code=401, detail="invalid credentials")
    code = secrets.token_urlsafe(24)
    authorization_codes[code] = (
        user.email,
        datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    query = {"code": code}
    if state is not None:
        query["state"] = state
    parsed = urlparse(redirect_uri)
    existing = dict(parse_qsl(parsed.query))
    existing.update(query)
    location = urlunparse(parsed._replace(query=urlencode(existing)))
    return RedirectResponse(url=location, status_code=302)


@app.get("/userinfo")
def userinfo(principal: Principal = Depends(current_principal)) -> Principal:
    return principal
