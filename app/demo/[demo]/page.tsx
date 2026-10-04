import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPage } from "@/components/studio/demo/demo-page";
import { pageMeta } from "@/components/studio/site";
import { voiceDemos } from "@/components/studio/live/demo-info";
import type { DemoId } from "@/components/studio/live/types";

// One live demo page per fictional business, opened from the homepage cards.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(voiceDemos).map((demo) => ({ demo }));
}

export async function generateMetadata({ params }: { params: Promise<{ demo: string }> }): Promise<Metadata> {
  const { demo: id } = await params;
  const demo = voiceDemos[id as DemoId];
  if (!demo) return {};
  return pageMeta({
    title: `${demo.agentName} at ${demo.name} · Live voice demo · Digital Macaroni`,
    shareTitle: `Call ${demo.agentName}, a live AI voice agent · Digital Macaroni`,
    description: demo.intro,
    path: `/demo/${id}/`,
    ownImage: true,
  });
}

export default async function LiveDemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const demo = voiceDemos[(await params).demo as DemoId];
  if (!demo) notFound();
  return <DemoPage demo={demo} />;
}
