"use client";

import { useEffect, useState } from "react";
import type { Feed, Entry } from "../live/use-demo-feed";
import type { DemoInfo } from "../live/demo-info";
import { ArrowRight, Check, Code, Lock } from "../icons";
import { track } from "../consent";
import f from "./funnel.module.css";

/**
 * Before a demo call: which kind of business the visitor runs, what runs it today, and where to send
 * their call report. While the call runs, the right column shows what each of the agent's actions
 * would write into the tool they picked (or into a custom back office). The operations are the real
 * ones from each vendor's developer docs (Docs/studio-preview/INTEGRATION_MAP.md in the Macaroni repo).
 */

type Trade = { id: string; label: string; example: string; ready: boolean };
type Op = { what: string; op: string };
type Tool = { id: string; name: string; note?: string; ops: Partial<Record<string, Op[]>>; confirmation: string };

const KEY = "dm-demo-setup";

export type Setup = { trade: string; tool: string; email: string; record: boolean; updates: boolean };

/** Ellie's trades. Only heating and cooling is wired up today; the rest are on the way. */
const TRADES: Trade[] = [
  { id: "hvac", label: "Heating & cooling", example: "Furnace, AC, heat pumps", ready: true },
  { id: "plumbing", label: "Plumbing", example: "Leaks, drains, water heaters", ready: false },
  { id: "electrical", label: "Electrical", example: "Panels, outlets, EV chargers", ready: false },
  { id: "roofing", label: "Roofing", example: "Leaks, storm damage, inspections", ready: false },
  { id: "pest", label: "Pest control", example: "One-off and quarterly plans", ready: false },
];

const CUSTOM = "custom";

/** What each of Ellie's tools writes in each system, from the vendors' API references. */
const TOOLS: Tool[] = [
  {
    id: "housecallpro",
    name: "Housecall Pro",
    confirmation: "Housecall Pro texts the customer its own booking confirmation",
    ops: {
      get_caller_number: [{ what: "Find the customer by phone", op: "GET /customers?q=" }],
      check_availability: [{ what: "Check open arrival windows", op: "GET /company/schedule_availability/booking_windows" }],
      book_appointment: [
        { what: "Create the customer and service address", op: "POST /customers" },
        { what: "Create the job with the time window and technician", op: "POST /jobs" },
        { what: "Attach the call summary", op: "POST /jobs/{id}/notes" },
        { what: "Send the confirmation", op: "PUT /jobs/{id}/schedule · notify: true" },
      ],
      reschedule_appointment: [{ what: "Move the visit and notify the customer", op: "PUT /jobs/{id}/schedule" }],
      take_message: [{ what: "Log a lead for a callback", op: "POST /leads" }],
    },
  },
  {
    id: "jobber",
    name: "Jobber",
    confirmation: "Jobber's visit reminders go to the customer",
    ops: {
      get_caller_number: [{ what: "Find the client", op: "query clients(searchTerm)" }],
      check_availability: [{ what: "Read the team's scheduled visits", op: "query visits" }],
      book_appointment: [
        { what: "Create the client and property", op: "mutation clientCreate" },
        { what: "Create the job", op: "mutation jobCreate" },
        { what: "Schedule the visit and assign the tech", op: "mutation visitCreate" },
        { what: "Attach the call summary", op: "mutation jobCreateNote" },
      ],
      take_message: [{ what: "Log a request for a callback", op: "mutation requestCreate" }],
    },
  },
  {
    id: "servicetitan",
    name: "ServiceTitan",
    confirmation: "ServiceTitan's appointment notifications go to the customer",
    ops: {
      get_caller_number: [{ what: "Find the customer by phone", op: "GET /crm/v2/…/customers?phone=" }],
      check_availability: [{ what: "Check technician capacity", op: "POST /dispatch/v2/…/capacity" }],
      book_appointment: [
        { what: "Create the customer and location", op: "POST /crm/v2/…/customers" },
        { what: "Book the job with an arrival window", op: "POST /jpm/v2/…/jobs" },
        { what: "Assign the technician", op: "POST /dispatch/v2/…/assign-technicians" },
        { what: "Attach the call summary", op: "POST /jpm/v2/…/jobs/{id}/notes" },
      ],
      take_message: [{ what: "Log a lead for a callback", op: "POST /crm/v2/…/leads" }],
    },
  },
  {
    id: "workiz",
    name: "Workiz",
    confirmation: "Workiz automations send the confirmation",
    ops: {
      get_caller_number: [{ what: "Find the client", op: "GET /v2/clients?searchQuery=" }],
      check_availability: [{ what: "Check open slots", op: "GET /v2/availability" }],
      book_appointment: [
        { what: "Create the job (and client) with the time", op: "POST /v2/jobs" },
        { what: "Assign the technician", op: "POST /v2/jobs/{id}/team" },
      ],
      take_message: [{ what: "Log a lead for a callback", op: "POST /v2/leads" }],
    },
  },
];

const OTHER = "other";

export function readSetup(): Setup | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Setup) : null;
  } catch {
    return null;
  }
}

/* ---------------- Setup card ---------------- */

