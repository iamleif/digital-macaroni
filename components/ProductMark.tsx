const marks: Record<string, string> = {
  linear: "L",
  openphone: "O",
};

export function ProductMark({
  slug,
  name,
  logoUrl,
  large = false,
  linkTo,
}: {
  slug: string;
  name: string;
  logoUrl?: string;
  large?: boolean;
  linkTo?: string;
}) {
  const mark = (
    <span
      className={`product-mark product-mark-${slug}${logoUrl ? " product-mark-logo" : ""}${large ? " product-mark-large" : ""}`}
      aria-hidden="true"
    >
      {logoUrl ? <img src={logoUrl} alt="" /> : marks[slug] ?? name.charAt(0)}
    </span>
  );

  if (!linkTo) return mark;

  return (
    <a className="product-mark-link" href={linkTo} target="_blank" rel="noreferrer" aria-label={`Visit ${name}'s website`}>
      {mark}
    </a>
  );
}
