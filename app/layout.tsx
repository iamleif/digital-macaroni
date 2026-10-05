import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { CookieBanner } from "@/components/studio/consent";
import { DESCRIPTION, FOUNDER, JsonLd, NAME, SITE, siteGraph } from "@/components/studio/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Digital Macaroni — AI voice agents and software that get to work",
    template: "%s — Digital Macaroni",
  },
  description: DESCRIPTION,
  applicationName: NAME,
  authors: [{ name: FOUNDER.name, url: FOUNDER.linkedin }],
  creator: FOUNDER.name,
  publisher: NAME,
  openGraph: { siteName: NAME, locale: "en_US", type: "website" },
  twitter: { card: "summary_large_image" },
  // Bing Webmaster Tools ownership. Google Search Console is verified on the domain (DNS).
  verification: { other: { "msvalidate.01": "F464D8695CB460649309E60978C4AB66" } },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
        <JsonLd data={siteGraph} />
        <CookieBanner />
      </body>
    </html>
  );
}
