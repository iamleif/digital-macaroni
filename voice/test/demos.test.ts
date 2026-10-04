import { describe, expect, it } from "vitest";
import { formfield, type FormFieldState } from "../src/demos/formfield.js";
import { issueIsVague, northline, type NorthlineState } from "../src/demos/northline.js";
import { addDays, type OpResult } from "../src/demos/types.js";

// A Thursday morning in Chicago.
const NOW = new Date("2026-10-01T14:00:00Z");
const ctx = { now: NOW, channel: "browser" as const };

function nl() {
  const state = northline.createState(NOW) as NorthlineState;
  const run = (op: string, input: Record<string, unknown> = {}) => northline.operations[op]!.run(state, input as never, ctx);
  return { state, run };
}
function ff() {
  const state = formfield.createState(NOW) as FormFieldState;
  const run = (op: string, input: Record<string, unknown> = {}) => formfield.operations[op]!.run(state, input as never, ctx);
  return { state, run };
}
const res = (r: OpResult) => (r.ok ? r.result : (r.result ?? {})) as Record<string, any>;

describe("Northline", () => {
  const tomorrow = "2026-10-02";

  it("uses the session's own date and offers only open windows", () => {
    const { state, run } = nl();
    expect(state.today).toBe("2026-10-01");
    const r = run("check_availability", { service: "heating_repair", date: tomorrow, partOfDay: "afternoon" });
    expect(r.ok).toBe(true);
    const slots = res(r).available.map((s: any) => s.slotId);
    expect(slots.length).toBeGreaterThan(0);
    // Tomorrow's 12–2 window is fully booked in the fixture.
    expect(slots).not.toContain(`${tomorrow}T12`);
    expect(state.offered).toEqual(expect.arrayContaining(slots));
  });

  it("refuses to propose or book a time it never offered", () => {
    const { run } = nl();
    expect(run("note_request_details", { proposedSlotId: `${tomorrow}T14` }).ok).toBe(false);
    const r = run("book_appointment", { slotId: `${tomorrow}T14`, service: "heating_repair", name: "Alex", address: "48 Birch Lane", issue: "No heat", callerConfirmed: true });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("slot_not_offered");
  });

  it("books once, returns the same booking on a retry, and moves the same record", () => {
    const { state, run } = nl();
    const slots = res(run("check_availability", { service: "heating_repair", date: tomorrow })).available.map((s: any) => s.slotId);
    const booking = { slotId: slots[0], service: "heating_repair", name: "Alex Taylor", address: "48 Birch Lane", issue: "Furnace not heating", callerConfirmed: true };
    const first = run("book_appointment", booking);
    expect(first.ok).toBe(true);
    const again = run("book_appointment", booking);
    expect(res(again).duplicate).toBe(true);
    expect(res(again).appointmentId).toBe(res(first).appointmentId);
    expect(state.appointments).toHaveLength(1);
    // A second, different booking in the same call is refused: changes go through reschedule.
    const other = run("book_appointment", { ...booking, slotId: slots[1] });
    expect(!other.ok && other.error).toBe("already_booked");

    const moved = run("reschedule_appointment", { appointmentId: res(first).appointmentId, newSlotId: slots[1], callerConfirmed: true });
    expect(moved.ok).toBe(true);
    expect(state.appointments).toHaveLength(1);
    expect(state.appointments[0]!.slotId).toBe(slots[1]);
    expect(state.jobs.filter((j) => !j.existing)).toHaveLength(1);

    const cancelled = run("cancel_appointment", { appointmentId: res(first).appointmentId, callerConfirmed: true });
    expect(cancelled.ok).toBe(true);
    expect(state.jobs.filter((j) => !j.existing)).toHaveLength(0);
  });

  it("tells a category from a symptom", () => {
    for (const vague of ["Heating and cooling", "probably some kind of heating or cooling", "HVAC issue", "Heating repair", "something with the AC", "furnace problem", "not sure, my system"]) {
      expect(issueIsVague(vague), vague).toBe(true);
    }
    for (const real of ["No heat", "Furnace not heating", "AC blowing warm air", "Rattling noise from the furnace", "Water leaking under the unit", "keeps turning on and off"]) {
      expect(issueIsVague(real), real).toBe(false);
    }
  });

  it("will not book a repair until it knows what the caller has noticed", () => {
    const { state, run } = nl();
    const slots = res(run("check_availability", { service: "heating_repair", date: tomorrow })).available.map((s: any) => s.slotId);
    const booking = { slotId: slots[0], service: "heating_repair", name: "Alex", address: "48 Birch Lane", issue: "Heating and cooling", callerConfirmed: true };
    const r = run("book_appointment", booking);
    expect(!r.ok && r.error).toBe("issue_too_vague");
    expect(state.appointments).toHaveLength(0);
    expect(run("book_appointment", { ...booking, issue: "House not warming up, furnace runs" }).ok).toBe(true);
  });

  it("books a tune-up or estimate on request alone, with the right technicians", () => {
    const { run } = nl();
    const slots = res(run("check_availability", { service: "cooling_tune_up", date: tomorrow })).available.map((s: any) => s.slotId);
    expect(run("book_appointment", { slotId: slots[0], service: "cooling_tune_up", name: "Alex", address: "48 Birch Lane", issue: "AC tune-up", callerConfirmed: true }).ok).toBe(true);
    const info = res(run("get_business_info"));
    expect(info.services.find((s: any) => s.service === "replacement_estimate").callOutFee).toBe("Free");
  });

  it("keeps a category off the request card and says so", () => {
    const { state, run } = nl();
    const r = run("note_request_details", { service: "heating_repair", issue: "heating or cooling" });
    expect(r.ok).toBe(true);
    expect(state.request.issue).toBeUndefined();
    expect(res(r).issueNotRecorded).toBeTruthy();
    run("note_request_details", { issue: "No heat upstairs" });
    expect(state.request.issue).toBe("No heat upstairs");
  });

  it("gives only what is new after booking", () => {
    const { run } = nl();
    const slots = res(run("check_availability", { service: "heating_repair", date: tomorrow })).available.map((s: any) => s.slotId);
    const r = res(run("book_appointment", { slotId: slots[0], service: "heating_repair", name: "Alex", address: "48 Birch Lane", issue: "No heat", callerConfirmed: true }));
    expect(Object.keys(r).sort()).toEqual(["appointmentId", "callsAhead", "technician"]);
  });

  it("offers next openings when a day has none, and says Sunday is closed", () => {
    const { state, run } = nl();
    const sunday = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(state.today, i)).find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0)!;
    const r = run("check_availability", { service: "plumbing_repair", date: sunday });
    expect(r.ok).toBe(true);
    expect(res(r).available).toEqual([]);
    expect(res(r).reason).toBe("closed_sunday");
    expect(res(r).nextAvailable.length).toBeGreaterThan(0);
  });

  it("takes a message once", () => {
    const { state, run } = nl();
    const msg = { name: "Alex", callbackNumber: "555-0142", summary: "Wants a quote for a new boiler" };
    expect(run("take_message", msg).ok).toBe(true);
    expect(res(run("take_message", msg)).duplicate).toBe(true);
    expect(state.messages).toHaveLength(1);
  });

  it("shows openings only for technicians who do that work", () => {
    const { state, run } = nl();
    run("check_availability", { service: "plumbing_repair", date: "2026-10-03" });
    const view = northline.view(state) as any;
    expect(view.open.length).toBeGreaterThan(0);
    expect(view.open.every((o: any) => o.techId !== "maya")).toBe(true);
  });

  it("shows other customers' jobs without their details", () => {
    const { state } = nl();
    const view = northline.view(state) as any;
    expect(view.schedule.every((j: any) => j.kind === "existing" && !("name" in j) && !("address" in j))).toBe(true);
  });
});

