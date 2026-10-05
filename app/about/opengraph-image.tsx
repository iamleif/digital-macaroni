import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "About Digital Macaroni: AI agents that take action inside real business workflows";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    kicker: "About Digital Macaroni",
    title: "AI agents that take action inside real business workflows.",
    sub: "Voice agents, software and automations that turn conversations into completed work.",
  });
}
