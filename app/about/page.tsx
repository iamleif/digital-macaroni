import type { Metadata } from "next";
import { InfoPage } from "@/components/studio/info-page";
import { JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";

export const metadata: Metadata = pageMeta({
  title: "About — Digital Macaroni",
  shareTitle: "About Digital Macaroni",
  description: "Digital Macaroni builds AI agents that take action inside real business workflows: voice agents, software and automations that turn conversations into completed work.",
  path: "/about/",
  ownImage: true,
});

export default function AboutPage() {
  return <InfoPage title="About Digital Macaroni." intro="We build AI agents that take action inside real business workflows.">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", url: `${SITE}/about/`, name: "About Digital Macaroni", about: ORG_REF, mainEntity: ORG_REF }} />
    <section>
      <h2>What we do</h2>
      <p>Voice agents, software and automations that turn conversations into completed work.</p>
      <p>A conversation is where the work starts, not where it ends. Our agents connect to the tools your business already runs and carry each request through to done: updating records, coordinating schedules and teams, triggering the next step in a workflow, and closing the loop with the customer.</p>
    </section>
    <section>
      <h2>Who we build for</h2>
      <p>Businesses that run on conversations: home services, clinics and practices, shops, travel, and teams spread across locations. Every agent is built for one business, around its customers, its rules and the tools it already uses.</p>
    </section>
    <section>
      <h2>What we build</h2>
      <ul>
        <li><strong>Voice agents</strong> that answer calls and complete the work behind them.</li>
        <li><strong>Business software and dashboards</strong> where your team sees every conversation and what was done.</li>
        <li><strong>Automations and integrations</strong> that connect agents to your scheduling, ordering, records and messaging.</li>
        <li><strong>Apps</strong> for the web and mobile, from an early prototype to a working product.</li>
      </ul>
    </section>
    <section>
      <h2>Our own products</h2>
      <p>We also build and run our own: <a href="https://rankladder.app">RankLadder</a>, <a href="https://heyanders.com">Hey Anders</a> and <a href="https://twotop.app">TwoTop</a>.</p>
    </section>
    <section>
      <h2>Working with us</h2>
      <p>The quickest way to see what we do is to <a href="/#agents">call one of our demo agents</a>. Tell us what you need, and you get a clear proposal with scope, price and timeline before any work begins. <a href="/contact/">Drop us a note</a>.</p>
    </section>
  </InfoPage>;
}
