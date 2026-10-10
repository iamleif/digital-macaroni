import type { Metadata } from "next";
import { InfoPage } from "@/components/studio/info-page";
import { JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";

export const metadata: Metadata = pageMeta({
  title: "About — Digital Macaroni",
  shareTitle: "About Digital Macaroni",
  description: "Digital Macaroni builds AI voice agents that get to work and grow your revenue: they answer every call, book the job, update your systems and hand off to your team.",
  path: "/about/",
  ownImage: true,
});

export default function AboutPage() {
  return <InfoPage title="About Digital Macaroni." intro="We build AI voice agents that get to work and grow your revenue.">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", url: `${SITE}/about/`, name: "About Digital Macaroni", about: ORG_REF, mainEntity: ORG_REF }} />
    <section>
      <h2>What we do</h2>
      <p>AI voice agents that answer every call and complete the work behind it.</p>
      <p>A phone call is where the work starts, not where it ends. Our agents connect to the tools your business already runs and carry each request through to done: booking the visit, updating the record, sending the confirmation, and handing off to your team when a person should take over.</p>
    </section>
    <section>
      <h2>Who we build for</h2>
      <p>Businesses that live on the phone: home services, clinics and practices, law firms, shops, travel, and teams spread across locations. Every agent is built for one business, around its callers, its rules and the tools it already uses.</p>
    </section>
    <section>
      <h2>What you get</h2>
      <ul>
        <li><strong>A voice agent</strong> that answers every call and completes the work behind it, in your name and voice.</li>
        <li><strong>Connections to your tools</strong>: scheduling, CRM, ordering, records and messaging.</li>
        <li><strong>A dashboard</strong> with every call&rsquo;s transcript, summary and the actions your agent took.</li>
        <li><strong>Voice AI consulting</strong> for bigger projects. <a href="/consulting/">See how it works</a>.</li>
      </ul>
    </section>
    <section>
      <h2>Our own products</h2>
      <p>We also build and run our own: <a href="https://heyanders.com">Hey Anders</a> and <a href="https://twotop.app">TwoTop</a>.</p>
    </section>
    <section>
      <h2>Working with us</h2>
      <p>The quickest way to see what we do is to <a href="/#agents">call one of our demo agents</a>. Tell us what you need, and you get a clear proposal with scope, price and timeline before any work begins. <a href="/contact/">Drop us a note</a>.</p>
    </section>
  </InfoPage>;
}
