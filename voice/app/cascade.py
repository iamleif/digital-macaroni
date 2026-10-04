"""
The cascade: the visitor's speech is transcribed (AssemblyAI Universal-3.6 Pro by default, or Gemini
Live transcription; see stt.py), a Gemini text model
answers through ADK and runs the demo's tools, and its reply is spoken by Gemini TTS while it is
still being written. Speaks the same LiveSession interface as the Gemini Live and ElevenLabs adapters,
so transports, tools, records and the conversation panel work unchanged.

Turn-taking is ours to do. After a short silence measured here the transcription model is told the
audio stream ended, which makes it finalise at once instead of waiting on its own detector. Whether
the turn is over is then read from the words: a transcript that ends like a finished sentence is
answered straight away; one that trails off ("…to New York and", "my name is") waits a little longer
for the rest, so a pause mid-thought is not taken as the end. The reply starts speculatively from the latest interim transcript at that moment; when the
final transcript arrives a quarter of a second later it either matches (the reply carries on) or the
speculative reply is discarded and rewound before anything was heard. The visitor interrupts by speaking over the agent: the reply is cancelled (ADK abort
signal), queued speech is dropped, and the next turn tells the model what the visitor actually heard.

Timings for every turn are logged as cascade.turn (content-free): how long transcription took to
finalise, the model's first words, the first audio, and the total from the end of speech.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional

from google import genai
from google.adk.agents import LlmAgent, RunConfig
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.agents.run_config import StreamingMode
from google.adk.runners import InMemoryRunner
from google.genai import types

from . import log
from .audio import rms
from .config import config
from .demos import demos
from .live import LiveEvent, full_instruction
from .session import DemoSession, get_session
from .stt import Transcriber, open_transcriber
from .tools import demo_tools

CASCADE_NOTE = """

Everything you write is turned into speech as you write it, so write only the words you say aloud: plain sentences, no lists, symbols, markdown, notes or stage directions. Keep each reply short; the caller can always ask for more. Do not announce that you are checking or looking something up: when a lookup takes a moment, the caller hears a short holding line automatically. When the caller is done, say your goodbye and call end_call in the same reply."""

SPEECH_RMS = 700
# Silence after speech before the transcript is finalised and, if it reads as finished, answered.
END_OF_TURN_S = 0.3
# Silence after which the turn is ended even if the transcriber's own end-of-turn has not come.
FORCE_END_S = 1.0
# Further silence allowed after a transcript that trails off, before it is answered anyway.
UNFINISHED_HOLD_S = 0.6
# Last words that mean the visitor has not finished.
TRAILING = {"and", "but", "or", "so", "because", "to", "the", "a", "an", "my", "our", "from", "of", "for", "with", "in", "on", "at", "um", "uh", "er", "like", "then", "that", "which", "is", "are", "was", "it's", "i'm", "we're", "i", "we", "if", "about", "around"}
# Words that acknowledge rather than interrupt.
BACKCHANNEL = {"yeah", "yes", "yep", "okay", "ok", "mm", "mhm", "uh-huh", "right", "sure", "great", "cool", "hmm", "uh", "um", "ah", "oh"}
# Spoken when a tool that calls an outside service starts before the agent has said anything.
HOLD_LINES = ["One moment while I check.", "Let me look that up.", "Bear with me a second."]
# A phone caller reading out the four-digit screen code is linked here, the same way the keypad does
# it, rather than leaving the digits for the model to interpret.
SPOKEN_LINKED_NOTE = "[The caller read out their screen code and it linked; they can now see the dashboard. Acknowledge it in a few words and carry on.]"
SPOKEN_CODE_FAILED_NOTE = "[The caller read out a screen code, {code}, but it did not match a waiting screen{why}. Ask them to check the four digits on the page, or type them on the keypad.]"
DIGIT_WORDS = {"zero": "0", "oh": "0", "o": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9"}
# Spoken when the model hangs up without a word.
GOODBYE_LINE = "Thanks for calling. Goodbye!"
# TTS requests running ahead of playback.
TTS_AHEAD = 2

_client: Optional[genai.Client] = None


def client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.gemini_api_key)
    return _client


def _instruction(ctx: ReadonlyContext) -> str:
    s = get_session(ctx.session.id)
    return full_instruction(s) + CASCADE_NOTE if s else "The session has ended. Say goodbye."


_runners: dict[str, InMemoryRunner] = {}

# Audio for lines spoken word for word (openings, holding lines, goodbye), synthesised once at start-up
# in each cascade demo's voice and replayed instantly. Keyed by TTS model, voice, style and words.
_phrases: dict[tuple[str, str, str, str], bytes] = {}
PHRASE_CHUNK = 9600  # 0.2 s of 24 kHz PCM16


def voice_config_for(voice: str) -> types.VoiceConfig:
    """A designed voice ("voice_…") or a prebuilt one by name."""
    return types.VoiceConfig(voice=voice) if voice.startswith("voice_") else types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice))


def _phrase_key(voice: str, style: str, text: str) -> tuple[str, str, str, str]:
    return (config.tts_model, voice, style, _squash(text))


async def _tts(text: str, voice_config: types.VoiceConfig, style: str) -> AsyncIterator[bytes]:
    part = types.Part(text=text, speech_metadata=types.SpeechMetadata(style=style) if style else None)
    cfg = types.GenerateContentConfig(response_modalities=[types.Modality.AUDIO], speech_config=types.SpeechConfig(voice_config=voice_config))
    async for chunk in await client().aio.models.generate_content_stream(model=config.tts_model, contents=[types.Content(role="user", parts=[part])], config=cfg):
        for c in chunk.candidates or []:
            for part_out in (c.content.parts if c.content else None) or []:
                if part_out.inline_data and part_out.inline_data.data:
                    yield part_out.inline_data.data


async def warm_phrases() -> int:
    """Synthesises every cascade demo's fixed lines, split into pieces exactly as replies are spoken."""
    count = 0
    for demo_id in config.cascade_demos:
        demo = demos.get(demo_id)
        if demo is None:
            continue
        voice = config.voices.get(demo_id, "Achird")
        for line in [*demo.fixed_lines, *HOLD_LINES, GOODBYE_LINE]:
            chunker = Chunker()
            for piece in chunker.feed(line + " ") + chunker.flush():
                key = _phrase_key(voice, demo.voice_style, piece)
                if key in _phrases:
                    continue
                try:
                    _phrases[key] = b"".join([c async for c in _tts(piece, voice_config_for(voice), demo.voice_style)])
                    count += 1
                except Exception as err:  # noqa: BLE001
                    log.warn("cascade.phrase_failed", {"demo": demo_id}, err)
    return count


