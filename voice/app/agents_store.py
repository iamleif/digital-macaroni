"""
Client agents and onboarding links, kept as one JSON file each: in Cloud Storage (AGENTS_BUCKET,
no expiry) or, locally, a folder (AGENTS_DIR). Agents are loaded into memory at start-up and every
change is written through, so a call to a client's number never waits on storage.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Literal, Optional
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field

from . import log
from .config import config


class Owner(BaseModel):
    name: str = ""
    email: str = ""
    mobile: str = ""


class ClientAgent(BaseModel):
    id: str
    status: Literal["live", "paused"] = "live"
    number: str
    business_name: str
    agent_name: str = "Ava"
    voice: str = "Sulafat"
    profile: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""
    never_say: str = ""
    owner: Owner = Field(default_factory=Owner)
    plan: str = ""
    invite_id: str = ""
    created_at: float = Field(default_factory=time.time)
    calls: int = 0
    last_call_at: float = 0


class Invite(BaseModel):
    id: str
    label: str = ""
    plan: str = ""
    created_at: float = Field(default_factory=time.time)
    expires_at: float = 0
    used_by: str = ""


# number (E.164) -> agent, and id -> agent
_by_number: dict[str, ClientAgent] = {}
_by_id: dict[str, ClientAgent] = {}


def agent_for_number(number: str) -> Optional[ClientAgent]:
    return _by_number.get(number)


def agent_by_id(agent_id: str) -> Optional[ClientAgent]:
    return _by_id.get(agent_id)


def all_agents() -> list[ClientAgent]:
    return sorted(_by_id.values(), key=lambda a: a.created_at, reverse=True)


# ---- storage ----


def _token() -> str:
    import google.auth
    import google.auth.transport.requests

    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/devstorage.read_write"])
    creds.refresh(google.auth.transport.requests.Request())
    return creds.token


async def _put(name: str, data: dict[str, Any]) -> bool:
    body = json.dumps(data, ensure_ascii=False, indent=1).encode()
    if config.agents_dir:
        path = os.path.join(config.agents_dir, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(body)
        return True
    if not config.agents_bucket:
        log.warn("agents.no_storage")
        return False
    token = await asyncio.to_thread(_token)
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"https://storage.googleapis.com/upload/storage/v1/b/{config.agents_bucket}/o?uploadType=media&name={quote(name, safe='')}",
            content=body,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if r.status_code >= 300:
        log.warn("agents.save_failed", {"outcome": r.status_code})
        return False
    return True


async def _get(name: str) -> Optional[dict[str, Any]]:
    if config.agents_dir:
        path = os.path.join(config.agents_dir, name)
        if not os.path.exists(path):
            return None
        with open(path, "rb") as f:
            return json.loads(f.read())
    if not config.agents_bucket:
        return None
    token = await asyncio.to_thread(_token)
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get(f"https://storage.googleapis.com/storage/v1/b/{config.agents_bucket}/o/{quote(name, safe='')}?alt=media", headers={"Authorization": f"Bearer {token}"})
    return r.json() if r.status_code == 200 else None


async def _list(prefix: str) -> list[dict[str, Any]]:
    if config.agents_dir:
        folder = os.path.join(config.agents_dir, prefix)
        if not os.path.isdir(folder):
            return []
        out = []
        for n in sorted(os.listdir(folder)):
            if n.endswith(".json"):
                with open(os.path.join(folder, n), "rb") as f:
                    out.append(json.loads(f.read()))
        return out
    if not config.agents_bucket:
        return []
    token = await asyncio.to_thread(_token)
    out: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.get(f"https://storage.googleapis.com/storage/v1/b/{config.agents_bucket}/o", params={"prefix": prefix}, headers={"Authorization": f"Bearer {token}"})
        names = [i["name"] for i in (r.json().get("items") or [])] if r.status_code == 200 else []
        for n in names:
            got = await http.get(f"https://storage.googleapis.com/storage/v1/b/{config.agents_bucket}/o/{quote(n, safe='')}?alt=media", headers={"Authorization": f"Bearer {token}"})
            if got.status_code == 200:
                out.append(got.json())
    return out


async def load() -> int:
    """Reads every client agent into memory. Called once at start-up."""
    try:
        for data in await _list("agents/"):
            a = ClientAgent.model_validate(data)
            _by_id[a.id] = a
            _by_number[a.number] = a
    except Exception as err:  # noqa: BLE001
        log.error("agents.load_failed", {}, err)
    return len(_by_id)


async def save_agent(a: ClientAgent) -> bool:
    _by_id[a.id] = a
    _by_number[a.number] = a
    return await _put(f"agents/{a.id}.json", a.model_dump())


def new_agent_id() -> str:
    return "ag_" + secrets.token_hex(5)


# ---- onboarding links ----

INVITE_DAYS = 14


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _sign(payload: str) -> str:
    return _b64(hmac.new(config.admin_token.encode(), payload.encode(), hashlib.sha256).digest())[:32]


def invite_token(inv: Invite) -> str:
    payload = _b64(json.dumps({"i": inv.id, "e": int(inv.expires_at)}).encode())
    return f"{payload}.{_sign(payload)}"


def read_invite_token(token: str) -> Optional[tuple[str, float]]:
    """(invite id, expiry) from a token whose signature checks out, else None. Expiry is checked by the caller."""
    if not config.admin_token or "." not in (token or ""):
        return None
    payload, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return str(data["i"]), float(data["e"])
    except (ValueError, KeyError, TypeError):
        return None


async def create_invite(label: str, plan: str) -> tuple[Invite, str]:
    inv = Invite(id="inv_" + secrets.token_hex(5), label=label[:120], plan=plan[:40], expires_at=time.time() + INVITE_DAYS * 86400)
    await _put(f"invites/{inv.id}.json", inv.model_dump())
    return inv, invite_token(inv)


async def get_invite(invite_id: str) -> Optional[Invite]:
    data = await _get(f"invites/{invite_id}.json")
    return Invite.model_validate(data) if data else None


async def save_invite(inv: Invite) -> bool:
    return await _put(f"invites/{inv.id}.json", inv.model_dump())


async def all_invites() -> list[Invite]:
    return sorted((Invite.model_validate(d) for d in await _list("invites/")), key=lambda i: i.created_at, reverse=True)


def invite_url(token: str) -> str:
    return f"{config.site_url}/start/?invite={token}"
