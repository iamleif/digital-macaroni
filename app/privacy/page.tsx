import type { Metadata } from "next";
import { pageMeta } from "@/components/studio/site";
import { InfoPage } from "@/components/studio/info-page";

export const metadata: Metadata = pageMeta({
  title: "Privacy — Digital Macaroni",
  description: "How Digital Macaroni handles enquiries, demo phone calls, and website information.",
  path: "/privacy/",
});

export default function PrivacyPage() {
  return <InfoPage title="Privacy." intro="How we handle your information when you visit our website, contact us, or call a voice demo." updated="October 4, 2026">
    <section><h2>Contacting us</h2><p>Digital Macaroni is responsible for your information on this site. When you get in touch, we use your name, email address, and message to answer your enquiry and discuss your project. This supports our legitimate interest in responding to enquiries or takes steps towards an agreement at your request.</p></section>
    <section><h2>Demo phone calls</h2><p>Our voice demos are reached by phone. The website shows a short screen code so the demo page can follow your call; the website never accesses your microphone.</p><p>During a call, your voice, your phone number, call details, and the information you share are processed by telephone, voice, and AI service providers so the agent can understand and respond. Please use the sample details provided and avoid sharing sensitive personal information. You can hang up at any time.</p><p>A demo agent can email you a confirmation, such as a flight itinerary, if you ask for one and give an address. We use that address only to send that one email, through our email provider, and we don&rsquo;t keep it.</p></section>
    <section><h2>Website data and cookies</h2><p>We do not use advertising or analytics cookies on this site. Basic technical information, such as your IP address and browser details, is processed to deliver and protect the website, based on our legitimate interest in keeping it secure and working.</p></section>
    <section><h2>Sharing and keeping information</h2><p>We use service providers for website hosting, email, telephony, and voice and AI processing. They receive the information needed to provide those services. We do not sell your personal information.</p><p>We keep enquiry information for as long as needed to respond, follow up, and meet relevant business or legal obligations. Our individual products have their own privacy notices.</p></section>
    <section><h2>Your rights</h2><p>You can ask to access, correct, or delete your information. Depending on the applicable law, you can also request a portable copy, restrict processing, or object to it. Where processing relies on consent, you can withdraw it. You can complain to your data-protection authority.</p><p>For privacy questions or requests, email <a href="mailto:hello@digitalmacaroni.io">hello@digitalmacaroni.io</a>.</p></section>
  </InfoPage>;
}
