import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "Digital Macaroni: AI voice agents that get to work";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    title: "AI voice agents that get to work",
    chip: { before: "AI voice agents", after: "that get to work." },
    sub: "Custom agents that answer your phone and get the job done.",
    agent: { name: "Ellie", business: "Northline", status: "On a call", lineLabel: "On the line", line: "Maya can be there between 2 and 4. Shall I book it?" },
  });
}
