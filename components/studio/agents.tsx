import type { ReactNode } from "react";
import { voiceDemos } from "./live/demo-info";
import type { DemoId } from "./live/types";
import { FormFieldPreview, NorthlinePreview, WaypointPreview } from "./agent-previews";
import { architecturePath } from "./agent-pages/content";
import { BrandLockup } from "./brand-marks";
import { ArrowRight, ArrowUpRight, Phone } from "./icons";
import { Reveal } from "./reveal";
import h from "./home.module.css";

/** How each agent is presented on the homepage. */
const PERSONAS: Record<DemoId, { tone: string; preview: ReactNode; voice: string; pitch: string }> = {
  northline: {
    tone: "blue",
    preview: <NorthlinePreview />,
    voice: "gentle and reassuring voice",
    pitch: "Books service visits from real availability, moves them when plans change, and takes a message when nothing fits.",
  },
  formfield: {
    tone: "sage",
    preview: <FormFieldPreview />,
    voice: "polished and personable voice",
    pitch: "Finds the right piece, checks what’s actually in stock, reserves it for pickup and answers order questions.",
  },
  travel: {
    tone: "sand",
    preview: <WaypointPreview />,
    voice: "friendly and efficient voice",
    pitch: "Searches live airline fares, explains the options and the fine print, and walks you right up to booking.",
  },
};

const callWave = [5, 9, 6, 11, 8, 12, 6, 9, 5];

function AgentCard({ id, index }: { id: DemoId; index: number }) {
  const demo = voiceDemos[id];
  const p = PERSONAS[id];
  const href = `/demo/${id}/`;
  return <Reveal as="article" className={h.agent} delay={index * 90}>
    <a className={h.agentLink} href={href} target="_blank" rel="noopener" aria-label={`${demo.job}: ${demo.agentName} at ${demo.name}. Open the live demo (opens in a new tab)`}>
    <div className={h.agentStage} data-tone={p.tone}>
      <div className={h.stageTop}>
        <BrandLockup id={id} />
        <span className={h.livePill}><i />Live demo</span>
      </div>
      <div className={h.fragWrap} aria-hidden="true">{p.preview}</div>
      <div className={h.callChip} aria-hidden="true">
        <span className={h.callOrb} />
        <span><b>{demo.agentName}</b><small>On a call</small></span>
        <span className={h.callWave}>{callWave.map((v, i) => <i key={i} style={{ height: v, animationDelay: `${i * -0.15}s` }} />)}</span>
      </div>
    </div>
    <div className={h.agentInfo}>
      <div className={h.agentTitle}>
        <h3>{demo.job}</h3>
        <span className={h.agentArrow} aria-hidden="true"><ArrowUpRight size={16} /></span>
      </div>
      <p className={h.agentAs}>Answers as {demo.agentName} · {p.voice}</p>
      <p className={h.agentPitch}>{p.pitch}</p>
      <dl className={h.specs}>
        <div><dt><Phone size={14} />Try it</dt><dd>Call from any phone</dd></div>
      </dl>
    </div>
    </a>
    <a className={h.agentMore} href={architecturePath(id)}>How it’s built<ArrowRight size={14} /></a>
  </Reveal>;
}

export function Agents() {
  return <div className={h.agentGrid}>
    {(Object.keys(voiceDemos) as DemoId[]).map((id, i) => <AgentCard key={id} id={id} index={i} />)}
  </div>;
}
