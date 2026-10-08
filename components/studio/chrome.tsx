import Image from "next/image";
import { CookieSettings } from "./consent";
import { Facebook, Instagram, LinkedIn, Sparkle, TikTok, YouTube } from "./icons";
import { COMPANY_FACEBOOK, COMPANY_INSTAGRAM, COMPANY_LINKEDIN, COMPANY_TIKTOK, COMPANY_YOUTUBE } from "./site";
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

const socials = [
  { name: "YouTube", href: COMPANY_YOUTUBE, icon: <YouTube size={17} /> },
  { name: "LinkedIn", href: COMPANY_LINKEDIN, icon: <LinkedIn size={15} /> },
  { name: "TikTok", href: COMPANY_TIKTOK, icon: <TikTok size={15} /> },
  { name: "Instagram", href: COMPANY_INSTAGRAM, icon: <Instagram size={15} /> },
  { name: "Facebook", href: COMPANY_FACEBOOK, icon: <Facebook size={15} /> },
];

const ASK_AI_PROMPT = "Summarize what Digital Macaroni (digitalmacaroni.io) does and who it's for: the AI agents, software and automations it builds, and how they take action inside a business's workflows. Use https://digitalmacaroni.io/llm-info.txt and https://digitalmacaroni.io/llms.txt as sources.";
/** Each assistant opens with the prompt above; icon file in /studio/ai/. */
const askAi: [string, string, string][] = [
  ["chatgpt.png", "ChatGPT", `https://chatgpt.com/?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["claude.png", "Claude", `https://claude.ai/new?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["gemini.png", "Gemini", `https://gemini.google.com/app?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["google.svg", "Google AI Mode", `https://www.google.com/search?udm=50&q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["perplexity.png", "Perplexity", `https://www.perplexity.ai/search?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
  ["grok.png", "Grok", `https://grok.com/?q=${encodeURIComponent(ASK_AI_PROMPT)}`],
];

/** Social links and the "Ask AI about us" icons, just above the footer. */
export function StudioAskBand() {
  return <section className={h.askAi} aria-labelledby="ask-ai-heading">
    <nav aria-label="Digital Macaroni on social media" className={h.socials}>
      {socials.map((s) => <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer">{s.icon}{s.name}</a>)}
    </nav>
    <div className={h.askAiGroup}>
      <h2 id="ask-ai-heading" className={h.askAiHeading}><Sparkle size={15} />Ask AI about Digital Macaroni</h2>
      <div className={h.askAiIcons}>{askAi.map(([file, name, href]) => <a key={file} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ask ${name} about Digital Macaroni`} title={name}><Image unoptimized src={`/studio/ai/${file}`} alt="" width={36} height={36} /></a>)}</div>
    </div>
  </section>;
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
