import { OG_SIZE, OG_TYPE, ogCard } from "@/components/studio/og/card";
import { ANSWERS, CATEGORIES, answerBySlug } from "@/components/studio/answers/content";
import { FOUNDER } from "@/components/studio/site";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = "force-static";
export const alt = "A straight answer about AI phone agents from Digital Macaroni";

export function generateStaticParams() {
  return ANSWERS.map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const answer = answerBySlug((await params).slug)!;
  return ogCard({
    kicker: `Answers · ${CATEGORIES[answer.category].title}`,
    title: answer.title,
    footer: `By ${FOUNDER.name}, founder of Digital Macaroni · with sources`,
  });
}
