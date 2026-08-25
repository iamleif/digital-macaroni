import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";

export type ContentType = "review" | "story";
export type ContentStatus = "draft" | "published";
export type ReviewType = "hands-on" | "research-based" | "legacy-editorial";

export type ContentSource = {
  name: string;
  url: string;
  accessed: string;
};

export type ContentMeta = {
  slug: string;
  type: ContentType;
  title: string;
  description: string;
  date: string;
  author: string;
  status: ContentStatus;
  publishAt?: string;
  category: string;
  featured: boolean;
  readingTime: number;
  company?: string;
  score?: number;
  verdict?: string;
  cardVerdict?: string;
  productUrl?: string;
  logoUrl?: string;
  schemaCategory?: string;
  scores?: Record<string, number>;
  reviewType?: ReviewType;
  testingDisclosure?: string;
  editorialRunId?: number;
  approvedBodySha256?: string;
  sources: ContentSource[];
  legacyResearch: boolean;
};

export type ContentEntry = ContentMeta & { body: string };

const folders: Record<ContentType, string> = {
  review: "reviews",
  story: "stories",
};

function directoryFor(type: ContentType) {
  return path.join(process.cwd(), "content", folders[type]);
}

function readingTime(body: string) {
  const words = body
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`\[\](){}-]/g, " ")
    .trim()
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 220));
}

function bodySha256(body: string) {
  return crypto
    .createHash("sha256")
    .update(body.replace(/\r\n?/g, "\n").trim(), "utf8")
    .digest("hex");
}

function isPublished(entry: ContentEntry) {
  if (entry.status !== "published") return false;
  if (entry.type === "review") {
    if (!Number.isSafeInteger(entry.editorialRunId) || (entry.editorialRunId ?? 0) <= 0) return false;
    if (!/^[a-f0-9]{64}$/.test(entry.approvedBodySha256 ?? "")) return false;
    if (entry.approvedBodySha256 !== bodySha256(entry.body)) return false;
  }
  if (!entry.publishAt) return true;
  return new Date(entry.publishAt).getTime() <= Date.now();
}

export function getContentBySlug(
  type: ContentType,
  slug: string,
  options: { includeDrafts?: boolean } = {},
): ContentEntry | null {
  const safeSlug = slug.replace(/[^a-z0-9-]/g, "");
  const filePath = path.join(directoryFor(type), `${safeSlug}.mdx`);

  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(source);

  const entry: ContentEntry = {
    slug: safeSlug,
    type,
    title: data.title,
    description: data.description,
    date: data.date,
    author: data.author ?? "Leif Johansen",
    status: data.status === "published" ? "published" : "draft",
    publishAt: data.publishAt,
    category: data.category,
    featured: Boolean(data.featured),
    company: data.company,
    score: typeof data.score === "number" ? data.score : undefined,
    verdict: data.verdict,
    cardVerdict: data.cardVerdict ?? data.verdict,
    productUrl: data.productUrl,
    logoUrl: data.logoUrl,
    schemaCategory: data.schemaCategory ?? "BusinessApplication",
    scores: data.scores,
    reviewType: data.reviewType,
    testingDisclosure: data.testingDisclosure,
    editorialRunId: typeof data.editorialRunId === "number" ? data.editorialRunId : undefined,
    approvedBodySha256: typeof data.approvedBodySha256 === "string" ? data.approvedBodySha256 : undefined,
    sources: Array.isArray(data.sources) ? data.sources : [],
    legacyResearch: Boolean(data.legacyResearch),
    readingTime: readingTime(content),
    body: content,
  };

  if (!options.includeDrafts && !isPublished(entry)) return null;
  return entry;
}

export function getAllContent(
  type: ContentType,
  options: { includeDrafts?: boolean } = {},
): ContentMeta[] {
  const directory = directoryFor(type);
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => getContentBySlug(type, file.replace(/\.mdx$/, ""), { includeDrafts: true }))
    .filter((entry): entry is ContentEntry => Boolean(entry))
    .filter((entry) => options.includeDrafts || isPublished(entry))
    .map(({ body: _body, ...meta }) => meta)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function formatDate(date: string, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("en-US", {
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
