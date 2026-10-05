import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "Digital Macaroni: AI agents that take action inside real business workflows";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    title: "AI agents that take action inside real business workflows",
    chip: { before: "AI agents", after: "that take action inside real business workflows." },
    sub: "Voice agents, software and automations that turn conversations into completed work.",
    agent: { name: "Ellie", business: "Northline", status: "On a call", lineLabel: "On the line", line: "Maya can be there between 2 and 4. Shall I book it?" },
  });
}
