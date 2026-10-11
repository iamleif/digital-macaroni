"""The agent factory without a model or network: phone and website checks, profiles from HTML,
onboarding links, the generic agent's operations, the agent store, the instant form and summaries."""

import asyncio
import time
from datetime import datetime, timezone

import pytest

from app import agents_store, factory, twilio_api
from app.config import config
from app.demos.agent import AgentState, TakeMessage, TextBookingLink, agent, send_meeting_link, take_message, text_booking_link
from app.demos.agent.prompt import instruction
from app.demos.types import OpContext
from app.profile import fallback_profile, normalise_url, page_text, profile_facts, useful_links
from app.session import admit
from app.tools import tool_specs

NOW = datetime(2026, 10, 11, 17, 0, tzinfo=timezone.utc)
PHONE = OpContext(now=NOW, channel="phone")


@pytest.fixture
def cfg():
    saved = {}

    def set_(**kw):
        for k, v in kw.items():
            saved.setdefault(k, getattr(config, k))
            object.__setattr__(config, k, v)

    yield set_
    for k, v in saved.items():
        object.__setattr__(config, k, v)


class TestChecks:
    def test_us_and_canadian_numbers_only(self):
        assert twilio_api.nanp_number("(206) 555-0142") == "+12065550142"
        assert twilio_api.nanp_number("1 416 555 0199") == "+14165550199"
        assert twilio_api.nanp_number("+44 20 7946 0958") is None
        assert twilio_api.nanp_number("555-0142") is None
        assert twilio_api.pretty("+12065550142") == "(206) 555-0142"

    def test_websites(self):
        assert normalise_url("acmedental.com") == "https://acmedental.com"
        assert normalise_url("http://acme.com/about#x") == "http://acme.com/about"
        assert normalise_url("localhost") is None
        assert normalise_url("ftp://acme.com") is None
        assert normalise_url("https://acme.com:8443") is None


class TestProfile:
    HTML = """<html><head><title>Acme Dental | Seattle</title><meta name="description" content="Family dentist in Ballard"></head>
    <body><script>var x=1</script><nav><a href="/about-us">About</a><a href="/services/cleaning">Cleaning</a><a href="https://other.com/x">Out</a>
    <a href="/brochure.pdf">PDF</a><a href="/blog/post">Blog</a><a href="/contact">Contact</a></nav><p>Open Mon&ndash;Fri 8&ndash;5</p></body></html>"""

    def test_text_keeps_words_and_drops_code(self):
        t = page_text(self.HTML)
        assert "Acme Dental | Seattle | Family dentist in Ballard" in t
        assert "Open Mon–Fri 8–5" in t
        assert "var x" not in t

    def test_follows_only_useful_pages_on_the_same_site(self):
        links = useful_links("https://acme.com/", self.HTML)
        assert links == ["https://acme.com/about-us", "https://acme.com/services/cleaning", "https://acme.com/contact"]

    def test_fallback_and_facts(self):
        p = fallback_profile("https://www.best-plumbing.com")
        assert p.business_name == "Best Plumbing"
        facts = profile_facts(p.model_dump())
        assert "hours" not in facts and facts["business_name"] == "Best Plumbing"


class TestInvites:
    def test_signed_and_tamper_proof(self, cfg):
        cfg(admin_token="secret-1")
        inv = agents_store.Invite(id="inv_abc", expires_at=time.time() + 100)
        token = agents_store.invite_token(inv)
        assert agents_store.read_invite_token(token)[0] == "inv_abc"
        assert agents_store.read_invite_token(token[:-1] + ("A" if token[-1] != "A" else "B")) is None
        cfg(admin_token="secret-2")
        assert agents_store.read_invite_token(token) is None

    async def test_single_use(self, cfg, tmp_path):
        cfg(admin_token="secret", agents_dir=str(tmp_path))
        inv, token = await agents_store.create_invite("Acme", "ready-made")
        got, why = await factory.check_invite(token)
        assert got and got.id == inv.id and not why
        inv.used_by = "ag_1"
        await agents_store.save_invite(inv)
        got, why = await factory.check_invite(token)
        assert got is None and "already been used" in why


class TestStore:
    async def test_agents_persist_and_route_by_number(self, cfg, tmp_path):
        cfg(agents_dir=str(tmp_path))
        a = agents_store.ClientAgent(id="ag_test1", number="+12065550100", business_name="Acme", profile={"business_name": "Acme"})
        assert await agents_store.save_agent(a)
        agents_store._by_id.clear()
        agents_store._by_number.clear()
        assert await agents_store.load() == 1
        assert agents_store.agent_for_number("+12065550100").business_name == "Acme"


