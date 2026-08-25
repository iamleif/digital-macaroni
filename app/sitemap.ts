import type { MetadataRoute } from "next";
import { getAllContent } from "@/lib/content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://digitalmacaroni.io";
  const staticRoutes = ["", "/reviews", "/how-it-works", "/submit", "/about", "/privacy", "/llm-info"].map((route) => ({
    url: `${base}${route}`,
    changeFrequency: route === "" || route === "/reviews" ? "weekly" as const : "monthly" as const,
    priority: route === "" ? 1 : route === "/reviews" ? 0.9 : 0.6,
  }));
  const reviews = getAllContent("review").map((item) => ({
    url: `${base}/reviews/${item.slug}`,
    lastModified: new Date(`${item.date}T12:00:00Z`),
    changeFrequency: "monthly" as const,
    priority: 0.8,
    images: [`${base}/reviews/${item.slug}/og-image`],
  }));
  return [...staticRoutes, ...reviews];
}
