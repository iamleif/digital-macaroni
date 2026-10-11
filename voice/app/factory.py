"""
The agent factory: the generic agent (demos/agent) put to work three ways.

1. Instant demo call. A prospect gives their first name, mobile and website on digitalmacaroni.io;
   we read the site, and the agent rings them within seconds. They play a customer of their own
   business. Afterwards they get the summary the owner would get, and Leif gets the lead.
2. Self-serve setup. A signed onboarding link (Macaroni OS makes it) opens a form; the agent is built
   from the client's website and answers, a local number is bought and pointed here, and the client
   is told it's live with their number and forwarding steps.
3. One post-call pipeline. Every call on the generic agent ends the same way: Gemini writes the
   summary from the transcript and tool results, and the owner gets it by text and email.

Jobs (an instant call or a setup in progress) live in memory, like sessions: the service is a
single instance, and a page polls the job while it runs.
"""

from __future__ import annotations

import asyncio
import html
import json
import re
import secrets
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from . import agents_store, log, twilio_api
from .agents_store import ClientAgent, Owner
from .config import config
from .demos.agent import AgentState
from .profile import Profile, build_profile, fallback_profile, normalise_url
from .session import DemoSession, admit
from .twilio import stream_twiml

VOICES = {"female": ("Ava", "Sulafat"), "male": ("Leo", "Iapetus")}
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I)


@dataclass
class Job:
    id: str
    kind: str  # "instant" or "onboard"
    step: str = "reading"
    business: str = ""
    error: str = ""
    message: str = ""
    session_id: str = ""
    # Onboarding: what the finished page shows.
    number: str = ""
    agent_name: str = ""
    created: float = field(default_factory=time.monotonic)
    # Instant: who asked (held in memory for the lead email, never logged).
    lead: dict[str, str] = field(default_factory=dict)
    profile: Optional[Profile] = None
    lead_sent: bool = False

    def public(self) -> dict[str, Any]:
        out: dict[str, Any] = {"job": self.id, "step": self.step, "business": self.business}
        if self.error:
            out["error"] = self.error
        if self.message:
            out["message"] = self.message
        if self.number:
            out["number"] = self.number
            out["numberPretty"] = twilio_api.pretty(self.number)
            out["agentName"] = self.agent_name
        return out


jobs: dict[str, Job] = {}
JOB_TTL_S = 2 * 3600


def get_job(job_id: str) -> Optional[Job]:
    return jobs.get(job_id)


def _new_job(kind: str) -> Job:
    now = time.monotonic()
    for k in [k for k, j in jobs.items() if now - j.created > JOB_TTL_S]:
        jobs.pop(k, None)
    j = Job(id=secrets.token_urlsafe(12), kind=kind)
    jobs[j.id] = j
    return j


# ---- limits for the public instant demo ----

_tries: dict[str, list[float]] = {}


def _allow(key: str, limit: int, window_s: float) -> bool:
    now = time.time()
    recent = [t for t in _tries.get(key, []) if now - t < window_s]
    if len(recent) >= limit:
        _tries[key] = recent
        return False
    recent.append(now)
    _tries[key] = recent
    return True


def _clean(s: Any, n: int) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()[:n]


# ---- 1. Instant demo call ----


async def human(token: str, ip: str) -> bool:
    """Cloudflare Turnstile's verdict on the form's "Verify you are human" token. Passes when no secret is set."""
    if not config.turnstile_secret:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={"secret": config.turnstile_secret, "response": token, "remoteip": ip})
        return bool(r.json().get("success"))
    except (httpx.HTTPError, ValueError) as err:
        log.warn("factory.turnstile_failed", {}, err)
        return False


