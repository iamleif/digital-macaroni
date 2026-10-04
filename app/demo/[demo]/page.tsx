import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPage } from "@/components/studio/demo/demo-page";
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
  return {
    title: { absolute: `${demo.agentName} at ${demo.name} · Live voice demo · Digital Macaroni` },
    description: demo.intro,
    alternates: { canonical: `/demo/${id}/` },
  };
}

export default async function LiveDemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const demo = voiceDemos[(await params).demo as DemoId];
  if (!demo) notFound();
  return <DemoPage demo={demo} />;
}
