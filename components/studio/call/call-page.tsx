"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VOICE_URL } from "../live/client";
import { voiceDemos } from "../live/demo-info";
import type { AppointmentView, DealershipView, DentalView, FormFieldView, HotelsView, InsuranceView, LawFirmView, NorthlineView, RealEstateView, TravelView } from "../live/types";
import { BrandLockup } from "../brand-marks";
import { ArrowRight, ArrowUpRight, Check, Clock } from "../icons";
import { CookieSettings, track } from "../consent";
import { AppointmentOffice, DealershipOffice, DentalOffice, FormFieldOffice, HotelsOffice, InsuranceOffice, LawFirmOffice, NorthlineOffice, RealEstateOffice, TravelOffice } from "../demo/offices";
import { BOOKING_TOOLS, ToolMark, findTool, opsFor } from "../demo/funnel";
import { businessOf, isTestStop, mmss, outcomes, spoken, stepOutcome, took, type CallReport, type Line, type ReportEntry, type Step } from "./report";
import d from "../demo/demo.module.css";
import c from "./call.module.css";

/**
 * One call's own page, linked from the after-call pop-up and the call's email: what happened, the
 * back office as the call left it, the recording with its transcript in step, every step the agent
 * took and what it would have written into the visitor's own tool. The token in ?r= is the key.
 */

type Load =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; report: CallReport };

const LIVE_POLL_MS = 5000;
const RECORDING_POLL_MS = 10_000;
const RECORDING_POLLS = 30;

