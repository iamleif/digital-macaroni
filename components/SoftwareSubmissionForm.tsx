"use client";

import type { FormEvent } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { REVIEW_CATEGORIES } from "@/lib/review-taxonomy";

const inbox = "hello@digitalmacaroni.io";

function value(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

export function SoftwareSubmissionForm() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const software = value(formData, "software");
    const body = [
      `Software: ${software}`,
      `Website: ${value(formData, "website")}`,
      `Category: ${value(formData, "category")}`,
      `Contact: ${value(formData, "contact")}`,
      `Relationship: ${value(formData, "relationship")}`,
      "",
      "Why it is worth reviewing:",
      value(formData, "reason"),
      "",
      "Pricing and review access:",
      value(formData, "access") || "Not provided",
      "",
      "Anything else:",
      value(formData, "notes") || "Not provided",
    ].join("\n");

    window.location.href = `mailto:${inbox}?subject=${encodeURIComponent(`Software submission: ${software}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form className="submission-form" onSubmit={handleSubmit}>
      <div className="form-section-heading">
        <span className="tiny-label">The essentials</span>
        <span>Required fields are marked *</span>
      </div>

      <div className="form-grid">
        <label>
          <span>Software name *</span>
          <input name="software" autoComplete="organization" required />
        </label>
        <label>
          <span>Website URL *</span>
          <input name="website" type="url" inputMode="url" placeholder="https://" required />
        </label>
        <label>
          <span>Category *</span>
          <select name="category" defaultValue="" required>
            <option value="" disabled>Select the closest type</option>
            {REVIEW_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            <option>Other</option>
          </select>
        </label>
        <label>
          <span>Contact email *</span>
          <input name="contact" type="email" inputMode="email" autoComplete="email" required />
        </label>
      </div>

      <label>
        <span>Your relationship to the software *</span>
        <select name="relationship" defaultValue="" required>
          <option value="" disabled>Select one</option>
          <option>Founder or team member</option>
          <option>Agency or PR representative</option>
          <option>Customer or user</option>
          <option>Something else</option>
        </select>
      </label>

      <label>
        <span>Why should we review it? *</span>
        <textarea
          name="reason"
          rows={5}
          placeholder="What does it do, who is it for, and what makes it worth a closer look?"
          required
        />
      </label>

      <label>
        <span>Pricing and review access</span>
        <textarea
          name="access"
          rows={3}
          placeholder="Share the price, trial details, or whether you can provide a review account."
        />
      </label>

      <label>
        <span>Anything else we should know?</span>
        <textarea name="notes" rows={3} />
      </label>

      <div className="submission-action">
        <button type="submit">Prepare submission email <ArrowUpRight size={16} aria-hidden="true" /></button>
        <p>This opens your email app with the details filled in. You choose when to send it.</p>
      </div>
    </form>
  );
}
