import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";
export const alt = "Missed call calculator: what unanswered calls cost your business";

export default async function Image() {
  return ogCard({
    kicker: "Free tool · Missed call calculator",
    title: "What are missed calls costing your business?",
    footer: "Your numbers, ten seconds · Digital Macaroni",
  });
}
