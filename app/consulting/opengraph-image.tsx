import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const alt = "Voice AI consulting from Digital Macaroni";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    title: "Voice AI consulting for your next big build.",
    sub: "Voice in your product, phones and support moved to AI agents, build reviews and hands-on sprints. Days on site or months alongside your team.",
  });
}
