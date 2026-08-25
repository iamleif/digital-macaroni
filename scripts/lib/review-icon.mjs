import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

function iconCandidates(html, pageUrl) {
  const candidates = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "";
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href || !/(?:^|\s)(?:apple-touch-icon|icon|shortcut icon)(?:\s|$)/i.test(rel)) continue;
    try {
      candidates.push({
        url: new URL(href, pageUrl).href,
        priority: /apple-touch-icon/i.test(rel) ? 3 : /32x32|64x64|128x128|192x192|256x256|512x512/i.test(tag) ? 2 : 1,
      });
    } catch {
      // Ignore malformed icon URLs from third-party page scripts.
    }
  }
  return candidates.sort((left, right) => right.priority - left.priority).map((item) => item.url);
}

function extensionFor(contentType, sourceUrl) {
  if (contentType.includes("svg") || /\.svg(?:\?|$)/i.test(sourceUrl)) return "svg";
  if (contentType.includes("png") || /\.png(?:\?|$)/i.test(sourceUrl)) return "png";
  if (contentType.includes("webp") || /\.webp(?:\?|$)/i.test(sourceUrl)) return "webp";
  if (contentType.includes("jpeg") || /\.jpe?g(?:\?|$)/i.test(sourceUrl)) return "jpg";
  return "ico";
}

export async function ensureReviewIcon({ root, slug }) {
  const reviewPath = path.join(root, "content", "reviews", `${slug}.mdx`);
  const source = fs.readFileSync(reviewPath, "utf8");
  const { data } = matter(source);

  if (!data.productUrl) throw new Error(`${slug}: productUrl is required before an icon can be fetched`);

  const existingIconPath = typeof data.logoUrl === "string" && data.logoUrl.startsWith("/product-icons/")
    ? path.join(root, "public", data.logoUrl.slice(1))
    : null;
  const existingIcon = existingIconPath && fs.existsSync(existingIconPath) && fs.statSync(existingIconPath).size >= 64
    ? { logoUrl: data.logoUrl, sourceUrl: null, created: false }
    : null;

  const page = await fetch(data.productUrl, { redirect: "follow" });
  if (!page.ok) {
    if (existingIcon) return existingIcon;
    throw new Error(`${slug}: product page returned ${page.status}`);
  }
  const html = await page.text();
  const candidates = [...iconCandidates(html, page.url), new URL("/favicon.ico", page.url).href];

  let selected;
  for (const candidate of [...new Set(candidates)]) {
    const response = await fetch(candidate, { redirect: "follow" });
    if (!response.ok) continue;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/") && !/\.svg(?:\?|$)/i.test(candidate)) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 64) continue;
    selected = { sourceUrl: response.url, contentType, bytes };
    break;
  }

  if (!selected) {
    if (existingIcon) return existingIcon;
    throw new Error(`${slug}: no usable icon found on ${page.url}`);
  }

  const extension = extensionFor(selected.contentType, selected.sourceUrl);
  const iconDirectory = path.join(root, "public", "product-icons");
  fs.mkdirSync(iconDirectory, { recursive: true });
  const fileName = `${slug}.${extension}`;
  fs.writeFileSync(path.join(iconDirectory, fileName), selected.bytes);

  const logoUrl = `/product-icons/${fileName}`;
  const updatedSource = data.logoUrl
    ? source.replace(/^(logoUrl:\s*)[^\n]+$/m, `$1"${logoUrl}"`)
    : source.replace(/^(productUrl:\s*[^\n]+)$/m, `$1\nlogoUrl: "${logoUrl}"`);
  if (updatedSource !== source) fs.writeFileSync(reviewPath, updatedSource);

  return { logoUrl, sourceUrl: selected.sourceUrl, created: updatedSource !== source };
}
