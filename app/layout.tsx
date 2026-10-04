import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://digitalmacaroni.io"),
  title: {
    default: "Digital Macaroni — AI voice agents and software that get to work",
    template: "%s — Digital Macaroni",
  },
  description:
    "Digital Macaroni designs and builds custom AI voice agents, dashboards and apps for businesses.",
  creator: "Digital Macaroni",
  publisher: "Digital Macaroni",
  openGraph: {
    title: "Digital Macaroni",
    description:
      "Custom AI voice agents, dashboards and apps, designed and built by one studio.",
    type: "website",
    url: "https://digitalmacaroni.io",
    siteName: "Digital Macaroni",
  },
  twitter: {
    card: "summary",
    title: "Digital Macaroni",
    description:
      "Custom AI voice agents, dashboards and apps, designed and built by one studio.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
