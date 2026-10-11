import type { Metadata } from "next";
import Image from "next/image";
import { Check } from "@/components/studio/icons";
import c from "@/components/studio/contact.module.css";
import { pageMeta } from "@/components/studio/site";
import { OnboardForm } from "@/components/studio/factory/OnboardForm";

/** Client setup, opened from the signed link Digital Macaroni sends after a deal. Kept out of search. */
export const metadata: Metadata = {
  ...pageMeta({
    title: "Set up your AI voice agent — Digital Macaroni",
    shareTitle: "Set up your AI voice agent",
    description: "Tell us about your business and your agent goes live on its own local number in minutes.",
    path: "/start/",
  }),
  robots: { index: false, follow: false },
};

export default function StartPage() {
  return (
    <div className={c.page}>
      <header className={c.top}>
        <a href="/" className={c.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
      </header>
      <main id="content" className={c.sheet}>
        <section className={c.copy} aria-labelledby="start-title">
          <h1 id="start-title">Let’s get your agent answering.</h1>
          <p>One form. We read your website, build your agent, and give it a local number. It’s live in a few minutes.</p>
          <ul>
            <li><Check size={15} />Answers your callers from what you’ve told it</li>
            <li><Check size={15} />Takes messages and texts your booking link</li>
            <li><Check size={15} />A text and an email to you after every call</li>
          </ul>
        </section>
        <div className={c.formCard}><OnboardForm /></div>
      </main>
      <footer className={c.foot}>
        <a href="/privacy/">Privacy</a>
        <a href="/contact/">Help</a>
      </footer>
    </div>
  );
}
