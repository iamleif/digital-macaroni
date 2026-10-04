import type { ReactNode } from "react";
import h from "./home.module.css";

/**
 * Rises into place as it scrolls into view, driven by CSS scroll timelines. Browsers without them,
 * and visitors who prefer reduced motion, simply see the content.
 */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "article" }) {
  return <Tag className={`${h.reveal} ${className}`} style={delay ? { ["--reveal-offset" as string]: `${Math.round(delay / 15)}%` } : undefined}>{children}</Tag>;
}

/** Plays its entrance once on load: for content that starts in view. */
export function Intro({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`${h.intro} ${className}`} style={delay ? { ["--intro-delay" as string]: `${delay}ms` } : undefined}>{children}</div>;
}
