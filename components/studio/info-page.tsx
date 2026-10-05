import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowUpRight, Sparkle } from "./icons";
import { CookieSettings } from "./consent";
import i from "./info.module.css";

/** Plain reading pages (privacy, demo terms, information for AI) in the studio's style. */
export function InfoPage({ title, intro, updated, children }: { title: string; intro: string; updated?: string; children: ReactNode }) {
  return <div className={i.page}>
    <header className={i.top}>
      <a href="/" className={i.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
      <a href="/" className={i.back}>Back to the studio<ArrowUpRight size={14} /></a>
    </header>
    <main id="content" className={i.sheet}>
      <h1>{title}</h1>
      <p className={i.intro}>{intro}</p>
      {updated ? <p className={i.date}>Updated {updated}</p> : <div className={i.spacer} />}
      {children}
    </main>
    <footer className={i.foot}>
      <a href="/about/">About</a>
      <a href="/llm-info.txt"><Sparkle size={14} />Hey AI, learn about Digital Macaroni</a>
      <a href="/privacy/">Privacy</a>
      <a href="/demo-terms/">Demo terms</a>
      <CookieSettings />
      <span>© 2026 Digital Macaroni</span>
    </footer>
  </div>;
}
