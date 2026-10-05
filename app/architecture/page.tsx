import type { Metadata } from "next";
import { ArchitectureHub } from "@/components/studio/agent-pages/architecture-hub";
import { pageMeta } from "@/components/studio/site";

export const metadata: Metadata = pageMeta({
  title: "Voice agent architecture: speech-to-speech, voice platforms and cascades compared · Digital Macaroni",
  shareTitle: "Voice agent architecture, compared",
  description: "How AI voice agents are built: speech-to-speech models, managed voice platforms and speech-to-text, LLM and text-to-speech cascades. Compare speed, accuracy, voices and cost, and call a live demo of each.",
  path: "/architecture/",
});

export default function ArchitectureIndexPage() {
  return <ArchitectureHub />;
}
