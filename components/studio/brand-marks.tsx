import type { BrandId } from "./live/types";
import h from "./home.module.css";

/** Logo marks for the fictional demo businesses. Shared by the homepage cards and, later, the demo pages. */
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
  if (id === "lawfirm") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="7" fill="#1f3459" />
    <path d="M12 5.5v11M8.5 18h7M6.5 8h11" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M6.5 8 4.6 12.2h3.8L6.5 8Zm11 0-1.9 4.2h3.8L17.5 8Z" fill="#f5c542" />
  </svg>;
  if (id === "formfield") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#4f6a4a" />
    <path d="M12 18.5c-3.6-1.2-5.5-4-5.5-8.2 3.4.2 5.5 2.4 5.5 5.6 0-3.2 2.1-5.4 5.5-5.6 0 4.2-1.9 7-5.5 8.2Z" fill="#e9efe2" />
    <path d="M12 15.8V8" stroke="#e9efe2" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
  if (id === "hotels") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="ps-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b8a70" /><stop offset="1" stopColor="#135a47" /></linearGradient></defs>
    <rect width="24" height="24" rx="7" fill="url(#ps-g)" />
    <path d="M12 13.4 5.3 11.3M12 13.4 6.9 8.1M12 13.4 9.5 6.3M12 13.4V5.8M12 13.4l2.5-7.1M12 13.4l5.1-5.3M12 13.4l6.7-2.1" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" fill="none" />
    <path d="M12 13.4c.2 2.2-.3 4-1.3 5.4" stroke="#f3c766" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </svg>;
  if (id === "realestate") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="jr-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d7d63" /><stop offset="1" stopColor="#24503f" /></linearGradient></defs>
    <rect width="24" height="24" rx="7" fill="url(#jr-g)" />
    <path d="M5.2 12.2 12 6.4l6.8 5.8M7.4 10.6v7.4h9.2v-7.4" stroke="#fff" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="11" cy="14.6" r="1.25" fill="#9fc4e8" /><circle cx="13.4" cy="14" r="1.25" fill="#9fc4e8" /><circle cx="12.4" cy="16.2" r="1.25" fill="#9fc4e8" />
  </svg>;
  if (id === "insurance") return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="bb-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f86d6" /><stop offset="1" stopColor="#1f5596" /></linearGradient></defs>
    <rect width="24" height="24" rx="7" fill="url(#bb-g)" />
    <path d="M5 15.6c3 .4 5.4-.6 6.6-3.3.9-2 2.3-3.4 4.3-3.4 1.3 0 2.2.6 2.7 1.6-1 .3-1.6.9-1.8 1.9-.6 3.3-3.4 5.2-7.4 5.2-2 0-3.5-.7-4.4-2Z" fill="#fff" />
    <path d="M18.6 10.5 20.2 11l-1.7.6" fill="#f5c542" stroke="#f5c542" strokeWidth=".6" strokeLinejoin="round" />
    <path d="M9.4 13.2c1.3.1 2.5-.3 3.4-1.3" stroke="#3f86d6" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    <circle cx="16.3" cy="10.6" r=".7" fill="#1f5596" />
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
  lawfirm: { text: "Alder & Finch", className: h.wmLawfirm },
  hotels: { text: "Palmetto Stays", className: h.wmPalmetto },
  realestate: { text: "Juniper Row", className: h.wmJuniper },
  insurance: { text: "Bluebird", className: h.wmBluebird },
  lune: { text: "lune", className: h.wmLune },
  tidewell: { text: "Tidewell", className: h.wmTidewell },
};

export function BrandLockup({ id }: { id: BrandId }) {
  const w = WORDMARK[id];
  return <span className={h.lockup}><BrandMark id={id} /><span className={w.className}>{w.text}</span></span>;
}


/** Marks for the kinds of business on the first setup step, one look each. Kinds with a demo brand reuse it. */
export type KindId = "insurance" | "realestate" | "dealership" | "furniture" | "hotels";
const KIND_MARKS: Record<KindId, { bg: string; glyph: string }> = {
  insurance: { bg: "#2f6f8f", glyph: "M12 5 18 7.5v4.2c0 3.4-2.4 5.9-6 7.3-3.6-1.4-6-3.9-6-7.3V7.5L12 5ZM9.5 12l1.8 1.8 3.3-3.6" },
  realestate: { bg: "#b5503a", glyph: "M5.5 11.5 12 6l6.5 5.5M7 10.5V18h10v-7.5M10.5 18v-4h3v4" },
  dealership: { bg: "#3a4a63", glyph: "M5 14.5V12l1.6-3.6A1.5 1.5 0 0 1 8 7.5h8a1.5 1.5 0 0 1 1.4.9L19 12v2.5M5 14.5h14M5 14.5v2h2.2v-2M16.8 14.5v2H19v-2M7.5 12h9" },
  furniture: { bg: "#8a6a3f", glyph: "M6 11V9.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V11M4.5 12.5a1.5 1.5 0 0 1 3 0V14h9v-1.5a1.5 1.5 0 0 1 3 0V16.5h-15v-4ZM7 16.5v1.5M17 16.5v1.5" },
  hotels: { bg: "#4a4f9c", glyph: "M5 17.5V7.5M5 14h14v3.5M19 14v-2.2a2 2 0 0 0-2-2h-6V14M7.8 11.6h.01" },
};
export function KindMark({ id, size = 22 }: { id: KindId; size?: number }) {
  const m = KIND_MARKS[id];
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect width="24" height="24" rx="7" fill={m.bg} />
    <path d={m.glyph} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>;
}