def start_instant(body: dict[str, Any], ip: str) -> tuple[Optional[Job], Optional[tuple[int, str, str]]]:
    """Validates the form and starts the job. Returns the job, or (status, error, message)."""
    if body.get("company"):  # the honeypot
        return None, (400, "invalid", "Something went wrong. Please try again.")
    if not isinstance(body.get("elapsedMs"), (int, float)) or body["elapsedMs"] < 3000:
        return None, (400, "too_fast", "Please take a moment to check your details, then try again.")
    name = _clean(body.get("name"), 40).split(" ")[0]
    number = twilio_api.nanp_number(str(body.get("phone") or ""))
    website = normalise_url(str(body.get("website") or ""))
    email = _clean(body.get("email"), 120)
    if not name:
        return None, (400, "name", "Please add your first name.")
    if not number:
        return None, (400, "phone", "Please use a US or Canadian mobile number.")
    if not website:
        return None, (400, "website", "That website address doesn't look right.")
    if email and not _EMAIL.match(email):
        return None, (400, "email", "That email address doesn't look right.")
    if body.get("consent") is not True:
        return None, (400, "consent", "Please tick the box so we can call you.")
    if not config.enabled:
        return None, (503, "disabled", "The demo is paused right now. Please try again later.")
    if not twilio_api.configured():
        return None, (503, "not_configured", "Instant calls aren't available right now.")
    if not _allow(f"ip:{ip}", 3, 3600) or not _allow(f"num:{number}", 2, 86400):
        return None, (429, "rate_limited", "You've tried this a few times already. Please try again later, or get in touch.")
    if not _allow("all", 30, 3600):
        return None, (429, "busy", "Lots of people are trying this right now. Please try again in a few minutes.")
    j = _new_job("instant")
    j.lead = {"name": name, "phone": number, "website": website, "email": email}
    asyncio.get_running_loop().create_task(_run_instant(j))
    log.info("factory.instant_started", {"outcome": j.id[:6]})
    return j, None


async def _run_instant(j: Job) -> None:
    lead = j.lead
    try:
        profile = await build_profile(lead["website"]) or fallback_profile(lead["website"])
        j.profile = profile
        j.business = profile.business_name
        session, refused = admit("agent", "phone")
        if session is None:
            j.step, j.error = "failed", refused or "busy"
            j.message = "All our agents are busy right now. Please try again in a minute or two."
            return
        agent_name, voice = VOICES["female"]
        session.state = AgentState(now=session.state.now, mode="instant", profile=profile.model_dump(), agent_name=agent_name, visitor_name=lead["name"], caller_number=lead["phone"])
        session.caller_number = lead["phone"]
        session.voice = voice
        session.max_override = config.instant_max_seconds
        session.after_call = lambda s: _after_instant(j, s)
        j.session_id = session.id
        j.step = "calling"
        stream_url = "ws" + config.public_url[4:] + "/twilio/media"
        twiml = stream_twiml(stream_url, {"sessionId": session.id}, f"{config.public_url}/twilio/after-stream?session={session.id}")
        sid = await twilio_api.place_call(lead["phone"], config.instant_from, twiml, f"{config.public_url}/twilio/instant-status?job={j.id}")
        if not sid:
            session.end("error")
            j.step, j.error, j.message = "failed", "call_failed", "We couldn't place the call. Please check the number and try again."
            await _send_lead(j, None)
    except Exception as err:  # noqa: BLE001
        log.error("factory.instant_failed", {}, err)
        j.step, j.error, j.message = "failed", "internal", "Something went wrong on our side. Please try again."


async def instant_status(job_id: str, call_status: str) -> None:
    """Twilio's progress reports for the instant call."""
    j = jobs.get(job_id)
    if not j or j.step in ("done", "failed", "no_answer"):
        return
    if call_status == "ringing":
        j.step = "ringing"
    elif call_status == "in-progress":
        j.step = "in_call"
    elif call_status in ("busy", "no-answer", "failed", "canceled"):
        j.step = "no_answer"
        j.message = "We couldn't reach you. Check your phone isn't on Do Not Disturb, then try again."
        from .session import get_session

        s = get_session(j.session_id)
        if s and not s.ended:
            s.end("no_answer")
        await _send_lead(j, None)
    elif call_status == "completed" and j.step not in ("summary",):
        j.step = "summary"


async def _after_instant(j: Job, s: DemoSession) -> None:
    summary = await summarise(s)
    if summary is None:
        j.step = "done"
        j.message = "The call ended before we spoke. You can try again."
        await _send_lead(j, None)
        return
    state: AgentState = s.state
    await _deliver_summary(state.business, summary, Owner(name=j.lead["name"], email=j.lead.get("email", ""), mobile=j.lead["phone"]), demo=True)
    j.step = "done"
    await _send_lead(j, summary)


# ---- 3. The post-call pipeline ----


SUMMARY_PROMPT = """You write the call summary a business owner gets by text and email after their AI phone agent takes a call. From the transcript and the agent's actions below, reply with JSON only, with exactly these keys:
"caller_name" (as the caller gave it, or ""), "reason" (what they called about, under 8 words), "summary" (two or three plain sentences: what they asked or needed, what the agent told or did for them), "action" (what the owner should do next, one short sentence, or "" if nothing), "urgent" (true only if it can't wait until the next business day).
Only state what the transcript shows. Never invent details."""


