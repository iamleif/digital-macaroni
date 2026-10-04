import type { Metadata } from "next";
import { LinkedIn } from "@/components/studio/icons";
import { InfoPage } from "@/components/studio/info-page";
import { EMAIL, FOUNDER, FOUNDER_REF, JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";

export const metadata: Metadata = pageMeta({
  title: "About — Digital Macaroni",
  shareTitle: "Why Leif Johansen builds AI voice agents",
  description: "Digital Macaroni is Leif Johansen’s studio for AI voice agents. A motel front office, a career answering customers, and why the phone call is where businesses win or lose them.",
  path: "/about/",
  ownImage: true,
});

export default function AboutPage() {
  return <InfoPage title="Hi, I’m Leif." intro="I founded Digital Macaroni to build AI voice agents. I’m customer obsessed, and not in the corporate buzzword sense. This is why.">
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "AboutPage",
      url: `${SITE}/about/`,
      name: "About Digital Macaroni",
      about: ORG_REF,
      mainEntity: FOUNDER_REF,
    }} />
    <section>
      <h2>It started at a motel</h2>
      <p>I grew up in a small town in Washington State, where my parents owned the local motel. Every check-in, complaint and returning guest was a lesson in customer experience.</p>
      <p>This was before Google reviews, Yelp and AI search. A bad experience became a whisper that moved through town. My parents didn’t call it reputation management. They listened, fixed the problem and took care of the customer.</p>
    </section>
    <section>
      <h2>A career spent answering people</h2>
      <p>I’ve worked behind hotel desks, bartended, trained cabin crew, worked as a licensed real estate broker, run marketing and produced video. I have a bachelor’s degree in marketing and a master’s in film production.</p>
      <p>Every one of those jobs taught me something about people: what they need, what they notice, what earns their trust and what makes them tell someone else. Film taught me that how something sounds matters as much as what it says.</p>
    </section>
    <section>
      <h2>Today, the whisper is a one-star review</h2>
      <p>Technology has changed how quickly those experiences travel. The fundamentals haven’t changed at all.</p>
      <p>For most businesses, the phone is still where a customer first asks for help. It’s also where they’re most often let down: voicemail, hold music, a callback that never comes. And the review often starts with a call nobody answered.</p>
    </section>
    <section>
      <h2>What we build</h2>
      <p>Digital Macaroni builds AI voice agents that answer the way my parents ran that motel: listen, solve the problem, take care of the person. Every agent is built for one business, around its customers, its rules and its voice, and connected to the systems it already runs on. We build the dashboards and software around them too.</p>
      <p>We also run our own products: <a href="https://rankladder.app">RankLadder</a>, an AI receptionist for local service businesses, <a href="https://heyanders.com">Hey Anders</a> and <a href="https://twotop.app">TwoTop</a>.</p>
      <p>AI is how it works. Taking care of the customer is the point.</p>
    </section>
    <section>
      <h2>Say hello</h2>
      <p>The quickest way to see what we do is to <a href="/#agents">call one of our demo agents</a>. To talk about your business, <a href="/contact/">drop us a note</a> or write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
      <p>Digital Macaroni is based in Oslo, Norway. You can also find me on <a href={FOUNDER.linkedin} target="_blank" rel="noopener noreferrer me" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LinkedIn size={14} />LinkedIn</a>.</p>
    </section>
  </InfoPage>;
}