async function fetchReport(token: string): Promise<CallReport | null> {
  const r = await fetch(`${VOICE_URL}/reports/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as CallReport;
}

export function CallPage() {
  const token = useSearchParams().get("r")?.trim() ?? "";
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const recordingPolls = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return setLoad({ state: "missing" });
    try {
      const report = await fetchReport(token);
      setLoad(report ? { state: "ready", report } : { state: "missing" });
    } catch {
      setLoad((prev) => (prev.state === "ready" ? prev : { state: "error" }));
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh, attempt]);
  useEffect(() => { if (token) track("call_page_viewed"); }, [token]);

  // A call still going: check every few seconds. A finished call whose recording is on its way: every ten, for about five minutes.
  const report = load.state === "ready" ? load.report : null;
  const live = report?.status === "live";
  const pending = report?.status === "complete" && report.recordingPending && !report.recording;
  useEffect(() => {
    if (live) { const t = window.setTimeout(refresh, LIVE_POLL_MS); return () => window.clearTimeout(t); }
    if (pending && recordingPolls.current < RECORDING_POLLS) {
      const t = window.setTimeout(() => { recordingPolls.current += 1; void refresh(); }, RECORDING_POLL_MS);
      return () => window.clearTimeout(t);
    }
  }, [live, pending, report, refresh]);

  if (load.state === "loading") return <Frame><Skeleton /></Frame>;
  if (load.state === "missing") return <Frame><Missing /></Frame>;
  if (load.state === "error") return <Frame><Trouble onRetry={() => { setLoad({ state: "loading" }); setAttempt((n) => n + 1); }} /></Frame>;
  return <Report report={load.report} gaveUp={pending ? recordingPolls.current >= RECORDING_POLLS : false} />;
}

/* ---------------- Page frame ---------------- */

/** Shown in the exported HTML until the browser reads the link's token. */
export function CallPageFallback() {
  return <Frame><Skeleton /></Frame>;
}

function Frame({ business, children, footInside }: { business?: ReturnType<typeof businessOf>; children: React.ReactNode; footInside?: boolean }) {
  return <div className={`${d.page} ${c.root}`}>
    <header className={d.top}>
      <a href="/" className={d.dm} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} /><span>Digital Macaroni</span></a>
      {business ? <><span className={d.slash} aria-hidden="true">/</span><BrandLockup id={business.brand} /></> : null}
      <a href="/#agents" className={`${d.back} ${c.topBack}`}>All demos<ArrowUpRight size={14} /></a>
    </header>
    <main id="content" className={c.main}>{children}</main>
    {footInside ? null : <Foot business={business} />}
  </div>;
}

function Foot({ business }: { business?: ReturnType<typeof businessOf> }) {
  return <footer className={c.foot}>
    {business ? <span>{business.name} is a fictional business. Nothing was really booked, sold or charged.</span> : null}
    <span>Anyone with this page’s link can open it. It’s deleted after 30 days.</span>
    <nav><a href="/privacy/">Privacy</a><a href="/demo-terms/">Demo terms</a><CookieSettings /></nav>
  </footer>;
}

function Skeleton() {
  return <div className={c.skeleton} aria-busy="true" aria-label="Loading your call">
    <div className={c.sheet}><i style={{ width: "38%" }} /><i style={{ width: "72%", height: 30 }} /><i style={{ width: "54%" }} /></div>
    <div className={c.skelGrid}>
      <div className={c.sheet}><i style={{ width: "30%" }} /><i style={{ width: "80%" }} /><i style={{ width: "100%", height: 220 }} /></div>
      <div className={c.sheet}><i style={{ width: "40%" }} /><i style={{ width: "100%", height: 44 }} /><i style={{ width: "90%" }} /><i style={{ width: "70%" }} /><i style={{ width: "84%" }} /></div>
    </div>
  </div>;
}

function Missing() {
  return <section className={`${c.sheet} ${c.notice}`}>
    <h1>We can’t find this call</h1>
    <p>Call pages are kept for 30 days, so this one may have expired. If you opened it from an email, check the whole link came through.</p>
    <div className={c.noticeActions}>
      <a className={c.primary} href="/#agents">Try a demo<ArrowRight size={14} /></a>
      <a className={c.ghost} href="/contact/">Book a chat with us</a>
    </div>
  </section>;
}

function Trouble({ onRetry }: { onRetry: () => void }) {
  return <section className={`${c.sheet} ${c.notice}`}>
    <h1>This call didn’t load</h1>
    <p>We couldn’t reach the call service just now. Check your connection and try again.</p>
    <div className={c.noticeActions}><button type="button" className={c.primary} onClick={onRetry}>Try again<ArrowRight size={14} /></button></div>
  </section>;
}

/* ---------------- The report ---------------- */

function Report({ report, gaveUp }: { report: CallReport; gaveUp: boolean }) {
  const business = businessOf(report);
  const { agent } = business;
  const steps = report.entries.filter((e): e is Step => e.kind === "step");
  const src = report.recording ? (/^https?:/.test(report.recording.url) ? report.recording.url : `${VOICE_URL}/${report.recording.url.replace(/^\//, "")}`) : null;
  const offset = report.recording?.offsetMs ?? 0;
  const player = useAudio(src);
  const seek = src ? (t: number) => { player.seek(Math.max(0, (t - offset) / 1000)); player.play(); } : null;
  // Times on the page match the player when there is a recording, and the call's own clock when not.
  const clock = (t: number) => mmss(src ? t - offset : t);

  // The footer sits at the end of the left column, so the call panel stays clear of the top bar to the very end.
  return <Frame business={business} footInside>
    <div className={c.grid}>
      {/* The call itself: who, when, the player and every word. Its own panel, in view while the rest scrolls. */}
      <aside className={`${c.sheet} ${c.listen}`} data-demo={business.brand} aria-label="Your call">
        <CallHead report={report} business={business} />
        <div className={c.sectionHead}><h2>{src ? "Listen back" : "What was said"}</h2><span>{report.entries.filter((e) => e.kind === "say").length} lines</span></div>
        {src ? <Player player={player} steps={steps} offset={offset} durationMs={report.durationMs} />
          : <RecordingNote report={report} gaveUp={gaveUp} agent={agent} />}
        <Transcript entries={report.entries} agent={agent} player={src ? player : null} offset={offset} onSeek={seek} clock={clock} />
      </aside>

      <div className={c.left}>
        <WhatHappened report={report} business={business} />
        {report.view ? <section className={c.officeWrap} aria-label={`${business.name} back office`}>
          <p>{business.name}’s back office {report.status === "live" ? "right now" : "when the call ended"}. Everything on it came from this call.</p>
          <Office report={report} agent={business.agent} />
        </section> : null}
        <Steps steps={steps} agent={agent} demo={report.demo} onSeek={seek} clock={clock} />
        <ToolWrites report={report} steps={steps} agent={agent} clock={clock} />
        <Close agent={agent} />
        <Foot business={business} />
      </div>
    </div>
  </Frame>;
}

function CallHead({ report, business }: { report: CallReport; business: ReturnType<typeof businessOf> }) {
  const started = new Date(report.startedAt);
  const when = Number.isNaN(started.getTime()) ? null : started.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const live = report.status === "live";
  const how = report.channel === "phone" ? (report.callerNumber ? `Phone call from ${report.callerNumber}` : "Phone call") : "Website call";
  return <header className={c.callHead}>
    <h1>Your call with {business.agent}</h1>
    <p>{[when, !live && report.durationMs ? spoken(report.durationMs) : null, how].filter(Boolean).join(" · ")}</p>
    {live ? <p className={c.liveNote} role="status"><i />This call is still going. This page fills in as it happens.</p> : null}
  </header>;
}

/* ---------------- What happened ---------------- */

function WhatHappened({ report, business }: { report: CallReport; business: ReturnType<typeof businessOf> }) {
  const found = outcomes(report);
  const [lead, ...rest] = found.length ? found : [{ title: "Answered questions", detail: `${business.agent} answered the caller’s questions. Nothing needed booking or passing to the team.` }];
  const live = report.status === "live";
  return <section className={`${c.sheet} ${c.happened}`} aria-labelledby="happened-title">
    <div className={c.sectionHead}><h2 id="happened-title">What happened</h2>{live ? <span>So far</span> : null}</div>
    <div className={c.outcome}>
      <i aria-hidden="true"><Check size={16} /></i>
      <div><b>{lead.title}</b>{lead.detail ? <p>{lead.detail}</p> : null}</div>
    </div>
    {rest.length ? <ul className={c.outcomes}>{rest.map((o) => <li key={o.title + o.detail}><i aria-hidden="true"><Check size={11} /></i><span><b>{o.title}</b>{o.detail ? <small>{o.detail}</small> : null}</span></li>)}</ul> : null}
  </section>;
}

function Office({ report, agent }: { report: CallReport; agent: string }) {
  const v = report.view!;
  const state = report.status === "live" ? "live" : "finished";
  if ("skin" in v) return <AppointmentOffice view={v as AppointmentView} state={state} agentName={agent} />;
  switch (report.demo) {
    case "lawfirm": return <LawFirmOffice view={v as LawFirmView} state={state} agentName={agent} />;
    case "travel": return <TravelOffice view={v as TravelView} state={state} agentName={agent} />;
    case "hotels": return <HotelsOffice view={v as HotelsView} state={state} agentName={agent} />;
    case "formfield": return <FormFieldOffice view={v as FormFieldView} state={state} agentName={agent} />;
    case "realestate": return <RealEstateOffice view={v as RealEstateView} state={state} agentName={agent} />;
    case "insurance": return <InsuranceOffice view={v as InsuranceView} state={state} agentName={agent} />;
    case "dealership": return <DealershipOffice view={v as DealershipView} state={state} agentName={agent} />;
    case "dental": return <DentalOffice view={v as DentalView} state={state} agentName={agent} />;
    default: return <NorthlineOffice view={v as NorthlineView} state={state} agentName={agent} />;
  }
}

/* ---------------- The recording ---------------- */

type AudioState = ReturnType<typeof useAudio>;
const RATES = [1, 1.5, 2];

/** One <audio> element and its state. While playing, the time is read every frame so the transcript keeps step. */
function useAudio(src: string | null) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);

  useEffect(() => {
    if (!src) return;
    const a = new Audio();
    a.preload = "metadata";
    a.src = src;
    ref.current = a;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => { if (Number.isFinite(a.duration)) setDuration(a.duration); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("seeked", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    return () => { a.pause(); a.removeAttribute("src"); a.load(); ref.current = null; };
  }, [src]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => { if (ref.current) setTime(ref.current.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const play = useCallback(() => { void ref.current?.play().catch(() => undefined); }, []);
  const pause = useCallback(() => ref.current?.pause(), []);
  const seek = useCallback((t: number) => { const a = ref.current; if (!a) return; a.currentTime = t; setTime(t); }, []);
  const setRate = useCallback((r: number) => { setRateState(r); if (ref.current) ref.current.playbackRate = r; }, []);
  return { playing, time, duration, rate, play, pause, seek, setRate };
}

function Player({ player, steps, offset, durationMs }: { player: AudioState; steps: Step[]; offset: number; durationMs: number }) {
  const total = player.duration || Math.max(1, (durationMs - offset) / 1000);
  const p = Math.min(100, (player.time / total) * 100);
  const started = useRef(false);
  function toggle() {
    if (player.playing) return player.pause();
    if (!started.current) { started.current = true; track("call_page_play"); }
    player.play();
  }
  return <div className={c.player}>
    <button type="button" className={c.play} onClick={toggle} aria-label={player.playing ? "Pause" : "Play the recording"} data-playing={player.playing || undefined}>
      {player.playing
        ? <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" /></svg>}
    </button>
    <div className={c.scrub}>
      <div className={c.track} style={{ "--p": `${p}%` } as React.CSSProperties}>
        <input type="range" min={0} max={total} step={0.1} value={Math.min(player.time, total)} aria-label="Position in the recording" aria-valuetext={`${mmss(player.time * 1000)} of ${mmss(total * 1000)}`}
          onChange={(e) => player.seek(Number(e.target.value))} />
        {steps.map((s, i) => { const at = (s.t - offset) / 1000 / total; return at >= 0 && at <= 1 ? <i key={i} style={{ left: `${at * 100}%` }} data-failed={(!s.ok && !isTestStop(s)) || undefined} aria-hidden="true" /> : null; })}
      </div>
      <div className={c.under}>
        <span className={c.times}>{mmss(player.time * 1000)}<small> / {mmss(total * 1000)}</small></span>
        <div className={c.rates} role="group" aria-label="Playback speed">
          {RATES.map((r) => <button key={r} type="button" aria-pressed={player.rate === r} onClick={() => player.setRate(r)}>{r}×</button>)}
        </div>
      </div>
    </div>
  </div>;
}

function RecordingNote({ report, gaveUp, agent }: { report: CallReport; gaveUp: boolean; agent: string }) {
  if (report.status === "live") return <p className={c.recNote}><Clock size={15} /><span><b>The recording comes after the call.</b> The words appear below as they’re said.</span></p>;
  if (report.recordingPending && !gaveUp) return <p className={c.recNote} data-pending><span className={c.recDots} aria-hidden="true"><i /><i /><i /></span><span><b>The recording is on its way.</b> It’s usually ready a minute or two after the call. This page picks it up on its own.</span></p>;
  if (report.recordingPending) return <p className={c.recNote}><Clock size={15} /><span><b>The recording isn’t ready yet.</b> Reload this page in a few minutes.</span></p>;
  const why = report.channel === "browser" ? "Website calls aren’t recorded." : report.setup?.record === false ? "You chose not to record this call." : "This call has no recording.";
  return <p className={c.recNote}><span><b>{why}</b> Here’s everything you and {agent} said.</span></p>;
}

/* ---------------- Transcript ---------------- */

function Transcript({ entries, agent, player, offset, onSeek, clock }: { entries: ReportEntry[]; agent: string; player: AudioState | null; offset: number; onSeek: ((t: number) => void) | null; clock: (t: number) => string }) {
  const box = useRef<HTMLOListElement>(null);
  const userScrolled = useRef(0);
  const lines = useMemo(() => entries.map((e, i) => ({ e, i })).filter((x): x is { e: Line; i: number } => x.e.kind === "say"), [entries]);

  // The line being spoken: the last one that has started (a little lead so the highlight lands with the words).
  const now = player ? player.time * 1000 + offset + 150 : -1;
  let active = -1;
  if (player && (player.playing || player.time > 0)) for (const l of lines) { if (l.e.t <= now) active = l.i; else break; }

  useEffect(() => {
    const el = box.current;
    if (!el || active < 0 || Date.now() - userScrolled.current < 4000) return;
    const row = el.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!row) return;
    const top = row.offsetTop - el.clientHeight * 0.32;
    el.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [active]);

  const mark = () => { userScrolled.current = Date.now(); };
  if (!entries.length) return <p className={c.emptyLine}>Nothing was said on this call.</p>;

  return <ol className={c.transcript} ref={box} onWheel={mark} onTouchMove={mark} aria-label="Transcript">
    {entries.map((e, i) => {
      if (e.kind === "step") return <li key={i} className={c.tStep} data-status={e.ok ? "done" : isTestStop(e) ? "stopped" : "failed"} data-index={i}>
        <i aria-hidden="true">{e.ok || isTestStop(e) ? <Check size={10} /> : "!"}</i><span>{stepOutcome(e)}</span>
      </li>;
      const who = e.speaker === "agent" ? agent : "You";
      const body = <><span className={c.who}>{who}<time>{clock(e.t)}</time></span><p>{e.text}</p></>;
      return <li key={i} className={c.line} data-speaker={e.speaker === "agent" ? "agent" : "caller"} data-active={active === i || undefined} data-index={i}>
        {onSeek ? <button type="button" onClick={() => onSeek(e.t)} aria-label={`Play from ${clock(e.t)}: ${who}`}>{body}</button> : <div>{body}</div>}
      </li>;
    })}
  </ol>;
}

/* ---------------- Every step ---------------- */

function Steps({ steps, agent, demo, onSeek, clock }: { steps: Step[]; agent: string; demo: CallReport["demo"]; onSeek: ((t: number) => void) | null; clock: (t: number) => string }) {
  const names = new Map((voiceDemos[demo]?.design.tools ?? []).map((t) => [t.name, t.label]));
  return <section className={`${c.sheet} ${c.steps}`} aria-labelledby="steps-title">
    <div className={c.sectionHead}><h2 id="steps-title">Every step {agent} took</h2><span>{steps.length ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : null}</span></div>
    {steps.length ? <ol className={c.stepList}>
      {steps.map((s, i) => {
        const status = s.ok ? "done" : isTestStop(s) ? "stopped" : "failed";
        return <li key={i} data-status={status}>
          {onSeek ? <button type="button" className={c.at} onClick={() => onSeek(s.t)} aria-label={`Play from ${clock(s.t)}`}>{clock(s.t)}</button> : <span className={c.at}>{clock(s.t)}</span>}
          <div className={c.stepBody}>
            <b>{names.get(s.tool) ?? s.label}</b>
            <p>{stepOutcome(s)}</p>
          </div>
          <div className={c.stepMeta}>
            <em data-status={status}>{status === "done" ? "Done" : status === "stopped" ? "Stopped at payment" : "Didn’t go through"}</em>
            {s.ms != null ? <small>{took(s.ms)}</small> : null}
          </div>
        </li>;
      })}
    </ol> : <p className={c.emptyLine}>{agent} answered from what it knows and didn’t need to look anything up or write anything down.</p>}
  </section>;
}

/* ---------------- What it would have written into their tool ---------------- */

function ToolWrites({ report, steps, agent, clock }: { report: CallReport; steps: Step[]; agent: string; clock: (t: number) => string }) {
  const tool = findTool(report.setup?.tool);
  if (!tool) return null;
  const done = steps.filter((s) => s.ok);
  const groups = done.map((s, i) => ({ key: i, step: s, ops: opsFor(tool, s) })).filter((g) => g.ops.length);
  const booked = done.some((s) => BOOKING_TOOLS.includes(s.tool));
  const mapped = Object.keys(tool.ops).length > 0;
  return <section className={`${c.sheet} ${c.tool}`} aria-labelledby="tool-title">
    <header className={c.toolHead}>
      <span className={c.toolLogo}><ToolMark id={tool.id} name={tool.name} /></span>
      <div><h2 id="tool-title">What {agent} would have written into {tool.name}</h2><p>In a live install these are the calls {agent} makes to your {tool.name}, from {tool.name}’s own API.</p></div>
    </header>
    {groups.length ? <ol className={c.writes}>
      {groups.map((g) => <li key={g.key}>
        <span className={c.writeAt}>{clock(g.step.t)}</span>
        <ul>{g.ops.map((o) => <li key={o.op + o.what}><i aria-hidden="true"><Check size={10} /></i><span>{o.what}<code>{o.op}</code></span></li>)}</ul>
      </li>)}
      {booked && tool.confirmation ? <li data-kind="native"><span className={c.writeAt} /><ul><li><i aria-hidden="true"><Check size={10} /></i><span>{tool.confirmation}</span></li></ul></li> : null}
    </ol> : <p className={c.emptyLine}>{mapped ? `Nothing on this call needed writing into ${tool.name}. Book something or leave a message next time, and every write shows up here.` : `We connect ${agent} to ${tool.name} through its API when we build yours: every booking, note and message lands where your team already works.`}</p>}
  </section>;
}

/* ---------------- Close ---------------- */

function Close({ agent }: { agent: string }) {
  return <section className={c.close} aria-labelledby="close-title">
    <div>
      <h2 id="close-title">This is just the tip of the iceberg.</h2>
      <p>{agent} is one example. We build voice agents around how your business really runs: your services, your rules and the tools you already use. They pick up every call, do the work while they talk, and pass the rest to your team.</p>
    </div>
    <div className={c.closeActions}>
      <a className={c.yellow} href="/contact/" onClick={() => track("call_page_cta", { target: "contact" })}>Book a chat with us<ArrowRight size={15} /></a>
      <a className={c.dark} href="/#agents" onClick={() => track("call_page_cta", { target: "demos" })}>Try another demo</a>
    </div>
  </section>;
}
