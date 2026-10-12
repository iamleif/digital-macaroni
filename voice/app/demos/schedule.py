"""
How a busy business's diary is generated, shared by every demo with a calendar.

A real diary is mostly full: people work different shifts (half days, days off, a late start), lunch is
somewhere, and only a few gaps are left, at different times on different days. So the generator works from
the openings outward: it first decides how many openings the day keeps (1 to 5, mostly 2 to 4), reserves them
for different people at different times of day, then fills every other working minute with existing
appointments of realistic lengths, and shows the time off shift as 'Out', 'Lunch' or 'Admin' blocks.

Everything is a function of the date, the business and the person, never of the call's timestamp, so a given
date looks the same on every call and different dates and weeks differ. The one exception is today: nothing
is left open before the earliest bookable time.

Times are minutes after midnight. A shift is a string "9:00-13:00,13:45-17:30" (the gaps are breaks); a person's
shifts are keyed by weekday, 0 = Sunday as everywhere else; a missing weekday is a day off.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable, Optional, Sequence

from .types import add_days, weekday

EPOCH = date(2026, 1, 5)  # a Monday

# How many openings a day keeps, as (count, weight). The mean is just under three.
OPEN_WEIGHTS = ((1, 0.10), (2, 0.30), (3, 0.35), (4, 0.18), (5, 0.07))
# A business with many kinds of work always keeps at least two openings, so every kind comes round.
OPEN_WEIGHTS_MANY = ((2, 0.34), (3, 0.42), (4, 0.20), (5, 0.04))
# Busier-feeling businesses on a small grid (a handful of hours per person).
OPEN_WEIGHTS_SMALL = ((1, 0.04), (2, 0.40), (3, 0.46), (4, 0.10))
OPEN_WEIGHTS_BIG = ((1, 0.05), (2, 0.25), (3, 0.35), (4, 0.27), (5, 0.08))


def u(*parts: object) -> float:
    """A repeatable number in [0, 1) from the parts."""
    return int.from_bytes(hashlib.sha256("|".join(map(str, parts)).encode()).digest()[:8], "big") / 2**64


def rng(*parts: object) -> random.Random:
    return random.Random(int.from_bytes(hashlib.sha256("|".join(map(str, parts)).encode()).digest()[:8], "big"))


def open_budget(prefix: str, day: str, weights: Sequence[tuple[int, float]] = OPEN_WEIGHTS) -> int:
    """How many openings this date keeps. Decided by the date alone."""
    x = u(prefix, "open-budget", day)
    for n, w in weights:
        x -= w
        if x < 0:
            return n
    return weights[-1][0]


def cap_budget(k: int, capacity: float, per: float, floor: int = 2, share: float = 0.28) -> int:
    """A thin day (most of the team off) can't keep as many openings as a full one: no more than `share` of the working
    capacity (`per` is the capacity one opening takes), never fewer than `floor`."""
    return min(k, max(floor, int(capacity * share / per + 0.5)))


def cells_working(segs: dict[str, list[tuple[int, int]]], hours: Sequence[int], length: int = 60) -> int:
    """How many (person, hour) cells of `length` minutes the shifts cover."""
    return sum(1 for ss in segs.values() for h in hours if any(a <= h * 60 and h * 60 + length <= b for a, b in ss))


def business_index(day: str, closed: frozenset[int] | set[int]) -> int:
    """The count of open days since a fixed epoch: consecutive for consecutive open days, whatever the week looks like."""
    n = (date.fromisoformat(day) - EPOCH).days
    full, rem = divmod(n, 7)
    count = full * (7 - len(closed))
    base = EPOCH.isoformat()
    for i in range(rem):
        if weekday(add_days(base, full * 7 + i)) not in closed:
            count += 1
    return count


# ---- Shifts ----


def clock(s: str) -> int:
    h, _, m = s.strip().partition(":")
    return int(h) * 60 + int(m or 0)


def segments(spec: Optional[str], lo: int = 0, hi: int = 24 * 60) -> list[tuple[int, int]]:
    """A shift string as working segments, clipped to the business's hours. None or 'off' is a day off."""
    if not spec or spec == "off":
        return []
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        s, e = max(lo, clock(a)), min(hi, clock(b))
        if e > s:
            out.append((s, e))
    return out


def shift_of(shifts: dict[str, Any], who: str, day: str, lo: int = 0, hi: int = 24 * 60) -> list[tuple[int, int]]:
    return segments((shifts.get(who) or {}).get(str(weekday(day))), lo, hi)


def subtract(segs: Sequence[tuple[int, int]], cuts: Sequence[tuple[int, int]]) -> list[tuple[int, int]]:
    out = list(segs)
    for cs, ce in cuts:
        nxt = []
        for a, b in out:
            if ce <= a or cs >= b:
                nxt.append((a, b))
                continue
            if cs > a:
                nxt.append((a, cs))
            if ce < b:
                nxt.append((ce, b))
        out = nxt
    return sorted(out)


def off_blocks(segs: Sequence[tuple[int, int]], lo: int, hi: int, cover: Sequence[tuple[int, int]] = (), seed: str = "") -> list[tuple[int, int, str]]:
    """(start, minutes, title) for the time inside lo..hi that this person is not working: 'Out' at either end of
    the day or all day, 'Lunch' for a midday break, 'Admin' for another gap. `cover` is time the business already
    shows itself (a shared lunch band), which gets no block."""
    gaps = subtract([(lo, hi)], list(segs))
    out = []
    for a, b in subtract(gaps, list(cover)):
        if not segs:
            title = "Out"
        elif a == lo or b == hi:
            title = "Out"
        elif 11 * 60 <= a <= 14 * 60 + 30 and b - a <= 90:
            title = "Lunch"
        else:
            title = "Admin" if u(seed, a) < 0.6 else "Out"
        out.append((a, b - a, title))
    return out


