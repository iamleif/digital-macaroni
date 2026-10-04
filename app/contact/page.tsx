import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Check } from "@/components/studio/icons";
import c from "@/components/studio/contact.module.css";
import { Location } from "@/components/studio/location";
import { pageMeta } from "@/components/studio/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = pageMeta({
  title: "Contact — Digital Macaroni",
  shareTitle: "Talk to Digital Macaroni about an AI voice agent",
  description: "Tell Digital Macaroni what your business needs: an AI voice agent, business software or an app. Ready-made agents from $2,500; custom from $5,000.",
  path: "/contact/",
});

export default function ContactPage() {
  return (
    <div className={c.page}>
      <header className={c.top}>
        <a href="/" className={c.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
        <a href="/" className={c.back}>Back to the studio<ArrowUpRight size={14} /></a>
      </header>
      <main id="content" className={c.sheet}>
        <section className={c.copy} aria-labelledby="contact-title">
          <h1 id="contact-title">Let’s make something useful.</h1>
          <p>A new idea, a tricky workflow, or something you wish worked better. Tell us what’s on your mind and we’ll figure out the right thing to make.</p>
          <ul>
            <li><Check size={15} />Voice agents, business software and apps</li>
            <li><Check size={15} />Ready-made agents from $2,500; custom from $5,000</li>
            <li><Check size={15} />Or email <a href="mailto:hello@digitalmacaroni.io">hello@digitalmacaroni.io</a></li>
          </ul>
        </section>
        <div className={c.formCard}><ContactForm /></div>
      </main>
      <footer className={c.foot}>
        <a href="/privacy/">Privacy</a>
        <a href="/demo-terms/">Demo terms</a>
        <Location />
        <span>© 2026 Digital Macaroni</span>
      </footer>
    </div>
  );
}
