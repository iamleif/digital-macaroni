import Image from "next/image";
import { CookieSettings } from "./consent";
import { Places } from "./location";
import h from "./home.module.css";

/** Top bar for the homepage and the full-width pages built from its sheets (pricing, consulting). */
export function StudioNav({ home = false }: { home?: boolean }) {
  const at = home ? "" : "/";
  return <header className={h.nav}>
    <a href={home ? "#" : "/"} className={h.brand} aria-label="Digital Macaroni home"><Image unoptimized src="/studio/macaroni.png" alt="" width={30} height={30} priority />Digital Macaroni</a>
    <nav aria-label="Studio navigation" className={h.navLinks}>
      <a href={`${at}#agents`}>Voice demos</a>
      <a href={`${at}#services`}>Services</a>
      <a href="/pricing/">Pricing</a>
      <a href="/consulting/">Consulting</a>
      <a href="/answers/">Answers</a>
    </nav>
    <a className={h.navCta} href="/contact/">Let’s talk</a>
  </header>;
}

export function StudioFooter() {
  return <footer className={h.footer}>
    <a href="/" className={h.brand}><Image unoptimized src="/studio/macaroni.png" alt="" width={26} height={26} />Digital Macaroni</a>
    <nav aria-label="Site information" className={h.footerLinks}>
      <a href="/about/">About</a>
      <a href="/pricing/">Pricing</a>
      <a href="/consulting/">Consulting</a>
      <a href="/answers/">Answers</a>
      <a href="/missed-call-calculator/">Missed call calculator</a>
      <a href="/architecture/">Architecture</a>
      <a href="/privacy/">Privacy</a>
      <a href="/demo-terms/">Demo terms</a>
      <CookieSettings />
    </nav>
    <div className={h.footerPlaces}><Places /></div>
    <a href="/llm-info.txt" className={h.footerAi}><span aria-hidden="true">👋</span> Hey AI, learn about us</a>
    <p className={h.footerCopy}>© 2026 Digital Macaroni</p>
  </footer>;
}