# ---- Openings ----


@dataclass
class Hole:
    who: str
    start: int
    minutes: int

    @property
    def end(self) -> int:
        return self.start + self.minutes

    def span(self) -> tuple[int, int]:
        return (self.start, self.start + self.minutes)


Card = tuple[tuple[str, ...], int]  # (who could hold it, minutes)


def hole_starts(segs: Sequence[tuple[int, int]], minutes: int, grid: int, min_start: int = 0, min_side: int = 0, allowed: Optional[Callable[[int], bool]] = None) -> list[int]:
    """Where a gap of `minutes` fits inside the segments, on the grid, leaving either nothing or at least
    `min_side` minutes on each side (so the neighbours can be filled and the gap stays the size it was planned)."""
    out = []
    for a, b in segs:
        s = -(-max(a, min_start) // grid) * grid
        while s + minutes <= b:
            left, right = s - a, b - (s + minutes)
            if (left == 0 or left >= min_side) and (right == 0 or right >= min_side) and (allowed is None or allowed(s)):
                out.append(s)
            s += grid
    return out


def choose_holes(
    r: random.Random,
    *,
    k: int,
    deck: Sequence[Card],
    idx: int,
    starts: Callable[[str, int, list[Hole]], list[int]],
    span: tuple[int, int],
    stride: int = 3,
    forced: Sequence[Card] = (),
    must: Sequence[Card] = (),
) -> list[Hole]:
    """Reserve k openings for the day. Cards come from a deck that advances with the date, so over a fortnight every
    kind of opening (and every person) comes round; cards for someone who is off, or has no room, are passed over.
    Openings go to different people and different quarters of the day where they can."""
    holes: list[Hole] = []
    used_who: set[str] = set()
    used_bucket: set[int] = set()
    used_start: set[int] = set()
    lo, hi = span
    quarter = max(1, (hi - lo) / 4)

    def bucket(s: int) -> int:
        return min(3, int((s - lo) // quarter))

    def place(card: Card, strict: bool) -> bool:
        cands, minutes = card
        who_order = [w for w in cands if w not in used_who] or ([] if strict else list(cands))
        r.shuffle(who_order)
        for who in who_order:
            ss = starts(who, minutes, holes)
            if not ss:
                continue
            fresh = [s for s in ss if s not in used_start] or ss
            free_b = [s for s in fresh if bucket(s) not in used_bucket]
            pool = free_b or fresh
            # Pick a quarter first, then a time in it, so one quarter's many starts don't outweigh the others.
            by = sorted({bucket(s) for s in pool})
            b = r.choice(by)
            s = r.choice([x for x in pool if bucket(x) == b])
            holes.append(Hole(who, s, minutes))
            used_who.add(who)
            used_bucket.add(b)
            used_start.add(s)
            return True
        return False

    for card in must:  # always placed, in order, even past k
        place(card, strict=False)
    order = list(forced)
    r.shuffle(order)
    for card in order:
        if len(holes) < k:
            place(card, strict=True)
    n = len(deck)
    pos = stride * idx
    for strict in (True, False):
        for i in range(n):
            if len(holes) >= k:
                break
            place(deck[(pos + i) % n], strict)
        if len(holes) >= k:
            break
    return holes


def settle(make: Callable[[int], Any], floor: int, need: int, starts_of: Callable[[Any], list[int]]) -> Any:
    """The day's openings, generated from the date alone (make(0)). Only if this is today and too few of them are left
    after `floor` (the earliest bookable minute) is the day generated again around the time that is left, so today
    never goes quiet while any other date is identical on every call."""
    out = make(0)
    if floor and sum(1 for s in starts_of(out) if s >= floor) < need:
        out = make(floor)
    return out


# ---- Filling ----


def fill(r: random.Random, segs: Sequence[tuple[int, int]], pool: Sequence[tuple[str, int]], unit: int, min_bookable: int) -> list[tuple[int, int, str]]:
    """Existing appointments across the working segments: titles and lengths from the pool, short natural gaps
    here and there (always shorter than anything bookable), the end of each stretch landing on the stretch's end."""
    lens = sorted({m for _, m in pool})
    out: list[tuple[int, int, str]] = []
    max_gap = max(0, min_bookable - unit)
    for a, b in segs:
        total = b - a
        memo: dict[tuple[int, int], bool] = {}

        def reach(rem: int, tail: int) -> bool:
            if rem <= tail:
                return True
            key = (rem, tail)
            if key not in memo:
                memo[key] = any(reach(rem - m, tail) for m in lens if m <= rem)
            return memo[key]

        tail = 0 if reach(total, 0) else (unit if reach(total, unit) and unit <= max_gap else max_gap)
        t, rem = a, total
        while rem > tail:
            options = [(t_, m) for t_, m in pool if m <= rem and reach(rem - m, tail)]
            gaps = [g for g in range(unit, max_gap + 1, unit) if r.random() < 0.05]
            if gaps:
                g = gaps[0]
                with_gap = [(t_, m) for t_, m in pool if m <= rem - g and reach(rem - g - m, tail)]
                if with_gap and rem - g > tail:
                    t += g
                    rem -= g
                    options = with_gap
            if not options:
                break
            title, m = r.choice(options)
            out.append((t, m, title))
            t += m
            rem -= m
    return out