describe("Form & Field", () => {
  it("finds a green lamp under $100 from the catalogue", () => {
    const { run } = ff();
    const r = run("search_products", { query: "table lamp", color: "green", maxPrice: 100 });
    expect(r.ok).toBe(true);
    const names = res(r).matches.map((m: any) => m.name);
    expect(names).toEqual(["Ridge Table Lamp"]);
  });

  it("refuses an out-of-stock option and suggests what is available", () => {
    const { run } = ff();
    const r = run("reserve_item", { variantId: "ridge-oat", quantity: 1, name: "Sam", callerConfirmed: true });
    expect(r.ok).toBe(false);
    expect(res(r).otherOptions.map((o: any) => o.variantId)).toEqual(["ridge-sage", "ridge-charcoal"]);
  });

  it("reserves, holds stock, changes quantity, and releases it on cancel", () => {
    const { state, run } = ff();
    const first = run("reserve_item", { variantId: "ridge-sage", quantity: 2, name: "Sam", callerConfirmed: true });
    expect(first.ok).toBe(true);
    const detail = (id: string) => res(run("get_product_details", { productId: "ridge-lamp" })).options.find((o: any) => o.variantId === id).inStock;
    expect(detail("ridge-sage")).toBe(1);
    expect(res(run("reserve_item", { variantId: "ridge-sage", quantity: 2, name: "Sam", callerConfirmed: true })).duplicate).toBe(true);
    const tooMany = run("update_reservation", { reservationId: res(first).reservationId, quantity: 4, callerConfirmed: true });
    expect(!tooMany.ok && tooMany.error).toBe("insufficient_stock");
    expect(run("update_reservation", { reservationId: res(first).reservationId, quantity: 3, callerConfirmed: true }).ok).toBe(true);
    expect(detail("ridge-sage")).toBe(0);
    expect(run("cancel_reservation", { reservationId: res(first).reservationId, callerConfirmed: true }).ok).toBe(true);
    expect(detail("ridge-sage")).toBe(3);
    expect(state.reservations[0]!.status).toBe("cancelled");
  });

  it("only discusses an order when number and email both match", () => {
    const { state, run } = ff();
    expect(run("lookup_order", { orderNumber: "1042", email: "someone@example.com" }).ok).toBe(false);
    expect(run("create_support_request", { issue: "Mug arrived chipped" }).ok).toBe(false);
    expect(run("lookup_order", { orderNumber: "order 1042", email: "Emilia at example dot com" }).ok).toBe(true);
    const req = run("create_support_request", { issue: "Mug arrived chipped" });
    expect(res(req).status).toBe("pending review");
    expect(state.supportRequests).toHaveLength(1);
  });
});
