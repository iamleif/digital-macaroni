"""What the Northline dashboard shows. Never includes anything the visitor should not see."""

from __future__ import annotations

from typing import Any

from ..types import add_days, date_label, mask_number
from .state import Job, NorthlineState, active, bookable_days, describe_slot, parse_slot, window_label
from .store import TECHNICIANS, WINDOWS, service, tech_name


def view(state: NorthlineState) -> dict[str, Any]:
    days = bookable_days(state)
    focus = (state.viewing or {}).get("date") or (active(state)[0].slot_id[:10] if active(state) else add_days(state.today, 1))
    day = focus if focus in days else days[0]
    proposed = state.request.get("proposedSlotId")
    viewing = state.viewing

    def schedule_entry(j: Job) -> dict[str, Any]:
        appt = None if j.existing else next((a for a in state.appointments if a.job_id == j.id and a.status == "booked"), None)
        entry: dict[str, Any] = {"techId": j.tech_id, "hour": j.hour, "kind": "existing" if j.existing else "demo", "title": service(j.service_id)["name"]}
        if appt:
            entry.update({"appointmentId": appt.id, "name": appt.name, "address": appt.address})
        return entry

    # Only technicians who do this kind of work and are free: an opening shown is one that could be booked.
    open_cells = []
    if viewing and viewing["date"] == day:
        for sid in viewing["slots"]:
            hour = parse_slot(sid)[1]  # type: ignore[index]
            for t in TECHNICIANS:
                if viewing["skill"] in t["skills"] and not any(j.tech_id == t["id"] and j.date == day and j.hour == hour for j in state.jobs):
                    open_cells.append({"techId": t["id"], "hour": hour})

    return {
        "timeZone": "Pacific Time",
        "today": state.today,
        "day": {"date": day, "label": date_label(day)},
        "technicians": [{"id": t["id"], "name": t["name"].split(" ")[0]} for t in TECHNICIANS],
        "windows": [{"hour": h, "label": window_label(h)} for h in WINDOWS],
        "schedule": [schedule_entry(j) for j in state.jobs if j.date == day],
        "open": open_cells,
        "proposed": parse_slot(proposed)[1] if proposed and proposed.startswith(day) else None,  # type: ignore[index]
        "request": {
            "service": service(state.request["serviceId"])["name"] if state.request.get("serviceId") else None,
            "name": state.request.get("name"),
            "address": state.request.get("address"),
            "issue": state.request.get("issue"),
            "proposed": describe_slot(proposed) if proposed else None,
        },
        "appointments": [
            {"id": a.id, "status": a.status, "service": service(a.service_id)["name"], **describe_slot(a.slot_id), "technician": tech_name(a.tech_id), "name": a.name, "address": a.address, "changes": len(a.history) - 1}
            for a in state.appointments
        ],
        "messages": [{"id": m.id, "name": m.name, "summary": m.summary, "preferredTime": m.preferred_time, "callback": mask_number(m.callback_number), "urgent": m.urgent} for m in state.messages],
        "emailed": state.emailed,
    }
