"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = {
  state: "idle" | "sending" | "success" | "error";
  message: string;
};

const initialStatus: Status = { state: "idle", message: "" };

export function ContactForm() {
  const [status, setStatus] = useState<Status>(initialStatus);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sent") === "1") {
      setStatus({ state: "success", message: "Thanks. Your message is on its way." });
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setStatus({ state: "sending", message: "Sending…" });

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "We couldn’t send your message. Please try again.");
      }

      form.reset();
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

  return (
    <form
      className="contact-form"
      action="/api/contact"
      method="post"
      onSubmit={handleSubmit}
    >
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required maxLength={100} />
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>

      <div className="field">
        <label htmlFor="topic">What’s this about?</label>
        <select id="topic" name="topic" required defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          <option value="new-project">A new project</option>
          <option value="existing-project">An existing project</option>
          <option value="collaboration">A collaboration</option>
          <option value="question">A general question</option>
          <option value="other">Something else</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="message">What’s on your mind?</label>
        <textarea id="message" name="message" required maxLength={5000} />
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
