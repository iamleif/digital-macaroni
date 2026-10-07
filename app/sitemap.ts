import type { MetadataRoute } from "next";
import { ANSWERS, UPDATED_ISO } from "@/components/studio/answers/content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://digitalmacaroni.io";

  // Bump when a page's content changes; answers carry their own date.
  const updated = "2026-10-05";

  return [
    { url: `${base}/`, lastModified: "2026-10-07", changeFrequency: "monthly", priority: 1 },
    ...["northline", "formfield", "travel"].map((demo) => ({
      url: `${base}/demo/${demo}/`,
      lastModified: updated,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${base}/architecture/`, lastModified: "2026-10-05", changeFrequency: "monthly", priority: 0.8 },
    ...["speech-to-speech", "managed-voice-platform", "stt-llm-tts-cascade"].map((slug) => ({
      url: `${base}/architecture/${slug}/`,
      lastModified: "2026-10-05",
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/about/`, lastModified: updated, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/contact/`, lastModified: updated, changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/missed-call-calculator/`, lastModified: "2026-10-07", changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/answers/`, lastModified: UPDATED_ISO, changeFrequency: "monthly", priority: 0.8 },
    ...ANSWERS.map((x) => ({ url: `${base}/answers/${x.slug}/`, lastModified: UPDATED_ISO, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/privacy/`, lastModified: updated, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/cookies/`, lastModified: updated, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/demo-terms/`, lastModified: updated, changeFrequency: "yearly", priority: 0.2 },
  ];
}
