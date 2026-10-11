import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Check } from "@/components/studio/icons";
import c from "@/components/studio/contact.module.css";
import { CookieSettings } from "@/components/studio/consent";
import { pageMeta } from "@/components/studio/site";
import { InstantForm } from "@/components/studio/factory/InstantForm";

export const metadata: Metadata = pageMeta({
  title: "Hear your own AI voice agent — Digital Macaroni",
  shareTitle: "Get a call from an AI agent that knows your business",
  description: "Give us your website and your number. In seconds, an AI voice agent that has read your website calls you. Play a customer and hear how it would answer your calls.",
  path: "/your-agent/",
});

export default function YourAgentPage() {
  return (
    <div className={c.page}>
      <header className={c.top}>
        <a href="/" className={c.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
        <a href="/pricing/" className={c.back}>Pricing<ArrowUpRight size={14} /></a>
      </header>
      <main id="content" className={c.sheet}>
        <section className={c.copy} aria-labelledby="your-agent-title">
          <h1 id="your-agent-title">Hear your own agent. In 20 seconds.</h1>
          <p>Give us your website and your mobile. An AI agent reads your site and calls you. Play one of your customers and hear how it would answer your calls.</p>
          <ul>
            <li><Check size={15} />Answers from what’s on your website</li>
            <li><Check size={15} />Takes a message like your best front desk</li>
            <li><Check size={15} />Texts you the call summary when you hang up</li>
          </ul>
        </section>
        <div className={c.formCard}><InstantForm /></div>
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