export function SetupCard({ demo, onDone }: { demo: DemoInfo; onDone: (s: Setup) => void }) {
  const [step, setStep] = useState(0);
  const [trade, setTrade] = useState("hvac");
  const [tool, setTool] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [record, setRecord] = useState(true);
  const [updates, setUpdates] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  useEffect(() => { track("demo_setup_viewed", { demo: demo.id }); }, [demo.id]);

  function finish() {
    const s: Setup = { trade, tool: tool ?? CUSTOM, email: email.trim(), record, updates };
    try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    track("demo_setup_done", { demo: demo.id, trade, tool: s.tool, record: record ? 1 : 0, updates: updates ? 1 : 0 });
    onDone(s);
  }

  return <div className={f.scrim} role="dialog" aria-modal="true" aria-labelledby="setup-title">
    <div className={f.card}>
      <ol className={f.progress} aria-label="Steps">
        {["Your business", "Your tools", "Your report"].map((s, i) => <li key={s} data-state={i < step ? "done" : i === step ? "now" : "next"}><i>{i < step ? <Check size={11} /> : i + 1}</i>{s}</li>)}
      </ol>

      {step === 0 ? <>
        <h2 id="setup-title">What kind of business should {demo.agentName} answer for?</h2>
        <p className={f.lede}>She’ll take the call the way she would for you: your services, your schedule, your rules.</p>
        <div className={f.trades}>
          {TRADES.map((t) => <button key={t.id} type="button" className={f.trade} data-selected={trade === t.id || undefined} disabled={!t.ready} onClick={() => setTrade(t.id)}>
            <b>{t.label}</b><span>{t.example}</span>{t.ready ? null : <em>Soon</em>}
          </button>)}
        </div>
        <div className={f.actions}><button type="button" className={f.primary} onClick={() => { track("demo_setup_trade", { demo: demo.id, trade }); setStep(1); }}>Continue<ArrowRight size={14} /></button></div>
      </> : null}

      {step === 1 ? <>
        <h2 id="setup-title">What runs your business today?</h2>
        <p className={f.lede}>As {demo.agentName} works, you’ll see exactly what she would write into it.</p>
        <button type="button" className={f.custom} data-selected={tool === CUSTOM || undefined} onClick={() => setTool(CUSTOM)}>
          <span className={f.customIcon}><Code size={18} /></span>
          <span><b>Something custom, or nothing yet</b><small>We build the agent and your own back office around how you work.</small></span>
        </button>
        <div className={f.tools}>
          {TOOLS.map((t) => <button key={t.id} type="button" className={f.tool} data-selected={tool === t.id || undefined} onClick={() => setTool(t.id)}>{t.name}</button>)}
          <button type="button" className={f.tool} data-selected={tool === OTHER || undefined} onClick={() => setTool(OTHER)}>Something else</button>
        </div>
        <div className={f.actions}>
          <button type="button" className={f.back} onClick={() => setStep(0)}>Back</button>
          <button type="button" className={f.primary} disabled={!tool} onClick={() => { track("demo_setup_tool", { demo: demo.id, tool: tool ?? "" }); setStep(2); }}>Continue<ArrowRight size={14} /></button>
        </div>
      </> : null}

      {step === 2 ? <>
        <h2 id="setup-title">Where should we send your call report?</h2>
        <p className={f.lede}>After the call you’ll get what {demo.agentName} did, minute by minute{tool && tool !== CUSTOM && tool !== OTHER ? `, and what it would have written in ${TOOLS.find((t) => t.id === tool)?.name}` : ""}.</p>
        <label className={f.field}><span>Work email</span><input type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className={f.check}><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} /><span>Record the call so I can listen back in my report</span></label>
        <label className={f.check}><input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} /><span>Send me occasional updates from Digital Macaroni</span></label>
        <p className={f.fine}><Lock size={12} /><span>Kept 30 days, then deleted. See our <a href="/privacy/">privacy policy</a>.</span></p>
        <div className={f.actions}>
          <button type="button" className={f.back} onClick={() => setStep(1)}>Back</button>
          <button type="button" className={f.primary} disabled={!emailOk} onClick={finish}>Start the demo<ArrowRight size={14} /></button>
        </div>
      </> : null}
    </div>
  </div>;
}

/* ---------------- Live: what lands in their tools ---------------- */

type Action = Extract<Entry, { kind: "action" }>;

export function ToolsLane({ demo, feed, setup }: { demo: DemoInfo; feed: Feed; setup: Setup }) {
  const tool = TOOLS.find((t) => t.id === setup.tool);
  const done = feed.entries.filter((e): e is Action => e.kind === "action" && e.status === "done");
  const custom = !tool;
  const rows = custom
    ? done.filter((a) => a.tool !== "link_screen" && a.tool !== "end_call").map((a) => ({ key: a.id, what: a.summary ?? a.label, op: a.tool }))
    : done.flatMap((a) => (tool.ops[a.tool] ?? []).map((o, i) => ({ key: `${a.id}-${i}`, what: o.what, op: o.op })));
  const booked = done.some((a) => a.tool === "book_appointment");

  return <section className={f.lane} aria-label={custom ? "Your back office" : `Sent to ${tool.name}`}>
    <header>
      <span className={f.laneIcon}>{custom ? <Code size={15} /> : tool.name.slice(0, 1)}</span>
      <div><h3>{custom ? "Your back office" : `Sent to ${tool.name}`}</h3><small>{custom ? `What ${demo.agentName} wrote into the system we’d build for you` : `In a live install, this is what ${demo.agentName} writes to your ${tool.name}`}</small></div>
    </header>
    {rows.length ? <ol>
      {rows.map((r) => <li key={r.key}><i><Check size={11} /></i><span>{r.what}<code>{r.op}</code></span></li>)}
      {!custom && booked ? <li data-kind="native"><i><Check size={11} /></i><span>{tool.confirmation}</span></li> : null}
    </ol> : <p className={f.laneEmpty}>{custom ? `Each record ${demo.agentName} creates appears here.` : `Each call ${demo.agentName} would make to ${tool.name} appears here as she works.`}</p>}
  </section>;
}
