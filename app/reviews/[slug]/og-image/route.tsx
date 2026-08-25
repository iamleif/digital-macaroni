import { ImageResponse } from "next/og";
import { getAllContent, getContentBySlug } from "@/lib/content";

export const dynamic = "force-static";

export function generateStaticParams() {
  const params = getAllContent("review").map(({ slug }) => ({ slug }));
  return params.length > 0 ? params : [{ slug: "__placeholder__" }];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const review = getContentBySlug("review", slug);

  if (!review) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px",
          background: "#fff7e6",
          color: "#191815",
          border: "12px solid #191815",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 700 }}>
          <span>Digital Macaroni</span>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{review.category}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 50 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <span style={{ fontSize: 30, fontWeight: 700, marginBottom: 22 }}>{review.company}</span>
            <span style={{ fontSize: 68, lineHeight: 0.98, letterSpacing: "-0.055em", fontWeight: 700 }}>
              {review.cardVerdict}
            </span>
          </div>
          <div
            style={{
              width: 235,
              height: 235,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 28,
              background: "#ef4f2f",
              color: "#fff7e6",
              border: "5px solid #191815",
              boxShadow: "12px 12px 0 #191815",
            }}
          >
            <span style={{ fontSize: 18, textTransform: "uppercase" }}>Our score</span>
            <strong style={{ fontSize: 96, lineHeight: 0.8, letterSpacing: "-0.08em" }}>{review.score?.toFixed(1)}</strong>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
