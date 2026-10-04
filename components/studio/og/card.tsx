import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Link-preview cards (1200×630) in the site's look: the grey page, the white sheet with its soft
 * blue and peach light, Geist type, and the dark "on a call" card from the homepage hero.
 * Rendered at build time by the opengraph-image routes.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const dir = join(process.cwd(), "components/studio/og/fonts");
const assets = Promise.all([
  readFile(join(dir, "Geist-Medium.ttf")),
  readFile(join(dir, "Geist-SemiBold.ttf")),
  readFile(join(dir, "GeistMono-Medium.ttf")),
  readFile(join(process.cwd(), "public/studio/macaroni.png")),
]);

const INK = "#0f0f0d";
const MUTED = "#74726b";
const BARS = [10, 18, 30, 22, 40, 28, 52, 34, 46, 26, 58, 38, 30, 48, 24, 36, 18, 28, 14, 20, 10];

export type OgAgent = { name: string; business: string; line: string; lineLabel: string; status: string };

export async function ogCard({ kicker, title, sub, agent, chip, footer }: {
  kicker?: string;
  title: string;
  sub?: string;
  /** The dark call card on the right. Leave out for text-only cards. */
  agent?: OgAgent;
  /** Put the yellow wave chip after the first line, like the homepage headline. */
  chip?: { before: string; after: string };
  footer?: string;
}) {
  const [medium, semibold, mono, logo] = await assets;
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const wide = !agent;
  const size = wide ? (title.length > 60 ? 62 : 70) : title.length > 44 ? 56 : 68;

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#e9e8e3", padding: 18, fontFamily: "Geist" }}>
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%",
        borderRadius: 36, padding: "48px 56px", color: INK,
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(60% 70% at 0% 0%, rgba(186, 214, 255, 0.55), rgba(255,255,255,0) 100%), radial-gradient(55% 70% at 100% 0%, rgba(255, 214, 170, 0.55), rgba(255,255,255,0) 100%)",
      }}>
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={logoSrc} width={44} height={44} style={{ transform: "rotate(-8deg)" }} />
            <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>Digital Macaroni</span>
          </div>
          <span style={{ fontSize: 22, color: MUTED }}>digitalmacaroni.io</span>
        </div>

        {/* Body */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", width: wide ? 1000 : 640 }}>
            {kicker ? <span style={{ fontFamily: "Geist Mono", fontSize: 19, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a6a0c", marginBottom: 18 }}>{kicker}</span> : null}
            {chip ? (
              <div style={{ display: "flex", flexDirection: "column", fontSize: size, fontWeight: 500, letterSpacing: "-0.05em", lineHeight: 1.02 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span>{chip.before}</span>
                  <WaveChip size={Math.round(size * 0.86)} />
                </div>
                <span>{chip.after}</span>
              </div>
            ) : (
              <span style={{ fontSize: size, fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1.06 }}>{title}</span>
            )}
            {sub ? <span style={{ fontSize: 26, lineHeight: 1.4, color: "#3b3a36", marginTop: 24, maxWidth: wide ? 900 : 600 }}>{sub}</span> : null}
          </div>
          {agent ? <CallCard agent={agent} /> : null}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 21, color: MUTED }}>
          <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, background: "#22a06b" }} />
          <span>{footer ?? "Three live AI voice agents · call one from any phone"}</span>
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: medium, weight: 500, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}

function WaveChip({ size }: { size: number }) {
  return <div style={{
    display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: size * 0.3,
    backgroundImage: "linear-gradient(160deg, #ffd95e, #f2b71c)", boxShadow: "0 10px 22px -8px rgba(242, 183, 28, 0.8)",
  }}>
    <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="#3a2a00" strokeWidth={2} strokeLinecap="round">
      <path d="M3 12h1.5M7 8v8M10.5 5v14M14 9v6M17.5 7v10M21 12h-.5" />
    </svg>
  </div>;
}

function CallCard({ agent }: { agent: OgAgent }) {
  return <div style={{
    display: "flex", flexDirection: "column", width: 380, padding: 28, borderRadius: 30, background: "#11110f", color: "#f4f2ec",
    boxShadow: "0 30px 60px -24px rgba(15, 15, 13, 0.55)", transform: "rotate(2deg)",
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 48, backgroundImage: "linear-gradient(160deg, #ffd95e, #f2b71c)", color: "#3a2a00", fontSize: 24, fontWeight: 600 }}>{agent.name[0]}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 24, fontWeight: 600 }}>{agent.name}</span>
          <span style={{ fontSize: 17, color: "#a8a59c" }}>{agent.business}</span>
        </div>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 70, marginTop: 22 }}>
      {BARS.map((h, i) => <div key={i} style={{ display: "flex", width: 8, height: h, borderRadius: 8, backgroundImage: "linear-gradient(180deg, #ffd95e, #f2b71c)" }} />)}
    </div>
    <span style={{ fontFamily: "Geist Mono", fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a8a59c", marginTop: 20 }}>{agent.lineLabel}</span>
    <span style={{ fontSize: 22, lineHeight: 1.4, marginTop: 8 }}>“{agent.line}”</span>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22, fontSize: 17, color: "#d7f5e6" }}>
      <div style={{ display: "flex", width: 9, height: 9, borderRadius: 9, background: "#3ddc97" }} />
      <span>{agent.status}</span>
    </div>
  </div>;
}