def runner(demo_id: str) -> InMemoryRunner:
    if demo_id not in _runners:
        agent = LlmAgent(
            name=f"{demo_id}_cascade",
            model=config.text_model,
            instruction=_instruction,
            tools=demo_tools(demos[demo_id], live=False),
            generate_content_config=types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)),
        )
        _runners[demo_id] = InMemoryRunner(agent=agent, app_name=f"{demo_id}_cascade")
    return _runners[demo_id]


class Chunker:
    """
    Splits the reply as it streams into pieces to speak, each its own TTS request. A designed voice can
    sound slightly different from one request to the next, so there are as few joins as possible: the
    first sentence alone (so speech starts early), then the rest of the reply together once it is
    written (well before that first sentence has finished playing). Pieces never end mid-sentence.
    """

    SENTENCE = re.compile(r"[.!?…][\"”’)]?\s")
    # The rest of a reply is cut, at a sentence end, only if it grows this long.
    REST_MAX = 1200

    def __init__(self) -> None:
        self.buf = ""
        self.first = True

    def feed(self, text: str) -> list[str]:
        self.buf += text
        out: list[str] = []
        while (cut := self._cut()) is not None:
            piece, self.buf = self.buf[:cut].strip(), self.buf[cut:]
            if piece:
                out.append(piece)
                self.first = False
        return out

    def flush(self) -> list[str]:
        rest, self.buf = self.buf.strip(), ""
        if rest:
            self.first = False
        return [rest] if rest else []

    def _cut(self) -> Optional[int]:
        if self.first:
            sentence = self.SENTENCE.search(self.buf)
            if sentence:
                return sentence.end()
            if len(self.buf) > 400:
                space = self.buf.rfind(" ", 0, 360)
                return space + 1 if space > 0 else 360
            return None
        if len(self.buf) > self.REST_MAX:
            ends = [m.end() for m in self.SENTENCE.finditer(self.buf, 0, self.REST_MAX)]
            return ends[-1] if ends else None
        return None


