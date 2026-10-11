import { voiceDemos } from "./live/demo-info";
import type { DemoId } from "./live/types";
import { LivePreview } from "./live-previews";
import { architecturePath } from "./agent-pages/content";
import { ArrowRight, Check } from "./icons";
import { Reveal } from "./reveal";
import h from "./home.module.css";

/** How each agent is presented on the homepage. */
/** Only the homepage lineup has a persona; other demos (hotels, real estate, insurance, salon, clinic) are reached from their own pages. */
type HomeDemo = Exclude<DemoId, "hotels" | "realestate" | "insurance" | "lune" | "tidewell" | "dealership">;
const PERSONAS: Record<HomeDemo, { tone: string; label: string; bullets: string[]; title: string; industries: string; pitch: string }> = {
  northline: {
    label: "Appointments",
    title: "Booking an appointment by phone.",
    pitch: "Choose your kind of business, call the example, and watch the agent work the schedule on screen.",
    bullets: ["Checks the real schedule instead of guessing", "Books a time, then moves it when the caller changes their mind", "Takes a message when nothing fits"],
    industries: "",
    tone: "blue",
  },
  formfield: {
    label: "Stock and orders",
    title: "Answering questions about products and orders.",
    pitch: "Choose your kind of business, call the example, and ask about an item or an order. The agent looks it up while you talk.",
    bullets: ["Looks up live stock and product details", "Holds an item for pickup", "Answers an order question once the caller is verified"],
    industries: "",
    tone: "sage",
  },
  lawfirm: {
    label: "New clients and leads",
    title: "Taking in a new client or lead.",
    pitch: "Choose your kind of business, call the example, and watch the record fill in as the caller talks.",
    bullets: ["Fills in the record: what happened, details, who’s involved", "Checks for conflicts and sizes up the lead", "Books the next step and creates the follow-up tasks"],
    industries: "",
    tone: "navy",
  },
  travel: {
    label: "Longer bookings",
    title: "Booking something with several steps.",
    pitch: "Call the example and watch the agent search live prices and build the booking one step at a time.",
    bullets: ["Searches live prices and explains the options", "Adds the extras, one at a time", "Reads everything back before going ahead"],
    industries: "",
    tone: "sand",
  },
};

/** The examples shown on the homepage, in order. */
const LINEUP: HomeDemo[] = ["northline", "formfield", "lawfirm", "travel"];

function Example({ id, index }: { id: HomeDemo; index: number }) {
  const p = PERSONAS[id];
  return <Reveal as="article" className={index % 2 ? `${h.ex} ${h.exFlip}` : h.ex}>
    <a className={h.exStageLink} href={`/demo/${id}/`} target="_blank" rel="noopener" aria-label={`${p.title}. Try the live example (opens in a new tab)`}>
      <div className={`${h.agentStage} ${h.exStage}`} data-tone={p.tone}>
        <div className={h.fragWrap} aria-hidden="true"><LivePreview id={id} /></div>
      </div>
    </a>
    <div className={h.exText}>
      <small>Example · {p.label}</small>
      <h3>{p.title}</h3>
      <p className={h.exPitch}>{p.pitch}</p>
      <p className={h.exIn}>What happens in this example</p>
      <ul className={h.exList}>{p.bullets.map((b) => <li key={b}><Check size={14} />{b}</li>)}</ul>
      <div className={h.exActions}>
        <a className={h.exTry} href={`/demo/${id}/`} target="_blank" rel="noopener">Call this example<ArrowRight size={14} /></a>
        <a className={h.agentMore} href={architecturePath(id)}>How this one is built<ArrowRight size={14} /></a>
      </div>
    </div>
  </Reveal>;
}

/** The rest of what we build: not an example to call, so it is not a card to open. */
const MORE = ["Search and book travel", "Order status and returns", "Reminders and no-show follow-up", "Texting links, forms and confirmations", "Call back missed calls", "Take payments", "Hand off to a person", "Your own software, wired in"];

function MoreCard({ index }: { index: number }) {
  return <Reveal as="article" className={h.agentWide} delay={index * 90}>
    <div className={h.moreCard}>
      <small>And much more</small>
      <h3>Whatever your calls need to do.</h3>
      <p>The examples are starting points. Every agent is built around your business, your rules and the software you already use.</p>
      <ul>{MORE.map((m) => <li key={m}>{m}</li>)}</ul>
      <a href="/contact/">Tell us what you need<ArrowRight size={14} /></a>
    </div>
  </Reveal>;
}

export function Agents() {
  return <div className={h.exWrap}>
    {LINEUP.map((id, i) => <Example key={id} id={id} index={i} />)}
    <MoreCard index={LINEUP.length} />
  </div>;
}
