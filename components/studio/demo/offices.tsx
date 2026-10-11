import { Fragment, createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ProductArt, swatch } from "../live/product-art";
import { formfieldEmpty } from "../live/sample-views";
import type { AppointmentView, BrandId, DealershipView, DentalView, FormFieldView, HotelsStage, HotelsView, InsuranceView, LawFirmView, RealEstateView, NorthlineView, RecordField, TravelJourney, TravelSeatCell, TravelSeatMap, TravelStage, TravelView } from "../live/types";
import { BrandMark } from "../brand-marks";
import { ArrowRight, Bed, Calendar, Check, Clock, Coffee, Globe, Grid, Home, Inbox, Lock, MapPin, Phone, Search, Seat, Settings, Suitcase, User } from "../icons";
import d from "./demo.module.css";

/*
 * Each demo business's back office, as its staff would see it while the agent works. Rendered only
 * from the session's records (or the sample records before a call), so what changes on screen is
 * exactly what the agent did.
 */

export type LiveState = "sample" | "live" | "finished";

/** True when a back office is shown as a still picture (the homepage examples): nothing types itself or opens. */
export const StaticPreview = createContext(false);

const STATE_LABEL: Record<LiveState, string> = { sample: "Sample data", live: "Your call · live", finished: "Your call · finished" };

/** The agent's latest step on the call. Each back office follows it to the screen that step changes. */
export type Cue = { tool: string; id: string } | null;
type IconC = (p: { size?: number }) => ReactNode;
type Screen = { id: string; label: string; icon: IconC; count?: number; body: ReactNode };

/** The screen the agent's work points to: the newest step that maps to a screen wins; before any, `start`. */
function useFollow(cue: Cue | undefined, map: Record<string, string>, start: string): string {
  const [on, setOn] = useState(start);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!cue) { seen.current = null; setOn(start); return; }
    if (cue.id === seen.current) return;
    seen.current = cue.id;
    const to = map[cue.tool];
    if (to) setOn(to);
  }, [cue, map, start]);
  return on;
}

/**
 * The business's software: a sidebar of screens and one screen at a time, sized to the frame. The screen
 * follows the agent (`active`); a click opens another, until the agent's next step takes it back.
 */
function Screens({ id, kicker, title, tools, state, screens, active, cue, head }: { id: BrandId; kicker: string; title: string; tools?: ReactNode; state: LiveState; screens: Screen[]; active: string; cue?: Cue; head?: ReactNode }) {
  const still = useContext(StaticPreview);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { setPicked(null); }, [active, cue?.id]);
  const on = screens.find((x) => x.id === (picked ?? active)) ?? screens[0]!;
  // A still picture (the homepage) has no clicks: it shows the main screen with the next one under it, so the frame is full.
  const next = still ? screens[screens.indexOf(on) + 1] : undefined;
  const buttons = screens.map((x) => <button key={x.id} type="button" data-on={x.id === on.id || undefined} aria-pressed={x.id === on.id} onClick={() => setPicked(x.id)} title={x.label}>
    <x.icon size={17} /><small>{x.label}</small>{x.count ? <i>{x.count}</i> : null}
  </button>);
  return <div className={d.app} data-demo={id} data-screens>
    <nav className={d.rail} aria-label="Screens">
      <span className={d.railLogo}><BrandMark id={id} size={30} /></span>
      {buttons}
      <span className={d.railEnd}><Settings size={17} /></span>
    </nav>
    <div className={d.appMain}>
      <header className={d.appHead}>
        <div><small>{kicker}</small><h2>{title}</h2></div>
        <div className={d.appTools}>
          {tools}
          <span className={d.statePill} data-state={state}><i />{STATE_LABEL[state]}</span>
        </div>
      </header>
      <nav className={d.tabs} aria-label="Screens">{buttons}</nav>
      {head}
      <div className={d.screen} key={on.id}>{on.body}</div>
      {next ? <div className={d.screen} key={next.id}>{next.body}</div> : null}
    </div>
  </div>;
}

function Card({ title, meta, children, wide }: { title: string; meta?: ReactNode; children: ReactNode; wide?: boolean }) {
  return <section className={d.card} data-wide={wide || undefined}>
    <div className={d.cardHead}><h3>{title}</h3>{meta != null ? <span>{meta}</span> : null}</div>
    {children}
  </section>;
}

function Field({ label, value, note }: { label: string; value: string | null | undefined; note?: string }) {
  return <div className={d.field} data-filled={Boolean(value)}>
    <dt><i aria-hidden="true">{value ? <Check size={11} /> : null}</i>{label}</dt>
    <dd key={value ?? "empty"}>{value ?? <span className={d.dash}>Waiting</span>}{note && value ? <em>{note}</em> : null}</dd>
  </div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={d.empty}>{children}</p>;
}

/** A confirmation the agent emailed after the caller's yes. The address arrives masked. */
function Emailed({ to, what }: { to: string; what: string }) {
  return <div className={d.emailed} role="status"><span><Inbox size={16} /></span><div><b>Emailed to {to}</b><small>{what} · sent after the caller&rsquo;s yes</small></div></div>;
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const TONES = ["a", "b", "c", "d"];

/* ---------------- Northline ---------------- */

export function NorthlineOffice({ view, state, agentName, cue }: { view: NorthlineView; state: LiveState; agentName: string; cue?: Cue }) {
  const job = (techId: string, hour: number) => view.schedule.find((j) => j.techId === techId && j.hour === hour);
  const isOpen = (techId: string, hour: number) => view.open.some((o) => o.techId === techId && o.hour === hour);
  const r = view.request;
  const booked = [...view.appointments].reverse().find((a) => a.status === "booked");
  const time = booked ? `${booked.day}, ${booked.window}` : r.proposed ? `${r.proposed.day}, ${r.proposed.window}` : null;
  const filled = [r.service, r.name, r.address, r.issue, time].filter(Boolean).length;
  const slots = view.technicians.length * view.windows.length;
  const taken = view.schedule.length;
  let proposedShown = false;
  const active = useFollow(cue, NORTHLINE_SCREENS, "schedule");

  const schedule = <>
    <div className={d.kpis}>
      <div><span>Technicians</span><strong>{view.technicians.length}</strong></div>
      <div><span>Windows booked</span><strong>{taken}<small>/{slots}</small></strong></div>
      <div data-hot={view.open.length > 0 || undefined}><span>Open for this job</span><strong>{view.open.length || "—"}</strong></div>
      <div data-hot={Boolean(booked) || undefined}><span>Your visit</span><strong>{booked ? booked.id : "—"}</strong></div>
    </div>
    <section className={d.board} aria-label="Dispatch board">
      <div className={d.boardGrid} style={{ gridTemplateColumns: `100px repeat(${view.windows.length}, minmax(92px, 1fr))` }}>
        <span className={d.boardCorner}>Technician</span>
        {view.windows.map((w) => <span key={w.hour} className={d.boardHour}>{w.label}</span>)}
        {view.technicians.map((t, row) => [
          <span key={t.id} className={d.tech}><i data-tone={TONES[row % 4]}>{initials(t.name)}</i><b>{t.name}</b></span>,
          ...view.windows.map((w) => {
            const j = job(t.id, w.hour);
            let content: ReactNode = null;
            if (j?.kind === "demo") content = <div key={`${j.appointmentId}-${w.hour}`} className={d.jobMine}>
              <span className={d.jobTag}>{j.appointmentId} · by {agentName}</span>
              <b>{j.title}</b><small>{j.name}</small><small>{j.address}</small>
            </div>;
            else if (j) content = <div className={d.jobBusy} title="Booked by another customer"><b>{j.title}</b><small>Booked</small></div>;
            else if (isOpen(t.id, w.hour) && view.proposed === w.hour && !proposedShown) {
              proposedShown = true;
              content = <div className={d.jobProposed}><b>Proposed</b><small>Waiting for a yes</small></div>;
            } else if (isOpen(t.id, w.hour)) content = <div className={d.jobOpen}>Open</div>;
            return <div key={`${t.id}${w.hour}`} className={d.slot}>{content}</div>;
          }),
        ])}
      </div>
    </section>
  </>;

  const booking = <div className={d.cards}>
    <Card title="Service request" meta={<span className={d.progress}><i style={{ width: `${filled * 20}%` }} />{filled}/5</span>}>
      <dl className={d.fields}>
        <Field label="Service" value={r.service} />
        <Field label="Name" value={r.name} />
        <Field label="Address" value={r.address} />
        <Field label="Problem" value={r.issue} />
        <Field label="Time" value={time} note={booked ? "Booked" : r.proposed ? "Proposed" : undefined} />
      </dl>
    </Card>
    <Card title="Visits" meta={view.appointments.length || "None yet"}>
      {view.appointments.length ? <ul className={d.list}>{view.appointments.map((a) => <li key={a.id} data-status={a.status}>
        <span className={d.listIcon}><Calendar size={15} /></span>
        <div><b>{a.service} · {a.id}</b><small>{a.day}, {a.window} · {a.technician}</small><small>{a.name}, {a.address}</small></div>
        <em data-status={a.status}>{a.status === "cancelled" ? "Cancelled" : a.changes ? `Moved ${a.changes}×` : "Booked"}</em>
      </li>)}</ul> : <Empty>A visit appears here once {agentName} books it.</Empty>}
      {view.emailed ? <Emailed to={view.emailed.to} what={`Confirmation for ${view.emailed.reference}`} /> : null}
    </Card>
  </div>;

  return <Screens id="northline" kicker={`Dispatch · ${view.timeZone}`} title={view.day.label} state={state} active={active} cue={cue} screens={[
    { id: "schedule", label: "Schedule", icon: Calendar, body: schedule },
    { id: "booking", label: "Booking", icon: User, body: booking },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: <Messages items={view.messages} empty="Callback requests for the team land here." /> },
  ]} />;
}
const NORTHLINE_SCREENS: Record<string, string> = { note_request_details: "booking", get_business_info: "booking", check_availability: "schedule", book_appointment: "schedule", reschedule_appointment: "schedule", cancel_appointment: "booking", email_confirmation: "booking", take_message: "inbox" };

/** Callback requests and messages for the team: the same inbox in every business. */
function Messages({ items, empty, title = "Messages" }: { items: { id: string; name: string; summary: string; preferredTime?: string | null; callback?: string; for?: string | null; urgent?: boolean }[]; empty: string; title?: string }) {
  return <Card title={title} meta={items.length || "Inbox empty"}>
    {items.length ? <ul className={d.list}>{items.map((m) => <li key={m.id}>
      <span className={d.listIcon}><Phone size={15} /></span>
      <div><b>{m.name} · {m.id}{m.urgent ? " · urgent" : ""}</b><small>{m.summary}</small>{m.for || m.callback || m.preferredTime ? <small>{[m.for ? `For ${m.for}` : null, m.callback ? `call back ${m.callback}` : null, m.preferredTime ?? null].filter(Boolean).join(" · ")}</small> : null}</div>
    </li>)}</ul> : <Empty>{empty}</Empty>}
  </Card>;
}

/* ---------------- Ellie's other front desks: salon / med spa and clinic ---------------- */

const WORDS = {
  salon: { brand: "lune" as const, kicker: "Front desk", staff: "Stylist", staffs: "Team today", menu: "Service menu", request: "New booking", list: "Appointments", mine: "Booked on this call" },
  clinic: { brand: "tidewell" as const, kicker: "Reception", staff: "Practitioner", staffs: "Practitioners", menu: "Visit types", request: "Patient booking", list: "Visits", mine: "Booked on this call" },
};

const ampm = (m: number) => { const h = Math.floor(m / 60); const mm = m % 60; return `${(h + 11) % 12 + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`; };
const GROUP_TONE: Record<string, string> = { Hair: "a", Colour: "b", Nails: "c", "Med spa": "d", Chiropractic: "a", Physiotherapy: "c", Massage: "b" };

/** A salon's book: a tall column per stylist with their photo, 15-minute rows, each treatment its real length. */
function SalonBook({ view, agentName }: { view: AppointmentView; agentName: string }) {
  const ROWH = 11;
  const y = (m: number) => ((m - view.dayStart) / 15) * ROWH;
  const rows = (view.dayEnd - view.dayStart) / 15;
  return <section className={d.salon} aria-label="The day by stylist">
    <div className={d.salonHead} style={{ gridTemplateColumns: `52px repeat(${view.staff.length}, minmax(0, 1fr))` }}>
      <span />
      {view.staff.map((p) => <span key={p.id} className={d.salonWho}>{p.photo ? <img src={p.photo} alt="" /> : <i>{initials(p.name)}</i>}<b>{p.name}</b><small>{p.role}</small></span>)}
    </div>
    <div className={d.salonBody} style={{ gridTemplateColumns: `52px repeat(${view.staff.length}, minmax(0, 1fr))`, height: rows * ROWH }}>
      <div className={d.salonTimes}>{Array.from({ length: rows / 2 }, (_, i) => view.dayStart + i * 30).map((m) => <span key={m} style={{ top: y(m) }} data-hour={m % 60 === 0 || undefined}>{m % 60 === 0 ? ampm(m) : ""}</span>)}</div>
      {view.staff.map((p) => <div key={p.id} className={d.salonCol}>
        {view.open.filter((o) => o.staffId === p.id).map((o) => <div key={`o${o.start}`} className={d.salonOpen} style={{ top: y(o.start), height: 2 * ROWH - 2 }}><b>Open {ampm(o.start)}</b></div>)}
        {view.proposed && view.proposed.staffId === p.id ? <div className={d.salonProposed} style={{ top: y(view.proposed.start), height: (view.proposed.minutes / 15) * ROWH - 2 }}><b>Proposed</b><small>Waiting for a yes</small></div> : null}
        {view.schedule.filter((j) => j.staffId === p.id).map((j) => <div key={`${j.start}${j.title}`} className={d.salonAppt} data-tone={GROUP_TONE[j.group] ?? "a"} data-mine={j.kind === "demo" || undefined} style={{ top: y(j.start), height: (j.minutes / 15) * ROWH - 2 }}>
          {j.kind === "demo" ? <span className={d.apptTag}>{j.ref} · by {agentName}</span> : null}
          <small>{ampm(j.start)} – {ampm(j.start + j.minutes)}</small>
          <b>{j.kind === "demo" ? j.name : j.title}</b>
          {j.minutes >= 45 ? <small>{j.kind === "demo" ? j.title : "Booked"}</small> : null}
        </div>)}
      </div>)}
    </div>
  </section>;
}

