export function StructuredData({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
