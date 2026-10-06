import type { Metadata } from "next";
import Image from "next/image";
import { Agents } from "@/components/studio/agents";
import { ArrowDown, Check } from "@/components/studio/icons";
import { CookieSettings } from "@/components/studio/consent";
import { pageMeta } from "@/components/studio/site";
import { ContactForm } from "../contact/ContactForm";
import h from "@/components/studio/home.module.css";
import c from "@/components/studio/contact.module.css";
import t from "@/components/studio/try.module.css";

/** The link-in-bio page for TikTok, Instagram, YouTube and Facebook: call a demo, or ask for one. Kept out of search; the homepage covers the same ground. */
export const metadata: Metadata = {
  ...pageMeta({
    title: "Call a live AI agent — Digital Macaroni",
    shareTitle: "Call a live AI agent and watch it work",
    description: "Call one of three live AI voice agents from your phone and watch the screen fill in as it talks. Then tell us what your business needs.",
    path: "/try/",
  }),
  robots: { index: false, follow: true },
};

export default function TryPage() {
  return (
    <div className={h.page}>
      <header className={t.top}>
        <a href="/" className={c.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
        <a href="#ask" className={c.back}>Get one built<ArrowDown size={14} /></a>
      </header>

      <main id="content">
        <section className={t.demos} aria-labelledby="try-title">
          <div className={t.head}>
            <span className={t.eyebrow}><i />Live demos</span>
            <h1 id="try-title">Call an AI agent. <span>Watch it work.</span></h1>
            <p>Pick one and call it from your phone. The screen fills in as it talks: the booking, the stock check, the flight search.</p>
          </div>
          <div className={t.agents}><Agents /></div>
        </section>

        <section id="ask" className={`${c.sheet} ${t.ask}`} aria-labelledby="ask-title">
          <div className={c.copy}>
            <h2 id="ask-title">Want one for your business?</h2>
            <p>Tell us about your calls and what should happen on them. We reply by email.</p>
            <ul>
              <li><Check size={15} />Built around the tools you already use</li>
              <li><Check size={15} />Only says what you’ve approved</li>
              <li><Check size={15} />Always a way through to a person</li>
            </ul>
          </div>
          <div className={c.formCard}><ContactForm /></div>
        </section>
      </main>

      <footer className={c.foot}>
        <a href="/">Digital Macaroni</a>
        <a href="/privacy/">Privacy</a>
        <a href="/demo-terms/">Demo terms</a>
        <CookieSettings />
      </footer>
    </div>
  );
}
