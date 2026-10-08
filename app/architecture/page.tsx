import type { Metadata } from "next";
import { ArchitectureHub } from "@/components/studio/agent-pages/architecture-hub";
import { pageMeta } from "@/components/studio/site";

export const metadata: Metadata = pageMeta({
  title: "Voice Agent Architecture Compared · Digital Macaroni",
  shareTitle: "Voice agent architecture, compared",
  description: "How AI voice agents are built: speech-to-speech, managed voice platforms and STT-LLM-TTS cascades. Compare speed, voices and cost, and call a demo of each.",
  path: "/architecture/",
});

export default function ArchitectureIndexPage() {
  return <ArchitectureHub />;
}
