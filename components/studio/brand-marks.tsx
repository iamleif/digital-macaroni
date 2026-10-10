import type { BrandId } from "./live/types";
import h from "./home.module.css";

/** Logo marks for the three fictional demo businesses. Shared by the homepage cards and, later, the demo pages. */
export function BrandMark({ id, size = 22 }: { id: BrandId; size?: number }) {
  if (id === "lune") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="ln-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c9739a" /><stop offset="1" stopColor="#7a3b66" /></linearGradient></defs>
    <circle cx="12" cy="12" r="12" fill="url(#ln-g)" />
    <path d="M14.6 6.2a6.2 6.2 0 1 0 3.4 10.9 5 5 0 1 1-3.4-10.9Z" fill="#fdeef4" />
  </svg>;
  if (id === "tidewell") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="tw-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3fb3ad" /><stop offset="1" stopColor="#1f7a78" /></linearGradient></defs>
    <rect width="24" height="24" rx="7" fill="url(#tw-g)" />
    <path d="M5 13.5c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6M5 17c1.6 0 1.6-1.6 3.2-1.6s1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <circle cx="12" cy="7.5" r="1.8" fill="#fff" />
  </svg>;
  if (id === "northline") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="nl-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b93e6" /><stop offset="1" stopColor="#2a5aa8" /></linearGradient></defs>
    <rect width="24" height="24" rx="7" fill="url(#nl-g)" />
    <path d="M12 5.5 17 17l-5-2.6L7 17l5-11.5Z" fill="#fff" />
  </svg>;
  if (id === "formfield") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#4f6a4a" />
    <path d="M12 18.5c-3.6-1.2-5.5-4-5.5-8.2 3.4.2 5.5 2.4 5.5 5.6 0-3.2 2.1-5.4 5.5-5.6 0 4.2-1.9 7-5.5 8.2Z" fill="#e9efe2" />
    <path d="M12 15.8V8" stroke="#e9efe2" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="wp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e8a65a" /><stop offset="1" stopColor="#b26f2a" /></linearGradient></defs>
    <rect width="24" height="24" rx="7" fill="url(#wp-g)" />
    <path d="M12 3.5c.9 0 1.5.9 1.5 2V10l6 3.5v1.8l-6-1.8v4l1.8 1.3v1.7l-3.3-.9-3.3.9v-1.7l1.8-1.3v-4l-6 1.8v-1.8l6-3.5V5.5c0-1.1.6-2 1.5-2Z" fill="#fff" transform="rotate(45 12 12) translate(1.8 1.8) scale(0.85)" />
  </svg>;
}

const WORDMARK: Record<BrandId, { text: string; className: string }> = {
  northline: { text: "Northline", className: h.wmNorthline },
  formfield: { text: "Form & Field", className: h.wmFormfield },
  travel: { text: "Waypoint", className: h.wmWaypoint },
  lune: { text: "lune", className: h.wmLune },
  tidewell: { text: "Tidewell", className: h.wmTidewell },
};

export function BrandLockup({ id }: { id: BrandId }) {
  const w = WORDMARK[id];
  return <span className={h.lockup}><BrandMark id={id} /><span className={w.className}>{w.text}</span></span>;
}
