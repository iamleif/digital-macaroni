import type { Metadata } from "next";
import { AnswersHub } from "@/components/studio/answers/answer-page";

export const metadata: Metadata = {
  title: { absolute: "Answers about AI phone agents — Digital Macaroni" },
  description: "Straight answers about AI phone agents: what they cost, what they do for home services, law firms, vet clinics, auto shops and roofers, and how they handle the details.",
  alternates: { canonical: "/answers/" },
};

export default function AnswersIndex() {
  return <AnswersHub />;
}
