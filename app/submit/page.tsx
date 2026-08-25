import type { Metadata } from "next";
import { SoftwareSubmissionForm } from "@/components/SoftwareSubmissionForm";

export const metadata: Metadata = {
  title: "Submit your software",
  description: "Put your software forward for an independent Digital Macaroni review.",
  alternates: {
    canonical: "/submit",
    types: { "application/rss+xml": "/feed.xml", "application/feed+json": "/feed.json" },
  },
};

export default function SubmitPage() {
  return (
    <section className="submit-page section-pad">
      <header className="submit-hero">
        <div>
          <h1>Put it on our desk.</h1>
        </div>
        <p>
          Tell us what you have built and why it is worth using. A submission gets
          our attention, not a guaranteed review or a kinder score.
        </p>
      </header>

      <div className="submit-layout">
        <aside className="submission-notes" aria-labelledby="what-we-consider">
          <span className="tiny-label" id="what-we-consider">What we consider</span>
          <ol>
            <li><span>01</span><p><strong>A real product.</strong> Something people can use today.</p></li>
            <li><span>02</span><p><strong>A clear point of view.</strong> A product solving a specific problem for specific people.</p></li>
            <li><span>03</span><p><strong>Useful context.</strong> Tell us your relationship to the software and why it belongs on our review list.</p></li>
          </ol>
        </aside>
        <SoftwareSubmissionForm />
      </div>
    </section>
  );
}
