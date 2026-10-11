"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CallWatcher, type SetupChoices, type WatchStatus } from "../live/client";
import type { DemoInfo } from "../live/demo-info";
import { dealershipEmpty, formfieldEmpty, hotelsEmpty, insuranceEmpty, lawfirmEmpty, luneEmpty, northlineEmpty, realestateEmpty, tidewellEmpty, travelEmpty } from "../live/sample-views";
import type { DealershipView, DemoEvent, DemoId, DemoView, FormFieldView, HotelsView, InsuranceView, LawFirmView, NorthlineView, RealEstateView, TravelView } from "../live/types";
import { useDemoFeed, type Entry, type Feed } from "../live/use-demo-feed";
import { VoiceLevels } from "../live/voice-levels";
import { BrandLockup } from "../brand-marks";
import { ArrowUpRight, Check, Phone } from "../icons";
import { COMPANY_INSTAGRAM, COMPANY_LINKEDIN, COMPANY_TIKTOK, COMPANY_YOUTUBE } from "../site";
import { AppointmentOffice, DealershipOffice, FormFieldOffice, HotelsOffice, InsuranceOffice, LawFirmOffice, NorthlineOffice, RealEstateOffice, TravelOffice, type LiveState } from "./offices";
import { REPLAYS } from "./replay";
import { CookieSettings, track } from "../consent";
import { VoiceBars } from "./voice-bars";
import { AfterCall, SKINS, SetupCard, ToolBadge, ToolsLane, type Setup } from "./funnel";
import { luneSample, tidewellSample } from "../live/sample-views";
import type { AppointmentView, BookingSkin } from "../live/types";
import d from "./demo.module.css";

type Action = Extract<Entry, { kind: "action" }>;
const EMPTY: Record<DemoId, DemoView> = { northline: northlineEmpty, formfield: formfieldEmpty, travel: travelEmpty, lawfirm: lawfirmEmpty, hotels: hotelsEmpty, realestate: realestateEmpty, insurance: insuranceEmpty, lune: luneEmpty, tidewell: tidewellEmpty, dealership: dealershipEmpty };

/**
 * The live demo page. Every demo is reached by phone: a screen code is ready on arrival, and once the
 * caller types or says it this page follows the call. Left: the call and the conversation as it
 * happens. Middle: the business's back office changing as the agent works. Right: behind the call:
 * what the agent can do, the rules it follows, and every step it took with timings. `?replay` plays a
 * sample call through the same feed, clearly labelled, for reviewing the design without phoning in.
 */
