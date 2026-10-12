"""A call we placed: the agent's live session opens while the phone rings, so she speaks the moment it's answered."""

import asyncio

from app import phone
from app.phone import GREET_NOTE, PhoneBridge
from app.session import admit


class FakeLive:
    greets_itself = False

    def __init__(self) -> None:
        self.texts: list[str] = []
        self.closed = False

    def send_audio(self, pcm16k: bytes) -> None:
        pass

    def send_text(self, text: str) -> None:
        self.texts.append(text)

    async def events(self):
        await asyncio.Event().wait()
        yield  # pragma: no cover

    async def close(self) -> None:
        self.closed = True


class FakeSocket:
    async def close(self) -> None:
        pass

    async def send_text(self, _: str) -> None:
        pass


async def _warm(live: FakeLive) -> FakeLive:
    return live


def test_answered_call_uses_the_warm_session_and_greets_at_once(monkeypatch):
    async def run():
        async def cold(_s):
            raise AssertionError("opened a second live session")

        monkeypatch.setattr(phone, "open_live", cold)
        warm = FakeLive()
        s, _ = admit("agent", "phone")
        s.prewarmed = asyncio.create_task(_warm(warm))
        bridge = PhoneBridge(FakeSocket())  # type: ignore[arg-type]
        bridge.on_start({"streamSid": "MZ1", "callSid": "CA1", "customParameters": {"sessionId": s.id}})
        await asyncio.sleep(0.05)
        assert bridge.live is warm and warm.texts == [GREET_NOTE] and s.prewarmed is None
        await bridge.finish("test")
        assert warm.closed

    asyncio.run(run())


def test_unanswered_call_closes_the_warm_session():
    async def run():
        warm = FakeLive()
        s, _ = admit("agent", "phone")
        s.prewarmed = asyncio.create_task(_warm(warm))
        s.end("no_answer")
        await asyncio.sleep(0.05)
        assert warm.closed

    asyncio.run(run())
