"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { CallWatcher, type WatchStatus } from "../live/client";
import type { DemoInfo } from "../live/demo-info";
import { formfieldEmpty, northlineEmpty, travelEmpty } from "../live/sample-views";
import type { DemoEvent, DemoId, DemoView, FormFieldView, NorthlineView, TravelView } from "../live/types";
import { useDemoFeed, type Entry, type Feed } from "../live/use-demo-feed";
import { VoiceLevels } from "../live/voice-levels";
import { BrandLockup } from "../brand-marks";
import { Location } from "../location";
import { ArrowUpRight, Check, Phone } from "../icons";
import { FormFieldOffice, NorthlineOffice, TravelOffice, type LiveState } from "./offices";
import { REPLAYS } from "./replay";
import { VoiceBars } from "./voice-bars";
import d from "./demo.module.css";

type Action = Extract<Entry, { kind: "action" }>;
const EMPTY: Record<DemoId, DemoView> = { northline: northlineEmpty, formfield: formfieldEmpty, travel: travelEmpty };

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
  useEffect(() => { setReplaying(new URLSearchParams(window.location.search).has("replay")); }, []);

  const [watch, setWatch] = useState<{ status: WatchStatus; code?: string }>({ status: "requesting" });
  const watcher = useRef<CallWatcher | null>(null);
  const startWatcher = useCallback(() => {
    watcher.current?.stop();
    const w = new CallWatcher(demo.id, receive, (status, code) => {
      // A new call: clear the last call's results before its events arrive.
      if (status === "linked") { reset(); voice.clear(); }
      setWatch((prev) => ({ status, code: code ?? prev.code }));
    });
    watcher.current = w;
    void w.start();
  }, [demo.id, receive, reset, voice]);
  /** "Call again" / "Get a new code": clear the last call's results, then ask for a fresh code. */
  function newCode() { reset(); voice.clear(); setWatch({ status: "requesting" }); startWatcher(); }

  useEffect(() => {
    if (replaying) return;
    startWatcher();
    return () => watcher.current?.stop();
  }, [replaying, startWatcher]);

  // When a call ends, go straight back to the normal screen with a fresh code. The finished call's
  // results stay on screen until the next call links.
  useEffect(() => {
    if (!replaying && watch.status === "ended") { voice.clear(); startWatcher(); }
  }, [replaying, watch.status, startWatcher, voice]);

  // Sample replay: scripted events through the real feed.
  useEffect(() => {
    if (!replaying) return;
    reset();
    const timers = REPLAYS[demo.id].map(({ at, event }) => window.setTimeout(() => push(event as DemoEvent), at));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [replaying, demo.id, push, reset]);

  const onCall = !feed.ended && (watch.status === "linked" || (replaying && feed.entries.length > 0));
  const view = feed.view ?? EMPTY[demo.id];
  const state: LiveState = feed.view ? (feed.ended ? "finished" : "live") : "sample";

  return <div className={d.page}>
    <header className={d.top}>
      <a href="/" className={d.dm} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} /><span>Digital Macaroni</span></a>
      <span className={d.slash} aria-hidden="true">/</span>
      <BrandLockup id={demo.id} />
      <span className={d.topRole}>{demo.role} · live demo</span>
      <div className={d.topStatus} role="status">
        {replaying ? <span className={d.replayPill}>Sample replay · not a live call</span> : null}
        {onCall ? <CallBadge demo={demo} feed={feed} voice={voice} /> : null}
      </div>
      <a href="/#agents" className={d.back}>All demos<ArrowUpRight size={14} /></a>
    </header>

    <main id="content" className={d.layout}>
      <aside className={d.left}>
        {/* Once the call links, the card folds into the top-bar badge to give the conversation room. */}
        {onCall ? null : <CallCard demo={demo} feed={feed} voice={voice} onCall={onCall} watch={watch} replaying={replaying} onNewCode={newCode} />}

        {demo.sampleCard ? <section className={d.sample} aria-label={demo.sampleCard.title}>
          <h2>{demo.sampleCard.title}</h2>
          <dl>{demo.sampleCard.items.map((i) => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>
        </section> : null}

        <section className={d.convo} aria-label="Conversation" aria-live="polite">
          <div className={d.sectionHead}><h2>Conversation</h2>{feed.entries.length ? <span>{feed.entries.filter((e) => e.kind === "say").length} turns</span> : null}</div>
          {feed.entries.length ? <Conversation entries={feed.entries} agentName={demo.agentName} demoId={demo.id} />
            : <div className={d.prompts}>
              <p>{demo.intro}</p>
              <span>Try saying</span>
              <ul>{demo.prompts.map((p) => <li key={p}>“{p}”</li>)}</ul>
              <small>{demo.sampleDetails}</small>
            </div>}
        </section>
      </aside>

      <section className={d.center} aria-label={`${demo.name} back office`}>
        {demo.id === "northline" ? <NorthlineOffice view={view as NorthlineView} state={state} agentName={demo.agentName} />
          : demo.id === "travel" ? <TravelOffice view={view as TravelView} state={state} agentName={demo.agentName} />
          : <FormFieldOffice view={view as FormFieldView} state={state} agentName={demo.agentName} />}
      </section>

      <BehindTheCall demo={demo} feed={feed} />
    </main>

    <footer className={d.foot}>
      <span>{demo.name} is a fictional business. Nothing is really booked, sold or charged.</span>
      <a href="/privacy/">Privacy</a><a href="/demo-terms/">Demo terms</a>
      <Location />
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
  const lastCall = feed.ended ? <p className={d.callNote}><b>Call finished.</b> Your results stay on screen. Call again with a new code.</p> : null;
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

function BehindTheCall({ demo, feed }: { demo: DemoInfo; feed: Feed }) {
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
    <div className={d.sectionHead}><h2>Behind the call</h2></div>

    {feed.ended ? <Summary demo={demo} feed={feed} done={done} /> : null}

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
    { tools: ["email_itinerary"], one: "Emailed the itinerary", many: "Emailed the itinerary" },
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
