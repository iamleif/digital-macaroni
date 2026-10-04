import type { Metadata } from "next";
import { pageMeta } from "@/components/studio/site";
import { AnswersHub } from "@/components/studio/answers/answer-page";

export const metadata: Metadata = pageMeta({
  title: "Answers about AI phone agents — Digital Macaroni",
  shareTitle: "Straight answers about AI phone agents",
  description: "Straight answers about AI phone agents: what they cost, what they do for home services, law firms, vet clinics, auto shops and roofers, and how they handle the details.",
  path: "/answers/",
});

export default function AnswersIndex() {
  return <AnswersHub />;
}
