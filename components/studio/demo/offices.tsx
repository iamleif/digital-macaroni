import type { ReactNode } from "react";
import { ProductArt, swatch } from "../live/product-art";
import { formfieldEmpty } from "../live/sample-views";
import type { DemoId, FormFieldView, NorthlineView, TravelJourney, TravelView } from "../live/types";
import { BrandMark } from "../brand-marks";
import { Calendar, Check, Home, Inbox, Phone, Search, Settings, Users } from "../icons";
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

const AIRLINE_TONES: Record<string, string> = { "British Airways": "#1f3c74", Iberia: "#c8102e", "Virgin Atlantic": "#a3122f", "American Airlines": "#0b6fb3", Delta: "#0a2a5e", United: "#1b4b8f", JetBlue: "#0033a0", Lufthansa: "#05164d", "Air France": "#002157", KLM: "#00a1de" };
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

export function TravelOffice({ view, state, agentName }: { view: TravelView; state: LiveState; agentName: string }) {
  const q = view.search;
  const live = state !== "sample";
  const from = q ? (q.originName ?? q.origin) : null;
  const to = q ? (q.destinationName ?? q.destination) : null;
  const pending = view.readBack;
  const stopped = view.booking;
  const details = view.details;

  return <Shell id="travel" nav={1} kicker="Flight desk" title={q ? `${from} → ${to}` : "Flights"} state={state}
    tools={<span className={d.seg}><b>Cheapest</b><span>Fastest</span></span>}>
    <div className={d.trip}>
      <Field label="From" value={from} />
      <Field label="To" value={to} />
      <Field label="Depart" value={isoDate(q?.departureDate)} />
      <Field label="Return" value={q ? (isoDate(q.returnDate) ?? "One way") : null} />
      <Field label="Travellers" value={q ? `${q.adults} adult${q.adults > 1 ? "s" : ""} · ${cabin(q.cabinClass)}` : null} />
    </div>

    <section className={d.fares} aria-label="Fares">
      <div className={d.faresHead}><h3>{view.options.length ? `${view.options.length} ${view.options.length === 1 ? "option" : "options"}` : "Fares"}</h3><span>{view.options.length ? "Live airline prices · cheapest first" : q ? "Searching…" : "Nothing searched yet"}</span></div>
      {view.options.length ? view.options.map((o) => {
        const isPending = pending?.option === o.option;
        const isStopped = stopped?.option === o.option;
        const isSelected = view.selected === o.option;
        return <article key={`${o.option}-${o.price}`} className={d.fare} data-selected={isSelected || undefined} data-booking={isPending || isStopped || undefined}>
          <header>
            <span className={d.optionNo}>{o.option}</span>
            <i className={d.airline} style={{ background: AIRLINE_TONES[o.airline] ?? "#3b3a36" }}>{airlineCode(o.airline)}</i>
            <b>{o.airline}</b>
            {isStopped ? <span className={d.badge} data-tone="stop">Not booked · test mode</span>
              : isPending ? <span className={d.badge}>Waiting for a yes</span>
              : isSelected && live ? <span className={d.badge} data-tone="soft">{agentName} is describing this</span>
              : isSelected && details?.option === o.option ? <span className={d.badge} data-tone="soft"><Check size={11} />Rules checked</span> : null}
            <strong className={d.price}>{o.price}</strong>
          </header>
          {o.journeys.map((j, i) => <Leg key={i} j={j} label={i === 0 ? "Out" : "Back"} />)}
        </article>;
      }) : <>
        <Empty>{q ? `${agentName} is searching the airlines…` : `Fares appear here as ${agentName} searches the airlines.`}</Empty>
        {[0, 1, 2].map((i) => <div key={i} className={d.fareGhost} data-searching={Boolean(q) || undefined} aria-hidden="true"><i /><span /><span /><b /></div>)}
      </>}
    </section>

    <div className={d.cards}>
      <Card title="Fare details" meta={details ? `Option ${details.option}` : "None checked"}>
        {details ? <dl className={d.fields}>
          <Field label="Price" value={details.price} note={details.priceChanged ? "Changed since the search" : "Unchanged"} />
          {details.fareBrand ? <Field label="Fare" value={details.fareBrand} /> : null}
          <Field label="Refunds" value={details.refund} />
          <Field label="Changes" value={details.changes} />
          <Field label="Bags" value={details.baggage} />
        </dl> : <Empty>The rules and bags for a fare appear when {agentName} checks one.</Empty>}
      </Card>
      <Card title="Booking" meta={stopped ? "Stopped" : pending ? "Confirming" : "None yet"}>
        {stopped ? <div className={d.stopped}>
          <b>Not booked: this demo is in test mode</b>
          <span>Option {stopped.option} for {stopped.travellerName} · fare re-checked at {stopped.price}</span>
          <small>A live agency would take payment and issue the ticket here. Nothing was held or charged.</small>
        </div>
          : pending ? <ul className={d.list}><li><span className={d.listIcon}><Check size={15} /></span><div><b>Option {pending.option} · {pending.price}</b><small>For {pending.travellerName}</small><small>Read back · waiting for the caller’s yes</small></div></li></ul>
          : <Empty>A booking goes as far as payment, then stops: nothing is ever booked.</Empty>}
      </Card>
    </div>
  </Shell>;
}
