import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const reviewDirectory = path.join(root, "content", "reviews");
const queuePath = path.join(root, "research", "queue.json");
const startDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);

function weekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function previousPublicationDate(date) {
  const candidate = new Date(`${date}T12:00:00Z`);
  do candidate.setUTCDate(candidate.getUTCDate() - 1);
  while (![2, 5].includes(candidate.getUTCDay()));
  return candidate.toISOString().slice(0, 10);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || ![2, 5].includes(weekday(startDate))) {
  throw new Error("The starting date must be a Tuesday or Friday in YYYY-MM-DD format.");
}

const reviews = fs
  .readdirSync(reviewDirectory)
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => {
    const reviewPath = path.join(reviewDirectory, file);
    const source = fs.readFileSync(reviewPath, "utf8");
    const parsed = matter(source);
    return { slug: file.slice(0, -4), reviewPath, parsed, previousDate: parsed.data.date };
  })
  .sort((left, right) => right.previousDate.localeCompare(left.previousDate) || left.slug.localeCompare(right.slug));

const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const queueBySlug = new Map(queue.map((item) => [item.slug, item]));
let publicationDate = startDate;

for (const review of reviews) {
  review.parsed.data.date = publicationDate;
  review.parsed.data.publishAt = `${publicationDate}T09:00:00Z`;
  delete review.parsed.data.updated;
  fs.writeFileSync(review.reviewPath, matter.stringify(review.parsed.content, review.parsed.data));

  const queueEntry = queueBySlug.get(review.slug);
  if (!queueEntry) throw new Error(`${review.slug} is missing from research/queue.json`);
  queueEntry.date = publicationDate;
  publicationDate = previousPublicationDate(publicationDate);
}

fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(`Scheduled ${reviews.length} reviews from ${startDate} back to ${reviews.at(-1).parsed.data.date}.`);