def _transcript(s: DemoSession) -> str:
    lines = []
    for e in s.record.entries:
        if e.get("kind") == "say":
            lines.append(f"{'Agent' if e['speaker'] == 'agent' else 'Caller'}: {e['text']}")
        elif e.get("kind") == "tool" and e.get("tool") not in ("get_business_info", "get_caller_number", "end_call"):
            lines.append(f"[Agent action: {e['tool']} {json.dumps(e.get('args', {}), ensure_ascii=False)} -> {'ok' if e.get('ok') else 'failed'}]")
    return "\n".join(lines)[-20000:]


async def summarise(s: DemoSession) -> Optional[dict[str, Any]]:
    """The owner's summary of a call, or None when the caller never spoke."""
    if not any(e.get("kind") == "say" and e.get("speaker") == "visitor" for e in s.record.entries):
        return None
    state: AgentState = s.state
    messages = [{"name": m.name, "callback": m.callback, "reason": m.reason, "preferredTime": m.preferred_time, "urgent": m.urgent} for m in state.messages]
    out: dict[str, Any] = {"caller_name": messages[-1]["name"] if messages else "", "reason": "", "summary": "", "action": "", "urgent": any(m["urgent"] for m in messages)}
    try:
        from google import genai
        from google.genai import types

        r = await genai.Client(api_key=config.gemini_api_key).aio.models.generate_content(
            model=config.text_model,
            contents=f"{SUMMARY_PROMPT}\n\nBUSINESS: {state.business}\n\nTRANSCRIPT:\n{_transcript(s)}",
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
        )
        data = json.loads(re.search(r"\{.*\}", r.text or "", re.S).group(0))  # type: ignore[union-attr]
        for k in ("caller_name", "reason", "summary", "action"):
            if isinstance(data.get(k), str) and data[k].strip():
                out[k] = data[k].strip()[:600]
        out["urgent"] = bool(data.get("urgent")) or out["urgent"]
    except Exception as err:  # noqa: BLE001
        log.warn("factory.summary_failed", {"session": s.id}, err)
    if not out["summary"]:
        out["summary"] = messages[-1]["reason"] if messages else "The caller spoke with the agent; no message was left."
    out["messages"] = messages
    out["caller_number"] = s.caller_number if not state.mode == "instant" else (messages[-1]["callback"] if messages else "")
    out["seconds"] = int((s.ended_at or time.monotonic()) - s.created_at)
    if config.call_log_dir:
        # Local runs: keep the summary beside the call record, to check it without sending anything.
        import os

        os.makedirs(os.path.join(config.call_log_dir, "summaries"), exist_ok=True)
        with open(os.path.join(config.call_log_dir, "summaries", f"{s.id}.json"), "w") as f:
            json.dump({"business": state.business, "text": summary_text(state.business, out, state.mode == "instant"), **out}, f, indent=1)
    return out


def summary_text(business: str, m: dict[str, Any], demo: bool = False) -> str:
    who = m.get("caller_name") or "A caller"
    number = f" · {twilio_api.pretty(m['caller_number'])}" if m.get("caller_number") else ""
    parts = [f"{'URGENT · ' if m.get('urgent') else ''}New call for {business}", f"{who}{number}"]
    if m.get("reason"):
        parts.append(m["reason"])
    parts.append(m["summary"])
    if m.get("action"):
        parts.append(f"Next: {m['action']}")
    if demo:
        parts.append("This is what you'd get after every call. Want it for real? digitalmacaroni.io/pricing/")
    return "\n".join(parts)


async def _deliver_summary(business: str, m: dict[str, Any], owner: Owner, demo: bool = False) -> None:
    sends = []
    if owner.mobile:
        sends.append(twilio_api.send_sms(owner.mobile, summary_text(business, m, demo) + ("" if demo else "\nReply STOP to opt out.")))
    if owner.email:
        subject, body, text = summary_email(business, m, demo)
        sends.append(_resend(owner.email, subject, body, text, f"{business} via Digital Macaroni" if not demo else "Digital Macaroni"))
    await asyncio.gather(*sends, return_exceptions=True)


