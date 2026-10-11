import dataclasses
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import calllog, main, pairing, recording
from app.session import admit


@pytest.fixture
def stored(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Any:
    cfg = dataclasses.replace(main.config, call_log_dir=str(tmp_path), call_log_bucket="", allowed_origins=["https://digitalmacaroni.io"])
    for mod in (calllog, main, recording):
        monkeypatch.setattr(mod, "config", cfg)
    return tmp_path


async def test_a_finished_call_has_its_own_page(stored: Any) -> None:
    s, _ = admit("hotels", "phone")
    assert s is not None
    p = pairing.create_pairing("hotels")
    pairing.set_setup(p.viewer_token, {"trade": "hotels", "tool": "cloudbeds", "record": True})
    assert pairing.link_call(p.code, s) == "linked" and s.setup and s.setup["tool"] == "cloudbeds"
    s.caller_number = "+15555555382"
    s.recording_offset_ms = 900
    s.record.said("u1", "agent", "Thanks for calling Palmetto Stays, this is Marisol. This call is recorded.")
    s.record.said("u2", "user", "Two rooms please, my email is leif@example.com")
    s.record.tool("take_message", {"name": "Leif", "callbackNumber": "+15555555382"}, True, {"messageId": "MSG-412"}, 12, "Message for an agent · MSG-412", "Leaving a message for an agent")
    s.record.tool("link_screen", {"code": "1234"}, True, {}, 3)
    await calllog.save(s)

    client = TestClient(main.app)
    r = client.get(f"/reports/{s.report_token}").json()
    assert r["business"] == "Palmetto Stays" and r["agent"] == "Marisol" and r["status"] == "complete"
    assert r["callerNumber"] == "•••• 5382" and r["setup"] == {"trade": "hotels", "tool": "cloudbeds", "record": True}
    says = [e for e in r["entries"] if e["kind"] == "say"]
    assert says[1]["speaker"] == "user" and "l•••@example.com" in says[1]["text"]
    steps = [e for e in r["entries"] if e["kind"] == "step"]
    # Steps carry their summary, never the tool's arguments; plumbing tools are left out.
    assert steps == [{"kind": "step", "t": steps[0]["t"], "tool": "take_message", "label": "Leaving a message for an agent", "summary": "Message for an agent · MSG-412", "ok": True, "ms": 12}]
    assert "+15555555382" not in str(r)
    assert r["recording"] is None and r["recordingPending"] is True

    await calllog.put(calllog.report_name(s.report_token, "mp3"), b"ID3fake-mp3", "audio/mpeg")
    r = client.get(f"/reports/{s.report_token}").json()
    assert r["recording"] == {"url": f"reports/{s.report_token}/audio", "offsetMs": 900}
    audio = client.get(f"/reports/{s.report_token}/audio")
    assert audio.status_code == 200 and audio.content == b"ID3fake-mp3" and audio.headers["content-type"] == "audio/mpeg"


def test_unknown_or_malformed_tokens_find_nothing(stored: Any) -> None:
    client = TestClient(main.app)
    assert client.get("/reports/not-a-real-token-but-long-enough").status_code == 404
    assert client.get("/reports/../../etc/passwd").status_code == 404
    assert client.get("/reports/short").status_code == 404


def test_setup_needs_the_site_origin(stored: Any) -> None:
    client = TestClient(main.app)
    p = pairing.create_pairing("hotels")
    assert client.post(f"/pairings/{p.viewer_token}/setup", json={"tool": "x"}, headers={"origin": "https://evil.example"}).status_code == 403
    from app.verify import email_pass

    ok = client.post(f"/pairings/{p.viewer_token}/setup", json={"tool": "mews", "record": False, "email": "a@b.co", "pass": email_pass("a@b.co"), "junk": "x" * 999}, headers={"origin": "https://digitalmacaroni.io"})
    assert ok.json() == {"ok": True} and p.setup == {"tool": "mews", "email": "a@b.co", "record": False}
    # An email that didn't pass /check-email (a real person, a reachable address) is not kept.
    client.post(f"/pairings/{p.viewer_token}/setup", json={"tool": "mews", "email": "x@mailinator.com"}, headers={"origin": "https://digitalmacaroni.io"})
    assert "email" not in p.setup


async def test_recorded_only_when_chosen_and_the_agent_says_so(stored: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    started: list[str] = []

    async def start(session: Any, call_sid: str) -> None:
        started.append(call_sid)

    monkeypatch.setattr(recording, "start", start)
    for record, expect in ((True, "Great, you're connected. This demo is being recorded, and I'll email you the recording afterwards. How can I help you today?"), (False, "Great, you're connected. I'll email you a summary afterwards. How can I help you today?")):
        s, _ = admit("northline", "phone")
        assert s is not None
        s.call_sid = f"CA{record}"
        p = pairing.create_pairing("northline")
        pairing.set_setup(p.viewer_token, {"email": "a@b.co", "record": record, "tool": "jobber"})
        assert pairing.link_call(p.code, s) == "linked"
        assert s.connected_line() == expect
    import asyncio

    await asyncio.sleep(0)
    assert started == ["CATrue"]
    # A call that never links a screen is never recorded, and the agent says nothing about it.
    s, _ = admit("northline", "phone")
    assert s is not None and s.connected_line() == "Great, you're connected. How can I help you today?"


async def test_the_report_goes_once_to_the_setup_address_with_the_page_button(stored: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    from app import email, report_email

    sent: list[dict[str, str]] = []

    async def send(to: str, subject: str, html_body: str, text_body: str, from_name: str) -> None:
        sent.append({"to": to, "subject": subject, "html": html_body, "text": text_body, "from": from_name})

    async def any_domain(domain: str) -> bool:
        return True

    monkeypatch.setattr(email, "send", send)
    monkeypatch.setattr(email, "receives_mail", any_domain)
    s, _ = admit("hotels", "phone")
    assert s is not None
    s.setup = {"email": "leif@example.com", "record": True}
    s.record.tool("search_hotels", {}, True, {}, 5000, "3 best of 30 hotels", "Searching hotels")
    s.record.tool("take_message", {}, True, {}, 10, "Message for an agent · MSG-412", "Leaving a message")
    s.record.tool("link_screen", {}, True, {}, 1, "linked", "Linking")
    await report_email.send(s, recorded=True)
    await report_email.send(s, recorded=True)
    assert len(sent) == 1 and sent[0]["to"] == "leif@example.com" and sent[0]["subject"] == "Demo · Your call with Marisol at Palmetto Stays"
    assert "Message for an agent · MSG-412" in sent[0]["text"] and "linked" not in sent[0]["text"]
    assert s.report_url in sent[0]["html"] and "See your full call" in sent[0]["html"] and "Book a call with Leif" in sent[0]["html"]
