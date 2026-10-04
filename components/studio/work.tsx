"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowUpRight } from "./icons";
import h from "./home.module.css";

const products = [
  {
    id: "rankladder",
    name: "RankLadder",
    category: "Front office for local business",
    headline: "Calls, conversations, booking and reviews in one workspace.",
    description: "RankLadder answers the phone, keeps every customer conversation in one inbox, and puts the next step in front of the team.",
    image: "/studio/rankladder-inbox.jpg",
    width: 2000, height: 1257,
    alt: "RankLadder shared inbox showing customer conversations, a call summary, booking follow-up, and a call transcript",
    website: "https://rankladder.app",
    domain: "rankladder.app",
    tone: "lavender",
    tags: ["Voice agent", "Shared inbox", "Reviews"],
  },
  {
    id: "hey-anders",
    name: "Hey Anders",
    category: "AI assistant for practices",
    headline: "A little more room to care.",
    description: "An assistant and shared workspace for appointment-based practices. Conversations, scheduling and the next task, around the people who need you.",
    image: "/studio/hey-anders-dashboard.png",
    width: 1512, height: 827,
    alt: "Hey Anders practice dashboard with appointments, an assistant briefing, and tasks needing review",
    website: "https://heyanders.com",
    domain: "heyanders.com",
    tone: "rose",
    tags: ["Assistant", "Scheduling", "Tasks"],
  },
  {
    id: "twotop",
    name: "TwoTop",
    category: "Hospitality operations",
    headline: "Every shift ready before it starts.",
    description: "Schedules, team communication and service readiness for hospitality, so everyone is on the same page before the doors open.",
    image: "/studio/twotop-dashboard.png",
    width: 1280, height: 720,
    alt: "TwoTop hospitality dashboard with team communication and shift readiness",
    website: "https://twotop.app",
    domain: "twotop.app",
    tone: "sand",
    tags: ["Scheduling", "Team chat", "Checklists"],
  },
];

export function Work() {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const p = products[active];

  return <div>
    <div className={h.tabs} role="tablist" aria-label="Products we’ve made">
      {products.map((item, i) => <button
        key={item.id}
        ref={(el) => { tabs.current[i] = el; }}
        type="button"
        role="tab"
        id={`work-tab-${item.id}`}
        aria-controls="work-panel"
        aria-selected={active === i}
        tabIndex={active === i ? 0 : -1}
        onClick={() => setActive(i)}
        onKeyDown={(e) => {
          const n = products.length;
          const next = e.key === "ArrowRight" ? (active + 1) % n : e.key === "ArrowLeft" ? (active + n - 1) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
          if (next !== null) { e.preventDefault(); setActive(next); tabs.current[next]?.focus(); }
        }}
      >{item.name}</button>)}
    </div>
    <div id="work-panel" role="tabpanel" aria-labelledby={`work-tab-${p.id}`} className={h.workPanel} key={p.id}>
      <a className={h.workShot} data-tone={p.tone} href={p.website} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${p.name} (opens in a new tab)`}>
        <span className={h.bezel}><Image unoptimized src={p.image} alt={p.alt} width={p.width} height={p.height} sizes="(max-width: 900px) 100vw, 62vw" /></span>
      </a>
      <div className={h.workCopy}>
        <p className={h.kicker}>{p.category}</p>
        <h3>{p.name}</h3>
        <p className={h.workHeadline}>{p.headline}</p>
        <p className={h.workDesc}>{p.description}</p>
        <div className={h.tagRow}>{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
        <a className={h.pillDark} href={p.website} target="_blank" rel="noopener noreferrer">Visit {p.domain}<span className={h.pillIcon}><ArrowUpRight size={14} /></span></a>
      </div>
    </div>
  </div>;
}
