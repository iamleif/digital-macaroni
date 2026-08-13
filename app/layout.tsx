import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://digitalmacaroni.io"),
  title: {
    default: "Digital Macaroni — Independent software reviews",
    template: "%s — Digital Macaroni",
  },
  description:
    "Independent software reviews with clear opinions and simple scores.",
  authors: [{ name: "Leif Johansen", url: "https://digitalmacaroni.io/about" }],
  creator: "Leif Johansen",
  publisher: "Digital Macaroni",
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
      "application/feed+json": "/feed.json",
    },
  },
  openGraph: {
    title: "Digital Macaroni",
    description:
      "We use software, say what we think, and give it a score.",
    type: "website",
    url: "https://digitalmacaroni.io",
    siteName: "Digital Macaroni",
  },
  twitter: {
    card: "summary",
    title: "Digital Macaroni",
    description: "Independent software reviews with clear opinions and simple scores.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <div className="site-shell">
          <Header />
          <main id="content">{children}</main>
          <Footer />
        </div>
        <Script src="https://tag.grainql.com/v4/dm-4ao6x2.js" strategy="afterInteractive" />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-VPGKY80HW8" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-VPGKY80HW8');`}
        </Script>
      </body>
    </html>
  );
}
