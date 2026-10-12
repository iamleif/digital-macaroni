import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoPage } from "@/components/studio/demo/demo-page";
import { JsonLd, ORG_REF, SITE, breadcrumbs, pageMeta, webPage } from "@/components/studio/site";
import { voiceDemos } from "@/components/studio/live/demo-info";
import type { DemoId } from "@/components/studio/live/types";
import shop from "../../../voice/app/demos/formfield/data/shop.json";
import catalogue from "../../../voice/app/demos/formfield/data/catalogue.json";

// One live demo page per fictional business, opened from the homepage cards.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(voiceDemos).map((demo) => ({ demo }));
}

export async function generateMetadata({ params }: { params: Promise<{ demo: string }> }): Promise<Metadata> {
  const { demo: id } = await params;
  const demo = voiceDemos[id as DemoId];
  if (!demo) return {};
  return pageMeta({
    title: `${demo.job} · Live AI voice agent demo · Digital Macaroni`,
    shareTitle: `${demo.job}: call a live AI voice agent demo · Digital Macaroni`,
    description: demo.seoDescription ?? demo.intro,
    path: `/demo/${id}/`,
    ownImage: true,
  });
}

/** Form & Field's catalogue as schema.org products: one Product per item, one Offer per option with its stock. */
function shopSchema(url: string) {
  // Fictional business: no address, reviews or ratings. The description says so.
  const seller = { "@type": "Organization", "@id": `${url}#shop`, name: shop.name, description: `${shop.what} (A fictional demo business with sample data.)` };
  const products = catalogue.products.map((p) => ({
    "@type": "Product",
    "@id": `${url}#product-${p.id}`,
    sku: p.id,
    name: p.name,
    description: p.description,
    image: `${SITE}/studio/products/${p.id}.jpg`,
    url: `${url}#product-${p.id}`,
    category: p.category,
    material: p.materials,
    size: p.size,
    color: p.colors.slice(0, 3),
    brand: { "@type": "Brand", name: shop.name },
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      sku: v.id,
      name: `${p.name}, ${v.option}`,
      price: p.price.toFixed(2),
      priceCurrency: "USD",
      itemCondition: "https://schema.org/NewCondition",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      inventoryLevel: { "@type": "QuantitativeValue", value: v.stock },
      seller: { "@id": `${url}#shop` },
    })),
  }));
  return [
    { "@context": "https://schema.org", ...seller },
    { "@context": "https://schema.org", "@type": "ItemList", name: `${shop.name} catalogue (sample products)`, numberOfItems: products.length, itemListElement: products.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) },
  ];
}

export default async function LiveDemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const demo = voiceDemos[(await params).demo as DemoId];
  if (!demo) notFound();
  const url = `${SITE}/demo/${demo.id}/`;
  return <>
    <JsonLd data={[
      webPage({
        url,
        name: `${demo.job}: live AI voice agent demo`,
        description: demo.intro,
        extra: { primaryImageOfPage: { "@type": "ImageObject", url: `${url}opengraph-image` }, about: { "@id": `${url}#agent` } },
      }),
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${url}#agent`,
        name: `Example AI voice agent: ${demo.job.toLowerCase()}`,
        description: `An example AI voice agent built by Digital Macaroni for a fictional business (${demo.role.toLowerCase()}). Call it from any phone and watch it work on screen.`,
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any phone",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        creator: ORG_REF,
      },
      breadcrumbs(["Voice demos", `${SITE}/#agents`], [demo.name, url]),
      ...(demo.id === "formfield" ? shopSchema(url) : []),
    ]} />
    <DemoPage demo={demo} />
  </>;
}
