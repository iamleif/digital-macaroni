import Image from "next/image";
import { Check, Search } from "./icons";
import h from "./home.module.css";

/*
 * Cropped corners of each demo's back office, as the homepage cards show them. The highlighted
 * item in each is the thing the agent just did on a call. Sample data that mirrors the live demos.
 */

const hours = ["10a", "12p", "2p", "4p", "6p"];
const techs = [
  { name: "Maya", initials: "M", tone: "a", jobs: [{ start: 1, title: "Heat pump", who: "R. Patel" }, { start: 3, title: "Furnace", who: "Chloe Bennett", isNew: true }] },
  { name: "Sam", initials: "S", tone: "b", jobs: [{ start: 2, title: "AC repair", who: "M. Tran" }, { start: 4, title: "Heat pump", who: "D. Ruiz" }] },
  { name: "Jordan", initials: "J", tone: "c", jobs: [{ start: 1, title: "Tune-up", who: "P. Oduya" }, { start: 4, title: "Cooling repair", who: "J. Whitfield" }] },
  { name: "Priya", initials: "P", tone: "d", jobs: [{ start: 1, title: "Thermostat", who: "K. Moss" }] },
];

export function NorthlinePreview() {
  return <div className={h.frag}>
    <div className={h.fragHead}>
      <div><small>Dispatch</small><b>Thursday, Oct 8</b></div>
      <span className={h.fragSeg}><b>Day</b><span>Week</span></span>
    </div>
    <div className={h.dispatch}>
      <span />
      {hours.map((t) => <span key={t} className={h.dispatchHour}>{t}</span>)}
      {techs.map((t, row) => [
        <span key={t.name} className={h.dispatchTech} style={{ gridRow: row + 2 }}><i data-tone={t.tone}>{t.initials}</i>{t.name}</span>,
        ...t.jobs.map((j) => <span key={t.name + j.start} className={h.job} data-new={j.isNew || undefined} style={{ gridRow: row + 2, gridColumn: j.start + 1 }}>
          <b>{j.title}</b><small>{j.who}</small>{j.isNew && <em className={h.jobTag}>New · Ellie</em>}
        </span>),
      ])}
      <span className={h.nowLine} aria-hidden="true" />
    </div>
  </div>;
}

const items = [
  { name: "Ridge Table Lamp", price: "$89", img: "/studio/products/ridge-lamp.jpg", stock: [["#9db08f", "2 left"], ["#d9cdb2", "Out"], ["#3a3a36", "5 left"]], held: true },
  { name: "Field Planter", price: "$48", img: "/studio/products/field-planter.jpg", stock: [["#9db08f", "5 left"], ["#c07b54", "2 left"]] },
  { name: "Everyday Mugs", price: "$32", img: "/studio/products/everyday-mugs.jpg", stock: [["#d9cdb2", "12 left"], ["#4a5a7a", "7 left"]] },
];

export function FormFieldPreview() {
  return <div className={h.frag}>
    <div className={h.fragHead}>
      <div><small>Catalogue</small><b>3 found for this caller</b></div>
      <span className={h.fragSearch}><Search size={12} />green lamp</span>
    </div>
    <div className={h.products}>
      {items.map((p) => <div key={p.name} className={h.product} data-held={p.held || undefined}>
        <div className={h.productImg}>
          <Image unoptimized src={p.img} alt="" width={240} height={240} />
          {p.held && <span className={h.heldBadge}><Check size={11} />Held · Sam</span>}
        </div>
        <b>{p.name}</b>
        <span className={h.productPrice}>{p.price}</span>
        <div className={h.swatches}>{p.stock.map(([c, s]) => <span key={c + s}><i style={{ background: c }} />{s}</span>)}</div>
      </div>)}
    </div>
  </div>;
}

const fares = [
  { carrier: "British Airways", code: "BA", tone: "#1f3c74", dep: "8:20", arr: "11:05", info: "Nonstop · 7h 45m", price: "$389", picked: true },
  { carrier: "Iberia", code: "IB", tone: "#c8102e", dep: "7:05", arr: "1:50", info: "1 stop · MAD", price: "$402" },
  { carrier: "Virgin Atlantic", code: "VS", tone: "#a3122f", dep: "11:40", arr: "2:35", info: "Nonstop · 7h 55m", price: "$426" },
];

export function WaypointPreview() {
  return <div className={h.frag}>
    <div className={h.fragHead}>
      <div><small>Flights · Fri, Oct 16 · 1 adult</small><b>London → New York</b></div>
      <span className={h.fragSeg}><b>Best</b><span>Cheapest</span></span>
    </div>
    <div className={h.fares}>
      {fares.map((f) => <div key={f.code} className={h.fare} data-picked={f.picked || undefined}>
        <i style={{ background: f.tone }}>{f.code}</i>
        <div className={h.fareTimes}><b>{f.dep} → {f.arr}</b><small>{f.carrier} · {f.info}</small></div>
        <div className={h.farePrice}><b>{f.price}</b>{f.picked ? <small className={h.fareChecked}><Check size={10} />Rules checked</small> : <small>Economy</small>}</div>
      </div>)}
    </div>
  </div>;
}
