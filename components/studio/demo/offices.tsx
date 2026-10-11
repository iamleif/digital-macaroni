import { Fragment, createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ProductArt, swatch } from "../live/product-art";
import { formfieldEmpty } from "../live/sample-views";
import type { AppointmentView, BrandId, FormFieldView, HotelsStage, HotelsView, LawFirmView, NorthlineView, RecordField, TravelJourney, TravelSeatCell, TravelSeatMap, TravelStage, TravelView } from "../live/types";
import { BrandMark } from "../brand-marks";
import { ArrowRight, Bed, Calendar, Check, Clock, Coffee, Home, Inbox, Lock, MapPin, Phone, Search, Seat, Settings, Suitcase, User, Users } from "../icons";
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

function Shell({ id, nav, title, kicker, tools, state, children }: { id: BrandId; nav: number; title: string; kicker: string; tools?: ReactNode; state: LiveState; children: ReactNode }) {
  const icons = [Home, Calendar, Inbox, Users];
  return <div className={d.app} data-demo={id}>
    <nav className={d.rail} aria-hidden="true">
      <span className={d.railLogo}><BrandMark id={id} size={30} /></span>
      {icons.map((I, i) => <span key={i} data-on={i === nav || undefined}><I size={17} /></span>)}
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
      {children}
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

export function NorthlineOffice({ view, state, agentName }: { view: NorthlineView; state: LiveState; agentName: string }) {
  const job = (techId: string, hour: number) => view.schedule.find((j) => j.techId === techId && j.hour === hour);
  const isOpen = (techId: string, hour: number) => view.open.some((o) => o.techId === techId && o.hour === hour);
  const r = view.request;
  const booked = [...view.appointments].reverse().find((a) => a.status === "booked");
  const time = booked ? `${booked.day}, ${booked.window}` : r.proposed ? `${r.proposed.day}, ${r.proposed.window}` : null;
  const filled = [r.service, r.name, r.address, r.issue, time].filter(Boolean).length;
  const slots = view.technicians.length * view.windows.length;
  const taken = view.schedule.length;
  let proposedShown = false;

  return <Shell id="northline" nav={1} kicker={`Dispatch · ${view.timeZone}`} title={view.day.label} state={state}
    tools={<span className={d.seg}><b>Day</b><span>Week</span></span>}>
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

    <div className={d.cards}>
      <Card title="Service request" meta={<span className={d.progress}><i style={{ width: `${filled * 20}%` }} />{filled}/5</span>}>
        <dl className={d.fields}>
          <Field label="Service" value={r.service} />
          <Field label="Name" value={r.name} />
          <Field label="Address" value={r.address} />
          <Field label="Problem" value={r.issue} />
          <Field label="Time" value={time} note={booked ? "Booked" : r.proposed ? "Proposed" : undefined} />
        </dl>
      </Card>
      <div className={d.stack}>
        <Card title="Visits" meta={view.appointments.length || "None yet"}>
          {view.appointments.length ? <ul className={d.list}>{view.appointments.map((a) => <li key={a.id} data-status={a.status}>
            <span className={d.listIcon}><Calendar size={15} /></span>
            <div><b>{a.service} · {a.id}</b><small>{a.day}, {a.window} · {a.technician}</small><small>{a.name}, {a.address}</small></div>
            <em data-status={a.status}>{a.status === "cancelled" ? "Cancelled" : a.changes ? `Moved ${a.changes}×` : "Booked"}</em>
          </li>)}</ul> : <Empty>A visit appears here once {agentName} books it.</Empty>}
          {view.emailed ? <Emailed to={view.emailed.to} what={`Confirmation for ${view.emailed.reference}`} /> : null}
        </Card>
        <Card title="Messages" meta={view.messages.length || "Inbox empty"}>
          {view.messages.length ? <ul className={d.list}>{view.messages.map((m) => <li key={m.id}>
            <span className={d.listIcon}><Phone size={15} /></span>
            <div><b>{m.name} · {m.id}</b><small>{m.summary}</small>{m.preferredTime ? <small>Call back {m.preferredTime}</small> : null}</div>
          </li>)}</ul> : <Empty>Callback requests for the team land here.</Empty>}
        </Card>
      </div>
    </div>
  </Shell>;
}

/* ---------------- Ellie's other front desks: salon / med spa and clinic ---------------- */

const WORDS = {
  salon: { brand: "lune" as const, kicker: "Front desk", staff: "Stylist", staffs: "Team today", menu: "Service menu", request: "New booking", list: "Appointments", mine: "Booked on this call" },
  clinic: { brand: "tidewell" as const, kicker: "Reception", staff: "Practitioner", staffs: "Practitioners", menu: "Visit types", request: "Patient booking", list: "Visits", mine: "Booked on this call" },
};

export function AppointmentOffice({ view, state, agentName }: { view: AppointmentView; state: LiveState; agentName: string }) {
  const w = WORDS[view.skin];
  const booked = [...view.appointments].reverse().find((a) => a.status === "booked");
  const filled = view.request.filter((r) => r.value).length;
  const busyHours = view.schedule.reduce((n, j) => n + j.span, 0);
  const isOpen = (staffId: string, hour: number) => view.open.some((o) => o.staffId === staffId && o.hour === hour);
  const groups = [...new Set(view.menu.map((m) => m.group))];

  return <Shell id={w.brand} nav={1} kicker={`${w.kicker} · ${view.timeZone}`} title={view.day.label} state={state}
    tools={<span className={d.seg}><b>Day</b><span>Week</span></span>}>
    <div className={d.kpis}>
      <div><span>{w.staffs}</span><strong>{view.staff.length}</strong></div>
      <div><span>Hours booked</span><strong>{busyHours}<small>/{view.staff.length * view.hours.length}</small></strong></div>
      <div data-hot={view.open.length > 0 || undefined}><span>Open for this</span><strong>{view.open.length || "—"}</strong></div>
      <div data-hot={Boolean(booked) || undefined}><span>{w.mine}</span><strong>{booked ? booked.id : "—"}</strong></div>
    </div>

    <section className={d.board} aria-label={`${w.staff} schedule`}>
      <div className={d.boardGrid} style={{ gridTemplateColumns: `140px repeat(${view.hours.length}, minmax(96px, 1fr))` }}>
        <span className={d.boardCorner}>{w.staff}</span>
        {view.hours.map((h) => <span key={h.hour} className={d.boardHour}>{h.label}</span>)}
        {view.staff.map((s, row) => {
          const cells: ReactNode[] = [<span key={s.id} className={d.tech}><i data-tone={TONES[row % 4]}>{initials(s.name.replace("Dr. ", ""))}</i><span className={d.techWho}><b>{s.name}</b><small>{s.role}</small></span></span>];
          for (let i = 0; i < view.hours.length; i++) {
            const hour = view.hours[i]!.hour;
            const j = view.schedule.find((x) => x.staffId === s.id && x.hour === hour);
            const span = j ? Math.min(j.span, view.hours.length - i) : 1;
            let content: ReactNode = null;
            if (j?.kind === "demo") content = <div className={d.jobMine}><span className={d.jobTag}>{j.ref} · by {agentName}</span><b>{j.title}</b><small>{j.name}</small></div>;
            else if (j) content = <div className={d.jobBusy}><b>{j.title}</b><small>Booked</small></div>;
            else if (view.proposed && view.proposed.staffId === s.id && view.proposed.hour === hour) content = <div className={d.jobProposed}><b>Proposed</b><small>Waiting for a yes</small></div>;
            else if (isOpen(s.id, hour)) content = <div className={d.jobOpen}>Open</div>;
            cells.push(<div key={`${s.id}${hour}`} className={d.slot} style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>{content}</div>);
            i += span - 1;
          }
          return <Fragment key={s.id}>{cells}</Fragment>;
        })}
      </div>
    </section>

    <div className={d.cards}>
      <Card title={w.menu} meta={`${view.menu.length} options`}>
        <div className={d.menu}>{groups.map((g) => <div key={g}>
          <small>{g}</small>
          <ul>{view.menu.filter((m) => m.group === g).map((m) => <li key={m.id} data-chosen={m.chosen || undefined}>
            <div><b>{m.name}</b><span>{m.minutes} min · {m.staff.join(", ")}</span></div>
            <strong>{m.price}</strong>
          </li>)}</ul>
        </div>)}</div>
      </Card>
      <div className={d.stack}>
        <Card title={w.request} meta={<span className={d.progress}><i style={{ width: `${(filled / view.request.length) * 100}%` }} />{filled}/{view.request.length}</span>}>
          <dl className={d.fields}>{view.request.map((r) => <Field key={r.label} label={r.label} value={r.value} note={r.note} />)}</dl>
        </Card>
        {view.extras ? <Card title={view.extras.title}>
          <ul className={d.extras}>{view.extras.rows.map((r) => <li key={r.label} data-tone={r.tone}><span>{r.label}</span><b>{r.value}</b></li>)}</ul>
        </Card> : null}
        <Card title={w.list} meta={view.appointments.length || "None yet"}>
          {view.appointments.length ? <ul className={d.list}>{view.appointments.map((a) => <li key={a.id} data-status={a.status}>
            <span className={d.listIcon}><Calendar size={15} /></span>
            <div><b>{a.service} · {a.id}</b><small>{a.when} · {a.staff}</small><small>{a.name}</small></div>
            <em data-status={a.status}>{a.status === "cancelled" ? "Cancelled" : a.changes ? `Moved ${a.changes}×` : "Booked"}</em>
          </li>)}</ul> : <Empty>{view.skin === "salon" ? "An appointment" : "A visit"} appears here once {agentName} books it.</Empty>}
          {view.emailed ? <Emailed to={view.emailed.to} what={`Confirmation for ${view.emailed.reference}`} /> : null}
        </Card>
      </div>
    </div>
  </Shell>;
}

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

export function FormFieldOffice({ view, state, agentName }: { view: FormFieldView; state: LiveState; agentName: string }) {
  const live = state !== "sample";
  const focus = view.shown.find((p) => p.focus);
  // The shelves always show: the standard catalogue with live stock for anything looked up, plus other finds.
  const liveById = new Map(view.shown.map((p) => [p.id, p]));
  const catalogue = [...formfieldEmpty.shown.map((p) => liveById.get(p.id) ?? p), ...view.shown.filter((p) => !formfieldEmpty.shown.some((s) => s.id === p.id))];
  const found = new Set(live ? view.shown.map((p) => p.id) : []);
  const productId = (name: string) => catalogue.find((p) => p.name === name)?.id;
  const reservedCount = view.reservations.filter((r) => r.status === "reserved").length;

  return <Shell id="formfield" nav={0} kicker="Shop" title="Catalogue" state={state}
    tools={<span className={d.search}><Search size={13} />{found.size ? `${found.size} found by ${agentName}` : "Search products"}</span>}>
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

    <div className={d.cards}>
      <Card title="Product details" meta={focus?.name ?? "None open"}>
        {focus && (focus.description || focus.materials) ? <>
          {focus.description ? <p className={d.copy}>{focus.description}</p> : null}
          <dl className={d.fields}>
            {focus.materials ? <Field label="Materials" value={focus.materials} /> : null}
            {focus.size ? <Field label="Size" value={focus.size} /> : null}
          </dl>
        </> : <Empty>When {agentName} looks something up for you, its details open here.</Empty>}
      </Card>
      <Card title="Pickup orders" meta={view.reservations.length || "None yet"}>
        {view.reservations.length ? <ul className={d.list}>{view.reservations.map((r) => <li key={r.id} data-status={r.status}>
          <span className={d.thumb}><Photo id={productId(r.product)} name={r.product} option={r.option} /></span>
          <div><b>{r.quantity} × {r.product}</b><small>{r.option} · for {r.name} · {r.id}</small><small>Held until closing {r.pickupBy} · ${r.price} paid in store</small></div>
          <em data-status={r.status === "reserved" ? "booked" : "cancelled"}>{r.status === "reserved" ? "Ready" : "Cancelled"}</em>
        </li>)}</ul> : <Empty>A pickup order appears here once {agentName} reserves something.</Empty>}
        {view.emailed ? <Emailed to={view.emailed.to} what={`Reservation ${view.emailed.reference}`} /> : null}
      </Card>
      <Card title={view.order ? `Order #${view.order.number}` : "Order lookup"} meta={view.order?.status ?? "None yet"}>
        {view.order ? <>
          <p className={d.copy}>{view.order.name}</p>
          <ul className={d.items}>{view.order.items.map((i) => <li key={i.name}><b>{i.name}</b><span>{i.option} · ${i.price}</span></li>)}</ul>
          <ol className={d.timeline}>{view.order.events.map((e, i) => <li key={e} data-last={i === view.order!.events.length - 1 || undefined}>{e}</li>)}</ol>
          {view.supportRequests.map((s) => <p key={s.id} className={d.flag}>Support request {s.id}: pending review. Nothing is refunded automatically.</p>)}
        </> : <Empty>{agentName} discusses an order only once its number and email both match.</Empty>}
      </Card>
      <Card title="Messages" meta={view.messages.length || "Inbox empty"}>
        {view.messages.length ? <ul className={d.list}>{view.messages.map((m) => <li key={m.id}>
          <span className={d.listIcon}><Phone size={15} /></span>
          <div><b>{m.name} · {m.id}</b><small>{m.summary}</small></div>
        </li>)}</ul> : <Empty>Callback requests for the team land here.</Empty>}
      </Card>
    </div>
  </Shell>;
}

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

export function TravelOffice({ view, state, agentName }: { view: TravelView; state: LiveState; agentName: string }) {
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

  return <Shell id="travel" nav={1} kicker={kicker} title={q ? `${from} → ${to}` : "Flights"} state={state}
    tools={<span className={d.seg}><b>Booking</b><span>Trips</span></span>}>
    {searching ? <div className={d.trip}>
      <Field label="From" value={from} />
      <Field label="To" value={to} />
      <Field label="Depart" value={isoDate(q?.departureDate)} />
      <Field label="Return" value={q ? (isoDate(q.returnDate) ?? "One way") : null} />
      <Field label="Travellers" value={q ? `${q.adults} · ${cabin(q.cabinClass)}` : null} />
    </div> : null}
    <Stepper stage={stage} shown={shown} onShow={(s) => setPeek(s === stage ? null : { at: stage, show: s })} view={view} />
    <div className={d.stagePanel} key={shown}>{panel}</div>
    <TripSummary view={view} stage={stage} />
    {view.messages?.length ? <Card title="Messages for an agent" meta={view.messages.length}>
      <ul className={d.list}>{view.messages.map((m) => <li key={m.id}>
        <span className={d.listIcon}><Phone size={15} /></span>
        <div><b>{m.name} · {m.id}</b><small>{m.summary}</small><small>Call back on {m.callback}{m.preferredTime ? `, ${m.preferredTime}` : ""}</small></div>
      </li>)}</ul>
    </Card> : null}
  </Shell>;
}


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
            <span className={d.board} data-breakfast={breakfast || undefined}>{breakfast ? <Coffee size={12} /> : null}{r.board}</span>
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

export function HotelsOffice({ view, state, agentName }: { view: HotelsView; state: LiveState; agentName: string }) {
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

  return <Shell id="hotels" nav={1} kicker={kicker} title={q ? q.area : "Hotels"} state={state}
    tools={<span className={d.seg}><b>Booking</b><span>Stays</span></span>}>
    {searching ? <div className={d.trip}>
      <Field label="Area" value={q?.area} />
      <Field label="Check-in" value={q?.checkinLabel} />
      <Field label="Check-out" value={q?.checkoutLabel} />
      <Field label="Nights" value={q ? String(q.nights) : null} />
      <Field label="Guests" value={q ? plural(q.adults, "adult") : null} />
    </div> : null}
    <HotelStepper stage={stage} shown={shown} onShow={(s) => setPeek(s === stage ? null : { at: stage, show: s })} view={view} />
    <div className={d.stagePanel} key={shown}>{panel}</div>
    {hotelStep(stage) >= hotelStep("hotel") ? <StaySummary view={view} /> : null}
    {view.messages?.length ? <Card title="Messages for an agent" meta={view.messages.length}>
      <ul className={d.list}>{view.messages.map((m) => <li key={m.id}>
        <span className={d.listIcon}><Phone size={15} /></span>
        <div><b>{m.name} · {m.id}</b><small>{m.summary}</small><small>Call back on {m.callback}{m.preferredTime ? `, ${m.preferredTime}` : ""}</small></div>
      </li>)}</ul>
    </Card> : null}
  </Shell>;
}


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

export function LawFirmOffice({ view, state, agentName }: { view: LawFirmView; state: LiveState; agentName: string }) {
  const r = view.record;
  const a = view.assessment;
  const conflict = view.conflict;
  const stages = r.stage === "declined" ? [...STAGES.slice(0, 2), { id: "declined" as const, label: "Declined" }] : STAGES;
  const at = stages.findIndex((x) => x.id === r.stage);
  const filled = r.sections.flatMap((s) => s.fields).filter((x) => (Array.isArray(x.value) ? x.value.length : x.value)).length;
  const total = r.sections.flatMap((s) => s.fields).length;
  const booked = [...view.consults].reverse().find((c) => c.status === "booked");

  return <Shell id="lawfirm" nav={2} kicker={`Matters · New potential client · ${view.timeZone}`} title={r.title ?? "New call"} state={state}
    tools={<span className={d.seg}><b>Record</b><span>7 AM brief</span></span>}>
    <header className={d.recHead} data-opened={r.opened || undefined}>
      <div className={d.recId}>
        <span className={d.recNum}>{r.number ?? "PI-····"}</span>
        <span className={d.recTag}>Potential new client</span>
        <span className={d.recTag} data-tone="src">Phone · AI intake · {agentName}</span>
      </div>
      <ol className={d.stages} aria-label="Matter stage">
        {stages.map((x, i) => <li key={x.id} data-state={i < at ? "done" : i === at ? "now" : "next"} data-declined={x.id === "declined" || undefined}><i>{i < at ? <Check size={10} /> : i + 1}</i>{x.label}</li>)}
      </ol>
    </header>

    <div className={d.recGrid}>
      <div className={d.recForm}>
        {!r.opened ? <p className={d.recWaiting}>The matter record opens the moment {agentName} has something to write down.</p> : null}
        {r.sections.map((sec) => <section key={sec.id} className={d.recSection}>
          <h3>{sec.title}{sec.id === "contact" ? <span>{filled}/{total} filled</span> : null}</h3>
          <div className={d.recFields}>
            {sec.fields.map((fl) => <div key={fl.key} className={d.recField} data-wide={fl.wide || undefined}>
              <label>{fl.label}</label>
              <RecordInput field={fl} />
            </div>)}
          </div>
        </section>)}
      </div>

      <div className={d.stack}>
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

        <Card title="Tasks created" meta={view.tasks.length || "None yet"}>
          {view.tasks.length ? <ul className={d.tasks}>{view.tasks.map((t) => <li key={t.title}><i aria-hidden="true"><Check size={10} /></i><div><b>{t.title}</b><small>{t.who} · {t.due}</small></div></li>)}</ul> : <Empty>Follow-ups for the team are created from the record.</Empty>}
        </Card>

        <Card title="Free consultation" meta={booked ? booked.id : view.openTimes.length ? `${view.openTimes.length} open` : "Not booked"}>
          {booked ? <div className={d.consult}><span className={d.listIcon}><Calendar size={15} /></span><div><b>{booked.attorney}</b><small>{booked.day}, {booked.time} · {booked.format}</small></div><em>{booked.changes ? `Moved ${booked.changes}×` : "Booked"}</em></div>
            : view.openTimes.length ? <div className={d.openTimes}>{view.openTimes.map((o) => <span key={o.slotId}><b>{o.time}</b><small>{o.attorney.split(" ")[0]} · {o.day}</small></span>)}</div>
            : <Empty>Open times with the right attorney appear here.</Empty>}
          {view.emailed ? <Emailed to={view.emailed.to} what={`Confirmation for ${view.emailed.reference}`} /> : null}
        </Card>

        <Card title="7 AM case brief" meta={view.brief ? `${view.brief.rows.length} calls` : "Last night"}>
          {view.brief ? <ol className={d.brief}>{view.brief.rows.map((row, i) => <li key={`${row.who}-${i}`} data-mine={row.mine || undefined}>
            <span className={d.tier} data-tier={row.tier ?? "none"}>{row.tier ?? "—"}</span>
            <div><b>{row.who}{row.mine ? <em>This call</em> : null}</b><small>{row.summary}</small></div>
          </li>)}</ol> : <Empty>Every call ranked by case value, ready at 7 AM.</Empty>}
        </Card>

        {view.messages.length ? <Card title="Messages" meta={view.messages.length}>
          <ul className={d.list}>{view.messages.map((m) => <li key={m.id}>
            <span className={d.listIcon}><Phone size={15} /></span>
            <div><b>{m.name} · {m.id}{m.urgent ? " · urgent" : ""}</b><small>{m.summary}</small>{m.preferredTime ? <small>Call back {m.preferredTime}</small> : null}</div>
          </li>)}</ul>
        </Card> : null}
      </div>
    </div>
  </Shell>;
}
