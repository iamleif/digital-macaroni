import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPage } from "@/components/studio/demo/demo-page";
import { JsonLd, ORG_REF, SITE, pageMeta } from "@/components/studio/site";
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
    description: demo.seoDescription ?? demo.intro,
    path: `/demo/${id}/`,
    ownImage: true,
  });
}

export default async function LiveDemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const demo = voiceDemos[(await params).demo as DemoId];
  if (!demo) notFound();
  const url = `${SITE}/demo/${demo.id}/`;
  return <>
    <JsonLd data={[
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        url,
        name: `${demo.agentName} at ${demo.name}: live AI voice agent demo`,
        description: demo.intro,
        isPartOf: { "@id": `${SITE}/#website` },
        publisher: ORG_REF,
        about: {
          "@type": "SoftwareApplication",
          name: `${demo.agentName}, an AI voice agent for ${demo.name}`,
          description: `An example AI voice agent built by Digital Macaroni for a fictional business (${demo.role.toLowerCase()}). Call it from any phone and watch it work on screen.`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any phone",
          isAccessibleForFree: true,
          creator: ORG_REF,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Voice demos", item: `${SITE}/#agents` },
          { "@type": "ListItem", position: 3, name: demo.name, item: url },
        ],
      },
    ]} />
    <DemoPage demo={demo} />
  </>;
}
