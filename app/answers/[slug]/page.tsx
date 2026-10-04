import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnswerPage } from "@/components/studio/answers/answer-page";
import { ANSWERS, UPDATED_ISO, answerBySlug } from "@/components/studio/answers/content";
import { pageMeta } from "@/components/studio/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return ANSWERS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const answer = answerBySlug((await params).slug);
  if (!answer) return {};
  return pageMeta({
    title: `${answer.title} — Digital Macaroni`,
    shareTitle: answer.title,
    description: answer.description,
    path: `/answers/${answer.slug}/`,
    ownImage: true,
    type: "article",
    published: UPDATED_ISO,
  });
}

export default async function AnswerRoute({ params }: { params: Promise<{ slug: string }> }) {
  const answer = answerBySlug((await params).slug);
  if (!answer) notFound();
  return <AnswerPage answer={answer} />;
}
