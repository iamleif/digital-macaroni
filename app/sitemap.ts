import type { MetadataRoute } from "next";
import { ANSWERS, UPDATED_ISO } from "@/components/studio/answers/content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://digitalmacaroni.io";

  return [
    {
      url: base,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...["northline", "formfield", "travel"].map((demo) => ({
      url: `${base}/demo/${demo}/`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${base}/contact`,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    { url: `${base}/answers/`, lastModified: UPDATED_ISO, changeFrequency: "monthly", priority: 0.8 },
    ...ANSWERS.map((x) => ({ url: `${base}/answers/${x.slug}/`, lastModified: UPDATED_ISO, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/llm-info/`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/demo-terms/`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
