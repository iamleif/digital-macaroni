"""
Digital Macaroni demo voice service. Each demo number reaches its own agent; every call gets its
own session with isolated sample records. Browser conversations and phone pairing are served by
the same process (single instance: sessions live in memory).
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, Request, Response, WebSocket
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketDisconnect

from . import log
from .browser import bridge_browser
from .config import config
from .demos import is_demo_id
from .live import warm_up
from .pairing import create_pairing, drop_pairing, now_ms, pairing_for_viewer
from .phone import bridge_phone
from .session import DemoSession, active_count, admit, get_session, sweeper
from .twilio import hangup_twiml, notice_twiml, reject_twiml, stream_twiml, valid_media_signature, valid_twilio_signature

E164 = re.compile(r"^\+[1-9][0-9]{6,14}$")


async def _warm_loop() -> None:
    # Keep the model connection warm so the first visitor after a quiet spell is not the slow one.
    while True:
        log.info("live.warmed", {"latency_ms": await warm_up()})
        await asyncio.sleep(4 * 60)


async def _forget_starts() -> None:
    while True:
        await asyncio.sleep(60)
        now = time.monotonic()
        for ip in [ip for ip, times in _starts.items() if all(now - t > 600 for t in times)]:
            _starts.pop(ip, None)


async def _warm_phrases() -> None:
    # Fixed lines of the cascade demos (openings, holding lines, goodbye) play instantly once cached.
    from .cascade import warm_phrases

    started = time.monotonic()
    log.info("cascade.phrases_ready", {"count": await warm_phrases(), "latency_ms": int((time.monotonic() - started) * 1000)})


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not config.gemini_api_key:
        log.error("config.missing_gemini_key")
    if not config.twilio_auth_token and not config.skip_twilio_signature:
        log.error("config.missing_twilio_token")
    tasks = [asyncio.create_task(sweeper()), asyncio.create_task(_forget_starts())]
    if config.gemini_api_key:
        tasks.append(asyncio.create_task(_warm_loop()))
        tasks.append(asyncio.create_task(_warm_phrases()))
    log.info("service.started", {"model": config.model, "enabled": config.enabled, "max_concurrent": config.max_concurrent, "runtime": "python-adk"})
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
# Logos for the demo emails (email clients load them from here).
app.mount("/email-assets", StaticFiles(directory=str(Path(__file__).parent / "email_assets")), name="email-assets")


def xml(body: str) -> Response:
    return Response(content=body, media_type="text/xml")


def signed(path: str, params: dict[str, str], signature: Optional[str]) -> bool:
    return config.skip_twilio_signature or valid_twilio_signature(config.twilio_auth_token, f"{config.public_url}{path}", params, signature)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "enabled": config.enabled, "active": active_count()}


@app.post("/twilio/voice")
async def twilio_voice(request: Request) -> Response:
    params = {k: str(v) for k, v in (await request.form()).items()}
    if not signed("/twilio/voice", params, request.headers.get("x-twilio-signature")):
        log.warn("twilio.bad_signature", {"route": "voice"})
        return Response(status_code=403)
    demo = config.numbers.get(params.get("To", ""))
    if not demo:
        log.warn("twilio.unrouted_number")
        return xml(reject_twiml())
    session, refused = admit(demo, "phone")
    if session is None:
        notice = (
            "Thanks for calling Digital Macaroni's demo line. The demo is paused right now. Please try again later."
            if refused == "disabled"
            else "Thanks for calling Digital Macaroni's demo line. All of our demo agents are busy right now. Please try again in a few minutes, or talk to the agent on our website."
        )
        return xml(notice_twiml(notice))
    caller = params.get("From", "")
    session.caller_number = caller if E164.match(caller) else None
    log.info("twilio.call_answered", {"session": session.id, "demo": demo, "caller_id": bool(session.caller_number)})
    stream_url = "ws" + config.public_url[4:] + "/twilio/media" if config.public_url.startswith("http") else config.public_url + "/twilio/media"
    after = f"{config.public_url}/twilio/after-stream?session={session.id}"
    return xml(stream_twiml(stream_url, {"sessionId": session.id}, after))


@app.post("/twilio/after-stream")
async def twilio_after_stream(request: Request, session: str = "") -> Response:
    """The stream has ended. If the agent never started (its engine was unavailable), say so politely."""
    params = {k: str(v) for k, v in (await request.form()).items()}
    if not signed(f"/twilio/after-stream?session={session}", params, request.headers.get("x-twilio-signature")):
        log.warn("twilio.bad_signature", {"route": "after-stream"})
        return Response(status_code=403)
    s = get_session(session)
    if s and not s.live_started:
        log.warn("twilio.agent_unavailable", {"session": s.id, "demo": s.demo_id})
        return xml(notice_twiml("Sorry, this demo isn't available right now. Please try again a little later, or try it on our website."))
    return xml(hangup_twiml())


@app.websocket("/twilio/media")
async def twilio_media(ws: WebSocket) -> None:
    # Twilio signs the WebSocket handshake too; anything unsigned is closed before a model session opens.
    if not config.skip_twilio_signature and not valid_media_signature(config.twilio_auth_token, config.public_url, ws.headers.get("x-twilio-signature")):
        log.warn("twilio.bad_signature", {"route": "media"})
        await ws.close(code=1008)
        return
    await ws.accept()
    await bridge_phone(ws)


# ---- Website: browser conversations and watching a phone call ----


def allowed_origin(origin: Optional[str]) -> bool:
    return origin is not None and origin in config.allowed_origins


@app.middleware("http")
async def cors(request: Request, call_next):
    path = request.url.path
    if not (path.startswith("/browser/") or path.startswith("/pairings")):
        return await call_next(request)
    origin = request.headers.get("origin")
    response = Response(status_code=204) if request.method == "OPTIONS" else await call_next(request)
    if allowed_origin(origin):
        response.headers["access-control-allow-origin"] = origin  # type: ignore[assignment]
        response.headers["vary"] = "origin"
        response.headers["access-control-allow-methods"] = "POST, OPTIONS"
        response.headers["access-control-allow-headers"] = "content-type"
    return response


# Per-visitor limits on starting paid sessions; a single instance, so in-memory is the real limit.
_starts: dict[str, list[float]] = {}


def allow_start(key: str, limit: int) -> bool:
    now = time.monotonic()
    recent = [t for t in _starts.get(key, []) if now - t < 600]
    if len(recent) >= limit:
        _starts[key] = recent
        return False
    recent.append(now)
    _starts[key] = recent
    return True


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _demo_from_body(request: Request) -> Optional[str]:
    try:
        body = await request.json()
    except (ValueError, json.JSONDecodeError):
        return None
    demo = body.get("demo") if isinstance(body, dict) else None
    return demo if is_demo_id(demo) else None


@app.post("/browser/sessions")
async def browser_sessions(request: Request) -> JSONResponse:
    if not allowed_origin(request.headers.get("origin")):
        return JSONResponse({"error": "origin"}, status_code=403)
    demo = await _demo_from_body(request)
    if not demo:
        return JSONResponse({"error": "demo"}, status_code=400)
    if not allow_start(f"talk:{client_ip(request)}", 6):
        return JSONResponse({"error": "rate_limited", "message": "You have started several demos in a short time. Please wait a few minutes."}, status_code=429)
    session, refused = admit(demo, "browser")
    if session is None:
        message = "Our demo agents are all busy. Please try again in a minute or two." if refused == "busy" else "The demo is paused right now."
        return JSONResponse({"error": refused, "message": message}, status_code=503)
    return JSONResponse({"sessionId": session.id, "token": session.token, "maxSeconds": config.max_session_seconds})


@app.websocket("/browser/sessions/{sid}")
async def browser_socket(ws: WebSocket, sid: str, token: str = "") -> None:
    session = get_session(sid)
    if not allowed_origin(ws.headers.get("origin")) or not session or session.channel != "browser" or session.token != token or session.connected or session.ended:
        await ws.accept()
        await ws.close(1008)
        return
    await bridge_browser(ws, session)


@app.post("/pairings")
async def pairings(request: Request) -> JSONResponse:
    if not allowed_origin(request.headers.get("origin")):
        return JSONResponse({"error": "origin"}, status_code=403)
    demo = await _demo_from_body(request)
    if not demo:
        return JSONResponse({"error": "demo"}, status_code=400)
    if not allow_start(f"pair:{client_ip(request)}", 20):
        return JSONResponse({"error": "rate_limited"}, status_code=429)
    p = create_pairing(demo)
    return JSONResponse({"code": p.code, "viewerToken": p.viewer_token, "expiresAt": p.expires_at})


@app.websocket("/pairings/{token}")
async def pairing_socket(ws: WebSocket, token: str) -> None:
    """A page watching a phone call: waits for the code, then receives that call's events (never audio)."""
    p = pairing_for_viewer(token)
    await ws.accept()
    if not allowed_origin(ws.headers.get("origin")) or not p:
        await ws.close(1008)
        return
    out: asyncio.Queue[Optional[str]] = asyncio.Queue()
    unsubscribe = lambda: None  # noqa: E731

    def send(e: dict[str, Any]) -> None:
        out.put_nowait(json.dumps(e))

    def attach(session: DemoSession) -> None:
        nonlocal unsubscribe
        send({"type": "pairing.linked"})
        for e in session.snapshot():
            send(e)
        unsubscribe = session.subscribe(lambda e: e["type"] != "audio" and send(e))

    async def writer() -> None:
        while True:
            item = await out.get()
            if item is None:
                await ws.close(1000)
                return
            await ws.send_text(item)

    expiry: Optional[asyncio.TimerHandle] = None
    if p.session:
        attach(p.session)
    else:
        send({"type": "pairing.waiting", "code": p.code, "expiresAt": p.expires_at})
        p.on_linked = attach

        def expire() -> None:
            if not p.session:
                send({"type": "pairing.expired"})
                out.put_nowait(None)

        expiry = asyncio.get_running_loop().call_later(max(0, p.expires_at - now_ms()) / 1000, expire)
    w = asyncio.create_task(writer())
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        if expiry:
            expiry.cancel()
        unsubscribe()
        if not p.session:
            drop_pairing(p)
        w.cancel()
