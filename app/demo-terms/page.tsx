import type { Metadata } from "next";
import { pageMeta } from "@/components/studio/site";
import { InfoPage } from "@/components/studio/info-page";

export const metadata: Metadata = pageMeta({
  title: "Demo terms — Digital Macaroni",
  description: "What to expect when you call Digital Macaroni’s sample voice agents.",
  path: "/demo-terms/",
});

export default function DemoTermsPage() {
  return <InfoPage title="A demo, with clear boundaries." intro="These examples show how a phone conversation and a business’s software can work together." updated="October 4, 2026">
    <section><h2>Fictional businesses. Sample data.</h2><p>Northline, Form &amp; Field, and Waypoint Travel are fictional businesses. Their people, schedules, stock, orders, addresses, and customers are demonstration data. A demo booking does not reserve a real service, a demo reservation does not hold a real product, and nothing is sold, refunded, or charged.</p><p>Waypoint Travel’s fares come from an airline booking system’s test environment, so prices are illustrative. A Waypoint booking always stops before payment: no ticket is issued.</p></section>
    <section><h2>Use it to explore</h2><p>Try normal business questions and use the sample details provided. Do not share real payment information, health information, passwords, or someone else’s personal details. Do not use a demo for emergencies or rely on it for professional advice.</p><p>Automated responses can be wrong. The demos are for evaluation and make no commitments on behalf of a real business.</p></section>
    <section><h2>Calls and availability</h2><p>When you call a demo number, you are speaking to an AI agent. Your telephone provider’s normal calling charges can apply. Calls are processed by telephone, voice, and AI service providers, as described in our <a href="/privacy/">privacy notice</a>.</p><p>We can change, limit, or stop demo access at any time while we develop and maintain it.</p></section>
    <section><h2>Respectful use</h2><p>Do not overload the service, probe for other callers’ information, or use it for harassment, unlawful activity, or automated bulk calling.</p></section>
    <section><h2>Custom projects are agreed separately</h2><p>Trying a demo does not purchase a service or create a project agreement. Features, integrations, delivery, pricing, maintenance, and permitted actions for a client project are agreed separately in writing. Nothing here limits rights that cannot be excluded under applicable law.</p><p>For questions, reach us through our <a href="/contact/">contact page</a>.</p></section>
  </InfoPage>;
}
