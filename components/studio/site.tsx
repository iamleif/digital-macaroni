import type { Metadata } from "next";

/** One place for who we are: page metadata and the structured data on every page read from here. */
export const SITE = "https://digitalmacaroni.io";
export const NAME = "Digital Macaroni";
export const TAGLINE = "AI agents that take action inside real business workflows.";
export const DESCRIPTION =
  "Digital Macaroni builds AI agents that take action inside real business workflows: voice agents, software and automations that turn conversations into completed work.";
export const COMPANY_LINKEDIN = "https://www.linkedin.com/company/digitalmacaroni/";
export const FOUNDER = {
  name: "Leif Johansen",
  role: "Founder",
  linkedin: "https://www.linkedin.com/in/iamleifjohansen/",
};

const ORG_ID = `${SITE}/#organization`;
const FOUNDER_ID = `${SITE}/#founder`;
export const ORG_REF = { "@id": ORG_ID };
export const FOUNDER_REF = { "@id": FOUNDER_ID };

/** Title, description, canonical URL and link previews for one page. Previews use the page's own title and URL. */
export function pageMeta({ title, description, path, shareTitle, type = "website", published, ownImage = false }: {
  title: string;
  description: string;
  path: string;
  /** Shorter title for link previews when the page title carries the brand. */
  shareTitle?: string;
  type?: "website" | "article";
  published?: string;
  /** The page has its own opengraph-image route next to it. */
  ownImage?: boolean;
}): Metadata {
  const share = shareTitle ?? title;
  // A page's own card when it has one, otherwise the site-wide card.
  const images = [{ url: ownImage ? `${path}opengraph-image` : "/opengraph-image", width: 1200, height: 630, alt: ownImage ? share : `${NAME}: AI agents that take action inside real business workflows`, type: "image/png" }];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title: share,
      description,
      url: path,
      siteName: NAME,
      locale: "en_US",
      images,
      ...(type === "article"
        ? { type: "article", publishedTime: published, modifiedTime: published, authors: [FOUNDER.linkedin] }
        : { type: "website" }),
    },
    twitter: { card: "summary_large_image", title: share, description, images },
  };
}

/** The business, its founder and the website, linked by @id so every page describes the same entities. */
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: NAME,
      url: `${SITE}/`,
      logo: { "@type": "ImageObject", url: `${SITE}/icon.png`, width: 512, height: 512 },
      image: `${SITE}/opengraph-image`,
      description: DESCRIPTION,
      slogan: TAGLINE,
      foundingDate: "2024-06",
      founder: FOUNDER_REF,
      sameAs: [COMPANY_LINKEDIN],
      contactPoint: { "@type": "ContactPoint", contactType: "sales", url: `${SITE}/contact/`, availableLanguage: "English" },
      knowsAbout: ["AI agents", "AI voice agents", "Workflow automation", "System integrations", "Business software", "Conversational AI"],
      makesOffer: [
        {
          "@type": "Offer",
          name: "Ready-made AI voice agent",
          description: "A proven inbound phone agent, rebuilt for your business: answers every call, books appointments, answers questions, takes messages and transfers urgent calls.",
          price: 2500,
          priceCurrency: "USD",
          url: `${SITE}/#pricing`,
          itemOffered: { "@type": "Service", serviceType: "AI voice agent", name: "Ready-made AI voice agent", provider: ORG_REF },
        },
        {
          "@type": "Offer",
          name: "Custom AI voice agent",
          description: "An AI voice agent designed around your business and connected to the tools you already use through their APIs.",
          priceSpecification: { "@type": "PriceSpecification", minPrice: 5000, priceCurrency: "USD" },
          url: `${SITE}/#pricing`,
          itemOffered: { "@type": "Service", serviceType: "AI voice agent", name: "Custom AI voice agent", provider: ORG_REF },
        },
      ],
      owns: [
        { "@type": "Product", name: "RankLadder", url: "https://rankladder.app", description: "Customer conversations and front-office tools for local businesses." },
        { "@type": "Product", name: "Hey Anders", url: "https://heyanders.com", description: "An AI assistant and workspace for appointment-based practices." },
        { "@type": "Product", name: "TwoTop", url: "https://twotop.app", description: "Hospitality scheduling, communication and team operations." },
      ],
    },
    {
      "@type": "Person",
      "@id": FOUNDER_ID,
      name: FOUNDER.name,
      jobTitle: FOUNDER.role,
      worksFor: ORG_REF,
      sameAs: [FOUNDER.linkedin],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: NAME,
      url: `${SITE}/`,
      description: DESCRIPTION,
      publisher: ORG_REF,
      inLanguage: "en",
    },
  ],
};

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
