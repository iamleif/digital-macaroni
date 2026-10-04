import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnswerPage } from "@/components/studio/answers/answer-page";
import { ANSWERS, answerBySlug } from "@/components/studio/answers/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return ANSWERS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const answer = answerBySlug((await params).slug);
  if (!answer) return {};
  return {
    title: { absolute: `${answer.title} — Digital Macaroni` },
    description: answer.description,
    alternates: { canonical: `/answers/${answer.slug}/` },
    openGraph: { title: answer.title, description: answer.description, type: "article", url: `https://digitalmacaroni.io/answers/${answer.slug}/` },
  };
}

export default async function AnswerRoute({ params }: { params: Promise<{ slug: string }> }) {
  const answer = answerBySlug((await params).slug);
  if (!answer) notFound();
  return <AnswerPage answer={answer} />;
}