/** A clinic's day: a row per practitioner, the hours across, each visit its real length. */
function ClinicBoard({ view, agentName }: { view: AppointmentView; agentName: string }) {
  const span = view.dayEnd - view.dayStart;
  const x = (m: number) => `${((m - view.dayStart) / span) * 100}%`;
  const w = (m: number) => `calc(${(m / span) * 100}% - 3px)`;
  const hours = Array.from({ length: span / 60 }, (_, i) => view.dayStart + i * 60);
  return <section className={d.clinic} aria-label="The day by practitioner"><div className={d.clinicInner}>
    <div className={d.clinicHours}><span /><div>{hours.map((h) => <span key={h} style={{ left: x(h) }}>{ampm(h)}</span>)}</div></div>
    {view.staff.map((p, row) => <div key={p.id} className={d.clinicRow}>
      <span className={d.tech}><i data-tone={TONES[row % 4]}>{initials(p.name.replace("Dr. ", ""))}</i><span className={d.techWho}><b>{p.name}</b><small>{p.role}</small></span></span>
      <div className={d.clinicLane}>
        {hours.map((h) => <i key={h} style={{ left: x(h) }} />)}
        {view.open.filter((o) => o.staffId === p.id).map((o) => <div key={`o${o.start}`} className={d.clinicOpen} style={{ left: x(o.start), width: w(30) }}>Open {ampm(o.start)}</div>)}
        {view.proposed && view.proposed.staffId === p.id ? <div className={d.clinicProposed} style={{ left: x(view.proposed.start), width: w(view.proposed.minutes) }}>Proposed</div> : null}
        {view.schedule.filter((j) => j.staffId === p.id).map((j) => <div key={`${j.start}${j.title}`} className={d.clinicAppt} data-tone={GROUP_TONE[j.group] ?? "a"} data-mine={j.kind === "demo" || undefined} style={{ left: x(j.start), width: w(j.minutes) }} title={`${ampm(j.start)} · ${j.title}`}>
          {j.kind === "demo" ? <span className={d.apptTag}>{j.ref} · by {agentName}</span> : null}
          <b>{j.kind === "demo" ? j.name : j.title}</b>
          <small>{ampm(j.start)} · {j.minutes} min</small>
        </div>)}
      </div>
    </div>)}
  </div></section>;
}

export function AppointmentOffice({ view, state, agentName, cue }: { view: AppointmentView; state: LiveState; agentName: string; cue?: Cue }) {
  const w = WORDS[view.skin];
  const booked = [...view.appointments].reverse().find((a) => a.status === "booked");
  const filled = view.request.filter((r) => r.value).length;
  const groups = [...new Set(view.menu.map((m) => m.group))];
  const active = useFollow(cue, APPOINTMENT_SCREENS, "day");

  const bookedMin = view.schedule.reduce((n, j) => n + j.minutes, 0);
  const day = <>
    <div className={d.kpis}>
      <div><span>{w.staffs}</span><strong>{view.staff.length}</strong></div>
      <div><span>Hours booked</span><strong>{Math.round(bookedMin / 60)}<small>/{Math.round((view.staff.length * (view.dayEnd - view.dayStart)) / 60)}</small></strong></div>
      <div data-hot={view.open.length > 0 || undefined}><span>Open for this</span><strong>{view.open.length || "—"}</strong></div>
      <div data-hot={Boolean(booked) || undefined}><span>{w.mine}</span><strong>{booked ? booked.id : "—"}</strong></div>
    </div>
    {view.skin === "salon" ? <SalonBook view={view} agentName={agentName} /> : <ClinicBoard view={view} agentName={agentName} />}
  </>;

  const booking = <div className={d.cards}>
    <div className={d.stack}>
      <Card title={w.request} meta={<span className={d.progress}><i style={{ width: `${(filled / view.request.length) * 100}%` }} />{filled}/{view.request.length}</span>}>
        <dl className={d.fields}>{view.request.map((r) => <Field key={r.label} label={r.label} value={r.value} note={r.note} />)}</dl>
      </Card>
      {view.extras ? <Card title={view.extras.title}>
        <ul className={d.extras}>{view.extras.rows.map((r) => <li key={r.label} data-tone={r.tone}><span>{r.label}</span><b>{r.value}</b></li>)}</ul>
      </Card> : null}
    </div>
    <Card title={w.list} meta={view.appointments.length || "None yet"}>
      {view.appointments.length ? <ul className={d.list}>{view.appointments.map((a) => <li key={a.id} data-status={a.status}>
        <span className={d.listIcon}><Calendar size={15} /></span>
        <div><b>{a.service} · {a.id}</b><small>{a.when} · {a.staff}</small><small>{a.name}</small></div>
        <em data-status={a.status}>{a.status === "cancelled" ? "Cancelled" : a.changes ? `Moved ${a.changes}×` : "Booked"}</em>
      </li>)}</ul> : <Empty>{view.skin === "salon" ? "An appointment" : "A visit"} appears here once {agentName} books it.</Empty>}
      {view.emailed ? <Emailed to={view.emailed.to} what={`Confirmation for ${view.emailed.reference}`} /> : null}
    </Card>
  </div>;

  const menu = <Card title={w.menu} meta={`${view.menu.length} options`}>
    <div className={d.menuGrid}>{groups.map((g) => <div key={g}>
      <small>{g}</small>
      <ul>{view.menu.filter((m) => m.group === g).map((m) => <li key={m.id} data-chosen={m.chosen || undefined}>
        <div><b>{m.name}</b><span>{m.minutes} min · {m.staff.join(", ")}</span></div>
        <strong>{m.price}</strong>
      </li>)}</ul>
    </div>)}</div>
  </Card>;

  return <Screens id={w.brand} kicker={`${w.kicker} · ${view.timeZone}`} title={view.day.label} state={state} active={active} cue={cue} screens={[
    { id: "day", label: "Day", icon: Calendar, body: day },
    { id: "booking", label: "Booking", icon: User, body: booking },
    { id: "menu", label: view.skin === "salon" ? "Menu" : "Services", icon: Grid, body: menu },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: <Messages items={view.messages} empty="Callback requests for the team land here." /> },
  ]} />;
}
const APPOINTMENT_SCREENS: Record<string, string> = { note_booking: "booking", note_visit: "booking", find_patient: "booking", get_business_info: "menu", check_availability: "day", book_appointment: "day", reschedule_appointment: "day", cancel_appointment: "booking", email_confirmation: "booking", take_message: "inbox" };

/* ---------------- Form & Field ---------------- */

const PHOTOS: Record<string, string> = {
  "ridge-lamp": "/studio/products/ridge-lamp.jpg",
  "everyday-mugs": "/studio/products/everyday-mugs.jpg",
  "field-planter": "/studio/products/field-planter.jpg",
  "linen-throw": "/studio/products/linen-throw.jpg",
};

function Photo({ id, name, option }: { id: string | undefined; name: string; option: string }) {
  const src = id ? PHOTOS[id] : undefined;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={name} loading="lazy" /> : <ProductArt id={id ?? ""} color={swatch(option)} />;
}

export function FormFieldOffice({ view, state, agentName, cue }: { view: FormFieldView; state: LiveState; agentName: string; cue?: Cue }) {
  const live = state !== "sample";
  const focus = view.shown.find((p) => p.focus);
  // The shelves always show: the standard catalogue with live stock for anything looked up, plus other finds.
  const liveById = new Map(view.shown.map((p) => [p.id, p]));
  const catalogue = [...formfieldEmpty.shown.map((p) => liveById.get(p.id) ?? p), ...view.shown.filter((p) => !formfieldEmpty.shown.some((s) => s.id === p.id))];
  const found = new Set(live ? view.shown.map((p) => p.id) : []);
  const productId = (name: string) => catalogue.find((p) => p.name === name)?.id;
  const reservedCount = view.reservations.filter((r) => r.status === "reserved").length;
  const active = useFollow(cue, FORMFIELD_SCREENS, "catalogue");

  const shelf = <>
    <div className={d.kpis}>
      <div><span>On the shelves</span><strong>{catalogue.length}</strong></div>
      <div data-hot={found.size > 0 || undefined}><span>Found on this call</span><strong>{found.size || "—"}</strong></div>
      <div data-hot={reservedCount > 0 || undefined}><span>Held for pickup</span><strong>{reservedCount || "—"}</strong></div>
      <div data-hot={Boolean(view.order) || undefined}><span>Order looked up</span><strong>{view.order ? `#${view.order.number}` : "—"}</strong></div>
    </div>
    <section className={d.shelf} aria-label="Catalogue">
      {catalogue.map((p) => {
        const reserved = view.reservations.filter((r) => r.status === "reserved" && r.product === p.name);
        const shownOption = reserved[0]?.option ?? p.options.find((o) => o.inStock > 0)?.option ?? p.options[0]!.option;
        return <article key={p.id} className={d.product} data-focus={(p.focus && live) || undefined} data-reserved={reserved.length > 0 || undefined} data-found={found.has(p.id) || undefined} data-dim={(found.size > 0 && !found.has(p.id)) || undefined}>
          <div className={d.productImg}>
            <Photo id={p.id} name={p.name} option={shownOption} />
            {reserved.length ? <span className={d.badge} data-tone="held"><Check size={11} />Held · {reserved.map((r) => r.name.split(" ")[0]).join(", ")}</span>
              : p.focus && live ? <span className={d.badge}>{agentName} is showing this</span>
              : found.has(p.id) ? <span className={d.badge} data-tone="soft">Found by {agentName}</span> : null}
          </div>
          <div className={d.productName}><b>{p.name}</b><span>${p.price}</span></div>
          <ul className={d.stock}>{p.options.map((o) => <li key={o.id} data-out={o.inStock === 0 || undefined} data-held={reserved.some((r) => r.option === o.option) || undefined}>
            <i style={{ background: swatch(o.option) }} />{o.option}
            <b key={`${o.id}-${o.inStock}`}>{o.inStock === 0 ? "Out" : `${o.inStock} left`}</b>
          </li>)}</ul>
        </article>;
      })}
    </section>
  </>;

  const product = <Card title="Product details" meta={focus?.name ?? "None open"}>
    {focus ? <div className={d.productFocus}>
      <span className={d.productFocusImg}><Photo id={focus.id} name={focus.name} option={focus.options.find((o) => o.inStock > 0)?.option ?? focus.options[0]!.option} /></span>
      <div>
        <b>{focus.name}</b><strong>${focus.price}</strong>
        {focus.description ? <p className={d.copy}>{focus.description}</p> : null}
        <dl className={d.fields}>
          {focus.materials ? <Field label="Materials" value={focus.materials} /> : null}
          {focus.size ? <Field label="Size" value={focus.size} /> : null}
        </dl>
        <ul className={d.stock}>{focus.options.map((o) => <li key={o.id} data-out={o.inStock === 0 || undefined}><i style={{ background: swatch(o.option) }} />{o.option}<b>{o.inStock === 0 ? "Out" : `${o.inStock} left`}</b></li>)}</ul>
      </div>
    </div> : <Empty>When {agentName} looks something up for you, its details open here.</Empty>}
  </Card>;

  const pickups = <Card title="Pickup orders" meta={view.reservations.length || "None yet"}>
    {view.reservations.length ? <ul className={d.list}>{view.reservations.map((r) => <li key={r.id} data-status={r.status}>
      <span className={d.thumb}><Photo id={productId(r.product)} name={r.product} option={r.option} /></span>
      <div><b>{r.quantity} × {r.product}</b><small>{r.option} · for {r.name} · {r.id}</small><small>Held until closing {r.pickupBy} · ${r.price} paid in store</small></div>
      <em data-status={r.status === "reserved" ? "booked" : "cancelled"}>{r.status === "reserved" ? "Ready" : "Cancelled"}</em>
    </li>)}</ul> : <Empty>A pickup order appears here once {agentName} reserves something.</Empty>}
    {view.emailed ? <Emailed to={view.emailed.to} what={`Reservation ${view.emailed.reference}`} /> : null}
  </Card>;

  const orders = <Card title={view.order ? `Order #${view.order.number}` : "Order lookup"} meta={view.order?.status ?? "None yet"}>
    {view.order ? <>
      <p className={d.copy}>{view.order.name}</p>
      <ul className={d.items}>{view.order.items.map((i) => <li key={i.name}><b>{i.name}</b><span>{i.option} · ${i.price}</span></li>)}</ul>
      <ol className={d.timeline}>{view.order.events.map((e, i) => <li key={e} data-last={i === view.order!.events.length - 1 || undefined}>{e}</li>)}</ol>
      {view.supportRequests.map((s) => <p key={s.id} className={d.flag}>Support request {s.id}: pending review. Nothing is refunded automatically.</p>)}
    </> : <Empty>{agentName} discusses an order only once its number and email both match.</Empty>}
  </Card>;

  return <Screens id="formfield" kicker="Shop" title="Catalogue" state={state} active={active} cue={cue}
    tools={<span className={d.search}><Search size={13} />{found.size ? `${found.size} found by ${agentName}` : "Search products"}</span>} screens={[
    { id: "catalogue", label: "Shelves", icon: Grid, body: shelf },
    { id: "product", label: "Product", icon: Search, body: product },
    { id: "pickups", label: "Pickups", icon: Check, count: reservedCount, body: pickups },
    { id: "orders", label: "Orders", icon: Suitcase, body: orders },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: <Messages items={view.messages} empty="Callback requests for the team land here." /> },
  ]} />;
}
const FORMFIELD_SCREENS: Record<string, string> = { search_products: "catalogue", get_product_details: "product", reserve_item: "pickups", update_reservation: "pickups", cancel_reservation: "pickups", email_reservation: "pickups", lookup_order: "orders", create_support_request: "orders", take_message: "inbox" };

/* ---------------- Waypoint ---------------- */

const AIRLINE_TONES: Record<string, string> = { "Duffel Airways": "#2d2a4a", "British Airways": "#1f3c74", Iberia: "#c8102e", "Virgin Atlantic": "#a3122f", "American Airlines": "#0b6fb3", Delta: "#0a2a5e", United: "#1b4b8f", JetBlue: "#0033a0", Lufthansa: "#05164d", "Air France": "#002157", KLM: "#00a1de" };
const airlineCode = (name: string) => { const w = name.split(/\s+/); return (w.length > 1 ? w.map((x) => x[0]).join("") : name).slice(0, 2).toUpperCase(); };
const shortDate = (label: string) => label.replace(/^(\w{3})\w*, (\w{3})\w*/, "$1, $2");
const isoDate = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : null);
const cabin = (c: string) => c.replace("_", " ").replace(/^./, (x) => x.toUpperCase());

