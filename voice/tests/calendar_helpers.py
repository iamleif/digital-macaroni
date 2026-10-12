"""
Measuring a demo's diary the way someone looking at the calendar would: how many openings each day has, and how
much of everyone's working time is already taken. One function per demo family, the same answers shape:
{day: DayProfile(opens, density, starts, who)}.

An opening is a free stretch a visit could start in: a free (person, hour) cell for the hourly demos (Northline,
the dealership, the brokerage, the insurance agency, the law firm), a free stretch at least as long as the shortest
thing that person does for the minute-based ones (the dental chairs, the salon and the clinic). Time that has
already passed today is not an opening. Emergency holds at the dental practice are reported separately.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone



@dataclass
class DayProfile:
    opens: int
    density: float
    starts: list[int] = field(default_factory=list)  # minutes after midnight where each opening starts
    who: list[str] = field(default_factory=list)  # whose diary each opening is in


OFF_TITLES = {"Out", "Lunch", "Admin", "Tech out"}

# A morning in each demo's time zone on a Monday, early enough that today still has most of its day.
NOW = datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)  # 10 AM Central, 8 AM Mountain, 11 AM Eastern, 8 AM Pacific
EARLY = datetime(2026, 10, 12, 13, 0, tzinfo=timezone.utc)  # 6 AM Pacific, 9 AM Eastern: before anything opens


def _free_intervals(lo: int, hi: int, taken: list[tuple[int, int]]) -> list[tuple[int, int]]:
    out, cur = [], lo
    for a, b in sorted(taken):
        if a > cur:
            out.append((cur, a))
        cur = max(cur, b)
    if cur < hi:
        out.append((cur, hi))
    return out


def _clip(intervals: list[tuple[int, int]], floor: int) -> list[tuple[int, int]]:
    return [(max(a, floor), b) for a, b in intervals if b > floor]


# ---- minute-based: salon, clinic ----


def booking_profile(cal, state, with_today: bool = False) -> dict[str, DayProfile]:
    out = {}
    for day in cal.bookable_days(state):
        if day == state.today and not with_today:
            continue
        taken, work = 0, 0
        starts: list[int] = []
        who: list[str] = []
        for p in cal.staff:
            low = min(cal.length(s["id"]) for s in cal.services if p["id"] in s["staff"] and not s.get("hidden"))
            blocks = [b for b in state.busy if b.date == day and b.staff_id == p["id"]]
            off = [(b.start, b.start + b.minutes) for b in blocks if b.off]
            used = [(b.start, b.start + b.minutes) for b in blocks if not b.off]
            work += (cal.close - cal.open) - sum(b - a for a, b in off)
            taken += sum(b - a for a, b in used)
            floor = state.earliest_today if day == state.today else 0
            free = [x for x in _clip(_free_intervals(cal.open, cal.close, off + used), floor) if x[1] - x[0] >= low]
            starts += [a for a, _ in free]
            who += [p["id"]] * len(free)
        out[day] = DayProfile(len(starts), taken / work if work else 0.0, starts, who)
    return out


# ---- the dental book ----


def dental_profile(state, with_today: bool = False) -> dict[str, DayProfile]:
    from app.demos.dental.state import HOLD_MIN, HOLDS, LUNCH, bookable_days, has_lunch, hours_of
    from app.demos.dental.store import OPS, provider

    out = {}
    for day in bookable_days(state):
        if day == state.today and not with_today:
            continue
        lo, hi = hours_of(day)
        lunch = [LUNCH] if has_lunch(day) else []
        taken, work = 0, 0
        starts: list[int] = []
        who: list[str] = []
        for o in OPS:
            appts = [a for a in state.book if a.date == day and a.op == o["id"] and a.status == "booked"]
            off = [(a.start, a.start + a.minutes) for a in appts if a.off]
            used = [(a.start, a.start + a.minutes) for a in appts if not a.off]
            holds = [(h, h + HOLD_MIN) for op, h in HOLDS if op == o["id"] and h + HOLD_MIN <= hi]
            work += (hi - lo) - sum(b - a for a, b in off) - sum(b - a for a, b in lunch)
            taken += sum(b - a for a, b in used)
            floor = state.earliest_today if day == state.today else 0
            free = _clip(_free_intervals(lo, hi, off + used + lunch + holds), floor)
            low = 30 if provider(o["provider"])["role"] == "Hygienist" else 20
            keep = [x for x in free if x[1] - x[0] >= low]
            starts += [a for a, _ in keep]
            who += [o["id"]] * len(keep)
        out[day] = DayProfile(len(starts), taken / work if work else 0.0, starts, who)
    return out


# ---- hourly: Northline ----


def northline_profile(state, with_today: bool = False) -> dict[str, DayProfile]:
    from app.demos.northline.state import bookable_days
    from app.demos.northline.store import TECHNICIANS, WINDOWS

    out = {}
    for day in bookable_days(state):
        if day == state.today and not with_today:
            continue
        cells = {(j.tech_id, j.hour): j for j in state.jobs if j.date == day}
        work = [(t["id"], h) for t in TECHNICIANS for h in WINDOWS if not ((t["id"], h) in cells and not cells[(t["id"], h)].service_id)]
        used = [c for c in work if c in cells]
        opens = [c for c in work if c not in cells and (day != state.today or c[1] >= state.earliest_today_hour)]
        out[day] = DayProfile(len(opens), len(used) / len(work) if work else 0.0, [h * 60 for _, h in opens], [t for t, _ in opens])
    return out


# ---- hourly: dealership ----


def dealership_profile(state, with_today: bool = False) -> dict[str, DayProfile]:
    from app.demos.dealership import state as ds
    from app.demos.dealership.store import BAYS, DRIVE_HOURS, SALES, SERVICE_HOURS

    out = {}
    for day in ds.bookable_days(state):
        if day == state.today and not with_today:
            continue
        td_work = td_used = svc_work = svc_used = 0
        starts: list[int] = []
        who: list[str] = []
        hours = [h for h in SERVICE_HOURS if ds.weekday(day) != 6 or h < 14]

        def later(h: int) -> bool:
            return day != state.today or h >= state.earliest_today_hour

        for h in DRIVE_HOURS:
            free_here = ""
            for s in SALES:
                b = next((b for b in state.busy if b.who == s["id"] and b.date == day and b.hour == h), None)
                if b is None:
                    td_work += 1
                    free_here = free_here or s["id"]
                elif b.title not in OFF_TITLES:
                    td_work += 1
                    td_used += 1
            if free_here and later(h):  # one test-drive opening per hour, however many consultants are free
                starts.append(h * 60)
                who.append(free_here)
        for h in hours:
            here = [b for b in state.busy if b.who == "bay" and b.date == day and b.hour == h]
            off = sum(1 for b in here if b.title in OFF_TITLES)
            svc_work += BAYS - off
            svc_used += len(here) - off
            if later(h) and len(here) < BAYS:
                starts.append(h * 60)
                who.append("bay")
        work = td_work + svc_work
        out[day] = DayProfile(len(starts), (td_used + svc_used) / work if work else 0.0, starts, who)
    return out


# ---- hourly: brokerage, agency, law firm (a calendar of Booked entries) ----


def _hourly(calendar, people, hours_of_person, day, state, who_attr: str) -> DayProfile:
    work = used = 0
    starts: list[int] = []
    who: list[str] = []
    for pid in people:
        for h in hours_of_person(pid):
            b = next((b for b in calendar if getattr(b, who_attr) == pid and b.date == day and b.hour == h), None)
            if b is None:
                work += 1
                if day != state.today or h >= state.earliest_today_hour:
                    starts.append(h * 60)
                    who.append(pid)
            elif b.title not in OFF_TITLES:
                work += 1
                used += 1
    return DayProfile(len(starts), used / work if work else 0.0, starts, who)


def realestate_profile(state, with_today: bool = False) -> dict[str, DayProfile]:
    from app.demos.realestate.state import bookable_days
    from app.demos.realestate.store import AGENTS, SELLER_AGENT, SHOWING_HOURS, VALUATION_HOURS

    def hrs(pid):
        return VALUATION_HOURS if pid == SELLER_AGENT else SHOWING_HOURS

    out = {}
    for day in bookable_days(state):
        if day == state.today and not with_today:
            continue
        p = _hourly(state.calendar, [a["id"] for a in AGENTS], hrs, day, state, "agent_id")
        # Density counts every showing hour, the listing specialist's included: her other hours are booked too.
        work = used = 0
        for a in AGENTS:
            for h in SHOWING_HOURS:
                b = next((b for b in state.calendar if b.agent_id == a["id"] and b.date == day and b.hour == h), None)
                if b is None or b.title not in OFF_TITLES:
                    work += 1
                    used += 1 if b is not None else 0
        p.density = used / work if work else 0.0
        out[day] = p
    return out


def insurance_profile(state, with_today: bool = False) -> dict[str, DayProfile]:
    from app.demos.insurance.state import bookable_days
    from app.demos.insurance.store import CALL_HOURS, LICENSED

    return {d: _hourly(state.calendar, LICENSED, lambda p: CALL_HOURS, d, state, "staff_id") for d in bookable_days(state) if d != state.today or with_today}


def lawfirm_profile(state, with_today: bool = False) -> dict[str, DayProfile]:
    from app.demos.lawfirm.state import bookable_days
    from app.demos.lawfirm.store import ATTORNEYS, HOURS

    return {d: _hourly(state.calendar, [a["id"] for a in ATTORNEYS], lambda p: HOURS, d, state, "attorney_id") for d in bookable_days(state) if d != state.today or with_today}


def profiles(now: datetime = NOW, with_today: bool = False) -> dict[str, dict[str, DayProfile]]:
    """Every demo's per-day DayProfile for the fortnight from `now`."""
    from app.demos.dealership.state import create_state as dealership_state
    from app.demos.dental.state import create_state as dental_state
    from app.demos.insurance.state import create_state as insurance_state
    from app.demos.lawfirm.state import create_state as lawfirm_state
    from app.demos.lune.store import CAL as LUNE
    from app.demos.northline.state import create_state as northline_state
    from app.demos.realestate.state import create_state as realestate_state
    from app.demos.tidewell.store import CAL as TIDEWELL

    return {
        "dental": dental_profile(dental_state(now), with_today),
        "northline": northline_profile(northline_state(now), with_today),
        "lune": booking_profile(LUNE, LUNE.create_state(now), with_today),
        "tidewell": booking_profile(TIDEWELL, TIDEWELL.create_state(now), with_today),
        "dealership": dealership_profile(dealership_state(now), with_today),
        "realestate": realestate_profile(realestate_state(now), with_today),
        "insurance": insurance_profile(insurance_state(now), with_today),
        "lawfirm": lawfirm_profile(lawfirm_state(now), with_today),
    }


