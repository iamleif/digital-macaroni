import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";
import { voiceDemos } from "@/components/studio/live/demo-info";
import type { DemoId } from "@/components/studio/live/types";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";
export const alt = "A live AI voice agent demo from Digital Macaroni";

export function generateStaticParams() {
  return Object.keys(voiceDemos).map((demo) => ({ demo }));
}

export default async function Image({ params }: { params: Promise<{ demo: string }> }) {
  const demo = voiceDemos[(await params).demo as DemoId];
  return ogCard({
    kicker: `Live demo · ${demo.name}`,
    title: `${demo.job}. Call the live demo.`,
    sub: "One of three example builds. Call from any phone and watch every step on screen.",
    agent: { name: demo.agentName, business: demo.name, status: "Live agent", lineLabel: "Try saying", line: demo.prompts[0] },
    footer: `${demo.name} is a fictional business. The agent is live.`,
  });
}
