import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const reviewDirectory = path.join(process.cwd(), "content", "reviews");

function words(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function readability(value) {
  const clean = value
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`\[\](){}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = Math.max(1, (clean.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const tokens = words(clean);
  const syllables = tokens.reduce((total, word) => {
    const candidate = word
      .toLowerCase()
      .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
      .replace(/^y/, "");
    const count = candidate.match(/[aeiouy]{1,2}/g)?.length ?? 1;
    return total + Math.max(1, count);
  }, 0);
  const grade = 0.39 * (tokens.length / sentences) + 11.8 * (syllables / Math.max(1, tokens.length)) - 15.59;
  return {
    grade: Math.max(0, Number(grade.toFixed(1))),
    averageSentenceWords: Number((tokens.length / sentences).toFixed(1)),
  };
}

function fail(context, error) {
  if (!error) return;
  console.error(`${context}: ${error.message}`);
  process.exit(1);
}

let synced = 0;

for (const file of fs.readdirSync(reviewDirectory).filter((name) => name.endsWith(".mdx")).sort()) {
  const slug = file.replace(/\.mdx$/, "");
  const source = fs.readFileSync(path.join(reviewDirectory, file), "utf8");
  const { data, content } = matter(source);
  const reading = readability(content);
  const isPublished = data.status === "published";

  const { data: product, error: productError } = await supabase
    .from("products")
    .update({
      short_description: data.description,
      pipeline_status: isPublished ? "published" : "drafting",
      target_publish_date: isPublished ? data.date : null,
      is_public: isPublished,
    })
    .eq("slug", slug)
    .select("id")
    .single();
  fail(`${slug} product`, productError);

  const articlePayload = {
    product_id: product.id,
    slug,
    title: data.title,
    description: data.description,
    body_mdx: content.trim(),
    verdict: data.verdict,
    card_verdict: data.cardVerdict,
    author_name: data.author,
    status: isPublished ? "published" : "draft",
    review_type: data.reviewType,
    testing_disclosure: data.testingDisclosure,
    featured: Boolean(data.featured),
    published_on: isPublished ? data.date : null,
    updated_on: null,
    publish_at: isPublished ? `${data.date}T00:00:00Z` : null,
    overall_score: data.score,
    readability_grade: reading.grade,
    average_sentence_words: reading.averageSentenceWords,
    validation_report: {
      legacyResearch: Boolean(data.legacyResearch),
      syncedFrom: `content/reviews/${file}`,
      syncedAt: new Date().toISOString(),
    },
  };

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .upsert(articlePayload, { onConflict: "product_id" })
    .select("id")
    .single();
  fail(`${slug} article`, articleError);

  const { error: scoreError } = await supabase.from("article_scores").upsert({
    article_id: article.id,
    onboarding: data.scores.onboarding,
    product: data.scores.product,
    support: data.scores.support,
    billing: data.scores.billing,
  });
  fail(`${slug} scores`, scoreError);

  const { error: citationDeleteError } = await supabase
    .from("article_citations")
    .delete()
    .eq("article_id", article.id);
  fail(`${slug} citation cleanup`, citationDeleteError);

  const citations = (data.sources ?? []).map((item, index) => ({
    article_id: article.id,
    name: item.name,
    url: item.url,
    accessed_on: item.accessed,
    sort_order: index,
  }));
  if (citations.length > 0) {
    const { error: citationError } = await supabase.from("article_citations").insert(citations);
    fail(`${slug} citations`, citationError);
  }

  for (const item of data.sources ?? []) {
    const { error: researchSourceError } = await supabase.from("research_sources").upsert({
      product_id: product.id,
      platform: item.name,
      source_type: "official",
      url: item.url,
      title: item.name,
      accessed_at: `${item.accessed}T12:00:00Z`,
      metadata: { importedFrom: `content/reviews/${file}` },
    }, { onConflict: "product_id,url" });
    fail(`${slug} research source`, researchSourceError);
  }

  const snapshot = { ...articlePayload, scores: data.scores, citations };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const { data: latestVersion, error: versionReadError } = await supabase
    .from("article_versions")
    .select("version_number,snapshot")
    .eq("article_id", article.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(`${slug} version lookup`, versionReadError);

  if (latestVersion?.snapshot?.contentHash !== contentHash) {
    const { error: versionError } = await supabase.from("article_versions").insert({
      article_id: article.id,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      snapshot: { contentHash, article: snapshot },
      change_note: latestVersion ? "Synced updated local review" : "Imported existing local review",
    });
    fail(`${slug} version`, versionError);
  }

  synced += 1;
  console.log(`Synced ${slug}`);
}

console.log(`Synced ${synced} review${synced === 1 ? "" : "s"} to Supabase.`);
import "./lib/legacy-publisher-disabled.mjs";
