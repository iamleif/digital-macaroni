"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@/components/studio/consent";

type Status = {
  state: "idle" | "sending" | "success" | "error";
  message: string;
};

const initialStatus: Status = { state: "idle", message: "" };

const TOPICS = [
  ["ready-made", "A ready-made voice agent"],
  ["custom-agent", "A custom voice agent"],
  ["software", "Business software or a dashboard"],
  ["app", "An app"],
  ["question", "A general question"],
  ["other", "Something else"],
] as const;
type Topic = (typeof TOPICS)[number][0] | "";

const BUSINESS_TYPES = ["Home services", "Shop or retail", "Health or clinic", "Legal", "Restaurant or hospitality", "Travel", "Real estate", "Other"];
const CALL_VOLUMES = ["Under 100", "100 to 500", "500 to 2,000", "Over 2,000", "Not sure"];
const TIMELINES = ["As soon as possible", "Within a month", "In 1 to 3 months", "Just exploring"];
const BUDGETS = ["$5,000 to $10,000", "$10,000 to $25,000", "Over $25,000", "Not sure yet"];

const MESSAGE: Record<string, { label: string; placeholder: string }> = {
  "ready-made": { label: "Anything we should know?", placeholder: "What should callers be able to do? Book a visit, check stock, leave a message…" },
  "custom-agent": { label: "What should your agent do?", placeholder: "The calls you get, what should happen on them, and where the details should end up." },
  software: { label: "Tell us about it", placeholder: "Who uses it, what it replaces, and what a good day with it looks like." },
  app: { label: "Tell us about it", placeholder: "Who it’s for, what they’ll do with it, and where it should run (web, iPhone, Android)." },
};

function Select({ name, label, options, required, defaultValue = "" }: { name: string; label: string; options: readonly string[]; required?: boolean; defaultValue?: string }) {
  return <div className="field">
    <label htmlFor={name}>{label}{required ? null : <span className="optional"> optional</span>}</label>
    <select id={name} name={name} required={required} defaultValue={defaultValue}>
      <option value="" disabled={required}>Choose one</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>;
}

function Row({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [topic, setTopic] = useState<Topic>("");
  // When the form appeared; the server drops anything sent faster than a person could type.
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
    const params = new URLSearchParams(window.location.search);
    const asked = params.get("topic");
    if (asked && TOPICS.some(([v]) => v === asked)) setTopic(asked as Topic);
    if (params.get("sent") === "1") {
      setStatus({ state: "success", message: "Thanks. Your message is on its way." });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setStatus({ state: "sending", message: "Sending…" });

    try {
      const body = new FormData(form);
      body.set("elapsed", String(Date.now() - shownAt.current));
      const response = await fetch(form.action, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "We couldn’t send your message. Please try again.");
      }

      // Only the topic is sent; never the visitor's name, email or message.
      track("contact_form_sent", { topic: topic || "unspecified" });
      form.reset();
      setTopic("");
      setStatus({
        state: "success",
        message: result.message || "Thanks. Your message is on its way.",
      });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn’t send your message. Please try again.",
      });
    }
  }

  const message = MESSAGE[topic] ?? { label: "What’s on your mind?", placeholder: "Tell us a little about your business and what you’re hoping for." };
  const agent = topic === "ready-made" || topic === "custom-agent";

  return (
    <form
      className="contact-form"
      action="/api/contact"
      method="post"
      onSubmit={handleSubmit}
    >
      <Row>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" autoComplete="name" required maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
      </Row>

      <div className="field">
        <label htmlFor="company">Business<span className="optional"> optional</span></label>
        <input id="company" name="company" type="text" autoComplete="organization" maxLength={200} />
      </div>

      <div className="field">
        <label htmlFor="topic">What can we help with?</label>
        <select id="topic" name="topic" required value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
          <option value="" disabled>Choose one</option>
          {TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {agent ? <div className="field-group" key={topic}>
        <Row>
          <Select name="business_type" label="Type of business" options={BUSINESS_TYPES} required />
          <Select name="call_volume" label="Calls a month" options={CALL_VOLUMES} />
        </Row>
        {topic === "ready-made" ? <Row>
          <Select name="texting" label="Should it send texts?" options={["Yes", "No", "Not sure"]} />
          <Select name="hosting" label="How should it run?" options={["Hosted by Digital Macaroni", "Managed by Digital Macaroni", "Self-hosted on my own accounts", "Not sure yet"]} />
        </Row> : <>
          <div className="field">
            <label htmlFor="tools">Tools it should connect to<span className="optional"> optional</span></label>
            <input id="tools" name="tools" type="text" maxLength={300} placeholder="Google Calendar, HubSpot, Jobber, your own system…" />
          </div>
          <Row>
            <Select name="timeline" label="Timeline" options={TIMELINES} />
            <Select name="budget" label="Budget" options={BUDGETS} />
          </Row>
        </>}
      </div> : null}

      {topic === "software" || topic === "app" ? <div className="field-group" key={topic}>
        <div className="field">
          <label htmlFor="build">{topic === "app" ? "What kind of app?" : "What should it help with?"}<span className="optional"> optional</span></label>
          <input id="build" name="build" type="text" maxLength={300} placeholder={topic === "app" ? "A customer app, a booking app, an internal tool…" : "Scheduling, a dashboard, replacing spreadsheets…"} />
        </div>
        <Row>
          <Select name="timeline" label="Timeline" options={TIMELINES} />
          <Select name="budget" label="Budget" options={BUDGETS} />
        </Row>
      </div> : null}

      <div className="field">
        <label htmlFor="message">{message.label}</label>
        <textarea id="message" name="message" required maxLength={5000} placeholder={message.placeholder} />
      </div>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="form-action">
        <button
          className="submit-button"
          type="submit"
          disabled={status.state === "sending"}
        >
          {status.state === "sending" ? "Sending…" : "Send message"}
        </button>
        <p
          className="form-status"
          data-state={status.state}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </p>
      </div>
    </form>
  );
}