function Leg({ j, label }: { j: TravelJourney; label: string }) {
  return <div className={d.leg}>
    <span className={d.legLabel}>{label}<small>{shortDate(j.date)}</small></span>
    <div className={d.legEnd}><b>{j.departs}</b><small title={j.fromName}>{j.from}</small></div>
    <div className={d.legPath}><small>{j.duration}</small><i data-stops={j.stops} aria-hidden="true" /><small>{j.stops ? `${j.stops} stop${j.stops > 1 ? "s" : ""} · ${j.via.join(", ")}` : "Nonstop"}</small></div>
    <div className={d.legEnd}><b>{j.arrives}{j.arrivesNextDay ? <sup>+1</sup> : null}</b><small title={j.toName}>{j.to}</small></div>
  </div>;
}

const STEPS: { id: TravelStage; label: string }[] = [
  { id: "trip", label: "Trip" }, { id: "options", label: "Flights" }, { id: "fare", label: "Fare" }, { id: "seat", label: "Seat" },
  { id: "bags", label: "Bags" }, { id: "traveller", label: "Traveller" }, { id: "review", label: "Review" }, { id: "payment", label: "Payment" },
];
const stepIndex = (s: TravelStage) => STEPS.findIndex((x) => x.id === s);

/** How far the booking has got: the service says so; older services leave it to the records. */
function stageOf(v: TravelView): TravelStage {
  if (v.stage) return v.stage;
  if (v.booking) return "payment";
  if (v.readBack) return "review";
  if (v.details) return "fare";
  return v.options.length ? "options" : "trip";
}

