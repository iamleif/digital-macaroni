// Thin-line icons for the v2 homepage. One stroke weight, one corner style.
type P = { size?: number };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const ArrowUpRight = ({ size }: P) => <svg {...base(size)}><path d="M7 17 17 7M9 7h8v8" /></svg>;
export const ArrowDown = ({ size }: P) => <svg {...base(size)}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
export const Phone = ({ size }: P) => <svg {...base(size)}><path d="M5 4h3.5l1.8 4.4-2.3 1.4a11 11 0 0 0 5.2 5.2l1.4-2.3L19 14.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>;
export const Mic = ({ size }: P) => <svg {...base(size)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>;
export const Check = ({ size }: P) => <svg {...base(size)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const Wave = ({ size }: P) => <svg {...base(size)}><path d="M3 12h1.5M7 8v8M10.5 5v14M14 9v6M17.5 7v10M21 12h-.5" /></svg>;
export const Grid = ({ size }: P) => <svg {...base(size)}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>;
export const Device = ({ size }: P) => <svg {...base(size)}><rect x="6.5" y="2.5" width="11" height="19" rx="3" /><path d="M10.5 18.5h3" /></svg>;
export const Home = ({ size }: P) => <svg {...base(size)}><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" /><path d="M9.5 20.5V14h5v6.5" /></svg>;
export const Calendar = ({ size }: P) => <svg {...base(size)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const Inbox = ({ size }: P) => <svg {...base(size)}><path d="M3.5 13.5 6 5.5h12l2.5 8V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4.5Z" /><path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5" /></svg>;
export const Users = ({ size }: P) => <svg {...base(size)}><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-2.5-5.1" /></svg>;
export const Settings = ({ size }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>;
export const Search = ({ size }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
export const Sparkle = ({ size }: P) => <svg {...base(size)}><path d="m12 3 2.1 6.1L20 11l-5.9 1.9L12 19l-2.1-6.1L4 11l5.9-1.9L12 3Z" /></svg>;
export const Bolt = ({ size }: P) => <svg {...base(size)}><path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z" /></svg>;
