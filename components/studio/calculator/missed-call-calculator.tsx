"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Phone } from "../icons";
import { track } from "../consent";
import { AI_MINUTES_PER_CALL, AI_RATE_PER_MINUTE, BOOKING_RATES, DEFAULT_MISSED, GROUPS, DEFAULT_RATE, HOSTED_PLAN, STARTING_VALUE, TRADES, type Group, lostRevenue } from "./math";
import c from "./calculator.module.css";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fewJobs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The calculator itself: four inputs, the answer updating as they type. */
export function MissedCallCalculator() {
  const [trade, setTrade] = useState("");
  const [missed, setMissed] = useState(DEFAULT_MISSED);
  const [ticket, setTicket] = useState(STARTING_VALUE);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [custom, setCustom] = useState(false);
  const used = useRef(false);
  const current = TRADES.find((t) => t.id === trade);
  const group = current
    ? { ...GROUPS[current.group], ...(current.value ? { value: current.value } : {}), ...(current.hint ? { hint: current.hint } : {}) }
    : { ...GROUPS.other, hint: "What one booking or new customer is worth to you." };

  const touched = () => {
    if (used.current) return;
    used.current = true;
    track("calculator_used");
  };

  const pickTrade = (id: string) => {
    const t = TRADES.find((x) => x.id === id)!;
    setTrade(id);
    if (t.ticket) { setTicket(t.ticket); setCustom(false); }
    touched();
  };

  const r = lostRevenue({ missed, ticket, rate });
  const answering = missed * AI_MINUTES_PER_CALL * AI_RATE_PER_MINUTE;
  const multiple = answering > 0 ? Math.round(r.monthly / answering) : 0;
  const jobsForPlan = ticket > 0 ? Math.max(1, Math.ceil(HOSTED_PLAN.price / ticket)) : 0;

  return <section className={c.calc} aria-labelledby="calc-heading">
    <h2 id="calc-heading" className={c.visuallyHidden}>Calculate what missed calls cost you</h2>

    <div className={c.inputs}>
      <div className={c.field}>
        <label htmlFor="business"><span className={c.step}>1</span>Your kind of business</label>
        <div className={c.select}>
          <select id="business" value={trade} data-empty={trade ? undefined : ""} onChange={(e) => pickTrade(e.target.value)}>
            <option value="" disabled>Choose your kind of business</option>
            {(Object.keys(GROUPS) as Group[]).map((g) => <optgroup key={g} label={GROUPS[g].label}>
              {TRADES.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </optgroup>)}
          </select>
        </div>
      </div>

      <div className={c.field}>
        <label htmlFor="missed"><span className={c.step}>2</span>Missed calls last month</label>
        <p className={c.hint}>Your phone provider or call log shows this. A guess is fine.</p>
        <div className={c.stepper}>
          <button type="button" aria-label="Fewer missed calls" onClick={() => { setMissed((m) => Math.max(0, m - 1)); touched(); }}>−</button>
          <input id="missed" type="number" inputMode="numeric" min={0} max={5000} value={missed} onChange={(e) => { setMissed(clamp(e.target.valueAsNumber, 0, 5000)); touched(); }} />
          <button type="button" aria-label="More missed calls" onClick={() => { setMissed((m) => Math.min(5000, m + 1)); touched(); }}>+</button>
        </div>
        <input className={c.range} type="range" min={0} max={200} value={Math.min(missed, 200)} aria-label="Missed calls last month" onChange={(e) => { setMissed(e.target.valueAsNumber); touched(); }} />
      </div>

      <div className={c.field}>
        <label htmlFor="ticket"><span className={c.step}>3</span>{group.value}</label>
        <p className={c.hint}>{group.hint} {custom && current?.ticket ? <button type="button" className={c.reset} onClick={() => { setCustom(false); setTicket(current.ticket); }}>Use the typical figure</button> : !current ? "Pick your business above for a typical figure, or enter your own." : current.ticket && !custom ? "We filled in a typical figure. Use your own if you know it." : "Enter your own figure."}</p>
        <div className={c.money}>
          <span aria-hidden="true">$</span>
          <input id="ticket" type="number" inputMode="numeric" min={0} max={100000} value={ticket} onChange={(e) => { setTicket(clamp(e.target.valueAsNumber, 0, 100000)); setCustom(true); touched(); }} />
        </div>
      </div>

      <fieldset className={c.field}>
        <legend><span className={c.step}>4</span>How many of those callers would have booked?</legend>
        <p className={c.hint}>Not every caller becomes a customer. 1 in 4 is a careful starting point.</p>
        <div className={c.segments}>
          {BOOKING_RATES.map((b) => <button key={b.rate} type="button" aria-pressed={rate === b.rate} onClick={() => { setRate(b.rate); touched(); }}>{b.label}</button>)}
        </div>
      </fieldset>

      <a className={c.mobileBar} href="#calc-result" aria-hidden="true" tabIndex={-1}>
        <span>Costing you about</span><b>{money(r.monthly)}<small>/mo</small></b><span className={c.mobileBarMore}>See it</span>
      </a>
    </div>

    <div id="calc-result" className={c.result} aria-live="polite">
      <p className={c.resultKicker}>Missed calls are costing you about</p>
      <p className={c.resultBig}>{money(r.monthly)}<span>a month</span></p>
      <p className={c.resultYear}>That&rsquo;s <b>{money(r.monthly * 12)}</b> a year.</p>

      <ol className={c.chain} aria-label="How we got there">
        <li><b>{missed.toLocaleString("en-US")}</b><span>missed calls</span></li>
        <li><b>{fewJobs(r.jobs)}</b><span>lost {r.jobs === 1 ? "booking" : "bookings"}</span></li>
        <li><b>{money(r.monthly)}</b><span>lost revenue</span></li>
      </ol>

      <div className={c.compare}>
        <p className={c.compareLabel}>Answering those calls with an AI agent</p>
        <p className={c.compareBig}>about {money(Math.max(answering, missed > 0 ? 1 : 0))} a month <span>in call minutes</span></p>
        <p className={c.compareNote}>{missed > 0 && multiple > 1 ? <>Missed calls cost you about <b>{multiple.toLocaleString("en-US")}×</b> more than answering them would. </> : null}Based on {AI_MINUTES_PER_CALL}-minute calls at about {Math.round(AI_RATE_PER_MINUTE * 100)}¢ a minute.</p>
        {jobsForPlan ? <p className={c.compareNote}>Our Hosted plan is {money(HOSTED_PLAN.price)} a month with {HOSTED_PLAN.minutes} minutes included. At your job value, it pays for itself with {jobsForPlan === 1 ? "one booked job" : `${jobsForPlan} booked jobs`} a month.</p> : null}
      </div>

      <div className={c.actions}>
        <a className={c.primary} href="/demo/northline/" onClick={() => track("calculator_cta", { target: "demo" })}><Phone size={16} />Hear an agent answer</a>
        <a className={c.secondary} href="/contact/" onClick={() => track("calculator_cta", { target: "contact" })}>Get a plan for your business<ArrowUpRight size={14} /></a>
      </div>
    </div>
  </section>;
}

function clamp(n: number, lo: number, hi: number) {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo;
}