async def after_client_call(s: DemoSession) -> None:
    a = agents_store.agent_by_id(s.agent_id or "")
    if not a:
        return
    a.calls += 1
    a.last_call_at = time.time()
    await agents_store.save_agent(a)
    summary = await summarise(s)
    if summary is not None:
        await _deliver_summary(a.business_name, summary, a.owner)
        log.info("factory.summary_sent", {"session": s.id, "outcome": a.id})


def start_client_call(a: ClientAgent, caller: Optional[str]) -> tuple[Optional[DemoSession], Optional[str]]:
    """A session for a call to a client's number."""
    session, refused = admit("agent", "phone", client=True)
    if session is None:
        return None, refused
    session.state = AgentState(now=session.state.now, mode="client", profile=a.profile, agent_name=a.agent_name, notes=a.notes, never_say=a.never_say, caller_number=caller)
    session.caller_number = caller
    session.voice = a.voice
    session.max_override = config.client_max_seconds
    session.agent_id = a.id
    session.after_call = after_client_call
    return session, None


# ---- 2. Self-serve setup ----


async def check_invite(token: str) -> tuple[Optional[agents_store.Invite], str]:
    got = agents_store.read_invite_token(token)
    if not got:
        return None, "This setup link isn't valid. Please use the link we sent you."
    invite_id, expires = got
    if time.time() > expires:
        return None, "This setup link has expired. Ask us for a new one."
    inv = await agents_store.get_invite(invite_id)
    if not inv:
        return None, "This setup link isn't valid. Please use the link we sent you."
    if inv.used_by:
        return None, "This setup link has already been used. Your agent is set up; check your email for its number."
    return inv, ""


async def start_onboard(body: dict[str, Any]) -> tuple[Optional[Job], Optional[tuple[int, str, str]]]:
    inv, why = await check_invite(str(body.get("invite") or ""))
    if not inv:
        return None, (403, "invite", why)
    business = _clean(body.get("businessName"), 100)
    website = normalise_url(str(body.get("website") or ""))
    owner_name = _clean(body.get("ownerName"), 80)
    owner_email = _clean(body.get("ownerEmail"), 120)
    owner_mobile = twilio_api.nanp_number(str(body.get("ownerMobile") or ""))
    area = re.sub(r"\D", "", str(body.get("areaCode") or ""))[:3]
    voice = body.get("voice") if body.get("voice") in VOICES else "female"
    booking = normalise_url(str(body.get("bookingUrl") or "")) if body.get("bookingUrl") else ""
    if not business:
        return None, (400, "businessName", "Please add your business name.")
    if not website:
        return None, (400, "website", "That website address doesn't look right.")
    if not owner_email or not _EMAIL.match(owner_email):
        return None, (400, "ownerEmail", "Please add the email where call summaries should go.")
    if not owner_mobile:
        return None, (400, "ownerMobile", "Please add a US or Canadian mobile for call summaries.")
    if not re.fullmatch(r"[2-9][0-9]{2}", area):
        return None, (400, "areaCode", "Please add a three-digit area code for your new number.")
    if booking is None:
        return None, (400, "bookingUrl", "That booking link doesn't look right.")
    j = _new_job("onboard")
    j.business = business
    inv.used_by = f"pending:{j.id}"
    await agents_store.save_invite(inv)
    form = {
        "business": business, "website": website, "owner": Owner(name=owner_name, email=owner_email, mobile=owner_mobile), "area": area, "voice": voice, "booking": booking,
        "hours": _clean(body.get("hours"), 300), "notes": _clean(body.get("notes"), 1500), "never": _clean(body.get("neverSay"), 600),
    }
    asyncio.get_running_loop().create_task(_run_onboard(j, inv, form))
    return j, None