@dataclass
class Piece:
    text: str
    audio: asyncio.Queue[Optional[bytes]] = field(default_factory=asyncio.Queue)
    # Playback times on the visitor's side, estimated from audio sent (monotonic seconds).
    starts_at: float = 0.0
    seconds: float = 0.0
    task: Optional[asyncio.Task[None]] = None


@dataclass
class Turn:
    abort: asyncio.Event = field(default_factory=asyncio.Event)
    pieces: list[Piece] = field(default_factory=list)
    interrupted: bool = False
    # Started from an interim transcript; discarded when the final one differs.
    speculative: bool = False
    discarded: bool = False
    invocation_id: str = ""
    # Transcript pieces scheduled to appear as their audio starts playing.
    shows: list[asyncio.TimerHandle] = field(default_factory=list)
    # Timings (monotonic) for the turn log.
    speech_end: float = 0.0
    final_at: float = 0.0
    started: float = 0.0
    first_text: float = 0.0
    first_audio: float = 0.0
    tools: int = 0


class Cascade:
    greets_itself = False

    def __init__(self, session: DemoSession) -> None:
        self.session = session
        self.demo_id = session.demo_id
        self.runner = runner(session.demo_id)
        self.app_name = f"{session.demo_id}_cascade"
        self.voice = config.voices.get(session.demo_id, "Achird")
        self.style = session.demo.voice_style
        self.voice_config = voice_config_for(self.voice)
        self.out: asyncio.Queue[Optional[LiveEvent]] = asyncio.Queue()
        # (text, end of speech, transcript final, speculative)
        self.inputs: asyncio.Queue[tuple[str, float, float, bool]] = asyncio.Queue()
        self.audio_in: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self.stt: Optional[Transcriber] = None
        self.turn: Optional[Turn] = None
        # A turn whose reply is written but still playing, and the task that completes it.
        self.tail: Optional[Turn] = None
        self.tail_task: Optional[asyncio.Task[None]] = None
        self.play_until = 0.0
        self.heard_note = ""
        self.hold = 0
        # The visitor's utterance so far, and the text a speculative reply started from.
        self.interim = ""
        self.speculated: Optional[str] = None
        self.speculation_dropped = False
        # A final transcript that trailed off, waiting to see whether the visitor carries on.
        self.held: Optional[str] = None
        self.hold_timer: Optional[asyncio.TimerHandle] = None
        # The call is linked to a screen (by keypad or a spoken code), so spoken codes are not tried again.
        self.screen_linked = False
        # Visitor speech, from our own level meter.
        self.voice_at = 0.0
        self.in_speech = False
        self.forced = False
        self.closed = False
        self.tasks: list[asyncio.Task[Any]] = []

    # ---- lifecycle ----

    async def start(self) -> None:
        await self.runner.session_service.create_session(app_name=self.app_name, user_id=self.session.id, session_id=self.session.id)
        self.stt = await open_transcriber(self.session.demo.vocabulary, client())
        self.tasks = [asyncio.create_task(self._send_audio()), asyncio.create_task(self._transcripts()), asyncio.create_task(self._turns())]
        # end_call runs as soon as the model asks, usually before its goodbye has been synthesised; the
        # transport is told only once everything said so far has played.
        end = self.session.request_end
        self.session.request_end = lambda reason: self.tasks.append(asyncio.create_task(self._end_after_speech(end, reason)))

    async def _end_after_speech(self, end: Any, reason: str) -> None:
        while not self.closed and (self.turn is not None or self.tail is not None or time.monotonic() < self.play_until):
            await asyncio.sleep(0.1)
        end(reason)

    def _push(self, e: Optional[LiveEvent]) -> None:
        self.out.put_nowait(e)

    def _fail(self, where: str, err: BaseException) -> None:
        if not self.closed:
            log.warn("cascade.error", {"session": self.session.id, "outcome": where}, err)
            self.closed = True
            self._push(None)

    async def events(self) -> AsyncIterator[LiveEvent]:
        while True:
            e = await self.out.get()
            if e is None:
                return
            yield e

    async def close(self) -> None:
        if self.closed and not self.tasks:
            return
        self.closed = True
        if self.hold_timer:
            self.hold_timer.cancel()
        if self.turn:
            self.turn.abort.set()
            self._stop_speech(self.turn)
        for t in [*self.tasks, *([self.tail_task] if self.tail_task else [])]:
            t.cancel()
        self.tasks = []
        if self.stt is not None:
            await self.stt.close()
        try:
            await self.runner.session_service.delete_session(app_name=self.app_name, user_id=self.session.id, session_id=self.session.id)
        except Exception:  # noqa: BLE001
            pass
        self._push(None)

    # ---- the visitor's side ----

    def send_audio(self, pcm16k: bytes) -> None:
        if not self.closed:
            self.audio_in.put_nowait(pcm16k)

    def send_text(self, text: str) -> None:
        """A system note (greet, nudge, time limit): a turn of its own, after any running one."""
        if "linked their screen" in text:
            self.screen_linked = True
        if not self.closed:
            now = time.monotonic()
            self.inputs.put_nowait((text, now, now, False))

    async def _send_audio(self) -> None:
        """Forwards audio in order and ends the visitor's turn after a short silence."""
        try:
            while (pcm := await self.audio_in.get()) is not None:
                now = time.monotonic()
                if rms(pcm) > SPEECH_RMS:
                    self.voice_at = now
                    self.in_speech = True
                    self.forced = False
                    # They are carrying on: whatever was held waits for the rest.
                    if self.hold_timer:
                        self.hold_timer.cancel()
                        self.hold_timer = None
                await self.stt.send(pcm)
                if self.in_speech and now - self.voice_at >= END_OF_TURN_S:
                    self.in_speech = False
                    await self.stt.end_of_speech()
                    if self.held is not None:
                        self._arm_hold()
                    elif self.interim and not self.stt.decides_turns and not self._busy() and finished(self.interim) and not self._may_be_code(self.interim):
                        self.speculated, self.speculation_dropped = self.interim, False
                        self.inputs.put_nowait((self.interim, self.voice_at, now, True))
                elif not self.in_speech and not self.forced and self.interim and now - self.voice_at >= FORCE_END_S:
                    self.forced = True
                    await self.stt.force_end()
        except asyncio.CancelledError:
            pass
        except Exception as err:  # noqa: BLE001
            self._fail("stt_send", err)

    async def _transcripts(self) -> None:
        try:
            async for kind, text in self.stt.events():
                if self.closed:
                    break
                if kind == "interim":
                    self._interim(text)
                else:
                    self._final(text)
        except asyncio.CancelledError:
            pass
        except Exception as err:  # noqa: BLE001
            self._fail("stt_receive", err)

    def _busy(self) -> bool:
        """The agent is replying: writing, running a tool, or its audio is still playing."""
        return self.turn is not None or self.tail is not None or time.monotonic() < self.play_until

    def _interim(self, text: str) -> None:
        if self.speculated is not None:
            # Still the utterance a speculative reply started from (the model re-sends it as it
            # finalises). If it has changed, that reply is wrong; the final transcript will replace it.
            if _squash(text) != _squash(self.speculated):
                self._drop_speculation()
            self.interim = text
            self._push(LiveEvent("transcript_set", speaker="visitor", text=text, finished=False))
            return
        words = _words(text)
        if self._busy():
            # A few words over the agent interrupts it; a lone "yeah" does not.
            if len(words) >= 2 and not all(w in BACKCHANNEL for w in words):
                self._interrupt()
            else:
                return
        self.interim = text
        self._push(LiveEvent("transcript_set", speaker="visitor", text=text, finished=False))

    def _final(self, text: str) -> None:
        words = _words(text)
        self.interim = ""
        if self.speculated is not None:
            guess, self.speculated = self.speculated, None
            if words:
                self._push(LiveEvent("transcript_set", speaker="visitor", text=text, finished=True))
            if not self.speculation_dropped and _squash(guess) == _squash(text):
                return
            self._drop_speculation()
            if words:
                self._submit(text)
            return
        if not words:
            return
        if self._busy():
            if all(w in BACKCHANNEL for w in words) and len(words) <= 2:
                return
            self._interrupt()
        self._push(LiveEvent("transcript_set", speaker="visitor", text=text, finished=True))
        self._submit(text)

    def _may_be_code(self, text: str) -> bool:
        """A screen code on an unlinked phone call: it goes through _link_spoken_code, never a speculative reply."""
        return self.session.link_screen is not None and not self.screen_linked and spoken_code(text) is not None

    def _link_spoken_code(self, text: str) -> Optional[str]:
        """
        On a phone call not yet linked to a screen, a short utterance that is a four-digit code links it
        directly. Returns the note to give the model instead of the raw digits, or None to pass the words on.
        """
        link = self.session.link_screen
        if link is None or self.screen_linked:
            return None
        code = spoken_code(text)
        if code is None:
            return None
        result = link(code)
        if result == "linked":
            self.screen_linked = True
            return SPOKEN_LINKED_NOTE
        why = " (too many tries on this call)" if result == "too_many_attempts" else ""
        return SPOKEN_CODE_FAILED_NOTE.format(code=" ".join(code), why=why)

    def _submit(self, text: str) -> None:
        """Answers what the visitor said now if it reads as finished; otherwise holds it briefly."""
        if self.held is not None:
            text = f"{self.held} {text}"
        note = self._link_spoken_code(text)
        if note is not None:
            self._release(note)
            return
        if finished(text):
            self._release(text)
        else:
            self.held = text
            self._arm_hold()

    def _arm_hold(self) -> None:
        if self.hold_timer:
            self.hold_timer.cancel()
        self.hold_timer = asyncio.get_running_loop().call_later(UNFINISHED_HOLD_S, lambda: self.held is not None and self._release(self.held))

    def _release(self, text: str) -> None:
        if self.hold_timer:
            self.hold_timer.cancel()
        self.held, self.hold_timer = None, None
        self.inputs.put_nowait((text, self.voice_at, time.monotonic(), False))

    def _drop_speculation(self) -> None:
        """The speculative reply answered the wrong words: stop it; _run rewinds it from the history."""
        self.speculation_dropped = True
        turn = self.turn
        if turn and turn.speculative and not turn.discarded:
            turn.discarded = True
            turn.abort.set()
            self._stop_speech(turn)
            if any(p.seconds for p in turn.pieces):
                self._push(LiveEvent("interrupted"))
                self.play_until = time.monotonic()
            else:
                # Unheard and about to be rewound: there is nothing to tell the model.
                self.heard_note = ""

    def _interrupt(self) -> None:
        # The turn being written, or one that is written and still playing.
        turn = self.turn or self.tail
        now = time.monotonic()
        if turn is None:
            if now < self.play_until:
                self.play_until = now
                self._push(LiveEvent("interrupted"))
            return
        if turn.interrupted:
            return
        turn.interrupted = True
        turn.abort.set()
        if turn is self.tail:
            if self.tail_task:
                self.tail_task.cancel()
            self.tail, self.tail_task = None, None
        spoken = [p for p in turn.pieces if p.seconds and p.starts_at <= now]
        whole = " ".join(p.text for p in turn.pieces)
        heard = " ".join(_heard(p, now) for p in spoken).strip()
        self._stop_speech(turn)
        if spoken:
            self._push(LiveEvent("interrupted"))
            self._push(LiveEvent("agent_correction", text=heard or "…"))
        if heard != whole:
            self.heard_note = f"[You were interrupted. The caller heard only: “{heard}”]" if heard else "[You were interrupted before the caller heard your reply.]"
        self.play_until = now

    def _stop_speech(self, turn: Turn) -> None:
        for h in turn.shows:
            h.cancel()
        for p in turn.pieces:
            if p.task and not p.task.done():
                p.task.cancel()
            p.audio.put_nowait(None)

    # ---- the agent's side ----

    async def _turns(self) -> None:
        try:
            while not self.closed:
                batch = [await self.inputs.get()]
                while not self.inputs.empty():
                    batch.append(self.inputs.get_nowait())
                # A speculative input followed by anything was superseded by the final transcript.
                batch = [b for i, b in enumerate(batch) if not b[3] or i == len(batch) - 1]
                # Speech that arrived while the last turn was finishing is answered together.
                text = " ".join(b[0] for b in batch)
                _, speech_end, final_at, speculative = batch[-1]
                if self.heard_note:
                    text, self.heard_note = f"{self.heard_note}\n{text}", ""
                await self._run(text, speech_end, final_at, speculative)
        except asyncio.CancelledError:
            pass
        except Exception as err:  # noqa: BLE001
            self._fail("turn", err)

    async def _run(self, text: str, speech_end: float, final_at: float, speculative: bool = False) -> None:
        if speculative and self.speculation_dropped:
            return
        turn = Turn(speech_end=speech_end, final_at=final_at, started=time.monotonic(), speculative=speculative)
        self.turn = turn
        chunker = Chunker()
        queue: asyncio.Queue[Optional[Piece]] = asyncio.Queue()
        player = asyncio.create_task(self._play(turn, queue))
        spoken = False
        streamed = False
        stream: Any = None

        def say(pieces: list[str]) -> None:
            nonlocal spoken
            for t in pieces:
                if not turn.first_text:
                    turn.first_text = time.monotonic()
                p = Piece(t)
                turn.pieces.append(p)
                queue.put_nowait(p)
                spoken = True

        try:
            stream = self.runner.run_async(
                user_id=self.session.id,
                session_id=self.session.id,
                new_message=types.Content(role="user", parts=[types.Part(text=text)]),
                run_config=RunConfig(streaming_mode=StreamingMode.SSE),
                abort_signal=turn.abort,
                # The visitor's message comes back first, which gives the invocation id for a rewind.
                yield_user_message=True,
            )
            async for event in stream:
                turn.invocation_id = turn.invocation_id or event.invocation_id
                if turn.abort.is_set():
                    break
                if event.author == "user":
                    continue
                parts = (event.content.parts if event.content else None) or []
                texts = [p.text for p in parts if p.text and not p.thought]
                if event.partial:
                    streamed = streamed or bool(texts)
                    for t in texts:
                        say(chunker.feed(t))
                    continue
                # A complete response repeats the text already streamed; speak it only if none was.
                if texts and not streamed:
                    for t in texts:
                        say(chunker.feed(t))
                streamed = False
                calls = event.get_function_calls()
                if calls:
                    turn.tools += len(calls)
                    say(chunker.flush())
                    if not spoken and any(c.name == "end_call" for c in calls):
                        say([GOODBYE_LINE])
                    elif not spoken and any(self._waits(c.name) for c in calls):
                        say([HOLD_LINES[self.hold % len(HOLD_LINES)]])
                        self.hold += 1
            if not turn.abort.is_set():
                say(chunker.flush())
        except asyncio.CancelledError:
            turn.abort.set()
            raise
        except Exception as err:  # noqa: BLE001
            log.warn("cascade.model_error", {"session": self.session.id}, err)
            if not spoken:
                say(["Sorry, I lost my train of thought there. Could you say that again?"])
        finally:
            queue.put_nowait(None)
            if stream is not None:
                # Lets ADK seal an aborted run (answer any pending tool call) before the next one starts.
                await stream.aclose()
        await player
        self.turn = None
        if turn.discarded and turn.invocation_id and not turn.tools:
            # Nothing was heard and nothing was done: forget the guess so the model sees only the final words.
            try:
                await self.runner.rewind_async(user_id=self.session.id, session_id=self.session.id, rewind_before_invocation_id=turn.invocation_id)
            except Exception as err:  # noqa: BLE001
                log.warn("cascade.rewind_failed", {"session": self.session.id}, err)
        if not turn.abort.is_set():
            self.tail = turn
            self.tail_task = asyncio.create_task(self._complete(turn))
        self._log(turn)

    async def _complete(self, turn: Turn) -> None:
        """The turn is complete when the visitor has heard it all (so a goodbye is not cut off). Runs
        alongside the next turn's input; an interruption while it plays cancels it."""
        try:
            while (left := self.play_until - time.monotonic()) > 0:
                await asyncio.sleep(left)
        except asyncio.CancelledError:
            return
        if self.tail is turn:
            self.tail, self.tail_task = None, None
            self._push(LiveEvent("transcript", speaker="agent", text=" ".join(p.text for p in turn.pieces), finished=True))
            self._push(LiveEvent("turn_complete"))

    def _waits(self, tool: str) -> bool:
        """A tool slow enough that the caller should hear a holding line while it runs."""
        op = self.session.demo.operations.get(tool)
        return bool(op and op.slow)

    async def _play(self, turn: Turn, queue: asyncio.Queue[Optional[Piece]]) -> None:
        """Synthesises pieces up to TTS_AHEAD in advance and sends their audio strictly in order."""
        pending: list[Piece] = []
        upstream_done = False
        while True:
            while not upstream_done and len(pending) < TTS_AHEAD:
                if not pending:
                    p = await queue.get()
                else:
                    try:
                        p = queue.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                if p is None:
                    upstream_done = True
                    break
                p.task = asyncio.create_task(self._synthesise(p))
                pending.append(p)
            if not pending:
                return
            p = pending.pop(0)
            first = True
            while (chunk := await p.audio.get()) is not None:
                if turn.abort.is_set():
                    break
                now = time.monotonic()
                if first:
                    first = False
                    p.starts_at = max(now, self.play_until)
                    if not turn.first_audio:
                        turn.first_audio = now
                    # Shown when the visitor starts hearing it, not when it was generated.
                    show = LiveEvent("transcript", speaker="agent", text=p.text + " ", finished=False)
                    turn.shows.append(asyncio.get_running_loop().call_later(p.starts_at - now, self._push, show))
                seconds = len(chunk) / 48000
                p.seconds += seconds
                self.play_until = max(now, self.play_until) + seconds
                self._push(LiveEvent("audio", data=chunk))
            if turn.abort.is_set():
                for rest in pending:
                    if rest.task:
                        rest.task.cancel()
                # Drain anything still queued so its pieces are not synthesised.
                while not upstream_done:
                    upstream_done = await queue.get() is None
                return

    async def _synthesise(self, p: Piece) -> None:
        try:
            cached = _phrases.get(_phrase_key(self.voice, self.style, p.text))
            if cached:
                for i in range(0, len(cached), PHRASE_CHUNK):
                    p.audio.put_nowait(cached[i : i + PHRASE_CHUNK])
                return
            async for data in _tts(p.text, self.voice_config, self.style):
                p.audio.put_nowait(data)
        except asyncio.CancelledError:
            pass
        except Exception as err:  # noqa: BLE001
            log.warn("cascade.tts_error", {"session": self.session.id}, err)
        finally:
            p.audio.put_nowait(None)

    def _log(self, t: Turn) -> None:
        def ms(a: float, b: float) -> Optional[int]:
            return int((a - b) * 1000) if a and b else None

        log.info(
            "cascade.turn",
            {
                "session": self.session.id,
                "stt_final_ms": ms(t.final_at, t.speech_end),
                "first_text_ms": ms(t.first_text, t.started),
                "first_audio_ms": ms(t.first_audio, t.first_text),
                "reply_ms": ms(t.first_audio, t.speech_end),
                "tools": t.tools,
                "pieces": len(t.pieces),
                "interrupted": t.interrupted,
                "speculative": t.speculative,
                "discarded": t.discarded,
            },
        )