# ---- state factories and fingerprints, to compare one date across two states ----


def states(now: datetime = NOW) -> dict:
    from app.demos.dealership.state import create_state as dealership_state
    from app.demos.dental.state import create_state as dental_state
    from app.demos.insurance.state import create_state as insurance_state
    from app.demos.lawfirm.state import create_state as lawfirm_state
    from app.demos.lune.store import CAL as LUNE
    from app.demos.northline.state import create_state as northline_state
    from app.demos.realestate.state import create_state as realestate_state
    from app.demos.tidewell.store import CAL as TIDEWELL

    return {
        "dental": dental_state(now), "northline": northline_state(now), "lune": LUNE.create_state(now), "tidewell": TIDEWELL.create_state(now),
        "dealership": dealership_state(now), "realestate": realestate_state(now), "insurance": insurance_state(now), "lawfirm": lawfirm_state(now),
    }


def entries(name: str, state, day: str) -> tuple:
    """Everything the diary holds on one date, in a form two states can be compared by."""
    if name == "dental":
        return tuple(sorted((a.op, a.start, a.minutes, a.patient, a.procedures, a.off) for a in state.book if a.date == day))
    if name == "northline":
        return tuple(sorted((j.tech_id, j.hour, j.title, j.service_id) for j in state.jobs if j.date == day))
    if name in ("lune", "tidewell"):
        return tuple(sorted((b.staff_id, b.start, b.minutes, b.title, b.off) for b in state.busy if b.date == day))
    if name == "dealership":
        return tuple(sorted((b.who, b.hour, b.title) for b in state.busy if b.date == day))
    if name == "realestate":
        return tuple(sorted((b.agent_id, b.hour, b.title) for b in state.calendar if b.date == day))
    if name == "insurance":
        return tuple(sorted((b.staff_id, b.hour, b.title) for b in state.calendar if b.date == day))
    if name == "lawfirm":
        return tuple(sorted((b.attorney_id, b.hour, b.title) for b in state.calendar if b.date == day))
    raise KeyError(name)


