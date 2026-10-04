import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://digitalmacaroni.io"),
  title: {
    default: "Digital Macaroni — Digital studio",
    template: "%s — Digital Macaroni",
  },
  description:
    "Digital Macaroni is an independent digital studio creating software, brands, websites, and other useful things.",
  creator: "Digital Macaroni",
  publisher: "Digital Macaroni",
  openGraph: {
    title: "Digital Macaroni",
    description:
      "An independent digital studio creating software, brands, websites, and other useful things.",
    type: "website",
    url: "https://digitalmacaroni.io",
    siteName: "Digital Macaroni",
  },
  twitter: {
    card: "summary",
    title: "Digital Macaroni",
    description:
      "An independent digital studio creating software, brands, websites, and other useful things.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
