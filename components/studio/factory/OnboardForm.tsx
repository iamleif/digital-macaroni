"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Phone } from "@/components/studio/icons";
import { VOICE_URL } from "@/components/studio/live/client";
import f from "./factory.module.css";
import { Turnstile } from "./Turnstile";

/** The voice service's progress for this setup (factory.py Job.public). */
type Job = { job: string; step: string; business: string; error?: string; message?: string; number?: string; numberPretty?: string; agentName?: string };

const STEPS = [
  { key: "reading", label: "Reading your website" },
  { key: "building", label: "Building your agent" },
  { key: "number", label: "Getting your local number" },
  { key: "live", label: "Live" },
];
const AT: Record<string, number> = { reading: 0, building: 1, number: 2, live: 3 };

export function OnboardForm() {
  const [invite, setInvite] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; message?: string } | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const [token, setToken] = useState("");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite") ?? "";
    setInvite(token);
    if (!token) {
      setCheck({ ok: false, message: "Open this page from the setup link we sent you." });
      return;
    }
    fetch(`${VOICE_URL}/onboard/check?invite=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((c: { ok: boolean; message?: string }) => setCheck(c))
      .catch(() => setCheck({ ok: false, message: "We couldn’t check your link. Please refresh the page." }));
  }, []);

  useEffect(() => {
    if (!job || ["live", "failed"].includes(job.step)) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${VOICE_URL}/onboard/${job.job}`);
        if (r.ok) setJob((await r.json()) as Job);
      } catch {
        // The next poll catches up.
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [job]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!token) {
      setProblem("Please tick “Verify you are human” first.");
      return;
    }
    setSending(true);
    setProblem("");
    try {
      const r = await fetch(`${VOICE_URL}/onboard`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...d, invite, turnstileToken: token }) });
      const out = (await r.json()) as Job & { message?: string };
      if (!r.ok) throw new Error(out.message || "Something went wrong. Please try again.");
      setJob(out);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
      setTries((n) => n + 1);
    }
  }

  if (job) {
    const at = AT[job.step] ?? 0;
    const live = job.step === "live";
    const failed = job.step === "failed";
    const digits = (job.number ?? "").slice(-10);
    return (
      <div className={f.progress} role="status" aria-live="polite">
        <h2>{live ? `${job.agentName} is answering for ${job.business}` : failed ? "We hit a snag." : `Setting up ${job.business}`}</h2>
        {failed ? <p className={f.problem}>{job.message}</p> : null}
        {!live && !failed ? (
          <ol className={f.steps}>
            {STEPS.map((s, i) => (
              <li key={s.key} className={f.step} data-state={i < at ? "done" : i === at ? "active" : "todo"}>
                <i>{i < at ? <Check size={13} /> : null}</i>{s.label}
              </li>
            ))}
          </ol>
        ) : null}
        {live ? (
          <>
            <span className={f.number}>{job.numberPretty}</span>
            <div className={f.actions}><a className={f.primary} href={`tel:${job.number}`}><Phone size={16} />Call it now</a></div>
            <p className={f.forward}>
              <b>Send your calls to it:</b> forward your business line to {job.numberPretty}. On most mobiles dial <b>*72{digits}</b> (AT&amp;T, Verizon) or <b>**21*{job.number}#</b> (T-Mobile). For only the calls you miss, use <b>*71{digits}</b> or <b>**61*{job.number}#</b>. On a business phone system, set forwarding in its settings.
            </p>
            <p>After every call you’ll get a text and an email: who called, their number, what they wanted and what to do next. We’ve emailed you all of this too.</p>
          </>
        ) : null}
      </div>
    );
  }

  if (!check) return <div className={f.progress}><p>Checking your link…</p></div>;
  if (!check.ok) return <div className={f.progress}><h2>This link doesn’t work</h2><p>{check.message}</p></div>;

  return (
    <form className="contact-form rr-block ph-no-capture" onSubmit={submit}>
      <div className="field">
        <label htmlFor="businessName">Business name</label>
        <input id="businessName" name="businessName" required maxLength={100} autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" required maxLength={200} inputMode="url" placeholder="yourbusiness.com" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ownerName">Your name</label>
          <input id="ownerName" name="ownerName" required maxLength={80} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="areaCode">Area code for your number</label>
          <input id="areaCode" name="areaCode" required inputMode="numeric" pattern="[2-9][0-9]{2}" maxLength={3} placeholder="206" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ownerEmail">Email for call summaries</label>
          <input id="ownerEmail" name="ownerEmail" type="email" required maxLength={120} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="ownerMobile">Mobile for call summaries</label>
          <input id="ownerMobile" name="ownerMobile" type="tel" required maxLength={20} autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label>Voice</label>
        <div className={f.voices}>
          <label className={f.voice}><input type="radio" name="voice" value="female" defaultChecked /><span>Ava<small>Warm, female</small></span></label>
          <label className={f.voice}><input type="radio" name="voice" value="male" /><span>Leo<small>Friendly, male</small></span></label>
        </div>
      </div>
      <div className="field">
        <label htmlFor="hours">Opening hours<span className="optional"> optional, if your website doesn’t say</span></label>
        <input id="hours" name="hours" maxLength={300} placeholder="Mon–Fri 8–5, Sat 9–1" />
      </div>
      <div className="field">
        <label htmlFor="bookingUrl">Online booking link<span className="optional"> optional, texted to callers who want to book</span></label>
        <input id="bookingUrl" name="bookingUrl" maxLength={300} inputMode="url" />
      </div>
      <div className="field">
        <label htmlFor="notes">What should your agent know?<span className="optional"> optional</span></label>
        <textarea id="notes" name="notes" maxLength={1500} placeholder="Prices you’re happy to share, what you don’t do, emergencies, insurance you take…" />
      </div>
      <div className="field">
        <label htmlFor="neverSay">Anything it should never say?<span className="optional"> optional</span></label>
        <input id="neverSay" name="neverSay" maxLength={600} />
      </div>
      <p className={f.note}>We read your website to build your agent. Your new number is local to the area code you choose.</p>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company_url">Leave this field empty</label>
        <input id="company_url" name="company_url" tabIndex={-1} autoComplete="off" />
      </div>
      <Turnstile onToken={setToken} resetKey={tries} />
      <div className="form-action">
        <button className={`submit-button ${f.callButton}`} type="submit" disabled={sending}>{sending ? "Starting…" : "Build my agent"}</button>
        {problem ? <p className="form-status" data-state="error" role="alert">{problem}</p> : null}
      </div>
    </form>
  );
}