class TestAgent:
    def state(self, **kw):
        return AgentState(now=NOW, profile={"business_name": "Acme Dental", "industry": "dental clinic", "time_zone": "America/Los_Angeles"}, caller_number="+12065550142", **kw)

    def test_message_is_kept_once(self):
        s = self.state()
        i = TakeMessage(name="Sam", callbackNumber="+12065550142", reason="Wants a cleaning next week")
        assert take_message(s, i, PHONE).ok
        assert take_message(s, i, PHONE).result["duplicate"]
        assert len(s.messages) == 1

    async def test_booking_link_needs_a_link(self):
        r = await text_booking_link(self.state(), TextBookingLink(callerConfirmed=True), PHONE)
        assert not r.ok and r.error == "no_booking_link"

    def test_instant_prompt_greets_the_prospect(self):
        p = instruction(self.state(mode="instant", visitor_name="Jamie"), PHONE)
        assert "Hi Jamie" in p and "Acme Dental" in p and "This is a demo" in p and "send_meeting_link" in p

    def test_client_prompt_uses_owner_notes(self):
        p = instruction(self.state(mode="client", notes="We don't take Delta Dental.", never_say="Never quote crowns."), PHONE)
        assert p.count("Thanks for calling Acme Dental") == 1 and "Delta Dental" in p and "Never quote crowns" in p

    def test_no_screen_code_tool(self):
        names = [s.name for s in tool_specs(agent)]
        assert "link_screen" not in names and {"get_business_info", "take_message", "text_booking_link", "end_call"} <= set(names)


    async def test_meeting_link_only_in_instant_mode(self):
        r = await send_meeting_link(self.state(mode="client"), {}, PHONE)
        assert not r.ok and r.error == "not_available"


class TestAdmit:
    def test_client_lines_ignore_the_demo_switch(self, cfg):
        cfg(enabled=False)
        s, why = admit("agent", "phone", client=True)
        assert s is not None and s.client
        s.end("test")
        s2, why = admit("agent", "phone")
        assert s2 is None and why == "disabled"


class TestInstantForm:
    BODY = {"name": "Jamie Lee", "phone": "206 555 0142", "website": "acme.com", "email": "jamie@acme.com", "consent": True, "elapsedMs": 9000}

    def test_rejects_bad_input(self, cfg):
        cfg(twilio_account_sid="AC1", twilio_api_key_sid="SK1", twilio_api_key_secret="x", enabled=True)
        assert factory.start_instant({**self.BODY, "company": "spam"}, "1.1.1.1")[1][1] == "invalid"
        assert factory.start_instant({**self.BODY, "elapsedMs": 500}, "1.1.1.1")[1][1] == "too_fast"
        assert factory.start_instant({**self.BODY, "phone": "+44 20 7946 0958"}, "1.1.1.1")[1][1] == "phone"
        assert factory.start_instant({**self.BODY, "consent": False}, "1.1.1.1")[1][1] == "consent"
        assert factory.start_instant({**self.BODY, "email": ""}, "1.1.1.1")[1][1] == "email"

    async def test_limits_tries_per_number(self, cfg, monkeypatch):
        cfg(twilio_account_sid="AC1", twilio_api_key_sid="SK1", twilio_api_key_secret="x", enabled=True)

        async def nothing(j):
            return None

        monkeypatch.setattr(factory, "_run_instant", nothing)
        factory._tries.clear()
        body = {**self.BODY, "phone": "206 555 0199"}
        assert factory.start_instant(body, "2.2.2.1")[0]
        assert factory.start_instant(body, "2.2.2.2")[0]
        assert factory.start_instant(body, "2.2.2.3")[1][1] == "rate_limited"
        await asyncio.sleep(0)


class TestTurnstile:
    async def test_needs_a_token_once_configured(self, cfg):
        assert await factory.human("", "1.1.1.1")
        cfg(turnstile_secret="secret")
        assert not await factory.human("", "1.1.1.1")


class TestSummary:
    def test_text_reads_well(self):
        m = {"caller_name": "Sam", "caller_number": "+12065550142", "reason": "Cleaning", "summary": "Sam wants a cleaning next week.", "action": "Call Sam to book.", "urgent": True}
        t = factory.summary_text("Acme Dental", m)
        assert t.startswith("URGENT · New call for Acme Dental") and "(206) 555-0142" in t and "Next: Call Sam to book." in t
        subject, body, _ = factory.summary_email("Acme Dental", {**m, "messages": []}, demo=True)
        assert subject.startswith("URGENT · Sam called Acme Dental") and "Book a call with Leif" in body


class TestVoicemail:
    async def test_voicemail_gets_a_hang_up_and_the_page_is_told(self, monkeypatch):
        sent = []

        async def lead(j, summary):
            sent.append(j.step)

        monkeypatch.setattr(factory, "_send_lead", lead)
        s, _ = admit("agent", "phone", client=True)
        j = factory._new_job("instant")
        j.session_id = s.id
        twiml = await factory.instant_answer(j.id, "machine_start")
        assert "<Hangup/>" in twiml and s.ended == "no_answer" and j.step == "no_answer" and "voicemail" in j.message and sent == ["no_answer"]

    async def test_a_person_gets_the_agent(self):
        s, _ = admit("agent", "phone", client=True)
        j = factory._new_job("instant")
        j.session_id = s.id
        twiml = await factory.instant_answer(j.id, "human")
        assert f'value="{s.id}"' in twiml and j.step == "in_call"
        s.end("test")

    async def test_a_voicemail_greeting_is_not_a_call_to_summarise(self):
        s, _ = admit("agent", "phone", client=True)
        s.record.said("u1", "visitor", "Leave a message after the beep.")
        assert await factory.summarise(s) is None
        s.end("test")
