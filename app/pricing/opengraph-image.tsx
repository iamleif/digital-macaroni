import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "Digital Macaroni pricing: ready-made AI voice agents $3,000, custom from $6,000";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    title: "AI voice agents from $3,000. Custom from $6,000.",
    sub: "Running plans from $249/mo, or self-host on your own accounts. You know the full cost before any work begins.",
  });
}
