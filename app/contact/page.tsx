import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Check } from "@/components/studio/icons";
import c from "@/components/studio/contact.module.css";
import { CookieSettings } from "@/components/studio/consent";
import { JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = pageMeta({
  title: "Contact — Digital Macaroni",
  shareTitle: "Tell Digital Macaroni what your business needs",
  description: "Tell Digital Macaroni about your business and the calls you get. AI voice agents that get to work and grow your revenue, and consulting for bigger projects.",
  path: "/contact/",
});

export default function ContactPage() {
  return (
    <div className={c.page}>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "ContactPage", url: `${SITE}/contact/`, name: "Contact Digital Macaroni", description: metadata.description, isPartOf: { "@id": `${SITE}/#website` }, about: ORG_REF, mainEntity: ORG_REF },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE}/contact/` }] },
      ]} />
      <header className={c.top}>
        <a href="/" className={c.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
        <a href="/" className={c.back}>Back to the studio<ArrowUpRight size={14} /></a>
      </header>
      <main id="content" className={c.sheet}>
        <section className={c.copy} aria-labelledby="contact-title">
          <h1 id="contact-title">Let’s make something useful.</h1>
          <p>A new idea, a tricky workflow, or something you wish worked better. Tell us what’s on your mind and we’ll figure out the right thing to make.</p>
          <ul>
            <li><Check size={15} />AI voice agents that answer every call and do the work</li>
            <li><Check size={15} />Consulting on bigger projects, scoped together</li>
            <li><Check size={15} />A clear proposal with scope and timeline before any work begins</li>
          </ul>
        </section>
        <div className={c.formCard}><ContactForm /></div>
      </main>
      <footer className={c.foot}>
        <a href="/privacy/">Privacy</a>
        <a href="/demo-terms/">Demo terms</a>
        <CookieSettings />
        <span>© 2026 Digital Macaroni</span>
      </footer>
    </div>
  );
}
