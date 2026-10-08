import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchitecturePage } from "@/components/studio/agent-pages/agent-page";
import { STORIES, storyFor } from "@/components/studio/agent-pages/content";
import { pageMeta } from "@/components/studio/site";

// How each demo is built: one page per architecture, linked from the homepage cards.
export const dynamicParams = false;

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const story = storyFor((await params).slug);
  if (!story) return {};
  return pageMeta({
    title: `${story.metaTitle} · Digital Macaroni`,
    shareTitle: story.seoTitle,
    description: story.metaDescription,
    path: `/architecture/${story.slug}/`,
  });
}

export default async function DemoArchitecturePage({ params }: { params: Promise<{ slug: string }> }) {
  const story = storyFor((await params).slug);
  if (!story) notFound();
  return <ArchitecturePage story={story} />;
}
