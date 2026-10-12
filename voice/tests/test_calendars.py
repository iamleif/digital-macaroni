"""
Every demo's diary should look like a real, busy business: most of everyone's working time already taken, a couple
of openings a day at different times for different people, and staff on visibly different shifts. The measuring is
in calendar_helpers.py; this file holds the targets, one test per family where the demo's own rules matter.
"""

from datetime import timedelta
from statistics import mean

import pytest

from calendar_helpers import EARLY, NOW, entries, off_entries, profiles, states

NAMES = ["dental", "northline", "lune", "tidewell", "dealership", "realestate", "insurance", "lawfirm"]
TEAM = {"dental": 4, "northline": 3, "lune": 4, "tidewell": 3, "dealership": 3, "realestate": 4, "insurance": 2, "lawfirm": 3}
# Three different fortnights: this one, one a week and a half on, and one six weeks on.
STARTS = [NOW, NOW + timedelta(days=10), NOW + timedelta(days=45)]


@pytest.fixture(scope="module")
def fortnights():
    return [profiles(n) for n in STARTS]


@pytest.mark.parametrize("name", NAMES)
def test_every_bookable_day_keeps_one_to_five_openings_and_a_fortnight_averages_two_to_four(fortnights, name):
    for f in fortnights:
        days = f[name]
        assert len(days) >= 9
        assert all(1 <= p.opens <= 5 for p in days.values()), {d: p.opens for d, p in days.items()}
        assert 2.0 <= mean(p.opens for p in days.values()) <= 4.0
        # Some days are busier than others, none is wide open.
        assert len({p.opens for p in days.values()}) >= 2


@pytest.mark.parametrize("name", NAMES)
def test_most_of_everyones_working_time_is_already_taken(fortnights, name):
    for f in fortnights:
        days = f[name]
        assert 0.70 <= mean(p.density for p in days.values()) <= 0.95
        assert all(p.density >= 0.5 for p in days.values()), {d: round(p.density, 2) for d, p in days.items()}


@pytest.mark.parametrize("name", NAMES)
def test_openings_are_spread_over_the_day_and_over_the_people(fortnights, name):
    for f in fortnights:
        starts = [s for p in f[name].values() for s in p.starts]
        people = {w for p in f[name].values() for w in p.who}
        assert len(people) >= min(3, TEAM[name]) and len(set(starts)) >= (4 if name in ("northline", "insurance") else 6)
        lo, hi = min(starts), max(starts)
        mid = (lo + hi) / 2
        early = sum(1 for s in starts if s < mid)
        assert 0.2 <= early / len(starts) <= 0.8  # not always mornings, not always afternoons
        # No single time of day or single person holds most of the openings.
        assert max(starts.count(s) for s in set(starts)) / len(starts) < 0.4
        counts = [sum(1 for p in f[name].values() for w in p.who if w == person) for person in people]
        assert max(counts) / len(starts) < (0.7 if TEAM[name] == 2 else 0.6)