/** "$1,234.50" or "389 EUR" to a number, and a number back in the same style. */
const amountOf = (money: string | null | undefined) => (money ? parseFloat(money.replace(/,/g, "").replace(/[^\d.]/g, "")) || 0 : 0);
function moneyLike(sample: string, n: number) {
  const prefix = sample.match(/^[^\d]*/)?.[0] ?? "";
  const suffix = sample.match(/[^\d.,]*$/)?.[0] ?? "";
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}${suffix}`;
}

/** A number that counts up (or down) to its new value, so a change to the total is seen happening. */
function Ticker({ value, like }: { value: number; like: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      const now = start + (value - start) * (1 - Math.pow(1 - k, 3));
      from.current = now;
      setShown(now);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  // Whole-dollar totals count in whole dollars.
  const n = Number.isInteger(value) ? Math.round(shown) : shown;
  return <span className={d.ticker} data-moving={shown !== value || undefined}>{moneyLike(like, n)}</span>;
}

/** Text that types itself in, as if someone at the desk were filling the field. */
function Typed({ text, delay = 0 }: { text: string; delay?: number }) {
  const still = useContext(StaticPreview);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (still) return;
    let i = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length && timer) clearInterval(timer);
      }, 42);
    }, delay);
    return () => { clearTimeout(wait); if (timer) clearInterval(timer); };
  }, [text, delay, still]);
  if (still) return <span className={d.typed}>{text}</span>;
  return <span className={d.typed}><span className={d.srOnly}>{text}</span><span aria-hidden="true">{text.slice(0, n)}{n < text.length ? <i className={d.caret} /> : null}</span></span>;
}

function Stepper({ stage, shown, onShow, view }: { stage: TravelStage; shown: TravelStage; onShow: (s: TravelStage) => void; view: TravelView }) {
  const at = stepIndex(stage);
  const note: Partial<Record<TravelStage, string | null>> = {
    options: view.selected ? `Option ${view.selected}` : null,
    fare: view.details?.fareBrand ?? null,
    seat: view.seat?.seat ?? (at > stepIndex("seat") ? "Check-in" : null),
    bags: view.bags ? (view.bags.added ? `+${view.bags.added}` : at > stepIndex("bags") ? "Included" : null) : null,
    traveller: view.traveller?.name.split(" ")[0] ?? null,
    payment: view.emailed ? "Emailed" : view.booking ? "Test mode" : null,
  };
  return <ol className={d.steps} aria-label="Booking progress">
    {STEPS.map((s, i) => {
      const state = i < at ? "done" : i === at ? (s.id === "payment" ? "stopped" : "now") : "next";
      const body = <><i>{state === "done" ? <Check size={11} /> : state === "stopped" ? <Lock size={11} /> : i + 1}</i><span>{s.label}<small>{note[s.id] ?? " "}</small></span></>;
      return <li key={s.id} data-state={state} data-shown={shown === s.id || undefined}>
        {state === "done" ? <button type="button" onClick={() => onShow(s.id)} aria-pressed={shown === s.id}>{body}</button> : <div aria-current={state !== "next" ? "step" : undefined}>{body}</div>}
      </li>;
    })}
  </ol>;
}

function FareCard({ o, view, live, agentName }: { o: TravelView["options"][number]; view: TravelView; live: boolean; agentName: string }) {
  const isSelected = view.selected === o.option;
  return <article className={d.fare} data-selected={isSelected || undefined}>
    <header>
      <span className={d.optionNo}>{o.option}</span>
      <i className={d.airline} style={{ background: AIRLINE_TONES[o.airline] ?? "#3b3a36" }}>{airlineCode(o.airline)}</i>
      <b>{o.airline}</b>
      {o.label ? <span className={d.fareLabel} data-label={o.label}>{o.label}</span> : null}
      {isSelected && live ? <span className={d.badge} data-tone="soft"><Check size={11} />Chosen</span> : null}
      <strong className={d.price}>{o.price}</strong>
    </header>
    {o.journeys.map((j, i) => <Leg key={i} j={j} label={i === 0 ? "Out" : "Back"} />)}
  </article>;
}

function FareLevels({ view, agentName }: { view: TravelView; agentName: string }) {
  const levels = view.fareLevels ?? [];
  const details = view.details;
  if (levels.length < 2) return details ? <Card title="Fare details" meta={details.fareBrand ?? `Option ${details.option}`}>
    <dl className={d.fields}>
      <Field label="Price" value={details.price} note={details.priceChanged ? "Changed since the search" : "Unchanged"} />
      <Field label="Refunds" value={details.refund} />
      <Field label="Changes" value={details.changes} />
      <Field label="Bags" value={details.baggage} />
    </dl>
  </Card> : null;
  return <section className={d.levels} aria-label="Fare levels">
    <div className={d.panelHead}><h3>Fare levels on these flights</h3><span>{details?.priceChanged ? "Price changed since the search" : "Priced live just now"}</span></div>
    <div className={d.levelGrid} style={{ gridTemplateColumns: `repeat(${Math.min(levels.length, 4)}, minmax(0, 1fr))` }}>
      {levels.slice(0, 4).map((lv, i) => <article key={lv.brand} className={d.level} data-current={lv.current || undefined} style={{ animationDelay: `${i * 90}ms` }}>
        <span className={d.levelTag}>{lv.current ? <><Check size={11} />Selected</> : `+${lv.difference ?? ""}`}</span>
        <b>{lv.brand}</b>
        <strong>{lv.price}</strong>
        <ul>
          <li><Suitcase size={13} />{lv.baggage.replace(" per traveller", "")}</li>
          <li><Calendar size={13} />{lv.changes}</li>
          <li><Inbox size={13} />{lv.refund}</li>
        </ul>
      </article>)}
    </div>
    <p className={d.panelNote}>{agentName} offers the next level up with its difference; every price is the airline&rsquo;s own.</p>
  </section>;
}

const FACILITY: Record<string, string> = { lavatory: "WC", galley: "G", closet: "C", stairs: "S" };
type SeatCell = Extract<TravelSeatCell, { id: string }>;
const isSeat = (c: TravelSeatCell): c is SeatCell => "id" in c;
const letterOf = (id: string) => id.replace(/^\d+/, "");

/**
 * Lines every row up on one set of columns. Airlines send each row's cells left to right, but a row
 * can drop a seat (2 seats where the rest of the cabin has 3), so seats sit at their letter's column
 * and a row without seats (lavatories, galleys) is centred in its section.
 */
function seatColumns(map: TravelSeatMap) {
  const count = Math.max(0, ...map.rows.map((r) => r.sections.length));
  const letters = Array.from({ length: count }, (_, si) => {
    const seen = new Set(map.rows.flatMap((r) => (r.sections[si] ?? []).filter(isSeat).map((c) => letterOf(c.id))));
    const sorted = [...seen].sort();
    const widest = Math.max(0, ...map.rows.map((r) => r.sections[si]?.length ?? 0));
    return [...sorted, ...Array<string>(Math.max(0, widest - sorted.length)).fill("")];
  });
  const rows = map.rows.map((r) => letters.map((cols, si) => {
    const cells = r.sections[si] ?? [];
    const slots: (TravelSeatCell | null)[] = Array(cols.length).fill(null);
    const rest: TravelSeatCell[] = [];
    for (const c of cells) {
      const at = isSeat(c) ? cols.indexOf(letterOf(c.id)) : -1;
      if (at >= 0 && !slots[at]) slots[at] = c;
      else rest.push(c);
    }
    let i = cells.some(isSeat) ? 0 : Math.floor((cols.length - cells.length) / 2);
    for (const c of rest) {
      while (i < slots.length && slots[i]) i++;
      if (i < slots.length) slots[i++] = c;
    }
    return slots;
  }));
  return { letters, rows };
}

function SeatMap({ map, seat }: { map: TravelSeatMap; seat: TravelView["seat"] }) {
  const { letters, rows } = seatColumns(map);
  const seats = map.rows.flatMap((r) => r.sections.flat()).filter(isSeat);
  const open = seats.filter((c) => c.st !== "taken");
  const n = map.rows.length;
  // A wing over one or two rows is test data (Duffel's test airline puts it at the nose), not a real plane.
  const w = map.wings && map.wings.last_row_index - map.wings.first_row_index >= 2 ? map.wings : null;
  const cols = letters.map((sec) => `repeat(${sec.length}, var(--seat))`).join(" var(--aisle) ");
  // The cabin runs nose to tail down the panel and scrolls; it slides to the seat once one is chosen.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>("[data-chosen]");
    if (!box || !el) return;
    const r = box.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const t = setTimeout(() => box.scrollBy({ top: e.top - r.top - r.height / 2 + e.height / 2, behavior: "smooth" }), 250);
    return () => clearTimeout(t);
  }, [seat?.seat]);
  const nudge = (dir: 1 | -1) => scroller.current?.scrollBy({ top: dir * scroller.current.clientHeight * 0.6, behavior: "smooth" });
  return <section className={d.seatPanel} aria-label="Seat map">
    <div className={d.panelHead}>
      <h3>{map.flight ? `${map.flight.flight} · ${map.flight.from} → ${map.flight.to}` : "Seat map"}</h3>
      <span>{open.length} open · {open.filter((c) => c.st === "free").length} free{map.cabin ? ` · ${cabin(map.cabin)}` : ""}</span>
      <span className={d.seatNav}>
        <button type="button" onClick={() => nudge(-1)} aria-label="Toward the front of the plane"><ArrowRight size={14} /></button>
        <button type="button" onClick={() => nudge(1)} aria-label="Toward the back of the plane"><ArrowRight size={14} /></button>
      </span>
    </div>
    <div className={d.seatScroll} ref={scroller} tabIndex={0} aria-label="Seat map, scrolls front to back">
    <div className={d.plane}>
      <div className={d.fuselage}>
        <div className={d.seatRows} style={{ "--cols": cols } as CSSProperties}>
          {w ? <span className={d.wing} style={{ "--w0": (w.first_row_index + 1) / (n + 1), "--wn": (w.last_row_index - w.first_row_index + 1) / (n + 1) } as CSSProperties} aria-hidden="true" /> : null}
          <div className={d.seatAxis} aria-hidden="true">{letters.map((sec, si) => <Fragment key={si}>{si > 0 ? <span className={d.aisle} /> : null}{sec.map((l, ci) => <span key={ci}>{l}</span>)}</Fragment>)}</div>
          {map.rows.map((r, i) => {
            const labelled = r.sections.flat().some((c) => isSeat(c) || c.type in FACILITY);
            return <div key={r.row ?? `x${i}`} className={d.seatCol} data-exit={r.exit || undefined} data-thin={!labelled || undefined} style={{ animationDelay: `${Math.min(i, 16) * 25}ms` }}>
              {rows[i].map((sec, si) => <Fragment key={si}>
                {si > 0 ? <span className={d.aisle}>{si === 1 && r.row != null ? r.row : ""}</span> : null}
                {sec.map((c, ci) => c && isSeat(c)
                  ? <span key={c.id} className={d.seat} data-st={c.st} data-chosen={seat?.seat === c.id || undefined} title={`${c.id} · ${c.st === "taken" ? "taken" : c.price ?? "free"}`}>
                    {seat?.seat === c.id ? <Check size={13} /> : c.st === "paid" ? <i>{c.price}</i> : null}
                  </span>
                  : <span key={`f${ci}`} className={d.facility} data-type={c?.type ?? "empty"}>{c ? FACILITY[c.type] ?? "" : ""}</span>)}
              </Fragment>)}
            </div>;
          })}
        </div>
      </div>
    </div>
    </div>
    <ul className={d.legend}>
      <li><i data-st="free" />Free</li>
      <li><i data-st="paid" />Extra cost</li>
      <li><i data-st="taken" />Taken</li>
      <li><i data-st="chosen" />{seat ? `${seat.seat} · ${seat.position}${seat.exitRow ? " · exit row" : ""} · ${seat.price === "free" ? "free" : seat.price}` : "Your seat"}</li>
      <li><i data-st="exit" />Exit row</li>
    </ul>
  </section>;
}

function bagCounts(included: string) {
  const checked = Number(included.match(/(\d+) checked/)?.[1] ?? 0);
  const carry = Number(included.match(/(\d+) carry-on/)?.[1] ?? 0);
  return { checked, carry };
}

function BagsPanel({ bags, agentName }: { bags: NonNullable<TravelView["bags"]>; agentName: string }) {
  const { checked, carry } = bagCounts(bags.included);
  const tiles: { key: string; kind: "carry" | "included" | "added" | "open"; label: string; note: string }[] = [
    ...Array.from({ length: carry }, (_, i) => ({ key: `c${i}`, kind: "carry" as const, label: "Carry-on", note: "Included" })),
    ...Array.from({ length: checked }, (_, i) => ({ key: `i${i}`, kind: "included" as const, label: "Checked bag", note: "Included" })),
    ...Array.from({ length: bags.added }, (_, i) => ({ key: `a${i}`, kind: "added" as const, label: "Checked bag", note: bags.extraBagPrice ? `Added · ${bags.extraBagPrice}` : "Added" })),
  ];
  if (bags.extraBagPrice && bags.added < bags.maxExtra) tiles.push({ key: "open", kind: "open", label: "Extra bag", note: `${bags.extraBagPrice} each` });
  return <section className={d.bagsPanel} aria-label="Bags">
    <div className={d.panelHead}><h3>Bags</h3><span>{bags.added ? `${bags.added} extra · ${bags.total ?? ""}` : `Fare includes ${bags.included.replace(" per traveller", "")}`}</span></div>
    <div className={d.bagTiles}>{tiles.map((t, i) => <div key={t.key} className={d.bagTile} data-kind={t.kind} style={{ animationDelay: t.kind === "added" ? "0ms" : `${i * 70}ms` }}>
      <span className={d.bagIcon}><Suitcase size={t.kind === "carry" ? 20 : 26} /></span>
      <b>{t.label}</b><small>{t.note}</small>
    </div>)}</div>
    {!bags.extraBagPrice ? <p className={d.panelNote}>This airline doesn&rsquo;t sell extra bags here, so {agentName} sticks to what the fare includes.</p> : null}
  </section>;
}

const bornOn = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function TravellerCard({ t }: { t: NonNullable<TravelView["traveller"]> }) {
  const rows: { label: string; value: string; key: string }[] = [
    { label: "Full name", value: t.name, key: "name" },
    { label: "Date of birth", value: bornOn(t.bornOn), key: "bornOn" },
    { label: "Email", value: t.email, key: "email" },
    { label: "Phone", value: t.phone, key: "phone" },
  ];
  let delay = 150;
  return <section className={d.traveller} aria-label="Lead traveller">
    <div className={d.panelHead}><h3>Lead traveller</h3><span>Adult · passenger 1</span></div>
    <div className={d.travellerBody}>
      <span className={d.travellerAvatar}>{initials(t.name)}</span>
      <dl>{rows.map((r) => {
        const at = delay;
        delay += r.value.length * 42 + 220;
        const sample = t.sample.includes(r.key);
        return <div key={r.key} data-sample={sample || undefined}><dt>{r.label}{sample ? <em>Sample</em> : <em data-tone="caller">From the call</em>}</dt><dd><Typed text={r.value} delay={at} /></dd></div>;
      })}</dl>
    </div>
    <p className={d.panelNote}>Only the name comes from the call. The rest are marked samples: this demo never asks for a date of birth, passport or card.</p>
  </section>;
}

function ReviewCard({ r, view }: { r: NonNullable<TravelView["review"]>; view: TravelView }) {
  const waiting = view.readBack && !view.booking;
  const rows: [string, string | null][] = [["Outbound", r.outbound], ["Return", r.return], ["Fare", r.fare], ["Seat", r.seat], ["Bags", r.bags], ["Traveller", r.traveller]];
  return <section className={d.review} aria-label="Booking review">
    <header>
      <i className={d.airline} style={{ background: AIRLINE_TONES[r.airline] ?? "#3b3a36" }}>{airlineCode(r.airline)}</i>
      <div><small>Itinerary · read back to the caller</small><b>{r.airline}</b></div>
      {r.fareChanged ? <span className={d.badge}>Price changed on re-check</span> : <span className={d.badge} data-tone="soft"><Check size={11} />Price re-checked</span>}
    </header>
    <dl>{rows.filter(([, v]) => v).map(([k, v], i) => <div key={k} style={{ animationDelay: `${i * 80}ms` }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <footer><span>{waiting ? "Waiting for the caller’s yes" : "Total"}</span><strong>{r.total}</strong></footer>
  </section>;
}

function PaymentStopped({ booking, emailed }: { booking: NonNullable<TravelView["booking"]>; emailed: TravelView["emailed"] }) {
  return <>
    <section className={d.payment} aria-label="Payment">
      <span className={d.paymentLock}><Lock size={20} /></span>
      <div>
        <small>Payment · stopped in test mode</small>
        <b>Everything up to payment is done</b>
        <p>Option {booking.option} for {booking.travellerName}, {booking.price} in total. A live agency would take payment and issue the ticket here. Nothing was booked, held or charged.</p>
      </div>
    </section>
    {emailed ? <div className={d.emailed} role="status"><span><Inbox size={16} /></span><div><b>Itinerary emailed to {emailed.to}</b><small>{emailed.total} · sent from Waypoint Travel after the caller&rsquo;s yes</small></div></div> : null}
  </>;
}

function TripSummary({ view, stage }: { view: TravelView; stage: TravelStage }) {
  const o = view.options.find((x) => x.option === view.selected);
  const details = view.details;
  if (!o || !details) return null;
  const at = stepIndex(stage);
  const seatAmount = view.seat && view.seat.price !== "free" ? amountOf(view.seat.price) : 0;
  const bagsAmount = view.bags?.added ? amountOf(view.bags.total) : 0;
  const total = view.review ? amountOf(view.review.total) : amountOf(details.price) + seatAmount + bagsAmount;
  const seat = view.seat ? `${view.seat.seat} · ${view.seat.position}` : at > stepIndex("seat") ? "At check-in" : null;
  return <section className={d.summaryCard} aria-label="Trip summary">
    <div className={d.summaryTrip}>
      <div className={d.panelHead}><h3>Trip summary</h3><span>{o.airline} · option {o.option}</span></div>
      {o.journeys.map((j, i) => <Leg key={i} j={j} label={i === 0 ? "Out" : "Back"} />)}
    </div>
    <dl className={d.summaryLines}>
      <div><dt>Fare<small>{details.fareBrand ?? "Standard"}</small></dt><dd key={details.price}>{details.price}</dd></div>
      <div data-empty={!seat || undefined}><dt>Seat<small>{seat ?? "Not chosen"}</small></dt><dd key={view.seat?.seat ?? "none"}>{view.seat ? (view.seat.price === "free" ? "Free" : view.seat.price) : "—"}</dd></div>
      <div data-empty={!view.bags?.added || undefined}><dt>Bags<small className={d.bagRow}>{view.bags?.added ? Array.from({ length: view.bags.added }, (_, i) => <i key={i}><Suitcase size={13} /></i>) : null}{view.bags ? (view.bags.added ? `+${view.bags.added} checked` : "Included only") : "—"}</small></dt><dd key={view.bags?.added ?? 0}>{view.bags?.added ? view.bags.total : "—"}</dd></div>
      <div data-empty={!view.traveller || undefined}><dt>Traveller<small>{view.traveller?.name ?? "Not yet"}</small></dt><dd><User size={14} /></dd></div>
      <div className={d.totalLine}><dt>{view.review ? "Total · re-checked" : "Running total"}</dt><dd><Ticker value={total} like={details.price} /></dd></div>
    </dl>
  </section>;
}

export function TravelOffice({ view, state, agentName, cue }: { view: TravelView; state: LiveState; agentName: string; cue?: Cue }) {
  const active = useFollow(cue, TRAVEL_SCREENS, "booking");
  const q = view.search;
  const live = state !== "sample";
  const from = q ? (q.originName ?? q.origin) : null;
  const to = q ? (q.destinationName ?? q.destination) : null;
  const stage = stageOf(view);
  // A finished step can be opened again; the next step the agent takes brings the view forward.
  const [peek, setPeek] = useState<{ at: TravelStage; show: TravelStage } | null>(null);
  const shown = peek && peek.at === stage ? peek.show : stage;
  const selected = view.options.find((o) => o.option === view.selected);

  let panel: ReactNode;
  if (shown === "trip" || (shown === "options" && !view.options.length)) panel = <section className={d.fares} aria-label="Fares">
    <div className={d.faresHead}><h3>Fares</h3><span>{q ? "Searching…" : "Nothing searched yet"}</span></div>
    <Empty>{q ? `${agentName} is searching the airlines…` : `Fares appear here as ${agentName} searches the airlines.`}</Empty>
    {[0, 1, 2].map((i) => <div key={i} className={d.fareGhost} data-searching={Boolean(q) || undefined} aria-hidden="true"><i /><span /><span /><b /></div>)}
  </section>;
  else if (shown === "options") panel = <section className={d.fares} aria-label="Fares">
    <div className={d.faresHead}><h3>{agentName}&rsquo;s short list</h3><span>Live airline prices · picked for you</span></div>
    {view.options.map((o) => <FareCard key={`${o.option}-${o.price}`} o={o} view={view} live={live} agentName={agentName} />)}
  </section>;
  else if (shown === "fare") panel = <>
    {selected ? <FareCard o={selected} view={view} live={live} agentName={agentName} /> : null}
    <FareLevels view={view} agentName={agentName} />
  </>;
  else if (shown === "seat") panel = view.seatMap ? <SeatMap key={view.seatMap.flight?.flight ?? "map"} map={view.seatMap} seat={view.seat} />
    : <div className={d.notice}><span><Seat size={18} /></span><div><b>Seats are assigned at check-in</b><small>This airline doesn&rsquo;t offer seat selection here, so {agentName} moves on to bags.</small></div></div>;
  else if (shown === "bags") panel = view.bags ? <BagsPanel bags={view.bags} agentName={agentName} /> : null;
  else if (shown === "traveller") panel = view.traveller ? <TravellerCard key={view.traveller.name} t={view.traveller} /> : null;
  else panel = <>
    {view.review ? <ReviewCard r={view.review} view={view} /> : null}
    {shown === "payment" && view.booking ? <PaymentStopped booking={view.booking} emailed={view.emailed} /> : null}
  </>;

  // Once a flight is chosen the search has done its job: it folds into the header to give the booking the room.
  const searching = !q || stepIndex(shown) <= stepIndex("options");
  const kicker = searching || !q ? "Flight desk" : `${isoDate(q.departureDate)}${q.returnDate ? ` – ${isoDate(q.returnDate)}` : " · one way"} · ${q.adults} adult${q.adults > 1 ? "s" : ""}, ${q.cabinClass.replace("_", " ")}`;

  const booking = <>
    {searching ? <div className={d.trip}>
      <Field label="From" value={from} />
      <Field label="To" value={to} />
      <Field label="Depart" value={isoDate(q?.departureDate)} />
      <Field label="Return" value={q ? (isoDate(q.returnDate) ?? "One way") : null} />
      <Field label="Travellers" value={q ? `${q.adults} · ${cabin(q.cabinClass)}` : null} />
    </div> : null}
    <Stepper stage={stage} shown={shown} onShow={(s) => setPeek(s === stage ? null : { at: stage, show: s })} view={view} />
    <div className={d.stagePanel} key={shown}>{panel}</div>
  </>;

  return <Screens id="travel" kicker={kicker} title={q ? `${from} → ${to}` : "Flights"} state={state} active={active} cue={cue} screens={[
    { id: "booking", label: "Booking", icon: Seat, body: booking },
    { id: "trip", label: "Trip", icon: Globe, body: <TripSummary view={view} stage={stage} /> },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages?.length ?? 0, body: <Messages title="Messages for an agent" items={view.messages ?? []} empty="Callback requests for an agent land here." /> },
  ]} />;
}
const TRAVEL_SCREENS: Record<string, string> = { find_places: "booking", search_flights: "booking", choose_flight: "booking", choose_fare: "booking", get_seats: "booking", choose_seat: "booking", add_bags: "booking", set_traveller: "booking", review_booking: "booking", book_flight: "booking", email_itinerary: "trip", take_message: "inbox" };


/* ---------------- Palmetto Stays ---------------- */

const HOTEL_STEPS: { id: HotelsStage; label: string }[] = [
  { id: "trip", label: "Trip" }, { id: "options", label: "Hotels" }, { id: "hotel", label: "Hotel" }, { id: "room", label: "Room" },
  { id: "guest", label: "Guest" }, { id: "review", label: "Review" }, { id: "payment", label: "Payment" },
];
const hotelStep = (s: HotelsStage) => HOTEL_STEPS.findIndex((x) => x.id === s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** How far the stay has got: the service says so; a partial record falls back to what it holds. */
function hotelStageOf(v: HotelsView): HotelsStage {
  if (v.stage) return v.stage;
  if (v.booking) return "payment";
  if (v.review) return "review";
  if (v.guest) return "guest";
  if (v.room) return "room";
  if (v.hotel) return "hotel";
  return v.options.length ? "options" : "trip";
}

/** The guest score in the words booking sites use for it. */
const ratingWord = (r: number) => (r >= 9 ? "Superb" : r >= 8.5 ? "Excellent" : r >= 8 ? "Very good" : r >= 7 ? "Good" : "Review score");

/** A hotel's own photo; without one (or if it fails to load), a quiet tile with the hotel's initials. */
function HotelPhoto({ src, name }: { src: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  if (src && !failed) return <img className={d.hotelImg} src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />;
  return <span className={d.hotelImg} data-none aria-hidden="true"><Bed size={20} /><small>{initials(name.replace(/^The\s+/i, ""))}</small></span>;
}

function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  const whole = Math.max(1, Math.min(5, Math.round(n)));
  return <span className={d.stars} aria-label={`${whole}-star hotel`}>{"★".repeat(whole)}</span>;
}

function Rating({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating == null) return <span className={d.rating} data-none><small>No guest score yet</small></span>;
  return <span className={d.rating}><b>{rating.toFixed(1)}</b><small>{ratingWord(rating)}{reviews ? ` · ${reviews.toLocaleString("en-US")} reviews` : ""}</small></span>;
}

function Refund({ refundable, text }: { refundable: boolean; text?: string }) {
  return <span className={d.refund} data-ok={refundable || undefined}>{refundable ? <Check size={11} /> : null}{text ?? (refundable ? "Free cancellation" : "Non-refundable")}</span>;
}

function HotelStepper({ stage, shown, onShow, view }: { stage: HotelsStage; shown: HotelsStage; onShow: (s: HotelsStage) => void; view: HotelsView }) {
  const at = hotelStep(stage);
  const room = view.rooms.find((r) => r.room === view.room);
  const note: Partial<Record<HotelsStage, string | null>> = {
    trip: view.search ? `${plural(view.search.nights, "night")}` : null,
    options: view.selected ? `Option ${view.selected}` : view.options.length ? `${view.options.length} picked` : null,
    hotel: view.hotel?.name.replace(/^The\s+/i, "").split(/[ ,]/)[0] ?? null,
    room: room?.board ?? null,
    guest: view.guest?.name.split(" ")[0] ?? null,
    review: view.review ? (view.review.priceChanged ? "New price" : "Re-checked") : null,
    payment: view.emailed ? "Emailed" : view.booking ? "Test mode" : null,
  };
  return <ol className={d.steps} style={{ gridTemplateColumns: `repeat(${HOTEL_STEPS.length}, minmax(0, 1fr))` }} aria-label="Booking progress">
    {HOTEL_STEPS.map((s, i) => {
      const state = i < at ? "done" : i === at ? (s.id === "payment" ? "stopped" : "now") : "next";
      const body = <><i>{state === "done" ? <Check size={11} /> : state === "stopped" ? <Lock size={11} /> : i + 1}</i><span>{s.label}<small>{note[s.id] ?? " "}</small></span></>;
      // While an earlier step is open, the current one is a button too, to come back to it.
      const back = state !== "next" && state !== "done" && shown !== stage;
      return <li key={s.id} data-state={state} data-shown={shown === s.id || undefined}>
        {state === "done" || back ? <button type="button" onClick={() => onShow(s.id)} aria-pressed={shown === s.id} aria-current={back ? "step" : undefined}>{body}</button> : <div aria-current={state !== "next" ? "step" : undefined}>{body}</div>}
      </li>;
    })}
  </ol>;
}

function HotelOption({ o, view, live }: { o: HotelsView["options"][number]; view: HotelsView; live: boolean }) {
  const isSelected = view.selected === o.option;
  return <article className={d.stay} data-selected={isSelected || undefined}>
    <div className={d.stayPhoto}><HotelPhoto src={o.photo} name={o.name} /><span className={d.optionNo}>{o.option}</span></div>
    <div className={d.stayBody}>
      <div className={d.stayTags}>
        {o.label ? <span className={d.fareLabel} data-label={o.label}>{o.label}</span> : null}
        {isSelected && live ? <span className={d.badge} data-tone="soft"><Check size={11} />Chosen</span> : null}
      </div>
      <b className={d.stayName}>{o.name} <Stars n={o.stars} /></b>
      <small className={d.stayAddr}><MapPin size={12} />{o.address}</small>
      <Rating rating={o.rating} reviews={o.reviews} />
    </div>
    <div className={d.stayPrice}>
      <strong>{o.total}</strong>
      <small>{o.perNight} a night</small>
      <Refund refundable={o.refundable} />
    </div>
  </article>;
}

function HotelPanel({ h, agentName }: { h: NonNullable<HotelsView["hotel"]>; agentName: string }) {
  const photos = h.photos.slice(0, 4);
  return <section className={d.hotelPanel} aria-label={h.name}>
    <div className={d.gallery} data-count={Math.max(1, photos.length)}>
      {photos.length ? photos.map((p, i) => <div key={p} style={{ animationDelay: `${i * 80}ms` }}><HotelPhoto src={p} name={i ? "" : h.name} /></div>)
        : <div><HotelPhoto src={null} name={h.name} /></div>}
    </div>
    <div className={d.hotelInfo}>
      <div className={d.hotelTitle}>
        <div><h3>{h.name} <Stars n={h.stars} /></h3><small className={d.stayAddr}><MapPin size={12} />{h.address}</small></div>
        <Rating rating={h.rating} reviews={h.reviews} />
      </div>
      <div className={d.hotelTimes}>
        <div><Clock size={14} /><span>Check-in<b>{h.checkIn || "—"}</b></span></div>
        <div><Clock size={14} /><span>Check-out<b>{h.checkOut || "—"}</b></span></div>
      </div>
      {h.highlights.length ? <ul className={d.highlights}>{h.highlights.slice(0, 6).map((x, i) => <li key={x} style={{ animationDelay: `${i * 60}ms` }}>{x}</li>)}</ul> : null}
      {h.pros.length || h.cons.length ? <div className={d.proCon}>
        <div><small>Guests like</small><ul>{h.pros.map((p) => <li key={p} data-tone="pro"><Check size={12} />{p}</li>)}</ul></div>
        <div><small>Worth knowing</small><ul>{h.cons.map((c) => <li key={c} data-tone="con"><i />{c}</li>)}</ul></div>
      </div> : null}
      <p className={d.panelNote}>From the hotel&rsquo;s own listing and guest reviews. {agentName} reads out only what is here.</p>
    </div>
  </section>;
}

function RoomsPanel({ view, agentName }: { view: HotelsView; agentName: string }) {
  const nights = view.search?.nights ?? null;
  return <section className={d.roomsPanel} aria-label="Rooms">
    <div className={d.panelHead}><h3>Rooms at {view.hotel?.name ?? "this hotel"}</h3><span>Live rates{nights ? ` · ${plural(nights, "night")}` : ""}</span></div>
    {view.rooms.length ? <ul className={d.roomList}>{view.rooms.map((r, i) => {
      const chosen = view.room === r.room;
      const breakfast = /breakfast/i.test(r.board);
      return <li key={r.room} data-chosen={chosen || undefined} style={{ animationDelay: `${i * 70}ms` }}>
        <span className={d.roomIcon}><Bed size={18} /></span>
        <div>
          <b>{r.name}{chosen ? <span className={d.badge}><Check size={11} />Chosen</span> : null}</b>
          <div className={d.roomTags}>
            <span className={d.roomBoard} data-breakfast={breakfast || undefined}>{breakfast ? <Coffee size={12} /> : null}{r.board}</span>
            <Refund refundable={r.refundable} text={r.cancellation} />
          </div>
        </div>
        <div className={d.roomPrice}><strong>{r.total}</strong><small>{r.perNight} a night</small></div>
      </li>;
    })}</ul> : <Empty>{agentName} is checking the rooms and rates…</Empty>}
  </section>;
}

function GuestCard({ g }: { g: NonNullable<HotelsView["guest"]> }) {
  const rows = [
    { label: "Full name", value: g.name, key: "name", sample: false },
    { label: "Email", value: g.email, key: "email", sample: true },
    { label: "Phone", value: g.phone, key: "phone", sample: true },
  ];
  let delay = 150;
  return <section className={d.traveller} aria-label="Lead guest">
    <div className={d.panelHead}><h3>Lead guest</h3><span>Name on the reservation</span></div>
    <div className={d.travellerBody}>
      <span className={d.travellerAvatar}>{initials(g.name)}</span>
      <dl>{rows.map((r) => {
        const at = delay;
        delay += r.value.length * 42 + 220;
        return <div key={r.key} data-sample={r.sample || undefined}><dt>{r.label}{r.sample ? <em>Sample</em> : <em data-tone="caller">From the call</em>}</dt><dd><Typed text={r.value} delay={at} /></dd></div>;
      })}</dl>
    </div>
    <p className={d.panelNote}>Only the name comes from the call. Email and phone are marked samples: this demo never asks for card details.</p>
  </section>;
}

function StayReview({ r, waiting }: { r: NonNullable<HotelsView["review"]>; waiting: boolean }) {
  const rows: [string, string | null][] = [
    ["Hotel", r.hotel], ["Dates", `${r.dates} · ${plural(r.nights, "night")}`], ["Room", r.room], ["Board", r.board],
    ["Guests", plural(r.adults, "adult")], ["Lead guest", r.guest], ["Cancellation", r.cancellation], ["At the hotel", r.taxes],
  ];
  return <section className={d.review} aria-label="Stay review">
    <header>
      <i className={d.airline} style={{ background: "var(--accent)" }}><Bed size={16} /></i>
      <div><small>Reservation · read back to the caller</small><b>{r.hotel}</b></div>
      {r.priceChanged ? <span className={d.badge}>Price changed on re-check</span> : <span className={d.badge} data-tone="soft"><Check size={11} />Price re-checked · held</span>}
    </header>
    <dl>{rows.filter(([, v]) => v).map(([k, v], i) => <div key={k} style={{ animationDelay: `${i * 80}ms` }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <footer><span>{waiting ? "Waiting for the caller’s yes" : "Total for the stay"}</span><strong>{r.total}</strong></footer>
  </section>;
}

function StayPaymentStopped({ view }: { view: HotelsView }) {
  const r = view.review;
  return <>
    <section className={d.payment} aria-label="Payment">
      <span className={d.paymentLock}><Lock size={20} /></span>
      <div>
        <small>Payment · stopped in test mode</small>
        <b>Everything up to payment is done</b>
        <p>{r ? `${r.room} at ${r.hotel} for ${r.guest}, ${r.total} in total. ` : ""}A live agency would send a secure payment link and confirm the room here. Nothing was booked or charged.</p>
      </div>
    </section>
    {view.emailed ? <div className={d.emailed} role="status"><span><Inbox size={16} /></span><div><b>Quote emailed to {view.emailed.to}</b><small>{r?.total ? `${r.total} · ` : ""}sent from Palmetto Stays after the caller&rsquo;s yes</small></div></div> : null}
  </>;
}

function StaySummary({ view }: { view: HotelsView }) {
  const q = view.search;
  const o = view.options.find((x) => x.option === view.selected);
  const h = view.hotel;
  if (!h && !o) return null;
  const name = h?.name ?? o!.name;
  const room = view.rooms.find((r) => r.room === view.room);
  const totalText = view.review?.total ?? room?.total ?? o?.total ?? null;
  return <section className={d.summaryCard} aria-label="Stay summary">
    <div className={d.summaryTrip}>
      <div className={d.panelHead}><h3>Stay summary</h3><span>{o ? `Option ${o.option}` : ""}</span></div>
      <div className={d.staySum}>
        <span className={d.staySumPhoto}><HotelPhoto src={h?.photos[0] ?? o?.photo} name={name} /></span>
        <div>
          <b>{name} <Stars n={h?.stars ?? o?.stars ?? null} /></b>
          {q ? <small>{q.checkinLabel} – {q.checkoutLabel} · {plural(q.nights, "night")} · {plural(q.adults, "adult")}</small> : null}
          <small className={d.stayAddr}><MapPin size={12} />{h?.address ?? o?.address}</small>
        </div>
      </div>
    </div>
    <dl className={d.summaryLines}>
      <div data-empty={!room || undefined}><dt>Room<small>{room?.name ?? "Not chosen"}</small></dt><dd key={room?.room ?? "none"}>{room ? room.perNight : "—"}</dd></div>
      <div data-empty={!room || undefined}><dt>Rate<small>{room ? room.board : "—"}</small></dt><dd key={`r${room?.room ?? "none"}`}>{room ? (room.refundable ? "Refundable" : "Non-refundable") : "—"}</dd></div>
      <div data-empty={!view.guest || undefined}><dt>Lead guest<small>{view.guest?.name ?? "Not yet"}</small></dt><dd><User size={14} /></dd></div>
      <div className={d.totalLine}><dt>{view.review ? "Total · re-checked" : "Total for the stay"}</dt><dd>{totalText ? <Ticker value={amountOf(totalText)} like={totalText} /> : "—"}</dd></div>
    </dl>
  </section>;
}

export function HotelsOffice({ view, state, agentName, cue }: { view: HotelsView; state: LiveState; agentName: string; cue?: Cue }) {
  const active = useFollow(cue, HOTEL_SCREENS, "booking");
  const q = view.search;
  const live = state !== "sample";
  const stage = hotelStageOf(view);
  // A finished step can be opened again; the next step the agent takes brings the view forward.
  const [peek, setPeek] = useState<{ at: HotelsStage; show: HotelsStage } | null>(null);
  const shown = peek && peek.at === stage ? peek.show : stage;

  let panel: ReactNode;
  if (shown === "trip" || (shown === "options" && !view.options.length)) panel = <section className={d.fares} aria-label="Hotels">
    <div className={d.faresHead}><h3>Hotels</h3><span>{q ? "Searching…" : "Nothing searched yet"}</span></div>
    <Empty>{q ? `${agentName} is searching Miami hotels and live rates…` : `Real Miami hotels appear here, with live rates, as ${agentName} searches.`}</Empty>
    {[0, 1, 2].map((i) => <div key={i} className={d.fareGhost} data-searching={Boolean(q) || undefined} aria-hidden="true"><i /><span /><span /><b /></div>)}
  </section>;
  else if (shown === "options") panel = <section className={d.fares} aria-label="Hotels">
    <div className={d.faresHead}><h3>{agentName}&rsquo;s short list</h3><span>Real hotels · live rates for your dates</span></div>
    {view.options.map((o) => <HotelOption key={`${o.option}-${o.name}`} o={o} view={view} live={live} />)}
  </section>;
  else if (shown === "hotel") panel = view.hotel ? <HotelPanel key={view.hotel.name} h={view.hotel} agentName={agentName} /> : <Empty>{agentName} is opening the hotel…</Empty>;
  else if (shown === "room") panel = <RoomsPanel view={view} agentName={agentName} />;
  else if (shown === "guest") panel = view.guest ? <GuestCard key={view.guest.name} g={view.guest} /> : <Empty>The lead guest&rsquo;s name appears here.</Empty>;
  else panel = <>
    {view.review ? <StayReview r={view.review} waiting={stage === "review" && !view.booking} /> : null}
    {shown === "payment" && view.booking ? <StayPaymentStopped view={view} /> : null}
  </>;

  // Once a hotel is chosen the search has done its job: it folds into the header to give the booking the room.
  const searching = !q || hotelStep(shown) <= hotelStep("options");
  const kicker = searching || !q ? "Hotel desk" : `${q.checkinLabel} – ${q.checkoutLabel} · ${plural(q.nights, "night")} · ${plural(q.adults, "adult")}`;

  const booking = <>
    {searching ? <div className={d.trip}>
      <Field label="Area" value={q?.area} />
      <Field label="Check-in" value={q?.checkinLabel} />
      <Field label="Check-out" value={q?.checkoutLabel} />
      <Field label="Nights" value={q ? String(q.nights) : null} />
      <Field label="Guests" value={q ? plural(q.adults, "adult") : null} />
    </div> : null}
    <HotelStepper stage={stage} shown={shown} onShow={(s) => setPeek(s === stage ? null : { at: stage, show: s })} view={view} />
    <div className={d.stagePanel} key={shown}>{panel}</div>
  </>;

  return <Screens id="hotels" kicker={kicker} title={q ? q.area : "Hotels"} state={state} active={active} cue={cue} screens={[
    { id: "booking", label: "Booking", icon: Bed, body: booking },
    { id: "stay", label: "Stay", icon: MapPin, body: hotelStep(stage) >= hotelStep("hotel") ? <StaySummary view={view} /> : <Empty>The stay comes together here once {agentName} opens a hotel.</Empty> },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages?.length ?? 0, body: <Messages title="Messages for an agent" items={view.messages ?? []} empty="Callback requests for an agent land here." /> },
  ]} />;
}
const HOTEL_SCREENS: Record<string, string> = { search_hotels: "booking", choose_hotel: "booking", choose_room: "booking", set_guest: "booking", review_stay: "booking", book_stay: "booking", email_quote: "stay", take_message: "inbox" };


/* ---------------- Alder & Finch Injury Law ---------------- */

const TIER_NOTE: Record<"A" | "B" | "C", string> = { A: "Serious case · senior partner", B: "Solid case", C: "Smaller or early-stage" };
const STAGES: { id: LawFirmView["record"]["stage"]; label: string }[] = [
  { id: "new", label: "New lead" },
  { id: "conflict", label: "Conflict check" },
  { id: "qualified", label: "Qualified" },
  { id: "consult", label: "Consult booked" },
];

/** A menu that opens when the agent picks a value, shows the choice being made, then closes on it. */
function SelectField({ field }: { field: RecordField }) {
  const value = field.value as string | null;
  const still = useContext(StaticPreview);
  const [open, setOpen] = useState(false);
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (still) return;
    if (value && value !== prev.current) {
      setOpen(true);
      const t = setTimeout(() => setOpen(false), 1700);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, still]);
  return <div className={d.select} data-open={open || undefined} data-filled={Boolean(value)}>
    <span className={d.selectValue}>{value ?? <i>Select…</i>}</span>
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    {open ? <ul className={d.menu} role="listbox">{field.options.map((o) => <li key={o} data-picked={o === value || undefined} role="option" aria-selected={o === value}>{o === value ? <Check size={11} /> : null}{o}</li>)}</ul> : null}
  </div>;
}

function RecordInput({ field }: { field: RecordField }) {
  const value = field.value;
  if (field.kind === "select") return <SelectField field={field} />;
  if (field.kind === "chips") {
    const picked = (value as string[] | null) ?? [];
    return <div className={d.chips}>{field.options.map((o) => <span key={o} data-on={picked.includes(o) || undefined}>{picked.includes(o) ? <Check size={10} /> : null}{o}</span>)}</div>;
  }
  if (field.kind === "toggle") return <div className={d.yn} role="radiogroup" aria-label={field.label}>{field.options.map((o) => <span key={o} data-on={o === value || undefined} role="radio" aria-checked={o === value}>{o}</span>)}</div>;
  return <div className={d.input} data-filled={Boolean(value)} data-kind={field.kind}>
    {field.kind === "date" ? <Calendar size={13} /> : null}
    {value ? <Typed key={value as string} text={value as string} /> : <i>Waiting</i>}
  </div>;
}

/* ---------------- The record: law, real estate and insurance share it ---------------- */

type RecordStage = { id: string; label: string; declined?: boolean };

/** The record's number, its tags and where it has got to. */
function RecordHeader({ opened, number, tags, source, stages, at, label }: { opened: boolean; number: string; tags: string[]; source: string; stages: RecordStage[]; at: number; label: string }) {
  return <header className={d.recHead} data-opened={opened || undefined}>
    <div className={d.recId}>
      <span className={d.recNum}>{number}</span>
      {tags.map((t) => <span key={t} className={d.recTag}>{t}</span>)}
      <span className={d.recTag} data-tone="src">{source}</span>
    </div>
    <ol className={d.stages} aria-label={label}>
      {stages.map((x, i) => <li key={x.id} data-state={i < at ? "done" : i === at ? "now" : "next"} data-declined={x.declined || undefined}><i>{i < at ? <Check size={10} /> : i + 1}</i>{x.label}</li>)}
    </ol>
  </header>;
}

/** The record's sections, each field typed in, picked or toggled as the agent records it. */
function RecordForm({ sections, opened, waiting, children, wide }: { sections: { id: string; title: string; fields: RecordField[] }[]; opened: boolean; waiting: string; children?: ReactNode; wide?: boolean }) {
  const all = sections.flatMap((s) => s.fields);
  const filled = all.filter((x) => (Array.isArray(x.value) ? x.value.length : x.value)).length;
  return <div className={d.recForm} data-wide={wide || undefined}>
    {!opened ? <p className={d.recWaiting}>{waiting}</p> : null}
    {sections.map((sec, i) => <section key={sec.id} className={d.recSection}>
      <h3>{sec.title}{i === 0 ? <span>{filled}/{all.length} filled</span> : null}</h3>
      <div className={d.recFields}>
        {sec.fields.map((fl) => <div key={fl.key} className={d.recField} data-wide={fl.wide || undefined}>
          <label>{fl.label}</label>
          <RecordInput field={fl} />
        </div>)}
      </div>
    </section>)}
    {children}
  </div>;
}

export function LawFirmOffice({ view, state, agentName, cue }: { view: LawFirmView; state: LiveState; agentName: string; cue?: Cue }) {
  const r = view.record;
  const a = view.assessment;
  const conflict = view.conflict;
  const stages: RecordStage[] = r.stage === "declined" ? [...STAGES.slice(0, 2), { id: "declined", label: "Declined", declined: true }] : STAGES;
  const at = stages.findIndex((x) => x.id === r.stage);
  const booked = [...view.consults].reverse().find((c) => c.status === "booked");
  const active = useFollow(cue, LAW_SCREENS, "record");

  const review = <div className={d.cards}>
    <Card title="Case review" meta={a ? (a.outcome === "qualified" ? "Can take it" : "Cannot take it") : "Waiting"}>
      <div className={d.review}>
        <div className={d.reviewRow} data-state={conflict?.status ?? "waiting"}>
          <i aria-hidden="true">{conflict ? (conflict.status === "clear" ? <Check size={11} /> : "!") : null}</i>
          <div><b>Conflict check</b><small>{conflict ? (conflict.status === "clear" ? `No match for ${conflict.checked.join(" or ")} in clients or open matters` : "A conflict was found. The firm cannot take this matter.") : "Runs once the caller gives a name"}</small></div>
        </div>
        <div className={d.reviewRow} data-state={a ? (a.outcome === "qualified" ? "clear" : "conflict") : "waiting"}>
          <i aria-hidden="true">{a ? (a.outcome === "qualified" ? <Check size={11} /> : "!") : null}</i>
          <div>
            <b>{a?.outcome === "declined" ? "Declined" : "Qualified"}{a?.tier ? <span className={d.tier} data-tier={a.tier}>Tier {a.tier}</span> : null}</b>
            <small>{a ? (a.outcome === "declined" ? a.reason : TIER_NOTE[a.tier!]) : "Decided from the record once the basics are in"}</small>
            {a?.outcome === "qualified" ? <ul className={d.reviewPoints}>{a.points.map((p) => <li key={p}>{p}</li>)}{a.flags.map((fl) => <li key={fl} data-flag>{fl}</li>)}</ul> : null}
            {a?.deadline ? <small className={d.deadline}>Colorado limit · {a.deadline}</small> : null}
          </div>
        </div>
      </div>
    </Card>
    <Card title="Call summary" meta={view.note ? `Added to ${r.number}` : "Written after the call"}>
      {view.note ? <p className={d.noteText}><Typed key={view.note} text={view.note} /></p> : <Empty>{agentName} writes the summary onto the matter once the case is reviewed.</Empty>}
    </Card>
  </div>;

  const consult = <div className={d.cards}>
    <Card title="Free consultation" meta={booked ? booked.id : view.openTimes.length ? `${view.openTimes.length} open` : "Not booked"}>
      {booked ? <div className={d.consult}><span className={d.listIcon}><Calendar size={15} /></span><div><b>{booked.attorney}</b><small>{booked.day}, {booked.time} · {booked.format}</small></div><em>{booked.changes ? `Moved ${booked.changes}×` : "Booked"}</em></div>
        : view.openTimes.length ? <div className={d.openTimes}>{view.openTimes.map((o) => <span key={o.slotId}><b>{o.time}</b><small>{o.attorney.split(" ")[0]} · {o.day}</small></span>)}</div>
        : <Empty>Open times with the right attorney appear here.</Empty>}
      {view.emailed ? <Emailed to={view.emailed.to} what={`Confirmation for ${view.emailed.reference}`} /> : null}
    </Card>
    <Card title="Tasks created" meta={view.tasks.length || "None yet"}>
      {view.tasks.length ? <ul className={d.tasks}>{view.tasks.map((t) => <li key={t.title}><i aria-hidden="true"><Check size={10} /></i><div><b>{t.title}</b><small>{t.who} · {t.due}</small></div></li>)}</ul> : <Empty>Follow-ups for the team are created from the record.</Empty>}
    </Card>
  </div>;

  const brief = <Card title="7 AM case brief" meta={view.brief ? `${view.brief.rows.length} calls` : "Last night"}>
    {view.brief ? <ol className={d.brief}>{view.brief.rows.map((row, i) => <li key={`${row.who}-${i}`} data-mine={row.mine || undefined}>
      <span className={d.tier} data-tier={row.tier ?? "none"}>{row.tier ?? "—"}</span>
      <div><b>{row.who}{row.mine ? <em>This call</em> : null}</b><small>{row.summary}</small></div>
    </li>)}</ol> : <Empty>Every call ranked by case value, ready at 7 AM.</Empty>}
  </Card>;

  return <Screens id="lawfirm" kicker={`Matters · New potential client · ${view.timeZone}`} title={r.title ?? "New call"} state={state} active={active} cue={cue}
    head={<RecordHeader opened={r.opened} number={r.number ?? "PI-····"} tags={["Potential new client"]} source={`Phone · AI intake · ${agentName}`} stages={stages} at={at} label="Matter stage" />} screens={[
    { id: "record", label: "Matter", icon: User, body: <RecordForm wide sections={r.sections} opened={r.opened} waiting={`The matter record opens the moment ${agentName} has something to write down.`} /> },
    { id: "review", label: "Review", icon: Check, body: review },
    { id: "consult", label: "Calendar", icon: Calendar, body: consult },
    { id: "brief", label: "Brief", icon: Clock, body: brief },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: <Messages items={view.messages} empty="Messages for the attorneys land here." /> },
  ]} />;
}
const LAW_SCREENS: Record<string, string> = { note_intake: "record", check_conflicts: "review", assess_case: "review", check_availability: "consult", book_consultation: "consult", reschedule_consultation: "consult", email_confirmation: "consult", take_message: "inbox" };


/* ---------------- Juniper Row Realty ---------------- */

const LEAD_STAGES: RecordStage[] = [
  { id: "new", label: "New lead" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "booked", label: "Booked" },
];

function HomeTile({ h, searching }: { h: RealEstateView["listings"]["homes"][number]; searching: boolean }) {
  return <li className={d.home} data-matched={h.matched || undefined} data-read={h.read || undefined} data-focus={h.focus || undefined} data-dim={(searching && !h.matched && !h.focus) || undefined}>
    <div className={d.homeTop}>
      <span className={d.homeType}><Home size={13} />{h.type}</span>
      {h.booked ? <em>Showing booked</em> : h.focus ? <em data-tone="focus">On the call</em> : h.read ? <em data-tone="read">Read out</em> : null}
    </div>
    <strong>{h.price}</strong>
    <b>{h.address}</b>
    <small>{h.beds} bd · {h.baths} ba · {h.sqft.toLocaleString("en-US")} sq ft</small>
    <small className={d.homeArea}><MapPin size={11} />{h.area}{h.daysOnMarket != null ? ` · ${h.daysOnMarket} days on market` : ""}</small>
    <span className={d.homeNote}>{h.standout}</span>
  </li>;
}

export function RealEstateOffice({ view, state, agentName, cue }: { view: RealEstateView; state: LiveState; agentName: string; cue?: Cue }) {
  const r = view.record;
  const lead = view.lead;
  const booked = view.appointments.filter((a) => a.status === "booked");
  const stages = LEAD_STAGES.map((x) => (x.id === "booked" && booked.some((a) => a.purpose === "valuation") ? { ...x, label: "Valuation booked" } : x.id === "booked" ? { ...x, label: "Showing booked" } : x));
  const at = stages.findIndex((x) => x.id === r.stage);
  const L = view.listings;
  const searching = L.criteria != null || L.homes.some((h) => h.focus);
  const est = view.estimate;
  const active = useFollow(cue, REALESTATE_SCREENS, "listings");

  const leadCard = <Card title="Lead score" meta={lead.tier ? lead.tierNote : "Waiting"}>
    <div className={d.review}>
      <div className={d.reviewRow} data-state={lead.tier ? "clear" : "waiting"}>
        <i aria-hidden="true">{lead.tier ? <Check size={11} /> : null}</i>
        <div>
          <b>{lead.tier ? "Ranked" : "Not ranked yet"}{lead.tier ? <span className={d.tier} data-tier={lead.tier}>{lead.tier}</span> : null}</b>
          <small>{lead.tier ? "From timeline, financing and what was booked. The caller never hears it." : "Ranked once the name, buying or selling, and timeline are in"}</small>
          {lead.points.length || lead.flags.length ? <ul className={d.reviewPoints}>{lead.points.map((p) => <li key={p}>{p}</li>)}{lead.flags.map((fl) => <li key={fl} data-flag>{fl}</li>)}</ul> : null}
        </div>
      </div>
      <div className={d.reviewRow} data-state={lead.agent ? "clear" : "waiting"}>
        <i aria-hidden="true">{lead.agent ? <Check size={11} /> : null}</i>
        <div><b>Assigned agent</b><small>{lead.agent ? `${lead.agent.name} · ${lead.agent.role}` : "Routed by area, or to the listing specialist for sellers"}</small></div>
      </div>
      {lead.known ? <div className={d.reviewRow} data-state="clear"><i aria-hidden="true"><Check size={11} /></i><div><b>Spoke with {lead.known.spokeWith}</b><small>{lead.known.note}</small></div></div> : null}
    </div>
  </Card>;

  const listings = <>
    <Card title={L.criteria ? "Search" : "Active listings · Austin"} meta={L.criteria ? `${L.total} match${L.total === 1 ? "" : "es"}` : L.total ? `${L.total} homes` : "Waiting"}>
      {L.criteria ? <p className={d.homeCriteria}><Search size={13} />{L.criteria}</p> : null}
      {L.homes.length ? <ul className={d.homes}>{L.homes.map((h) => <HomeTile key={h.id} h={h} searching={searching} />)}</ul> : <Empty>Homes that match light up here as the caller describes what they want.</Empty>}
      {L.snapshot ? <p className={d.homeSource}>Real active listings (RentCast), as of {L.snapshot}</p> : null}
    </Card>
    {view.focus || est ? <div className={d.cards}>
      {view.focus ? <Card title="On the call" meta={view.focus.price}>
        <div className={d.focusHome}>
          <b>{view.focus.address}</b>
          <small>{view.focus.area} · {view.focus.zip} · shows with {view.focus.agent}</small>
          <dl>{view.focus.facts.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>
        </div>
      </Card> : null}
      {est ? <Card title="Home value" meta={est.status === "ok" ? "Estimate" : "No estimate"}>
        {est.status === "ok" ? <div className={d.estimate}><small>{est.address}</small><strong>{est.low} – {est.high}</strong><span>From {est.comparables} comparable homes for sale nearby · confirmed by an in-person valuation</span></div>
          : <Empty>No estimate for {est.address}. The listing specialist values it in person.</Empty>}
      </Card> : null}
    </div> : null}
  </>;

  const calendar = <div className={d.cards}>
    <Card title={booked.some((a) => a.purpose === "valuation") || view.calendar?.purpose === "valuation" ? "Valuation" : "Showing"} meta={booked.length ? booked[booked.length - 1].id : view.calendar?.openTimes.length ? `${view.calendar.openTimes.length} open` : "Not booked"}>
      {booked.length ? booked.map((a) => <div key={a.id} className={d.consult}><span className={d.listIcon}><Calendar size={15} /></span><div><b>{a.address}</b><small>{a.day}, {a.time} · {a.agent}</small></div><em>{a.changes ? `Moved ${a.changes}×` : "Booked"}</em></div>)
        : view.calendar?.openTimes.length ? <div className={d.openTimes}>{view.calendar.openTimes.map((o) => <span key={o.slotId}><b>{o.time}</b><small>{o.agent.split(" ")[0]} · {o.day}</small></span>)}</div>
        : <Empty>Open times with the right agent appear here.</Empty>}
      {view.emailed ? <Emailed to={view.emailed.to} what={view.emailed.reference ? `Confirmation for ${view.emailed.reference}` : "Call summary"} /> : null}
    </Card>
    <Card title="Follow-ups" meta={view.tasks.length || "None yet"}>
      {view.tasks.length ? <ul className={d.tasks}>{view.tasks.map((t) => <li key={t.title}><i aria-hidden="true"><Check size={10} /></i><div><b>{t.title}</b><small>{t.who} · {t.due}</small></div></li>)}</ul> : <Empty>Tasks for the agents are created from the lead.</Empty>}
    </Card>
  </div>;

  const inbox = <div className={d.cards}>
    <Card title="Call summary" meta={view.note ? `Added to ${r.number}` : "Written as the call goes"}>
      {view.note ? <p className={d.noteText}><Typed key={view.note} text={view.note} /></p> : <Empty>{agentName} writes the summary onto the lead.</Empty>}
    </Card>
    <Messages items={view.messages} empty="Messages for the agents land here." />
  </div>;

  return <Screens id="realestate" kicker={`Leads · Inbound call · ${view.timeZone}`} title={r.title ?? "New call"} state={state} active={active} cue={cue}
    head={<RecordHeader opened={r.opened} number={r.number ?? "L-····"} tags={[lead.known ? "Known contact" : "New inquiry"]} source={`Phone · AI assistant · ${agentName}`} stages={stages} at={at} label="Lead stage" />} screens={[
    { id: "lead", label: "Lead", icon: User, body: <div className={d.recGrid}><RecordForm sections={r.sections} opened={r.opened} waiting={`The lead opens the moment ${agentName} learns something worth keeping.`} />{leadCard}</div> },
    { id: "listings", label: "Listings", icon: Home, body: listings },
    { id: "calendar", label: "Calendar", icon: Calendar, body: calendar },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: inbox },
  ]} />;
}
const REALESTATE_SCREENS: Record<string, string> = { note_lead: "lead", search_listings: "listings", get_listing: "listings", estimate_value: "listings", check_availability: "calendar", book_appointment: "calendar", reschedule_appointment: "calendar", email_confirmation: "calendar", take_message: "inbox" };


/* ---------------- Bluebird Insurance ---------------- */

function insuranceStages(v: InsuranceView): RecordStage[] {
  const customer = v.verified;
  const quoting = (v.record.sections.find((s) => s.id === "quote")?.fields[0]?.value as string[] | null)?.length;
  if (customer && !quoting) return [{ id: "new", label: "New call" }, { id: "ready", label: "Verified" }, { id: "logged", label: "Request logged" }];
  return [{ id: "new", label: "New call" }, { id: "intake", label: "Details" }, { id: "ready", label: customer ? "Verified" : "Ready to quote" }, { id: "booked", label: "Agent call booked" }];
}

export function InsuranceOffice({ view, state, agentName, cue }: { view: InsuranceView; state: LiveState; agentName: string; cue?: Cue }) {
  const r = view.record;
  const stages = insuranceStages(view);
  const at = Math.max(0, stages.findIndex((x) => x.id === r.stage)) + (r.stage === "logged" && !stages.some((x) => x.id === "logged") ? stages.length - 1 : 0);
  const booked = view.calls.filter((c) => c.status === "booked");
  const p = view.policy;
  const c = view.claim;
  const rows = view.rows;
  const active = useFollow(cue, INSURANCE_SCREENS, "account");

  const account = <div className={d.recGrid}>
    <RecordForm sections={r.sections} opened={r.opened} waiting={`The account opens the moment ${agentName} has something to write down.`} />
    <div className={d.stack}>
      {rows.drivers.length || rows.vehicles.length || rows.home.length ? <Card title="For the quote" meta={`${rows.drivers.length + rows.vehicles.length + rows.home.length} items`}>
        <ul className={d.list}>
          {rows.drivers.map((x) => <li key={`d-${x.name}`}><span className={d.listIcon}><User size={15} /></span><div><b>{x.name}</b><small>Driver{x.detail ? ` · ${x.detail}` : ""}</small></div></li>)}
          {rows.vehicles.map((x) => <li key={`v-${x.name}`}><span className={d.listIcon}><Suitcase size={15} /></span><div><b>{x.name}</b><small>Vehicle</small></div></li>)}
          {rows.home.map((x) => <li key={`h-${x.name}`}><span className={d.listIcon}><Home size={15} /></span><div><b>{x.detail}</b><small>{x.name}</small></div></li>)}
        </ul>
      </Card> : null}
      {view.accountPolicies.length ? <Card title="Policies on the account" meta={view.accountPolicies.length}>
        <ul className={d.policies}>{view.accountPolicies.map((x) => <li key={x.number} data-on={p?.number === x.number || undefined}><b>{x.line}</b><span>{x.carrier}</span><small>{x.number} · renews {x.renews}</small></li>)}</ul>
      </Card> : null}
      {!rows.drivers.length && !rows.vehicles.length && !rows.home.length && !view.accountPolicies.length ? <Card title="Quote or customer" meta="Waiting"><Empty>Drivers, vehicles and the home for a quote, or a customer&rsquo;s policies, appear here.</Empty></Card> : null}
    </div>
  </div>;

  const policy = <div className={d.cards}>
    {p ? <Card title={`${p.line} policy`} meta={`${p.carrier} · ${p.term}`}>
      <dl className={d.coverages}>{p.coverages.map((x) => <div key={x.name}><dt>{x.name}</dt><dd>{x.limit ?? x.deductible}{x.deductible && !x.limit ? <em>deductible</em> : null}</dd></div>)}</dl>
      <p className={d.policyMeta}>{[...p.insured, ...p.drivers.map((n) => `Driver: ${n}`)].join(" · ")}</p>
      <div className={d.billing}><span>{p.billing.plan}</span><b>{p.billing.amount}</b><small>Next due {p.billing.nextDue} · {p.billing.status}</small></div>
    </Card> : <Card title="Policy" meta="Waiting"><Empty>A current customer&rsquo;s coverages, limits and deductibles open here once {agentName} finds them.</Empty></Card>}
    <div className={d.stack}>
      {c ? <Card title="Claim notice" meta={c.id}>
        <div className={d.claim} data-injured={c.injured || undefined}>
          {c.description ? <p>{c.description}</p> : null}
          <dl>{c.fields.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.value ?? <span className={d.dash}>Waiting</span>}</dd></div>)}</dl>
          <div className={d.claimLine}><Phone size={14} /><div><b>{c.carrier} claims · {c.claimsLine}</b><small>Given to the caller. The carrier&rsquo;s adjuster decides coverage.</small></div></div>
        </div>
      </Card> : null}
      {view.requests.length ? <Card title="Service requests" meta={view.requests.length}>
        <ul className={d.list}>{view.requests.map((x) => <li key={x.id}><span className={d.listIcon}><Inbox size={15} /></span><div><b>{x.kind} · {x.id}</b><small>{x.details}</small><small>{x.policy} · staff confirm before it takes effect</small></div></li>)}</ul>
      </Card> : null}
      {!c && !view.requests.length ? <Card title="Claims & changes" meta="None yet"><Empty>A claim notice or a policy change request appears here.</Empty></Card> : null}
    </div>
  </div>;

  const calendar = <div className={d.cards}>
    <Card title="Licensed agent" meta={booked.length ? booked[booked.length - 1].id : view.openTimes.length ? `${view.openTimes.length} open` : "Not booked"}>
      {booked.length ? booked.map((x) => <div key={x.id} className={d.consult}><span className={d.listIcon}><Calendar size={15} /></span><div><b>{x.agent} calls {x.name.split(" ")[0]}</b><small>{x.day}, {x.time} · {x.topic}</small></div><em>{x.changes ? `Moved ${x.changes}×` : "Booked"}</em></div>)
        : view.openTimes.length ? <div className={d.openTimes}>{view.openTimes.map((o) => <span key={o.slotId}><b>{o.time}</b><small>{o.agent.split(" ")[0]} · {o.day}</small></span>)}</div>
        : <Empty>Quotes go to a licensed agent: open call times appear here.</Empty>}
      {view.emailed ? <Emailed to={view.emailed.to} what={view.emailed.reference ? `${view.emailed.reference.startsWith("PA-") ? "ID card" : "Confirmation"} for ${view.emailed.reference}` : "Call summary"} /> : null}
    </Card>
    <Card title="Tasks created" meta={view.tasks.length || "None yet"}>
      {view.tasks.length ? <ul className={d.tasks}>{view.tasks.map((t) => <li key={t.title}><i aria-hidden="true"><Check size={10} /></i><div><b>{t.title}</b><small>{t.who} · {t.due}</small></div></li>)}</ul> : <Empty>Follow-ups for the team are created from the account.</Empty>}
    </Card>
  </div>;

  const inbox = <div className={d.cards}>
    <Card title="Call summary" meta={view.note ? `Added to ${r.number}` : "Written as the call goes"}>
      {view.note ? <p className={d.noteText}><Typed key={view.note} text={view.note} /></p> : <Empty>{agentName} writes the summary onto the account.</Empty>}
    </Card>
    <Messages items={view.messages} empty="Messages for the account manager land here." />
  </div>;

  return <Screens id="insurance" kicker={`Accounts · ${view.verified ? "Current customer" : "Prospect"} · ${view.timeZone}`} title={r.title ?? "New call"} state={state} active={active} cue={cue}
    head={<RecordHeader opened={r.opened} number={r.number ?? "Q-····"} tags={[view.verified ? "Verified customer" : "New prospect", ...view.flags]} source={`Phone · AI assistant · ${agentName}`} stages={stages} at={Math.min(at, stages.length - 1)} label="Account stage" />} screens={[
    { id: "account", label: "Account", icon: User, body: account },
    { id: "policy", label: "Policy", icon: Lock, body: policy },
    { id: "calendar", label: "Calendar", icon: Calendar, body: calendar },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: inbox },
  ]} />;
}
const INSURANCE_SCREENS: Record<string, string> = { note_account: "account", find_customer: "account", get_policy: "policy", report_claim: "policy", request_change: "policy", email_id_card: "policy", check_availability: "calendar", book_agent_call: "calendar", reschedule_agent_call: "calendar", email_confirmation: "calendar", take_message: "inbox" };


/* ---------------- Woodward Motor Co. ---------------- */

const DEAL_STAGES: RecordStage[] = [
  { id: "new", label: "New lead" },
  { id: "searching", label: "Searching" },
  { id: "interested", label: "Car picked" },
  { id: "booked", label: "Booked" },
];
/** Our own copy of each car's photo, served by the voice service through this site. */
const carPhoto = (vin: string) => `/voice/media/cars/${vin}.jpg`;

function CarTile({ c, searching }: { c: DealershipView["lot"]["cars"][number]; searching: boolean }) {
  return <li className={d.car} data-matched={c.matched || undefined} data-read={c.read || undefined} data-focus={c.focus || undefined} data-dim={(searching && !c.matched && !c.focus) || undefined}>
    <span className={d.carPhoto}><img src={carPhoto(c.vin)} alt="" loading="lazy" />{c.booked ? <em>Test drive</em> : c.focus ? <em data-tone="focus">On the call</em> : c.cpo ? <em data-tone="cpo">Certified</em> : null}</span>
    <div>
      <b>{c.name}</b>
      <strong>{c.price}</strong>
      <small>{c.miles}{c.drivetrain ? ` · ${c.drivetrain}` : ""}{c.color ? ` · ${c.color}` : ""}</small>
    </div>
  </li>;
}

export function DealershipOffice({ view, state, agentName, cue }: { view: DealershipView; state: LiveState; agentName: string; cue?: Cue }) {
  const r = view.record;
  const at = DEAL_STAGES.findIndex((x) => x.id === r.stage);
  const L = view.lot;
  const searching = L.criteria != null || L.cars.some((c) => c.focus);
  const booked = view.appointments.filter((a) => a.status === "booked");
  const f = view.focus;
  const active = useFollow(cue, DEALERSHIP_SCREENS, "inventory");

  const inventory = <div className={d.lotGrid}>
    <Card title={L.criteria ? "Inventory search" : "On the lot"} meta={L.criteria ? `${L.total} match${L.total === 1 ? "" : "es"}` : `${L.total.toLocaleString("en-US")} cars`}>
      {L.criteria ? <p className={d.homeCriteria}><Search size={13} />{L.criteria}</p> : null}
      {L.cars.length ? <ul className={d.cars}>{L.cars.map((c) => <CarTile key={c.stock} c={c} searching={searching} />)}</ul> : <Empty>Cars that match light up here as the caller describes what they want.</Empty>}
      <p className={d.homeSource}>Real cars for sale around Detroit, as of {L.snapshot}</p>
    </Card>
    {f ? <Card title="On the call" meta={f.price}>
      <div className={d.focusCar}>
        <img src={carPhoto(f.vin)} alt={f.name} />
        <b>{f.name}</b>
        <small>{f.warranty} warranty{f.cpo ? " · certified pre-owned" : ""}</small>
        <dl>{f.facts.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>
      </div>
    </Card> : null}
  </div>;

  const lead = <div className={d.recGrid}>
    <RecordForm sections={r.sections} opened={r.opened} waiting={`The lead opens the moment ${agentName} learns something worth keeping.`} />
    <div className={d.stack}>
      {view.known ? <Card title="Returning customer" meta={view.known.salesperson}>
        <div className={d.reviewRow} data-state="clear"><i aria-hidden="true"><Check size={11} /></i><div><b>{view.known.car}</b><small>Last service: {view.known.lastService}</small></div></div>
      </Card> : null}
      <Card title="Call summary" meta={view.note ? `Added to ${r.number}` : "Written as the call goes"}>
        {view.note ? <p className={d.noteText}><Typed key={view.note} text={view.note} /></p> : <Empty>{agentName} writes the summary onto the lead.</Empty>}
      </Card>
    </div>
  </div>;

  const calendar = <div className={d.cards}>
    <Card title={view.calendar?.purpose === "service" || booked.some((a) => a.purpose === "service") ? "Service bay" : "Test drive"} meta={booked.length ? booked[booked.length - 1].id : view.calendar?.openTimes.length ? `${view.calendar.openTimes.length} open` : "Not booked"}>
      {booked.length ? booked.map((a) => <div key={a.id} className={d.consult}><span className={d.listIcon}><Calendar size={15} /></span><div><b>{a.purpose === "test_drive" ? a.vehicle : `${a.service} · ${a.vehicle}`}</b><small>{a.day}, {a.time}{a.with ? ` · ${a.with}` : ""}</small></div><em>{a.changes ? `Moved ${a.changes}×` : "Booked"}</em></div>)
        : view.calendar?.openTimes.length ? <div className={d.openTimes}>{view.calendar.openTimes.map((o) => <span key={o.slotId}><b>{o.time}</b><small>{o.with ? `${o.with.split(" ")[0]} · ` : ""}{o.day}</small></span>)}</div>
        : <Empty>Open test-drive and service times appear here.</Empty>}
      {view.emailed ? <Emailed to={view.emailed.to} what={view.emailed.reference ? `Confirmation for ${view.emailed.reference}` : "Call summary"} /> : null}
    </Card>
    <Card title="Follow-ups" meta={view.tasks.length || "None yet"}>
      {view.tasks.length ? <ul className={d.tasks}>{view.tasks.map((t) => <li key={t.title}><i aria-hidden="true"><Check size={10} /></i><div><b>{t.title}</b><small>{t.who} · {t.due}</small></div></li>)}</ul> : <Empty>Tasks for sales, finance and service are created from the lead.</Empty>}
    </Card>
  </div>;

  return <Screens id="dealership" kicker={`Sales desk · ${view.timeZone}`} title={r.title ?? "New call"} state={state} active={active} cue={cue}
    head={<RecordHeader opened={r.opened} number={r.number ?? "D-····"} tags={[view.known ? "Returning customer" : "New lead"]} source={`Phone · AI assistant · ${agentName}`} stages={DEAL_STAGES} at={at} label="Lead stage" />} screens={[
    { id: "inventory", label: "Inventory", icon: Grid, body: inventory },
    { id: "lead", label: "Lead", icon: User, body: lead },
    { id: "calendar", label: "Calendar", icon: Calendar, body: calendar },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length, body: <Messages items={view.messages} empty="Messages for sales, finance and service land here." /> },
  ]} />;
}
const DEALERSHIP_SCREENS: Record<string, string> = { search_inventory: "inventory", get_vehicle: "inventory", note_lead: "lead", check_availability: "calendar", book_appointment: "calendar", reschedule_appointment: "calendar", email_confirmation: "calendar", take_message: "inbox" };


/* ---------------- Aspen Grove Dental ---------------- */

const DENTAL_STAGES: RecordStage[] = [
  { id: "new", label: "New call" },
  { id: "chart", label: "Chart" },
  { id: "checked", label: "Insurance & triage" },
  { id: "booked", label: "Booked" },
];
const UNIT = 10;
const ROW = 12;
const hhmm = (m: number) => { const h = Math.floor(m / 60); return `${(h + 11) % 12 + 1}:${String(m % 60).padStart(2, "0")}${h < 12 ? "am" : "pm"}`; };
const CONFIRM: Record<DentalView["board"]["appts"][number]["confirmed"], { t: string; label: string }> = { confirmed: { t: "C", label: "Confirmed" }, left_message: { t: "LM", label: "Left message" }, unconfirmed: { t: "U", label: "Unconfirmed" } };

/** The practice's appointment book: one column per operatory, 10-minute rows, blocks coloured by provider. */
function DentalBook({ b, agentName }: { b: DentalView["board"]; agentName: string }) {
  const rows = (b.close - b.open) / UNIT;
  const y = (m: number) => ((m - b.open) / UNIT) * ROW;
  return <section className={d.book} aria-label={`Appointment book, ${b.label}`}>
    <div className={d.bookHead} style={{ gridTemplateColumns: `56px repeat(${b.ops.length}, minmax(0, 1fr))` }}>
      <span className={d.bookDay}>{b.label.split(",")[0]}</span>
      {b.ops.map((o) => <span key={o.id} className={d.bookOp} data-tone={o.tone}><b>{o.name}</b><small>{o.provider} · {o.code}</small></span>)}
    </div>
    <div className={d.bookBody} style={{ gridTemplateColumns: `56px repeat(${b.ops.length}, minmax(0, 1fr))`, height: rows * ROW }}>
      <div className={d.bookTimes}>
        {Array.from({ length: rows }, (_, i) => b.open + i * UNIT).map((m) => <span key={m} style={{ top: y(m) }} data-hour={m % 60 === 0 || undefined}>{m % 60 === 0 ? hhmm(m) : `:${m % 60}`}</span>)}
      </div>
      {b.ops.map((o) => <div key={o.id} className={d.bookCol} data-tone={o.tone}>
        {b.lunch ? <div className={d.bookLunch} style={{ top: y(b.lunch[0]), height: ((b.lunch[1] - b.lunch[0]) / UNIT) * ROW }}><span>Lunch</span></div> : null}
        {b.holds.filter((h) => h.op === o.id).map((h) => <div key={`h${h.start}`} className={d.bookHold} style={{ top: y(h.start), height: (h.minutes / UNIT) * ROW - 2 }}><b>Emergency hold</b><small>{hhmm(h.start)} · same-day pain</small></div>)}
        {b.openSlots.filter((s) => s.op === o.id).map((s) => <div key={`o${s.start}`} className={d.bookOpen} style={{ top: y(s.start), height: (s.minutes / UNIT) * ROW - 2 }}><b>Open</b><small>{hhmm(s.start)} · {s.minutes} min</small></div>)}
        {b.appts.filter((a) => a.op === o.id).map((a) => <div key={a.id} className={d.appt} data-tone={a.tone} data-mine={a.kind === "demo" || undefined} style={{ top: y(a.start), height: (a.minutes / UNIT) * ROW - 2 }} title={`${a.patient} · ${a.procedures}`}>
          <i className={d.apptConfirm} data-state={a.confirmed} title={CONFIRM[a.confirmed].label}>{CONFIRM[a.confirmed].t}</i>
          <div>
            {a.kind === "demo" ? <span className={d.apptTag}>{a.id} · by {agentName}</span> : null}
            <b>{a.patient}</b>
            <small>{a.procedures}</small>
            {a.minutes >= 40 && a.phone ? <small>H: {a.phone}</small> : null}
            {a.minutes >= 50 ? <small>{a.code}</small> : null}
          </div>
          {a.alert ? <em className={d.apptAlert} title="Medical alert">+</em> : null}
          {a.exam && a.minutes >= 40 ? <span className={d.apptExam} style={{ top: Math.max(14, ((a.minutes / 2 - 5) / UNIT) * ROW) }}>Dr exam</span> : null}
        </div>)}
      </div>)}
      {b.now != null ? <div className={d.bookNow} style={{ top: y(b.now) }}><span>{hhmm(b.now)}</span></div> : null}
    </div>
  </section>;
}

export function DentalOffice({ view, state, agentName, cue }: { view: DentalView; state: LiveState; agentName: string; cue?: Cue }) {
  const r = view.record;
  const at = DENTAL_STAGES.findIndex((x) => x.id === r.stage);
  const ins = view.insurance;
  const tr = view.triage;
  const booked = view.booked;
  const active = useFollow(cue, DENTAL_SCREENS, "schedule");

  const chart = <div className={d.recGrid}>
    <RecordForm sections={r.sections} opened={r.opened} waiting={`The chart opens the moment ${agentName} has something to write down.`} />
    <div className={d.stack}>
      <Card title="Insurance check" meta={ins ? (ins.inNetwork ? "In network" : "Out of network") : "Waiting"}>
        <div className={d.review}>
          <div className={d.reviewRow} data-state={ins ? (ins.inNetwork ? "clear" : "conflict") : "waiting"}>
            <i aria-hidden="true">{ins ? (ins.inNetwork ? <Check size={11} /> : "!") : null}</i>
            <div><b>{ins ? ins.carrier : "Dental plan"}</b><small>{ins ? (ins.medicaid ? "Not accepted; low-cost city clinics suggested" : ins.inNetwork ? `In network${ins.onFile ? " · on file" : ""} · benefits verified before the visit` : "Out of network · we file the claim for the patient") : "Checked against the plans we're in network with"}</small></div>
          </div>
        </div>
      </Card>
      {tr ? <Card title="Triage" meta={tr.outcome === "er" ? "Emergency room" : tr.outcome === "now" ? "Within the hour" : "Same day"}>
        <div className={d.review}>
          <div className={d.reviewRow} data-state={tr.outcome === "er" ? "conflict" : "clear"}>
            <i aria-hidden="true">{tr.outcome === "er" ? "!" : <Check size={11} />}</i>
            <div><b>{tr.outcome === "er" ? "Told to call 911 or go to the ER" : tr.outcome === "now" ? "Knocked-out tooth · in within the hour" : "Same-day emergency visit"}</b><small>{[tr.painLevel != null ? `Pain ${tr.painLevel}/10` : null, tr.swelling ? "swelling" : null, tr.fever ? "fever" : null].filter(Boolean).join(" · ") || "Answers recorded"}</small></div>
          </div>
        </div>
      </Card> : null}
      {view.found ? <Card title="Current patient" meta={view.found.hygienist}>
        <div className={d.reviewRow} data-state="clear"><i aria-hidden="true"><Check size={11} /></i><div><b>{view.found.due}</b><small>Usually sees {view.found.hygienist}</small></div></div>
      </Card> : null}
      <Card title="Booked on this call" meta={booked.length ? booked[booked.length - 1].id : "Not yet"}>
        {booked.length ? booked.map((a) => <div key={a.id} className={d.consult}><span className={d.listIcon}><Calendar size={15} /></span><div><b>{a.visit}</b><small>{a.day}, {a.time} · {a.with} · {a.op}</small></div><em>{a.changes ? `Moved ${a.changes}×` : "Booked"}</em></div>) : <Empty>The visit lands in the book once {agentName} books it.</Empty>}
        {view.emailed ? <Emailed to={view.emailed.to} what={view.emailed.reference ? `Confirmation for ${view.emailed.reference}` : "Call summary"} /> : null}
      </Card>
    </div>
  </div>;

  const inbox = <div className={d.cards}>
    <div className={d.stack}>
      <Card title="Call summary" meta={view.note ? `Added to ${r.number}` : "Written as the call goes"}>
        {view.note ? <p className={d.noteText}><Typed key={view.note} text={view.note} /></p> : <Empty>{agentName} writes the summary onto the chart.</Empty>}
      </Card>
      <Card title="Tasks" meta={view.tasks.length || "None yet"}>
        {view.tasks.length ? <ul className={d.tasks}>{view.tasks.map((t) => <li key={t.title}><i aria-hidden="true"><Check size={10} /></i><div><b>{t.title}</b><small>{t.who} · {t.due}</small></div></li>)}</ul> : <Empty>Benefit checks, forms and reminders are queued from the call.</Empty>}
      </Card>
    </div>
    <Messages items={view.messages} empty="Messages for the front office land here." />
  </div>;

  return <Screens id="dental" kicker={`Appointments · ${view.timeZone}`} title={view.board.label} state={state} active={active} cue={cue}
    head={<RecordHeader opened={r.opened} number={r.number ?? "P-····"} tags={[r.title ?? "New patient call", ...(ins ? [ins.inNetwork ? `${ins.carrier} · in network` : `${ins.carrier} · out of network`] : [])]} source={`Phone · AI assistant · ${agentName}`} stages={DENTAL_STAGES} at={at} label="Call stage" />} screens={[
    { id: "schedule", label: "Schedule", icon: Calendar, body: <DentalBook b={view.board} agentName={agentName} /> },
    { id: "chart", label: "Chart", icon: User, body: chart },
    { id: "inbox", label: "Inbox", icon: Inbox, count: view.messages.length + view.asap.length, body: inbox },
  ]} />;
}
const DENTAL_SCREENS: Record<string, string> = { note_patient: "chart", find_patient: "chart", check_insurance: "chart", triage_emergency: "chart", check_availability: "schedule", book_appointment: "schedule", reschedule_appointment: "schedule", cancel_appointment: "schedule", add_to_asap_list: "inbox", email_confirmation: "chart", take_message: "inbox" };