async def _run_onboard(j: Job, inv: agents_store.Invite, f: dict[str, Any]) -> None:
    try:
        j.step = "reading"
        profile = await build_profile(f["website"], f["business"]) or fallback_profile(f["website"], f["business"])
        profile.business_name = f["business"]
        if f["hours"]:
            profile.hours = f["hours"]
        if f["booking"]:
            profile.booking_url = f["booking"]
        j.step = "building"
        agent_name, voice = VOICES[f["voice"]]
        j.step = "number"
        if config.provision_dry_run:
            number = config.dry_run_number or None
        else:
            number = await twilio_api.buy_local_number(f["area"], f"DM client · {f['business']}", f"{config.public_url}/twilio/voice")
        if not number:
            raise RuntimeError("no_number")
        a = ClientAgent(id=agents_store.new_agent_id(), number=number, business_name=f["business"], agent_name=agent_name, voice=voice, profile=profile.model_dump(), notes=f["notes"], never_say=f["never"], owner=f["owner"], plan=inv.plan, invite_id=inv.id)
        if not await agents_store.save_agent(a):
            raise RuntimeError("save_failed")
        inv.used_by = a.id
        await agents_store.save_invite(inv)
        j.number, j.agent_name, j.step = number, agent_name, "live"
        log.info("factory.agent_live", {"outcome": a.id})
        subject, body, text = live_email(a)
        await asyncio.gather(
            _resend(a.owner.email, subject, body, text, "Digital Macaroni"),
            twilio_api.send_sms(a.owner.mobile, f"Your AI agent for {a.business_name} is live: {twilio_api.pretty(number)}. Call it now to hear {agent_name}. Forwarding steps are in your email."),
            _resend(config.leads_email, f"New agent live · {a.business_name}", f"<p>{html.escape(a.business_name)} is live on {twilio_api.pretty(number)} ({html.escape(inv.label or inv.id)}).</p><p>Owner: {html.escape(a.owner.name)} · {html.escape(a.owner.email)} · {twilio_api.pretty(a.owner.mobile)}</p><p>Website: {html.escape(profile.website)}</p>", f"{a.business_name} is live on {number}.", "Digital Macaroni"),
            return_exceptions=True,
        )
    except Exception as err:  # noqa: BLE001
        log.error("factory.onboard_failed", {}, err)
        inv.used_by = ""
        await agents_store.save_invite(inv)
        j.step, j.error = "failed", "internal"
        j.message = "We couldn't finish setting up your number. We've been told and will email you shortly." if str(err) == "no_number" else "Something went wrong on our side. We've been told and will be in touch shortly."
        await _resend(config.leads_email, f"Agent setup FAILED · {f['business']}", f"<p>Setup failed for {html.escape(f['business'])} ({html.escape(str(err))}). Invite {inv.id} was released so the link works again.</p>", f"Setup failed for {f['business']}: {err}", "Digital Macaroni")


# ---- email ----


async def _resend(to: str, subject: str, html_body: str, text_body: str, from_name: str) -> bool:
    """Owners and Leif are known recipients, so this skips the per-address limits demo emails have."""
    if not config.resend_api_key or not to:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.resend_api_key}"},
                json={"from": f"{from_name} <{config.email_from}>", "to": [to], "subject": subject, "html": html_body, "text": text_body, "reply_to": config.email_reply_to},
            )
        if r.status_code >= 300:
            log.warn("factory.email_failed", {"outcome": r.status_code})
            return False
        return True
    except httpx.HTTPError as err:
        log.warn("factory.email_failed", {}, err)
        return False


FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"


def _shell(preheader: str, heading: str, inner: str, foot: str) -> str:
    e = html.escape
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f1eb"><div style="display:none;max-height:0;overflow:hidden">{e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-family:{FONT};font-size:24px;font-weight:800;line-height:1.3;color:#1b1a17">{e(heading)}</td></tr>
<tr><td style="padding:8px 28px 26px;font-family:{FONT};font-size:15px;line-height:1.6;color:#3d3a34">{inner}</td></tr></table>
<p style="font-family:{FONT};font-size:12px;color:#9a9286;max-width:560px">{foot}</p></td></tr></table></body></html>"""


def summary_email(business: str, m: dict[str, Any], demo: bool) -> tuple[str, str, str]:
    e = html.escape
    who = m.get("caller_name") or "A caller"
    rows = [("Caller", who), ("Number", twilio_api.pretty(m["caller_number"]) if m.get("caller_number") else ""), ("About", m.get("reason", "")), ("Next step", m.get("action", ""))]
    table = "".join(f'<tr><td style="padding:8px 0;border-top:1px solid #ece8e1;color:#857d70;font-size:13px;width:100px;vertical-align:top">{e(k)}</td><td style="padding:8px 0;border-top:1px solid #ece8e1;font-size:15px">{e(v)}</td></tr>' for k, v in rows if v)
    msgs = "".join(f'<p style="background:#f6f3ee;border-radius:10px;padding:12px 14px;margin:14px 0 0"><b>Message{" · urgent" if x["urgent"] else ""}:</b> {e(x["reason"])}<br><span style="color:#6b645a;font-size:13px">Call back {e(x["name"])} on {e(twilio_api.pretty(x["callback"]) if twilio_api.nanp_number(x["callback"]) else x["callback"])}{" · " + e(x["preferredTime"]) if x.get("preferredTime") else ""}</span></p>' for x in m.get("messages") or [])
    urgent = '<p style="display:inline-block;background:#fde8e4;color:#a8321f;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;margin:0 0 12px">URGENT</p><br>' if m.get("urgent") else ""
    inner = f'{urgent}<p style="margin:0 0 14px">{e(m["summary"])}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{table}</table>{msgs}'
    if demo:
        inner += f'<p style="margin:22px 0 0;padding:16px;background:#1b1a17;color:#fff8e6;border-radius:12px">This is what you\'d get after every call your agent takes, by text and email. <a href="{config.site_url}/pricing/" style="color:#f5c542">See what it costs to have it for real &rarr;</a></p>'
    foot = "Sent by Digital Macaroni after a demo call you asked for." if demo else f"Sent by your AI agent for {e(business)}, built by Digital Macaroni. Reply to this email for help."
    subject = f"{'URGENT · ' if m.get('urgent') else ''}{who} called {business}" + (f" · {m['reason']}" if m.get("reason") else "")
    return subject, _shell(m["summary"], f"New call: {who}", inner, foot), summary_text(business, m, demo)


def live_email(a: ClientAgent) -> tuple[str, str, str]:
    e = html.escape
    n = twilio_api.pretty(a.number)
    digits = a.number[-10:]
    inner = f"""<p style="margin:0 0 14px">{e(a.agent_name)}, your AI agent for {e(a.business_name)}, is answering on <b style="font-size:18px">{e(n)}</b>.</p>
