import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ProductArt, swatch } from "../live/product-art";
import { formfieldEmpty } from "../live/sample-views";
import type { DemoId, FormFieldView, NorthlineView, TravelJourney, TravelSeatCell, TravelSeatMap, TravelStage, TravelView } from "../live/types";
import { BrandMark } from "../brand-marks";
import { ArrowRight, Calendar, Check, Home, Inbox, Lock, Phone, Search, Seat, Settings, Suitcase, User, Users } from "../icons";
import d from "./demo.module.css";

/*
 * Each demo business's back office, as its staff would see it while the agent works. Rendered only
 * from the session's records (or the sample records before a call), so what changes on screen is
 * exactly what the agent did.
 */

export type LiveState = "sample" | "live" | "finished";

const STATE_LABEL: Record<LiveState, string> = { sample: "Sample data", live: "Your call · live", finished: "Your call · finished" };

function Shell({ id, nav, title, kicker, tools, state, children }: { id: DemoId; nav: number; title: string; kicker: string; tools?: ReactNode; state: LiveState; children: ReactNode }) {
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
  const [n, setN] = useState(0);
  useEffect(() => {
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
  }, [text, delay]);
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

function SeatMap({ map, seat }: { map: TravelSeatMap; seat: TravelView["seat"] }) {
  const ref = map.rows.find((r) => r.row != null);
  const letters = ref ? ref.sections.map((sec) => sec.map((c) => ("id" in c ? c.id.replace(/^\d+/, "") : ""))) : [];
  const seats = map.rows.flatMap((r) => r.sections.flat()).filter((c): c is Extract<TravelSeatCell, { id: string }> => "id" in c);
  const open = seats.filter((c) => c.st !== "taken");
  const n = map.rows.length;
  const w = map.wings;
  // The cabin shows a section at a time; it slides to the seat once one is chosen.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>("[data-chosen]");
    if (!box || !el) return;
    const r = box.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const t = setTimeout(() => box.scrollBy({ left: e.left - r.left - r.width / 2 + e.width / 2, top: e.top - r.top - r.height / 2 + e.height / 2, behavior: "smooth" }), 250);
    return () => clearTimeout(t);
  }, [seat?.seat]);
  const nudge = (dir: 1 | -1) => {
    const box = scroller.current;
    if (!box) return;
    const across = box.scrollWidth > box.clientWidth + 4;
    box.scrollBy({ left: across ? dir * box.clientWidth * 0.6 : 0, top: across ? 0 : dir * box.clientHeight * 0.6, behavior: "smooth" });
  };
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
        <div className={d.seatRows}>
          {w ? <span className={d.wing} style={{ "--w0": (w.first_row_index + 1) / (n + 1), "--wn": (w.last_row_index - w.first_row_index + 1) / (n + 1) } as CSSProperties} aria-hidden="true" /> : null}
          <div className={d.seatAxis} aria-hidden="true">{letters.map((sec, si) => <Fragment key={si}>{si > 0 ? <span className={d.aisle} /> : null}{sec.map((l, ci) => <span key={ci}>{l}</span>)}</Fragment>)}</div>
          {map.rows.map((r, i) => <div key={r.row ?? `x${i}`} className={d.seatCol} data-exit={r.exit || undefined} style={{ animationDelay: `${i * 30}ms` }}>
            {r.sections.map((sec, si) => <Fragment key={si}>
              {si > 0 ? <span className={d.aisle}>{si === 1 && r.row != null ? r.row : ""}</span> : null}
              {sec.map((c, ci) => "id" in c
                ? <span key={c.id} className={d.seat} data-st={c.st} data-chosen={seat?.seat === c.id || undefined} title={`${c.id} · ${c.st === "taken" ? "taken" : c.price ?? "free"}`}>
                  {seat?.seat === c.id ? <Check size={15} /> : c.st === "paid" ? <i>{c.price}</i> : null}
                </span>
                : <span key={`f${ci}`} className={d.facility} data-type={c.type}>{FACILITY[c.type] ?? ""}</span>)}
            </Fragment>)}
          </div>)}
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
  </Shell>;
}
