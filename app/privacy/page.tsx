import type { Metadata } from "next";
import { pageMeta } from "@/components/studio/site";
import { InfoPage } from "@/components/studio/info-page";

export const metadata: Metadata = pageMeta({
  title: "Privacy — Digital Macaroni",
  description: "How Digital Macaroni handles enquiries, demo phone calls, and website information.",
  path: "/privacy/",
});

export default function PrivacyPage() {
  return <InfoPage title="Privacy." intro="How we handle your information when you visit our website, contact us, or call a voice demo." updated="October 10, 2026">
    <section><h2>Contacting us</h2><p>Digital Macaroni is responsible for your information on this site. When you get in touch, we use your name, email address, and message to answer your enquiry and discuss your project. This supports our legitimate interest in responding to enquiries or takes steps towards an agreement at your request.</p></section>
    <section><h2>Demo phone calls</h2><p>Our voice demos are reached by phone. The website shows a short screen code so the demo page can follow your call; the website never accesses your microphone.</p><p>During a call, your voice, your phone number, call details, and the information you share are processed by telephone, voice, and AI service providers so the agent can understand and respond. Please use the sample details provided and avoid sharing sensitive personal information. You can hang up at any time.</p><p>We keep a written transcript of each demo call, with what the agent did during it, for 30 days so we can review and improve the demos. After 30 days it is deleted automatically. We don&rsquo;t keep audio recordings of demo calls.</p><p>A demo agent can email you a confirmation, such as a flight itinerary, if you ask for one and give an address. We use that address only to send that one email, through our email provider, and we don&rsquo;t keep it.</p></section>
    <section><h2>Website data and cookies</h2><p>Basic technical information, such as your IP address and browser details, is processed to deliver and protect the website, based on our legitimate interest in keeping it secure and working.</p><p>With your consent, we use Google Analytics, Grain and PostHog to understand how visitors use the site so we can improve it. PostHog can record how a page is used, but never what you type into a form. These tools load only after you say yes, and you can change your answer at any time with Cookie settings at the bottom of every page. We don’t use advertising cookies. See our <a href="/cookies/">cookie policy</a>.</p></section>
    <section><h2>Sharing and keeping information</h2><p>We use service providers for website hosting, email, telephony, voice and AI processing, and, if you consent, analytics. They receive the information needed to provide those services. We do not sell your personal information.</p><p>We keep enquiry information for as long as needed to respond, follow up, and meet relevant business or legal obligations. Our individual products have their own privacy notices.</p></section>
    <section><h2>Your rights</h2><p>You can ask to access, correct, or delete your information. Depending on the applicable law, you can also request a portable copy, restrict processing, or object to it. Where processing relies on consent, you can withdraw it. You can complain to your data-protection authority.</p><p>For privacy questions or requests, reach us through our <a href="/contact/">contact page</a>.</p></section>
  </InfoPage>;
}
