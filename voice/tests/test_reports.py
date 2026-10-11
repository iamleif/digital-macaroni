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
    ok = client.post(f"/pairings/{p.viewer_token}/setup", json={"tool": "mews", "record": False, "email": "a@b.co", "junk": "x" * 999}, headers={"origin": "https://digitalmacaroni.io"})
    assert ok.json() == {"ok": True} and p.setup == {"tool": "mews", "email": "a@b.co", "record": False}
