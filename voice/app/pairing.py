"""
Linking a phone call to a browser that wants to watch it. The page asks for a short code and
shows it; the caller types it on the keypad (or reads it to the agent). Only then does that page
receive the call's events. Codes are single-use, short-lived, scoped to one demo, and never
matched by caller ID. A call gets a few attempts before further codes are ignored.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from typing import Callable, Optional

from .session import DemoSession

CODE_TTL_MS = 10 * 60_000
MAX_ATTEMPTS_PER_CALL = 5


def now_ms() -> int:
    return int(time.time() * 1000)


@dataclass
class Pairing:
    code: str
    viewer_token: str
    demo: str
    expires_at: int
    session: Optional[DemoSession] = None
    # The viewer's socket hook: called once the call is linked.
    on_linked: Optional[Callable[[DemoSession], None]] = None


_by_code: dict[str, Pairing] = {}
_by_token: dict[str, Pairing] = {}


def _sweep() -> None:
    now = now_ms()
    for p in list(_by_token.values()):
        if p.expires_at < now and not p.session:
            _by_code.pop(p.code, None)
            _by_token.pop(p.viewer_token, None)


def create_pairing(demo: str) -> Pairing:
    _sweep()
    code = str(secrets.randbelow(9000) + 1000)
    while code in _by_code:
        code = str(secrets.randbelow(9000) + 1000)
    p = Pairing(code=code, viewer_token=secrets.token_urlsafe(18), demo=demo, expires_at=now_ms() + CODE_TTL_MS)
    _by_code[code] = p
    _by_token[p.viewer_token] = p
    return p


def pairing_for_viewer(token: Optional[str]) -> Optional[Pairing]:
    return _by_token.get(token) if token else None


def link_call(code: str, session: DemoSession) -> str:
    """Links a phone session to the pairing with this code. The code stops working once used."""
    _sweep()
    p = _by_code.get(code)
    if not p or p.expires_at < now_ms():
        return "not_found"
    if p.demo != session.demo_id:
        return "wrong_demo"
    if p.session:
        return "already_linked"
    p.session = session
    _by_code.pop(code, None)
    if p.on_linked:
        p.on_linked(session)
    return "linked"


def drop_pairing(p: Pairing) -> None:
    _by_code.pop(p.code, None)
    _by_token.pop(p.viewer_token, None)