def off_entries(name: str, state, day: str) -> list:
    """The time off shift on one date: who, and when."""
    if name == "dental":
        return [(a.op, a.start, a.minutes, a.patient) for a in state.book if a.date == day and a.off]
    if name == "northline":
        return [(j.tech_id, j.hour, 120, j.title) for j in state.jobs if j.date == day and j.existing and not j.service_id]
    if name in ("lune", "tidewell"):
        return [(b.staff_id, b.start, b.minutes, b.title) for b in state.busy if b.date == day and b.off]
    if name == "dealership":
        return [(b.who, b.hour * 60, 60, b.title) for b in state.busy if b.date == day and b.title in OFF_TITLES]
    return [(getattr(b, "agent_id", None) or getattr(b, "staff_id", None) or b.attorney_id, b.hour * 60, 60, b.title) for b in (getattr(state, "calendar", [])) if b.date == day and b.title in OFF_TITLES]


def print_table(now: datetime = NOW) -> None:
    """Open slots per day for each demo over the fortnight from `now` (today included): python tests/calendar_helpers.py"""
    p = profiles(now, with_today=True)
    for name, days in p.items():
        print(f"{name:11s} " + "  ".join(f"{d[5:]}:{v.opens}" for d, v in days.items()))


if __name__ == "__main__":
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    print_table()