@pytest.mark.parametrize("name", NAMES)
def test_a_date_looks_the_same_on_every_call_and_different_dates_differ(name):
    a, b = states(NOW)[name], states(NOW + timedelta(hours=9, minutes=40))[name]
    c = states(NOW + timedelta(days=3))[name]
    days = sorted({d for d in profiles_days(name, a)})
    same = [d for d in days if d not in (a.today, b.today)]
    assert same and all(entries(name, a, d) == entries(name, b, d) for d in same)
    # A state made three days later agrees on every date both of them cover, apart from their own todays.
    both = [d for d in days if d in set(profiles_days(name, c)) and d not in (a.today, c.today)]
    assert both and all(entries(name, a, d) == entries(name, c, d) for d in both)
    # Different dates, and different weeks, are not copies of each other.
    assert len({entries(name, a, d) for d in days}) == len(days)
    week1, week2 = days[: len(days) // 2], days[len(days) // 2 :]
    assert [entries(name, a, d) for d in week1] != [entries(name, a, d) for d in week2]


def profiles_days(name, state):
    from calendar_helpers import booking_profile, dealership_profile, dental_profile, insurance_profile, lawfirm_profile, northline_profile, realestate_profile
    from app.demos.lune.store import CAL as LUNE
    from app.demos.tidewell.store import CAL as TIDEWELL

    fn = {"dental": dental_profile, "northline": northline_profile, "dealership": dealership_profile, "realestate": realestate_profile, "insurance": insurance_profile, "lawfirm": lawfirm_profile}
    if name in fn:
        return list(fn[name](state, with_today=True))
    return list(booking_profile(LUNE if name == "lune" else TIDEWELL, state, with_today=True))


@pytest.mark.parametrize("name", NAMES)
def test_people_work_different_shifts_and_time_off_shows_as_out_lunch_or_admin(name):
    state = states(NOW)[name]
    days = [d for d in profiles_days(name, state) if d != state.today]
    off = {d: off_entries(name, state, d) for d in days}
    flat = [x for v in off.values() for x in v]
    assert flat and {x[3] for x in flat} <= {"Out", "Lunch", "Admin", "Tech out"}
    # Someone is out on some days and not others, and the shape of the day (who is out, and when) varies day to day.
    assert len({tuple(sorted((x[0], x[1]) for x in v)) for v in off.values()}) >= 4
    assert len({x[0] for x in flat}) >= min(3, TEAM[name])


@pytest.mark.parametrize("name", ["dental", "northline", "lune", "tidewell"])
def test_nothing_is_open_today_before_the_earliest_bookable_time(name):
    state = states(EARLY + timedelta(days=1, hours=4))[name]  # a Tuesday, when all four are open
    p = profiles_days(name, state)
    assert state.today in p
    from calendar_helpers import booking_profile, dental_profile, northline_profile
    from app.demos.lune.store import CAL as LUNE
    from app.demos.tidewell.store import CAL as TIDEWELL

    prof = {"dental": lambda s: dental_profile(s, True), "northline": lambda s: northline_profile(s, True), "lune": lambda s: booking_profile(LUNE, s, True), "tidewell": lambda s: booking_profile(TIDEWELL, s, True)}[name](state)
    floor = getattr(state, "earliest_today", None) or state.earliest_today_hour * 60
    assert all(s >= floor - 29 for s in prof[state.today].starts)  # a stretch that began earlier but runs past it still counts


# ---- every kind of visit has room on at least four of the fourteen days ----


def _days_with(state, days, fn):
    return [d for d in days if fn(d)]


def test_dental_every_visit_type_has_openings_on_four_days_and_the_emergency_holds_stay():
    from app.demos.dental import state as ds
    from app.demos.dental.store import TYPES

    st = states(NOW)["dental"]
    days = ds.bookable_days(st)
    for t in TYPES:
        assert len(_days_with(st, days, lambda d: ds.open_slots(st, t["id"], d))) >= 4, t["id"]
    # The holds are in the book: 10:30 in OP-1 and 2:00 in OP-2 are never given to an existing patient.
    for d in days:
        assert not [a for a in st.book if a.date == d and not a.off and a.op == "op1" and a.start < 11 * 60 and a.start + a.minutes > 10 * 60 + 30]
        assert not [a for a in st.book if a.date == d and not a.off and a.op == "op2" and a.start < 14 * 60 + 30 and a.start + a.minutes > 14 * 60]
    mondays_to_thursdays = [d for d in days if ds.weekday(d) in (1, 2, 3, 4) and d != st.today]
    assert all(ds.open_slots(st, "emergency", d) for d in mondays_to_thursdays)


def test_dental_view_draws_time_off_as_blocks_and_keeps_the_lunch_band():
    from app.demos.dental import dental

    st = states(NOW)["dental"]
    st.viewing = {"date": "2026-10-14", "slots": [], "type": "cleaning"}
    board = dental.view(st)["board"]
    off = [a for a in board["appts"] if a.get("off")]
    assert off and all(a["kind"] == "existing" and a["patient"] in ("Out", "Lunch", "Admin") for a in off)
    assert board["lunch"] == [720, 780]
    assert {o["id"] for o in board["ops"]} == {a["op"] for a in board["appts"]}


def test_northline_heating_and_cooling_have_room_on_four_days_and_time_off_shows_on_the_board():
    from app.demos.northline import northline
    from app.demos.northline import state as ns

    st = states(NOW)["northline"]
    days = ns.bookable_days(st)
    for skill in ("heating", "cooling"):
        assert len([d for d in days if ns.open_slots(st, d, skill)]) >= 4, skill
    st.viewing = {"date": days[2], "slots": [], "skill": "heating"}
    v = northline.view(st)
    out = [j for j in v["schedule"] if j.get("off")]
    assert out and all(j["kind"] == "existing" and j["title"] in ("Out", "Lunch", "Admin") and "name" not in j for j in out)


def test_dealership_test_drives_and_service_each_have_room_on_four_days():
    from app.demos.dealership import state as ds

    st = states(NOW)["dealership"]
    days = ds.bookable_days(st)
    for purpose in ("test_drive", "service"):
        assert len([d for d in days if ds.open_slots(st, purpose, d)]) >= 4, purpose
    # Four bays: some are staffed shorter days, so the number of bays free in an hour is never the full four.
    assert any(b.title == "Tech out" for b in st.busy)


def test_brokerage_every_agent_and_valuations_have_room_on_four_days():
    from app.demos.realestate import state as rs
    from app.demos.realestate.store import AGENTS, SELLER_AGENT

    st = states(NOW)["realestate"]
    days = rs.bookable_days(st)
    for a in AGENTS:
        purpose = "valuation" if a["id"] == SELLER_AGENT else "showing"
        assert len([d for d in days if rs.open_slots(st, purpose, a["id"], d)]) >= 4, a["id"]


def test_insurance_calls_have_room_on_nine_days():
    from app.demos.insurance import state as isx

    st = states(NOW)["insurance"]
    assert len([d for d in isx.bookable_days(st) if isx.open_slots(st, d)]) >= 9


def test_law_firm_every_kind_of_case_has_room_and_the_senior_partner_is_always_free_for_something():
    from app.demos.lawfirm import state as ls
    from app.demos.lawfirm.store import ACCIDENT_TYPES, ATTORNEYS, SENIOR_PARTNER

    st = states(NOW)["lawfirm"]
    days = [d for d in ls.bookable_days(st) if d != st.today]
    for kind in ACCIDENT_TYPES:
        pool = [a["id"] for a in ATTORNEYS if kind in a["types"]]
        if not pool:
            continue
        assert len([d for d in days if ls.open_slots(st, d, pool)]) >= 4, kind
    assert all(ls.open_slots(st, d, [SENIOR_PARTNER]) for d in days)
