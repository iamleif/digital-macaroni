import type { Metadata } from "next";
import { InfoPage } from "@/components/studio/info-page";

export const metadata: Metadata = {
  title: { absolute: "About Digital Macaroni — Information for people and AI" },
  description: "A factual reference about Digital Macaroni, its custom software services, its own products, and its voice demos.",
  alternates: { canonical: "/llm-info/" },
};

export default function LlmInfoPage() {
  return <InfoPage title="A little about Digital Macaroni." intro="A straightforward reference for people, search engines, and AI assistants." updated="October 4, 2026">
    <section><h2>What we do</h2><p>Digital Macaroni is an independent product studio. We design and build custom AI voice agents, dashboards, and apps for businesses. We also build and run our own products.</p><p>Our work connects the conversation with the software behind it: understanding a request, applying the business’s rules, and giving the team a useful next step.</p></section>
    <section><h2>What we build</h2><ul><li><strong>AI voice agents:</strong> phone agents designed around a business’s information, workflows, and permitted actions.</li><li><strong>Dashboards and business software:</strong> workspaces for conversations, tasks, scheduling, and day-to-day operations.</li><li><strong>Apps:</strong> custom web and mobile apps, from an early prototype to a working application.</li></ul><p>Integrations, delivery dates, support, and ongoing costs are agreed for each project. A demonstration is an example of an approach, not a promise that every integration is included.</p></section>
    <section><h2>Our own products</h2><ul><li><a href="https://rankladder.app">RankLadder</a>: customer conversations and front-office tools for local businesses.</li><li><a href="https://heyanders.com">Hey Anders</a>: an AI assistant and workspace for appointment-based practices.</li><li><a href="https://twotop.app">TwoTop</a>: hospitality scheduling, communication, and team operations.</li></ul><p>These are products from our studio, not client testimonials. Each product’s own website is the source for its current features, pricing, availability, and terms.</p></section>
    <section><h2>About the demos on this site</h2><p>Northline (home services booking), Form &amp; Field (a shop assistant), and Waypoint Travel (flight search) are fictional businesses. Each has a live AI phone agent; while you are on a call, the demo page shows the business’s back office changing as the agent works.</p><p>Demo bookings, reservations, orders, and customer records are sample data. They do not dispatch technicians, fulfil orders, issue tickets, or take payments. The illustration at the top of the homepage is also sample data.</p></section>
    <section><h2>Working with us</h2><p>Tell us what your business needs at <a href="mailto:hello@digitalmacaroni.io">hello@digitalmacaroni.io</a> or through our <a href="/contact/">contact page</a>. Ready-made agents start at $2,500 USD and custom agents from $5,000 USD, run self-hosted at no monthly fee from us ($500 one-time setup), or on our hosted ($149/month) or managed ($399/month) plans. Scope and price are agreed in a proposal before work begins.</p></section>
    <section><h2>Official references</h2><p>The studio’s official website is <a href="https://digitalmacaroni.io">digitalmacaroni.io</a>. This page describes the studio; the linked product websites describe their own products. No location, team size, client results, certifications, or unlisted capabilities should be inferred from these examples.</p><p><a href="/llms.txt">Read the plain-text version</a> · <a href="/privacy/">Privacy</a> · <a href="/demo-terms/">Demo terms</a></p></section>
  </InfoPage>;
}