<p style="margin:0 0 6px"><b>1. Hear it now.</b> Call {e(n)} and ask it what a customer would.</p>
<p style="margin:14px 0 6px"><b>2. Send your calls to it.</b> Forward your business line to {e(n)}. On most mobile carriers, dial <b>*72{e(digits)}</b> (AT&amp;T, Verizon) or <b>**21*{e(a.number)}#</b> (T-Mobile) and press call; to forward only calls you don't answer, use <b>*71{e(digits)}</b> or <b>**61*{e(a.number)}#</b>. On a business phone system, set call forwarding to {e(n)} in its settings. To stop forwarding, dial <b>*73</b> or <b>##21#</b>.</p>
<p style="margin:14px 0 6px"><b>3. Watch your phone.</b> After every call you'll get a text and an email: who called, their number, what they wanted and what to do next.</p>
<p style="margin:14px 0 0">Want it to say something differently or know something new? Just reply to this email.</p>"""
    text = f"{a.agent_name}, your AI agent for {a.business_name}, is answering on {n}.\n1. Call {n} to hear it.\n2. Forward your business line to {n}: *72{digits} (AT&T, Verizon) or **21*{a.number}# (T-Mobile); for unanswered calls only, *71{digits} or **61*{a.number}#. Stop with *73 or ##21#.\n3. After every call you'll get a text and an email with the summary.\nReply to this email for changes."
    return f"Your AI agent is live · {n}", _shell(f"Your agent answers on {n}", "Your agent is live", inner, "Digital Macaroni · digitalmacaroni.io"), text


async def _send_lead(j: Job, summary: Optional[dict[str, Any]]) -> None:
    if j.lead_sent:
        return
    j.lead_sent = True
    e = html.escape
    lead, p = j.lead, j.profile
    outcome = {"done": "Had the call", "summary": "Had the call", "no_answer": "Didn't answer", "failed": "Call failed"}.get(j.step, j.step)
    rows = [("Name", lead.get("name", "")), ("Mobile", twilio_api.pretty(lead.get("phone", ""))), ("Email", lead.get("email", "")), ("Website", lead.get("website", "")), ("Business", p.business_name if p else ""), ("What they do", p.summary if p else ""), ("Outcome", outcome)]
    table = "".join(f"<tr><td style='padding:4px 12px 4px 0;color:#857d70'>{e(k)}</td><td>{e(v)}</td></tr>" for k, v in rows if v)
    call = f"<p><b>Call summary:</b> {e(summary['summary'])}</p>" if summary else ""
    await _resend(config.leads_email, f"Instant demo lead · {p.business_name if p else lead.get('website', '')} · {outcome}", f"<table>{table}</table>{call}", "\n".join(f"{k}: {v}" for k, v in rows if v) + (f"\nCall: {summary['summary']}" if summary else ""), "Digital Macaroni")
