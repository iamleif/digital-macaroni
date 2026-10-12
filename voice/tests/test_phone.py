"""The phone bridge on a call we placed: the agent waits for the person's "hello?" and keeps it out of the model."""

import asyncio
import time

from app import phone
from app.phone import GREET_NOTE, PhoneBridge
from app.session import admit

LOUD = bytes([0x00, 0x80] * 80)  # 20 ms of loud mu-law
QUIET = bytes([0xFF] * 160)  # 20 ms of silence


class FakeLive:
    greets_itself = False

    def __init__(self) -> None:
        self.texts: list[tuple[float, str]] = []
        self.audio = 0

    def send_audio(self, pcm16k: bytes) -> None:
        self.audio += 1

    def send_text(self, text: str) -> None:
        self.texts.append((time.monotonic(), text))

    async def events(self):
        await asyncio.Event().wait()
        yield  # pragma: no cover

    async def close(self) -> None:
        pass


class FakeSocket:
    async def close(self) -> None:
        pass

    async def send_text(self, _: str) -> None:
        pass


def _media(b: bytes) -> str:
    import base64

    return base64.b64encode(b).decode()


async def _call(outbound: bool, monkeypatch) -> tuple[PhoneBridge, FakeLive, float]:
    live = FakeLive()

    async def fake_open(_s):
        return live

    monkeypatch.setattr(phone, "open_live", fake_open)
    s, _ = admit("agent", "phone")
    s.outbound = outbound
    bridge = PhoneBridge(FakeSocket())  # type: ignore[arg-type]
    bridge.on_start({"streamSid": "MZ1", "callSid": "CA1", "customParameters": {"sessionId": s.id}})
    # "Hello?" for 400 ms, then quiet.
    for _ in range(20):
        bridge.on_media(_media(LOUD))
        await asyncio.sleep(0.02)
    hello_ended = time.monotonic()
    for _ in range(60):
        bridge.on_media(_media(QUIET))
        await asyncio.sleep(0.02)
    return bridge, live, hello_ended


def test_outbound_waits_for_hello_and_keeps_it_from_the_model(monkeypatch):
    async def run():
        bridge, live, hello_ended = await _call(True, monkeypatch)
        assert [t for _, t in live.texts] == [GREET_NOTE]
        assert live.texts[0][0] - hello_ended >= phone.HELLO_QUIET_S - 0.05
        # The hello never reached the model, and the agent's opening is guarded while it plays.
        assert live.audio == 0
        bridge.first_audio = True
        bridge.playback_ends_at = time.monotonic() + 0.3
        bridge.on_media(_media(LOUD))
        assert live.audio == 0
        await asyncio.sleep(0.6)
        bridge.on_media(_media(QUIET))
        assert live.audio == 1
        await bridge.finish("test")

    asyncio.run(run())


def test_inbound_greets_at_once(monkeypatch):
    async def run():
        bridge, live, hello_ended = await _call(False, monkeypatch)
        assert [t for _, t in live.texts] == [GREET_NOTE]
        assert live.texts[0][0] < hello_ended
        assert live.audio > 0
        await bridge.finish("test")

    asyncio.run(run())