export function DemoPage({ demo }: { demo: DemoInfo }) {
  const { feed, push, reset } = useDemoFeed();
  // The waveform's levels arrive many times a second: they go straight to the bars, not through React.
  const [voice] = useState(() => new VoiceLevels());
  const receive = useCallback((e: DemoEvent) => { if (!voice.take(e)) push(e); }, [voice, push]);

  const [replaying, setReplaying] = useState(false);
  // The setup flow (business, tools, report email, then the call) runs for every demo each time the page opens.
  const [funnel, setFunnel] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const replay = q.has("replay");
    setReplaying(replay);
    setFunnel(true);
    if (!replay) track("demo_viewed", { demo: demo.id });
  }, [demo.id]);
  // A sample replay is for reviewing the screen: it skips the setup card and plays straight away.
  const gated = funnel && !setup && !replaying;
  // After a call in the setup flow: the visitor chooses to go again or to look through the screen.
  const [exploring, setExploring] = useState(false);
  const [again, setAgain] = useState(false);
  // Which business Ellie answers for. Salon and clinic are front-end previews until the voice side is wired.
  const skin = demo.id === "northline" && funnel && setup ? (setup.trade as BookingSkin) : "home";
  const look = SKINS[skin];
  const shown: DemoInfo = skin === "home" ? demo : {
    ...demo, name: look.name, role: look.role, intro: look.intro, prompts: look.prompts, sampleDetails: look.sampleDetails, sampleCard: undefined,
    design: { ...demo.design, tools: demo.design.tools.map((t) => ({ ...t, label: t.label.replace("Fill in the service request", "Fill in the booking").replace(" a visit", " an appointment").replace("services and fees", "services and prices") })), rules: demo.design.rules.map((r) => r.replace("visit", "appointment")) },
  };
  // The finished call's numbers for the funnel, read when the call ends.
  const feedRef = useRef(feed);
  feedRef.current = feed;

  const [watch, setWatch] = useState<{ status: WatchStatus; code?: string }>({ status: "requesting" });
  // The last call's own page (/call/?r=…), offered once the call is over. Kept while a fresh code is fetched.
  const [report, setReport] = useState<string | null>(null);
  const watcher = useRef<CallWatcher | null>(null);
  // The visitor's setup goes with every pairing, so a fresh code after a call still carries it.
  const choices = useRef<SetupChoices | null>(null);
  const startWatcher = useCallback(() => {
    watcher.current?.stop();
    const w = new CallWatcher(demo.id, receive, (status, code, token) => {
      // A new call: clear the last call's results before its events arrive.
      if (status === "linked") { reset(); voice.clear(); setReport(token ?? null); track("demo_call_started", { agent: demo.agentName, demo: demo.id }); }
      setWatch((prev) => ({ status, code: code ?? prev.code }));
    });
    watcher.current = w;
    if (choices.current) w.sendSetup(choices.current);
    void w.start();
  }, [demo.id, demo.agentName, receive, reset, voice]);
  /** The setup card's answers, stored on the pairing so the call (and its page) know them. */
  const sendSetup = useCallback((s: Setup) => {
    choices.current = { trade: s.trade, tool: s.tool, email: s.email, record: s.record, updates: s.updates, pass: s.pass };
    watcher.current?.sendSetup(choices.current);
  }, []);
  /** "Call again" / "Get a new code": clear the last call's results, then ask for a fresh code. */
  function newCode() { reset(); voice.clear(); setWatch({ status: "requesting" }); startWatcher(); }

  useEffect(() => {
    // Started before the setup card closes: its last step shows the code the caller will enter.
    if (replaying) return;
    startWatcher();
    return () => watcher.current?.stop();
  }, [replaying, startWatcher]);

  // A code is always on offer: when one expires or the link drops, ask for a fresh one without being told to.
  useEffect(() => {
    if (replaying || !funnel) return;
    if (watch.status === "expired") { startWatcher(); return; }
    if (watch.status === "error") { const t = window.setTimeout(startWatcher, 3000); return () => window.clearTimeout(t); }
  }, [replaying, funnel, watch.status, startWatcher]);

  // When a call ends, go straight back to the normal screen with a fresh code. The finished call's
  // results stay on screen until the next call links.
  useEffect(() => {
    if (!replaying && watch.status === "ended") {
      const f = feedRef.current;
      track("demo_call_finished", {
        demo: demo.id,
        turns: f.entries.filter((e) => e.kind === "say").length,
        actions: f.entries.filter((e) => e.kind === "action" && e.status === "done").length,
      });
      voice.clear();
      startWatcher();
    }
  }, [replaying, watch.status, startWatcher, voice, demo.id]);

  // Sample replay: scripted events through the real feed.
  useEffect(() => {
    if (!replaying || gated) return;
    reset();
    const timers = REPLAYS[demo.id].map(({ at, event }) => window.setTimeout(() => push(event as DemoEvent), at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [replaying, gated, demo.id, push, reset]);

  useEffect(() => { if (!feed.ended) setExploring(false); }, [feed.ended]);

  const onCall = !feed.ended && (watch.status === "linked" || (replaying && feed.entries.length > 0));
  const view = feed.view ?? EMPTY[demo.id];
  const state: LiveState = feed.view ? (feed.ended ? "finished" : "live") : "sample";

  return <div className={d.page} data-gated={gated || undefined}>
    <header className={d.top}>
      <a href="/" className={d.dm} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} /><span>Digital Macaroni</span></a>
      <span className={d.slash} aria-hidden="true">/</span>
      <BrandLockup id={skin === "home" ? demo.id : look.brand} />
      <span className={d.topRole}>{shown.role} · live demo</span>
      <div className={d.topStatus} role="status">
        {replaying ? <span className={d.replayPill}>Sample replay · not a live call</span> : null}
        {onCall ? <CallBadge demo={demo} feed={feed} voice={voice} /> : null}
      </div>
      {funnel && setup && !onCall && !again ? <button type="button" className={d.tryAnother} onClick={() => { track("demo_try_another"); newCode(); setExploring(false); setAgain(true); }}><Phone size={14} />Try another call</button> : null}
      <a href="/#agents" className={d.back}>All demos<ArrowUpRight size={14} /></a>
    </header>

    <main id="content" className={d.layout}>
      <aside className={d.left}>
        {/* Once the call links, the card folds into the top-bar badge to give the conversation room. */}
        {onCall || funnel ? null : <CallCard demo={shown} feed={feed} voice={voice} onCall={onCall} watch={watch} replaying={replaying} onNewCode={newCode} />}

        {shown.sampleCard ? <section className={d.sample} aria-label={shown.sampleCard.title}>
          <h2>{shown.sampleCard.title}</h2>
          <dl>{shown.sampleCard.items.map((i) => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>
        </section> : null}

        <section className={d.convo} aria-label="Conversation" aria-live="polite">
          <div className={d.sectionHead}><h2>Conversation</h2>{feed.entries.length ? <span>{feed.entries.filter((e) => e.kind === "say").length} turns</span> : null}</div>
          {feed.entries.length ? <Conversation entries={feed.entries} agentName={demo.agentName} demoId={demo.id} />
            : <div className={d.prompts}>
              <p>{shown.intro}</p>
              <span>Try saying</span>
              <ul>{shown.prompts.map((p) => <li key={p}>“{p}”</li>)}</ul>
              <small>{shown.sampleDetails}</small>
            </div>}
        </section>
      </aside>

      <section className={d.center} aria-label={`${shown.name} back office`}>
        {skin !== "home" ? <AppointmentOffice view={(skin === "salon" ? luneSample : tidewellSample) as AppointmentView} state="sample" agentName={demo.agentName} />
          : demo.id === "lawfirm" ? <LawFirmOffice view={view as LawFirmView} state={state} agentName={demo.agentName} />
          : demo.id === "northline" ? <NorthlineOffice view={view as NorthlineView} state={state} agentName={demo.agentName} />
          : demo.id === "travel" ? <TravelOffice view={view as TravelView} state={state} agentName={demo.agentName} />
          : demo.id === "hotels" ? <HotelsOffice view={view as HotelsView} state={state} agentName={demo.agentName} />
          : demo.id === "lune" || demo.id === "tidewell" ? <AppointmentOffice view={view as AppointmentView} state={state} agentName={demo.agentName} />
          : demo.id === "dealership" ? <DealershipOffice view={view as DealershipView} state={state} agentName={demo.agentName} />
          : demo.id === "realestate" ? <RealEstateOffice view={view as RealEstateView} state={state} agentName={demo.agentName} />
          : demo.id === "insurance" ? <InsuranceOffice view={view as InsuranceView} state={state} agentName={demo.agentName} />
          : <FormFieldOffice view={view as FormFieldView} state={state} agentName={demo.agentName} />}
      </section>

      <BehindTheCall demo={shown} feed={feed} setup={funnel ? setup : null} />
    </main>

    {gated ? <SetupCard demo={demo} watch={watch} onNewCode={newCode} onSaved={sendSetup} onDone={(s) => { sendSetup(s); setSetup(s); }} /> : null}
    {funnel && setup && again ? <SetupCard demo={demo} watch={watch} onNewCode={newCode} onDone={() => setAgain(false)} onClose={() => setAgain(false)} again={setup} /> : null}
    {funnel && setup && feed.ended && !exploring && !again ? <AfterCall report={report} onExplore={() => setExploring(true)} onAgain={() => { newCode(); setExploring(false); setAgain(true); }}>
      <Summary demo={shown} feed={feed} done={feed.entries.filter((e): e is Action => e.kind === "action" && (e.status === "done" || isTestStop(e)))} />
    </AfterCall> : null}

    <footer className={d.foot}>
      <span>{shown.name} is a fictional business. Nothing is really booked, sold or charged.</span>
      <a href="/privacy/">Privacy</a><a href="/demo-terms/">Demo terms</a><CookieSettings />
    </footer>
  </div>;
}

/* ---------------- Call badge (top bar, once the call is linked) ---------------- */

const BADGE_WAVE = [6, 11, 8, 14, 9, 16, 10, 7, 12, 15, 9, 6];

/** Shown only while a call is live; when it ends the page returns to the call card. */
function CallBadge({ demo, feed, voice }: { demo: DemoInfo; feed: Feed; voice: VoiceLevels }) {
  const startedAt = feed.log.find((i): i is Extract<typeof i, { kind: "event" }> => i.kind === "event")?.at ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return <div className={d.callBadge} data-speaking={feed.speaking || undefined}>
    <span className={d.badgeOrb} data-speaking={feed.speaking || undefined} aria-hidden="true" />
    <span className={d.badgeText}><b>On a call with {demo.agentName}</b><small><i />{feed.speaking ? `${demo.agentName} is speaking` : "Listening"}</small></span>
    <VoiceBars className={d.badgeWave} voice={voice} speaking={feed.speaking} shape={BADGE_WAVE} />
    <span className={d.badgeTimer}>{timer}</span>
  </div>;
}

/* ---------------- Call card ---------------- */

const WAVE = [8, 14, 10, 20, 15, 26, 18, 11, 17, 24, 30, 19, 13, 22, 27, 16, 21, 12, 9, 15, 11, 18, 13];

function CallCard({ demo, feed, voice, onCall, watch, replaying, onNewCode }: { demo: DemoInfo; feed: Feed; voice: VoiceLevels; onCall: boolean; watch: { status: WatchStatus; code?: string }; replaying: boolean; onNewCode: () => void }) {
  // After a call, the card is back to normal with a fresh code; the last call's results stay below.
  const lastCall = feed.ended ? <>
    <p className={d.callNote}><b>Call finished.</b> Your results stay on screen. Call again with a new code.</p>
    <FollowCard demo={demo} />
  </> : null;
  // On a phone, the dial link carries the code: the dialer waits (",,") then sends it as keypad tones.
  const dial = watch.status === "waiting" && watch.code ? `tel:${demo.phone},,${watch.code}` : `tel:${demo.phone}`;

  let body;
  if (onCall) {
    body = <>
      <VoiceBars className={d.wave} voice={voice} speaking={feed.speaking} shape={WAVE} />
      <p className={d.callNote}><b>You’re on screen.</b> Keep talking: everything {demo.agentName} does shows up here.</p>
    </>;
  } else if (replaying && feed.ended) {
    body = <p className={d.callNote}><b>Call finished.</b> This was a sample replay.</p>;
  } else if (watch.status === "waiting" && watch.code) {
    body = <>{lastCall}<div className={d.code}>
      <span>Your screen code</span>
      <div aria-label={`code ${watch.code.split("").join(" ")}`}>{watch.code.split("").map((c, i) => <b key={i}>{c}</b>)}</div>
      <small>{demo.agentName} asks for it when you call. Type it or say it, and this page follows your call.</small>
    </div></>;
  } else if (watch.status === "expired") {
    body = <p className={d.callNote}>That code expired. <button className={d.link} onClick={onNewCode}>Get a new code</button></p>;
  } else if (watch.status === "error") {
    body = <p className={d.callNote}>The screen link isn’t available right now, but the call still works. <button className={d.link} onClick={onNewCode}>Try again</button></p>;
  } else {
    body = <div className={d.code} data-loading><span>Your screen code</span><div>{[0, 1, 2, 3].map((i) => <b key={i} />)}</div><small>Preparing your code…</small></div>;
  }

  return <section className={d.call} data-on-call={onCall || undefined}>
    <div className={d.callTop}>
      <span className={d.orb} data-speaking={(onCall && feed.speaking) || undefined} aria-hidden="true" />
      <div><small>{onCall ? "On a call with" : feed.ended ? "You spoke with" : `Call ${demo.name}’s assistant`}</small><b>{demo.agentName}</b></div>
      {onCall ? <span className={d.callLive}><i />Live</span> : null}
    </div>
    {!onCall ? <a className={d.number} href={dial}><Phone size={20} />{demo.phoneDisplay}</a> : null}
    {body}
  </section>;
}

/** After a call: where to see how the agents are built, while the visitor is most curious. */
function FollowCard({ demo }: { demo: DemoInfo }) {
  const links = [
    { label: "YouTube", href: `${COMPANY_YOUTUBE}?sub_confirmation=1` },
    { label: "TikTok", href: COMPANY_TIKTOK },
    { label: "Instagram", href: COMPANY_INSTAGRAM },
    { label: "LinkedIn", href: COMPANY_LINKEDIN },
  ];
  return <div className={d.follow}>
    <p><b>See how {demo.agentName} was built.</b> We break down our agents, and how voice AI works, on YouTube.</p>
    <div>{links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noopener" onClick={() => track("demo_social_click", { demo: demo.id, target: l.label.toLowerCase() })}>{l.label}<ArrowUpRight size={12} /></a>)}</div>
  </div>;
}

/* ---------------- Conversation ---------------- */

/** Keeps the newest line in view, like a messaging app, unless the visitor has scrolled up. */
function useStickToBottom<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => { pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

/** Booking demos stop on purpose at payment: that is the end of the flow, not an error. */
const isTestStop = (a: Action) => a.status === "failed" && /test mode/i.test(a.summary ?? "");

/** A failure's first sentence only: the rest is guidance for the agent. */
const outcome = (a: Action) => (a.status === "failed" ? (a.summary ?? a.label).split(/(?<=[.!?])\s/)[0] : a.summary ?? a.label);

function Conversation({ entries, agentName, demoId }: { entries: Entry[]; agentName: string; demoId: DemoId }) {
  const list = useStickToBottom<HTMLDivElement>(entries);
  return <div className={d.turns} ref={list}>
    {entries.map((e) => e.kind === "say"
      ? <div key={e.id} className={d.turn} data-speaker={e.speaker} data-final={e.final}>
        {e.speaker === "agent" ? <span className={d.orbMini} data-demo={demoId} aria-hidden="true" /> : null}
        <div><span>{e.speaker === "agent" ? agentName : "You"}</span><p>{e.text}</p></div>
      </div>
      : <div key={e.id} className={d.step} data-status={isTestStop(e) ? "stopped" : e.status}>
        <i aria-hidden="true">{e.status === "running" ? null : e.status === "done" || isTestStop(e) ? <Check size={11} /> : "!"}</i>
        <span>{e.status === "running" ? `${e.label}…` : outcome(e)}</span>
      </div>)}
  </div>;
}

/* ---------------- Behind the call ---------------- */

const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
const took = (ms: number) => (ms < 1000 ? `${Math.max(1, ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

function BehindTheCall({ demo, feed, setup }: { demo: DemoInfo; feed: Feed; setup: Setup | null }) {
  const actions = feed.entries.filter((e): e is Action => e.kind === "action");
  const done = actions.filter((a) => a.status === "done" || isTestStop(a));
  const uses = (tool: string) =>
    tool === "link_screen" ? Number(feed.log.some((i) => i.kind === "event" && i.text.includes("linked")))
    : tool === "end_call" ? Number(feed.ended === "agent_ended")
    : done.filter((a) => a.tool === tool).length;
  const running = new Set(actions.filter((a) => a.status === "running").map((a) => a.tool));
  const byId = new Map(actions.map((a) => [a.id, a]));
  const label = new Map(demo.design.tools.map((t) => [t.name, t.label]));
  const activity = useStickToBottom<HTMLOListElement>(feed.log.length + feed.entries.length);
  const usedCount = demo.design.tools.filter((t) => uses(t.name) > 0).length;

  return <aside className={d.right} aria-label="Behind the call">
    <div className={d.sectionHead}><h2>Behind the call</h2>{setup ? <ToolBadge setup={setup} /> : null}</div>

    {setup ? <ToolsLane demo={demo} feed={feed} setup={setup} /> : null}

    {feed.ended && !setup ? <Summary demo={demo} feed={feed} done={done} /> : null}

    <section className={d.block}>
      <h3>What {demo.agentName} can do<span>{usedCount ? `${usedCount} used` : `${demo.design.tools.length} tools`}</span></h3>
      <ul className={d.tools}>{demo.design.tools.map((t) => {
        const n = uses(t.name);
        return <li key={t.name} data-used={n > 0 || undefined} data-running={running.has(t.name) || undefined}>
          <i aria-hidden="true">{running.has(t.name) ? null : n > 0 ? <Check size={11} /> : null}</i>
          <span>{t.label}<code>{t.name}</code></span>
          {n > 1 ? <b>×{n}</b> : null}
        </li>;
      })}</ul>
    </section>

    <section className={d.block}>
      <h3>Rules {demo.agentName} follows</h3>
      <ul className={d.rules}>{demo.design.rules.map((r) => <li key={r}><Check size={13} />{r}</li>)}</ul>
    </section>

    <section className={`${d.block} ${d.activity}`}>
      <h3>What just happened</h3>
      {feed.log.length ? <ol ref={activity}>
        {feed.log.map((item) => {
          if (item.kind === "event") return <li key={item.id} data-kind="event"><time>{clock(item.at)}</time><span>{item.text}</span></li>;
          const a = byId.get(item.id);
          if (!a) return null;
          return <li key={item.id} data-kind="action" data-status={isTestStop(a) ? "done" : a.status}>
            <time>{clock(a.at)}</time>
            <span>{label.get(a.tool) ?? a.label}{a.status === "running" ? <em> …</em> : <> → {outcome(a)}</>}<code>{a.tool}</code></span>
            {a.doneAt ? <small>{took(a.doneAt - a.at)}</small> : null}
          </li>;
        })}
      </ol> : <p className={d.emptyLog}>Each step {demo.agentName} takes appears here as it happens, with how long it took.</p>}
    </section>
  </aside>;
}

/** Summary lines for demos whose design doesn't list its own. */
const OUTCOMES: Partial<Record<DemoId, NonNullable<DemoInfo["design"]["outcomes"]>>> = {
  travel: [
    { tools: ["search_flights"], one: "Searched live airline fares", many: "Searched live fares {n} times" },
    { tools: ["choose_flight", "choose_fare"], one: "Priced the fare and its levels", many: "Priced {n} fares" },
    { tools: ["choose_seat"], one: "Picked a seat on the seat map", many: "Changed the seat {n} times" },
    { tools: ["add_bags"], one: "Added checked bags", many: "Updated the bags {n} times" },
    { tools: ["review_booking"], one: "Re-checked the price and read it back", many: "Read the booking back {n} times" },
    { tools: ["book_flight"], one: "Took the booking up to payment", many: "Took {n} bookings up to payment" },
    { tools: ["email_itinerary"], one: "Emailed the caller a copy", many: "Emailed the caller {n} times" },
    { tools: ["take_message"], one: "Took a message for an agent", many: "Took {n} messages for an agent" },
  ],
};

/** What the agent handled on this call, in an owner's terms. */
function Summary({ demo, feed, done }: { demo: DemoInfo; feed: Feed; done: Action[] }) {
  const events = feed.log.filter((i): i is Extract<typeof i, { kind: "event" }> => i.kind === "event");
  const start = events.find((e) => e.text.includes("connected") || e.text.includes("started"))?.at;
  const end = events.at(-1)?.at;
  const seconds = start && end ? Math.max(1, Math.round((end - start) / 1000)) : null;
  const lines = (demo.design.outcomes ?? OUTCOMES[demo.id] ?? [])
    .map((o) => ({ o, n: done.filter((a) => o.tools.includes(a.tool)).length }))
    .filter((x) => x.n > 0)
    .map(({ o, n }) => (n === 1 ? o.one : o.many.replace("{n}", String(n))));
  const handoffs = done.filter((a) => (demo.design.handoffTools ?? []).includes(a.tool)).length;
  return <section className={d.summary} aria-label="Call summary">
    <h3>{demo.agentName} handled this call</h3>
    <ul>{(lines.length ? lines : ["Answered questions"]).map((l) => <li key={l}><Check size={13} />{l}</li>)}</ul>
    <div className={d.summaryStats}>
      {seconds ? <div><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</b><span>on the line</span></div> : null}
      <div><b>{handoffs || "0"}</b><span>{handoffs ? "passed to the team" : "staff needed"}</span></div>
    </div>
  </section>;
}
