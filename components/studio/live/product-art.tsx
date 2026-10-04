import type { ReactNode } from "react";

const SWATCHES: [RegExp, string][] = [
  [/moss/i, "#6f8a4c"], [/sage/i, "#a3b394"], [/oat/i, "#e2d3b6"], [/charcoal/i, "#4b4a47"], [/brass/i, "#c8a35f"], [/black/i, "#2d2c2a"],
  [/white/i, "#f3efe6"], [/sand/i, "#dcc9a6"], [/ink/i, "#3c4a69"], [/olive/i, "#7f804f"], [/natural/i, "#e5dac4"], [/rust/i, "#b0633b"],
  [/oak/i, "#c79f69"], [/walnut/i, "#6c4b34"], [/clay/i, "#b8775b"],
];
export const swatch = (option: string) => SWATCHES.find(([re]) => re.test(option))?.[1] ?? "#d9cfbd";

/** Simple drawings of each catalogue item, tinted with the option shown. */
export function ProductArt({ id, color }: { id: string; color: string }) {
  const line = "#3b3a35";
  const art: Record<string, ReactNode> = {
    "ridge-lamp": <><path d="M19 12h22l5 15H14z" fill="#f4eee2" stroke={line} strokeWidth="1.2" /><rect x="22" y="27" width="16" height="20" rx="7" fill={color} stroke={line} strokeWidth="1.2" /><path d="M26 30v14M30 30v14M34 30v14" stroke={line} strokeOpacity=".25" /><path d="M20 50h20" stroke={line} strokeWidth="1.2" /></>,
    "moss-lamp": <><path d="M20 11h20l4 13H16z" fill="#f4eee2" stroke={line} strokeWidth="1.2" /><circle cx="30" cy="37" r="11" fill={color} fillOpacity=".85" stroke={line} strokeWidth="1.2" /><path d="M30 24v2" stroke={line} /><path d="M22 50h16" stroke={line} strokeWidth="1.2" /></>,
    "arc-floor-lamp": <><path d="M16 52V22c0-9 8-14 20-12" fill="none" stroke={color} strokeWidth="2.4" /><path d="M31 10c6-1 12 2 13 9H29c0-5 1-8 2-9z" fill={color} stroke={line} strokeWidth="1.2" /><ellipse cx="16" cy="52" rx="7" ry="2.5" fill="#d8d3c8" stroke={line} strokeWidth="1.2" /></>,
    "pleat-pendant": <><path d="M30 4v14" stroke={line} /><path d="M14 38c0-11 7-19 16-19s16 8 16 19z" fill={color} stroke={line} strokeWidth="1.2" /><path d="M22 38l3-18M30 38V19M38 38l-3-18" stroke={line} strokeOpacity=".25" /></>,
    "everyday-mugs": <><rect x="11" y="22" width="17" height="22" rx="4" fill={color} stroke={line} strokeWidth="1.2" /><path d="M28 27h3a4 4 0 0 1 0 9h-3" fill="none" stroke={line} strokeWidth="1.2" /><rect x="31" y="26" width="16" height="20" rx="4" fill={color} fillOpacity=".75" stroke={line} strokeWidth="1.2" /><path d="M47 30h3a4 4 0 0 1 0 8h-3" fill="none" stroke={line} strokeWidth="1.2" /></>,
    "linen-throw": <><path d="M12 20h36v10H12z" fill={color} stroke={line} strokeWidth="1.2" /><path d="M12 30h36v12H12z" fill={color} fillOpacity=".8" stroke={line} strokeWidth="1.2" /><path d="M14 42v4M18 42v4M22 42v4M26 42v4M30 42v4M34 42v4M38 42v4M42 42v4M46 42v4" stroke={line} strokeOpacity=".5" /></>,
    "fold-side-table": <><path d="M14 20h32v5H14z" fill={color} stroke={line} strokeWidth="1.2" /><path d="M14 20v-3M46 20v-3" stroke={line} strokeWidth="1.2" /><path d="M18 25l-2 25M42 25l2 25M24 25v22M36 25v22" stroke={color} strokeWidth="2.4" /></>,
    "field-planter": <><path d="M30 26c-6-10-14-9-14-9s2 9 14 9zM30 26c4-12 13-13 13-13s0 11-13 13z" fill="#7d9b6a" stroke={line} strokeWidth="1" /><path d="M17 27h26l-4 21H21z" fill={color} stroke={line} strokeWidth="1.2" /><path d="M15 48h30" stroke={line} strokeWidth="1.2" /></>,
  };
  return <svg viewBox="0 0 60 60" aria-hidden="true">{art[id] ?? <rect x="15" y="15" width="30" height="30" rx="6" fill={color} />}</svg>;
}
