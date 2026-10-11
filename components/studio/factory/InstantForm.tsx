"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { track } from "@/components/studio/consent";
import { Check } from "@/components/studio/icons";
import { VOICE_URL } from "@/components/studio/live/client";
import f from "./factory.module.css";
import { Turnstile } from "./Turnstile";

/** The voice service's progress for this call (factory.py Job.public). */
type Job = { job: string; step: string; business: string; error?: string; message?: string };

const STEPS = [
  { key: "reading", label: "Building your agent from your website" },
  { key: "calling", label: "Calling your phone" },
  { key: "in_call", label: "On the call" },
  { key: "done", label: "Summary emailed to you" },
];
// Twilio's "ringing" still counts as calling; "summary" means the call ended and the summary is being written.
const AT: Record<string, number> = { reading: 0, calling: 1, ringing: 1, in_call: 2, summary: 2, done: 3 };

export function InstantForm() {
  const [job, setJob] = useState<Job | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const [token, setToken] = useState("");
  const [tries, setTries] = useState(0);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  // Follow the call until it's over.
  useEffect(() => {
    if (!job || ["done", "failed", "no_answer"].includes(job.step)) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${VOICE_URL}/instant/${job.job}`);
        if (r.ok) setJob((await r.json()) as Job);
      } catch {
        // A missed poll is fine; the next one catches up.
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [job]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!token) {
      setProblem("Please tick “Verify you are human” first.");
      return;
    }
    setSending(true);
    setProblem("");
    try {
      const r = await fetch(`${VOICE_URL}/instant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          website: data.get("website"),
          email: data.get("email"),
          consent: data.get("consent") === "on",
          company: data.get("company"),
          elapsedMs: Date.now() - shownAt.current,
          turnstileToken: token,
        }),
      });
      const out = (await r.json()) as Job & { message?: string };
      if (!r.ok) throw new Error(out.message || "We couldn’t start the call. Please try again.");
      track("instant_call_started");
      setJob(out);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "We couldn’t start the call. Please try again.");
    } finally {
      setSending(false);
      setTries((n) => n + 1);
    }
  }

  if (job) {
    const at = AT[job.step] ?? 0;
    const failed = job.step === "failed" || job.step === "no_answer";
    const done = job.step === "done";
    return (
      <div className={f.progress} role="status" aria-live="polite">
        <h2>{done ? "That’s what your callers get." : failed ? "We couldn’t reach you." : at >= 1 ? "Calling you now" : "Building your agent now"}</h2>
        <p>{done ? (job.message || "Check your email: that’s the summary you’d get after every call, with a link to book a time with us.") : failed ? job.message : at >= 1 ? "Pick up when your phone rings. Pretend you’re one of your customers." : "Stay close to your phone. We’re reading your website and it calls you in under a minute."}</p>
        {failed ? null : (
          <ol className={f.steps}>
            {STEPS.map((s, i) => (
              <li key={s.key} className={f.step} data-state={i < at || done ? "done" : i === at ? "active" : "todo"}>
                <i>{i < at || done ? <Check size={13} /> : null}</i>{s.label}
              </li>
            ))}
          </ol>
        )}
        {done || failed ? (
          <div className={f.actions}>
            <a className={f.primary} href="/pricing/">Get it for real</a>
            <button className={f.secondary} type="button" onClick={() => { setJob(null); shownAt.current = Date.now(); }}>Try again</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    // rr-block and ph-no-capture: session recordings never see what people type.
    <form className="contact-form rr-block ph-no-capture" onSubmit={submit}>
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">First name</label>
          <input id="name" name="name" autoComplete="given-name" required maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="phone">Mobile</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={20} placeholder="(555) 555-0142" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="website">Your business website</label>
        <input id="website" name="website" type="text" inputMode="url" autoComplete="url" required maxLength={200} placeholder="yourbusiness.com" />
      </div>
      <div className="field">
        <label htmlFor="email">Email<span className="optional"> for the call summary</span></label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={120} />
      </div>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>
      <label className={f.consent}>
        <input type="checkbox" name="consent" required />
        <span>Call me now with an AI demo agent and email me the call summary. One call. US and Canadian numbers.</span>
      </label>
      <Turnstile onToken={setToken} resetKey={tries} />
      <div className="form-action">
        <button className={`submit-button ${f.callButton}`} type="submit" disabled={sending}>{sending ? "Starting…" : "Call me now"}</button>
        {problem ? <p className="form-status" data-state="error" role="alert">{problem}</p> : null}
      </div>
    </form>
  );
}
