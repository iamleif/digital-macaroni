import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "About Digital Macaroni: AI voice agents that do the work";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    kicker: "About Digital Macaroni",
    title: "AI voice agents that do the work.",
    sub: "They answer every call, book the job, update your systems and hand off to your team.",
  });
}
