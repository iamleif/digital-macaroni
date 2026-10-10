import type { Metadata } from "next";
import { CookieSettings } from "@/components/studio/consent";
import { InfoPage } from "@/components/studio/info-page";
import { pageMeta } from "@/components/studio/site";

export const metadata: Metadata = pageMeta({
  title: "Cookie policy — Digital Macaroni",
  description: "Which cookies Digital Macaroni uses, why, and how to change your choice.",
  path: "/cookies/",
});

export default function CookiesPage() {
  return <InfoPage title="Cookie policy." intro="Which cookies and browser storage this site uses, and how to change your choice." updated="October 10, 2026">
    <section>
      <h2>Your choice</h2>
      <p>On your first visit we ask whether we can use analytics cookies. If you say no, or don’t answer, no analytics tools load and nothing is stored for analytics. If you say yes, Google Analytics, Grain and PostHog load on the pages you visit.</p>
      <p>You can change your answer at any time with <CookieSettings /> at the bottom of every page. If you switch to no, we remove what these tools stored in your browser.</p>
    </section>
    <section>
      <h2>Always on</h2>
      <p>One essential setting remembers your choice, so we don’t ask on every page. For the current browser tab only, the site also notes which link or page your visit started from; it is sent along with analytics only if you say yes, and it is gone when you close the tab.</p>
    </section>
    <section>
      <h2>Analytics, only if you say yes</h2>
      <p>We use Google Analytics, Grain and PostHog to understand how visitors find and use the site, so we can improve it. PostHog can record how a page is used (clicks, scrolling, what is shown), never what you type into a form. They may store cookies or similar data in your browser for up to two years. We don’t use them for advertising, and they may process data outside Europe, including in the United States.</p>
    </section>
    <section>
      <h2>Questions</h2>
      <p>See our <a href="/privacy/">privacy policy</a> for how we handle your information and your rights, or reach us through our <a href="/contact/">contact page</a>.</p>
    </section>
  </InfoPage>;
}
