import { StructuredData } from "./StructuredData";

export function SiteJsonLd() {
  const baseUrl = "https://digitalmacaroni.io";
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        url: `${baseUrl}/`,
        name: "Digital Macaroni",
        alternateName: ["digitalmacaroni.io"],
        description: "Independent software reviews with clear opinions and simple scores.",
        publisher: { "@id": `${baseUrl}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        name: "Digital Macaroni",
        url: `${baseUrl}/`,
        logo: {
          "@type": "ImageObject",
          url: `${baseUrl}/icon.svg`,
        },
        email: "hello@digitalmacaroni.io",
        sameAs: ["https://www.linkedin.com/company/digitalmacaroni/"],
      },
    ],
  };

  return <StructuredData data={data} />;
}
