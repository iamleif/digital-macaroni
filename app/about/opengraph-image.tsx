import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "About Digital Macaroni and its founder, Leif Johansen";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    kicker: "About · Leif Johansen, founder",
    title: "Customer obsessed. That’s why we build AI voice agents.",
    sub: "From his parents’ small-town motel to agents that answer every call.",
    footer: "Digital Macaroni · Oslo, Norway",
  });
}