def finished(text: str) -> bool:
    """Whether a transcript reads as a finished turn: it ends a sentence or a number (a code, a date),
    and not on a word that expects more ("…and", "my name is")."""
    t = text.strip()
    words = _words(t)
    return bool(words) and (t[-1] in ".?!" or t[-1].isdigit()) and words[-1] not in TRAILING


def spoken_code(text: str) -> Optional[str]:
    """
    A four-digit screen code in a short utterance ("8946", "8 9 4 6", "eight nine four six",
    "it's 8946"), or None. Longer sentences are left to the model, so a year or a price in a travel
    request is never taken for a code.
    """
    tokens = re.findall(r"[a-z']+|\d", text.lower())
    runs: list[str] = []
    run = ""
    other = 0
    for t in tokens:
        d = t if t.isdigit() else DIGIT_WORDS.get(t)
        if d is None:
            other += 1
            if run:
                runs.append(run)
            run = ""
        else:
            run += d
    if run:
        runs.append(run)
    codes = [r for r in runs if len(r) == 4]
    return codes[0] if len(codes) == 1 and len(runs) == 1 and other <= 4 else None


def _squash(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _words(text: str) -> list[str]:
    # Digits count: a caller reading out "8946" has said something.
    return re.findall(r"[a-z0-9'\-]+", text.lower())


def _heard(p: Piece, now: float) -> str:
    """The part of a piece played by now, cut at a word."""
    if not p.seconds or now >= p.starts_at + p.seconds:
        return p.text
    words = p.text.split()
    n = int(len(words) * max(0.0, now - p.starts_at) / p.seconds)
    return " ".join(words[:n]) + ("…" if n else "")


async def open_cascade(session: DemoSession) -> Cascade:
    c = Cascade(session)
    try:
        await c.start()
    except BaseException:
        await c.close()
        raise
    return c
